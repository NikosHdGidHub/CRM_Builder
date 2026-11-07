-- ============================================================
-- Мини-CRM «Объекты и задачи» — начальная миграция Supabase
-- Применять один раз в Supabase SQL Editor или через migrations.
--
-- Принципы:
--   * роли: manager / executor, взаимоисключающие;
--   * задачи создаются в draft без исполнителя;
--   * отправка фиксирует исполнителя и блокирует содержимое;
--   * все переходы статусов выполняются через RPC;
--   * объекты и задачи удаляются мягко;
--   * история содержит ТОЛЬКО переходы статусов;
--   * клиенту доступны SELECT и специально разрешённые RPC.
-- ============================================================

-- 1. ENUM-типы -------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('manager', 'executor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'draft',
    'new',
    'in_progress',
    'in_review',
    'accepted',
    'revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Таблицы ---------------------------------------------------

-- Профиль создаётся автоматически при создании пользователя в Auth.
-- Новые пользователи по умолчанию получают роль executor.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'executor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  address TEXT NOT NULL CHECK (length(btrim(address)) > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT,
  object_id UUID NOT NULL REFERENCES public.objects(id) ON DELETE RESTRICT,
  executor_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.task_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT tasks_executor_required_after_draft
    CHECK (status = 'draft' OR executor_id IS NOT NULL)
);

-- Безопасный справочник пользователей: доступен всем вошедшим в систему,
-- но не раскрывает email. Нужен для выбора исполнителя и отображения
-- автора перехода в истории. Исходная таблица profiles остаётся под RLS.
CREATE OR REPLACE VIEW public.user_directory
WITH (security_barrier = true)
AS
SELECT id, display_name, role
FROM public.profiles;

CREATE TABLE IF NOT EXISTS public.task_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  from_status public.task_status,
  to_status public.task_status NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_history_initial_status_only_on_creation
    CHECK (from_status IS NOT NULL OR to_status = 'draft')
);

-- 3. Индексы ---------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_objects_deleted_at
  ON public.objects(deleted_at);

CREATE INDEX IF NOT EXISTS idx_tasks_object_status_deleted
  ON public.tasks(object_id, status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_tasks_executor_deleted
  ON public.tasks(executor_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task_created
  ON public.task_status_history(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

-- 4. Автоматическое создание / синхронизация профиля -------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      ''
    ),
    'executor'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = COALESCE(NEW.email, '') WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_update();

-- 5. Вспомогательные функции для RLS ----------------------------
-- SECURITY DEFINER нужен, чтобы проверки не зацикливались на RLS.
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'manager'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_manager()
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.objects o ON o.id = t.object_id
      WHERE t.id = p_task_id
        AND t.executor_id = auth.uid()
        AND t.deleted_at IS NULL
        AND o.deleted_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.executor_has_task_on_object(p_object_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.objects o ON o.id = t.object_id
    WHERE t.object_id = p_object_id
      AND t.executor_id = auth.uid()
      AND t.deleted_at IS NULL
      AND o.deleted_at IS NULL
  );
$$;

-- 6. Триггеры целостности и истории -----------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS objects_set_updated_at ON public.objects;
CREATE TRIGGER objects_set_updated_at
BEFORE UPDATE ON public.objects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  -- Содержимое и исполнитель после отправки изменить нельзя.
  IF OLD.status <> 'draft'::public.task_status THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.object_id IS DISTINCT FROM OLD.object_id
       OR NEW.executor_id IS DISTINCT FROM OLD.executor_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Нельзя редактировать отправленную задачу';
    END IF;
  END IF;

  -- Удалённая задача не может менять статус до восстановления.
  IF OLD.deleted_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Сначала восстановите задачу';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Проверяем допустимую дугу перехода и роль действующего пользователя.
    IF OLD.status = 'draft'::public.task_status
       AND NEW.status = 'new'::public.task_status THEN
      IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Только постановщик может отправить задачу';
      END IF;
      IF NEW.executor_id IS NULL THEN
        RAISE EXCEPTION 'Перед отправкой необходимо назначить исполнителя';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = NEW.executor_id
           AND p.role = 'executor'::public.app_role
      ) THEN
        RAISE EXCEPTION 'Назначенный пользователь не является исполнителем';
      END IF;

    ELSIF OLD.status = 'new'::public.task_status
       AND NEW.status = 'in_progress'::public.task_status THEN
      IF v_actor IS NULL OR v_actor <> OLD.executor_id OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = v_actor AND p.role = 'executor'::public.app_role
      ) THEN
        RAISE EXCEPTION 'Взять задачу в работу может только назначенный исполнитель';
      END IF;

    ELSIF OLD.status = 'in_progress'::public.task_status
       AND NEW.status = 'in_review'::public.task_status THEN
      IF v_actor IS NULL OR v_actor <> OLD.executor_id OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = v_actor AND p.role = 'executor'::public.app_role
      ) THEN
        RAISE EXCEPTION 'Отправить задачу на проверку может только назначенный исполнитель';
      END IF;

    ELSIF OLD.status = 'in_review'::public.task_status
       AND NEW.status IN ('accepted'::public.task_status, 'revision'::public.task_status) THEN
      IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Проверять задачу может только постановщик';
      END IF;

    ELSIF OLD.status = 'revision'::public.task_status
       AND NEW.status = 'in_progress'::public.task_status THEN
      IF v_actor IS NULL OR v_actor <> OLD.executor_id OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = v_actor AND p.role = 'executor'::public.app_role
      ) THEN
        RAISE EXCEPTION 'Вернуть задачу в работу может только назначенный исполнитель';
      END IF;

    ELSE
      RAISE EXCEPTION 'Недопустимый переход статуса: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_guard_update ON public.tasks;
CREATE TRIGGER tasks_guard_update
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_update();

CREATE OR REPLACE FUNCTION public.write_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_status_history (
      task_id, changed_by, from_status, to_status, comment
    ) VALUES (
      NEW.id, NEW.created_by, NULL, NEW.status, NULL
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_status_history (
      task_id, changed_by, from_status, to_status, comment
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.status,
      NEW.status,
      NULLIF(btrim(current_setting('app.task_status_comment', true)), '')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_write_status_history_insert ON public.tasks;
CREATE TRIGGER tasks_write_status_history_insert
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.write_task_status_history();

DROP TRIGGER IF EXISTS tasks_write_status_history_update ON public.tasks;
CREATE TRIGGER tasks_write_status_history_update
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.write_task_status_history();

-- 7. Внутренний helper: блокирует объект, затем задачу ------------
-- Все операции, меняющие состояние задачи, используют один порядок
-- блокировок, чтобы не дать удалить объект одновременно с изменением задачи.
CREATE OR REPLACE FUNCTION public._lock_task_and_object(p_task_id UUID)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_object_id UUID;
  v_task public.tasks%ROWTYPE;
BEGIN
  SELECT t.object_id
    INTO v_object_id
    FROM public.tasks t
   WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена';
  END IF;

  PERFORM 1
    FROM public.objects o
   WHERE o.id = v_object_id
   FOR UPDATE;

  SELECT t.*
    INTO v_task
    FROM public.tasks t
   WHERE t.id = p_task_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена';
  END IF;

  IF v_task.object_id IS DISTINCT FROM v_object_id THEN
    RAISE EXCEPTION 'Объект задачи изменился параллельно. Повторите операцию';
  END IF;

  RETURN v_task;
END;
$$;

-- 8. RPC: объекты -----------------------------------------------
CREATE OR REPLACE FUNCTION public.create_object(p_name TEXT, p_address TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Название объекта обязательно';
  END IF;
  IF p_address IS NULL OR length(btrim(p_address)) = 0 THEN
    RAISE EXCEPTION 'Адрес объекта обязателен';
  END IF;

  INSERT INTO public.objects (name, address, created_by)
  VALUES (btrim(p_name), btrim(p_address), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_object(
  p_object_id UUID,
  p_name TEXT,
  p_address TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Название объекта обязательно';
  END IF;
  IF p_address IS NULL OR length(btrim(p_address)) = 0 THEN
    RAISE EXCEPTION 'Адрес объекта обязателен';
  END IF;

  UPDATE public.objects
     SET name = btrim(p_name), address = btrim(p_address)
   WHERE id = p_object_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Активный объект не найден';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_object(p_object_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;

  SELECT o.deleted_at INTO v_deleted_at
    FROM public.objects o
   WHERE o.id = p_object_id
   FOR UPDATE;

  IF NOT FOUND OR v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Активный объект не найден';
  END IF;

  -- Если есть хотя бы одна неудалённая задача не в статусе accepted,
  -- объект удалять нельзя. Принятые задачи удаляются каскадно.
  IF EXISTS (
    SELECT 1
      FROM public.tasks t
     WHERE t.object_id = p_object_id
       AND t.deleted_at IS NULL
       AND t.status <> 'accepted'::public.task_status
  ) THEN
    RAISE EXCEPTION 'Нельзя удалить объект: на нём есть незавершённые задачи';
  END IF;

  UPDATE public.tasks
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE object_id = p_object_id
     AND deleted_at IS NULL;

  UPDATE public.objects
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_object_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_object(p_object_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;

  UPDATE public.objects
     SET deleted_at = NULL, deleted_by = NULL
   WHERE id = p_object_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Удалённый объект не найден';
  END IF;
  -- Связанные задачи намеренно НЕ восстанавливаются.
END;
$$;

-- 9. RPC: задачи ------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_task(
  p_title TEXT,
  p_description TEXT,
  p_object_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Название задачи обязательно';
  END IF;

  PERFORM 1
    FROM public.objects o
   WHERE o.id = p_object_id AND o.deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Активный объект не найден';
  END IF;

  INSERT INTO public.tasks (
    title, description, object_id, executor_id, status, created_by
  ) VALUES (
    btrim(p_title), p_description, p_object_id, NULL, 'draft', auth.uid()
  )
  RETURNING id INTO v_id;

  -- INSERT-триггер автоматически создаёт историю NULL -> draft.
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_task_draft(
  p_task_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_object_id UUID,
  p_executor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_object_id UUID;
  v_locked_object_id UUID;
  v_task public.tasks%ROWTYPE;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Название задачи обязательно';
  END IF;

  SELECT t.object_id INTO v_old_object_id
    FROM public.tasks t
   WHERE t.id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена';
  END IF;

  -- Блокируем исходный и целевой объекты в стабильном порядке.
  FOR v_locked_object_id IN
    SELECT o.id
      FROM public.objects o
     WHERE o.id IN (v_old_object_id, p_object_id)
     ORDER BY o.id
     FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  SELECT t.* INTO v_task
    FROM public.tasks t
   WHERE t.id = p_task_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена';
  END IF;
  IF v_task.object_id IS DISTINCT FROM v_old_object_id THEN
    RAISE EXCEPTION 'Задача была изменена параллельно. Повторите операцию';
  END IF;
  IF v_task.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Нельзя редактировать удалённую задачу';
  END IF;
  IF v_task.status <> 'draft'::public.task_status THEN
    RAISE EXCEPTION 'Редактировать можно только черновик';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.objects o
     WHERE o.id = p_object_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Целевой объект не найден или удалён';
  END IF;

  IF p_executor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_executor_id AND p.role = 'executor'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Выбранный пользователь не является исполнителем';
  END IF;

  UPDATE public.tasks
     SET title = btrim(p_title),
         description = p_description,
         object_id = p_object_id,
         executor_id = p_executor_id
   WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_task(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;

  v_task := public._lock_task_and_object(p_task_id);

  IF v_task.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Нельзя отправить удалённую задачу';
  END IF;
  IF v_task.status <> 'draft'::public.task_status THEN
    RAISE EXCEPTION 'Отправить можно только черновик';
  END IF;
  IF v_task.executor_id IS NULL THEN
    RAISE EXCEPTION 'Сначала назначьте исполнителя';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = v_task.executor_id
       AND p.role = 'executor'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Назначенный пользователь больше не является исполнителем';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.objects o
     WHERE o.id = v_task.object_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Объект удалён';
  END IF;

  UPDATE public.tasks SET status = 'new' WHERE id = p_task_id;
  -- UPDATE-триггеры проверяют переход и добавляют draft -> new в историю.
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_task(
  p_task_id UUID,
  p_to_status public.task_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_comment TEXT := NULLIF(btrim(p_comment), '');
BEGIN
  v_task := public._lock_task_and_object(p_task_id);

  IF v_task.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Нельзя менять статус удалённой задачи';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.objects o
     WHERE o.id = v_task.object_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Объект удалён';
  END IF;

  -- Роль и конкретный допустимый переход дополнительно проверяются триггером.
  IF v_task.status = 'in_review'::public.task_status
     AND p_to_status = 'revision'::public.task_status
     AND v_comment IS NULL THEN
    RAISE EXCEPTION 'При возврате на доработку комментарий обязателен';
  END IF;

  -- Передаём комментарий триггеру истории только на время этой транзакции.
  PERFORM set_config('app.task_status_comment', COALESCE(v_comment, ''), true);
  UPDATE public.tasks SET status = p_to_status WHERE id = p_task_id;
  PERFORM set_config('app.task_status_comment', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;

  v_task := public._lock_task_and_object(p_task_id);
  IF v_task.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Задача уже удалена';
  END IF;

  UPDATE public.tasks
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_task_id;
  -- Удаление не является переходом статуса и не попадает в историю.
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_task(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;

  v_task := public._lock_task_and_object(p_task_id);
  IF v_task.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Задача не удалена';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.objects o
     WHERE o.id = v_task.object_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Сначала восстановите объект';
  END IF;

  UPDATE public.tasks
     SET deleted_at = NULL, deleted_by = NULL
   WHERE id = p_task_id;
  -- Статус и история не меняются.
END;
$$;

-- 10. RLS ------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy
ON public.profiles
FOR SELECT TO authenticated
USING (public.is_manager() OR id = auth.uid());

DROP POLICY IF EXISTS objects_select_policy ON public.objects;
CREATE POLICY objects_select_policy
ON public.objects
FOR SELECT TO authenticated
USING (
  public.is_manager()
  OR public.executor_has_task_on_object(id)
);

DROP POLICY IF EXISTS tasks_select_policy ON public.tasks;
CREATE POLICY tasks_select_policy
ON public.tasks
FOR SELECT TO authenticated
USING (public.can_view_task(id));

DROP POLICY IF EXISTS task_status_history_select_policy ON public.task_status_history;
CREATE POLICY task_status_history_select_policy
ON public.task_status_history
FOR SELECT TO authenticated
USING (public.can_view_task(task_id));

-- 11. Права SQL -------------------------------------------------
-- Клиент читает через RLS, но не пишет в таблицы напрямую.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.objects FROM anon, authenticated;
REVOKE ALL ON TABLE public.tasks FROM anon, authenticated;
REVOKE ALL ON TABLE public.task_status_history FROM anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
REVOKE ALL ON public.user_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_directory TO authenticated;
GRANT SELECT ON TABLE public.objects TO authenticated;
GRANT SELECT ON TABLE public.tasks TO authenticated;
GRANT SELECT ON TABLE public.task_status_history TO authenticated;

-- Служебные функции, вызываемые политиками RLS.
REVOKE ALL ON FUNCTION public.is_manager() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_task(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.executor_has_task_on_object(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_task(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.executor_has_task_on_object(UUID) TO authenticated;

-- Внутренний helper не вызывается напрямую из клиента.
REVOKE ALL ON FUNCTION public._lock_task_and_object(UUID) FROM PUBLIC, anon, authenticated;

-- RPC для менеджера.
REVOKE ALL ON FUNCTION public.create_object(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_object(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_object(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_object(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_object(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_object(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_object(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_object(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.create_task(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_task(TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.update_task_draft(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_task_draft(UUID, TEXT, TEXT, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.send_task(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_task(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.transition_task(UUID, public.task_status, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_task(UUID, public.task_status, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_task(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_task(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_task(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_task(UUID) TO authenticated;

-- Последовательность identity не нужна клиенту напрямую.
REVOKE ALL ON SEQUENCE public.task_status_history_id_seq FROM anon, authenticated;

-- ============================================================
-- Первоначальная настройка пользователей после применения:
--
-- 1) Создайте пользователей вручную в Supabase Dashboard -> Auth -> Users.
--    Триггер автоматически создаст profiles с ролью executor.
--
-- 2) Назначьте роль manager одному или нескольким пользователям:
--    UPDATE public.profiles
--       SET role = 'manager'
--     WHERE email = 'manager@example.com';
--
-- 3) В Supabase Auth отключите разрешение открытой регистрации.
--
-- Примечание: service_role и SQL Editor обходят RLS. Никогда не помещайте
-- service_role key во frontend и не отправляйте его в Git.
-- ============================================================
