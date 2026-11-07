# mini-CRM «Объекты и задачи»

Небольшая CRM для строительной компании: менеджер ставит задачи по
объектам (стройкам), исполнители выполняют и отдают на проверку.
Две роли, цикл статусов задачи и полная история переходов.

Стек: **React + TypeScript + Vite**, **Supabase** (Auth, Postgres, RLS,
RPC), без UI-библиотек.

## Демо

- Приложение: **_(вставьте ссылку на Vercel/Netlify)_**
- Тестовые учётки:
  - менеджер — `manager@example.com` / `12345678`
  - исполнитель 1 — `executor1@example.com` / `12345678`
  - исполнитель 2 — `executor2@example.com` / `12345678`

## Как устроено

```
src/
├── app/          # AuthProvider, ObjectsProvider, роутер, guards
├── views/        # экраны (Login, ObjectDetail, TaskDetail, MyTasks)
├── services/     # обёртки над Supabase: authService, objectsService, tasksService
├── components/   # UI-примитивы и диалоги
├── hooks/        # useMyTasks и другие хуки
├── lib/          # supabase.ts — инициализация клиента
└── types/        # типы строк БД + лейблы
```

Слой `services` отделён от `views`: **вью только показывают, сервисы
только обрабатывают**. Вью не знают про Supabase, сервисы не знают про
JSX. Любая ошибка от Supabase бросается как исключение — вью решает,
как её показать.

### Безопасность

Правила доступа работают на уровне базы, а не UI:

1. **RLS включён на всех таблицах.** Исполнитель видит только свои
   задачи (`assignee_id = auth.uid()`) и объекты, где у него есть
   хотя бы одна задача в статусе ≠ `draft`. Черновики до отправки
   исполнителю невидимы.
2. **Запись — только через RPC.** На таблицы выдан только `SELECT`.
   Создание, редактирование, удаление, смена статуса — через
   `SECURITY DEFINER`-функции (`create_object`, `send_task`,
   `transition_task`, …). Даже если обратиться к PostgREST напрямую,
   прямой `INSERT`/`UPDATE`/`DELETE` не пройдёт.
3. **Переходы статусов проверяются в БД.** Триггер `guard_task_update`
   валидирует пару «из какого в какой» и роль актора. Запрещённый
   переход падает с ошибкой, даже если его отправить вручную через
   PostgREST.
4. **История статусов — append-only.** `task_status_history` доступна
   только на чтение. Запись делает триггер `SECURITY DEFINER` на
   `tasks`. Подделать, изменить или удалить запись через API нельзя.
5. **Открытая регистрация отключена.** Пользователей создаёт
   администратор в Supabase Dashboard. Роль хранится в `profiles`,
   а не в JWT user_metadata — UI читает её из таблицы.
6. **`service_role` не попадает во фронтенд.** В клиенте только
   `anon`-ключ, в репозитории — только `anon`, `.env.local` в
   `.gitignore`.

Подробнее — в [`SOLUTIONS.md`](./SOLUTIONS.md) (список решений и
допущений).

## Запуск локально

### 1. Клонировать и установить

```bash
git clone <repo-url>
cd mini-crm
npm install
```

### 2. Создать проект Supabase

1. [supabase.com](https://supabase.com) → New project (Free tier подойдёт).
2. Дождаться, пока база поднимется (~1 мин).

### 3. Применить миграцию

В Supabase Dashboard → **SQL Editor** → New query → вставить содержимое
файла [`migrations/0001_init.sql`](./migrations/0001_init.sql) → Run.

Файл создаёт:
- ENUM-типы `app_role`, `task_status`;
- таблицы `profiles`, `objects`, `tasks`, `task_status_history`;
- view `user_directory` (безопасный справочник пользователей);
- триггеры: автосоздание `profiles` из `auth.users`, авто-`updated_at`,
  `guard_task_update` (валидация переходов),
  `write_task_status_history` (append-only история);
- RPC-функции для всех операций записи;
- RLS-политики и `GRANT`/`REVOKE`.

### 4. Создать тестовых пользователей

В Dashboard → **Authentication** → **Users** → **Add user** (Email +
Password, подтверждение email можно отключить):

- `manager@example.com` — менеджер
- `executor1@example.com` — исполнитель
- `executor2@example.com` — исполнитель

Триггер `handle_new_auth_user` создаст для них строки в `profiles`
с ролью `executor` по умолчанию.

Назначить менеджера:

```sql
UPDATE public.profiles
   SET role = 'manager'
 WHERE email = 'manager@example.com';
```

### 5. Отключить открытую регистрацию

Dashboard → **Authentication** → **Sign In / Providers** → **Email** →
выключить **Allow new users to sign up**.

### 6. Прописать env

Скопировать `.env.example` в `.env.local` и заполнить:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`Project URL` и `anon`-ключ — в Dashboard → **Settings** → **API**.
`service_role` **не нужен** на клиенте и не должен попадать в `.env.local`.

### 7. Запустить

```bash
npm run dev
```

Открыть `http://localhost:5173` — попадёте на `/login`. Войти под
менеджером или исполнителем.

## Скрипты

```bash
npm run dev       # dev-сервер с HMR
npm run build     # production-сборка (tsc + vite build)
npm run preview   # предпросмотр production-сборки
npm run lint      # eslint
```

## Наполнение данными

Через UI под менеджером:

1. В сайдбаре «Объекты» → «+» → создать 2–3 объекта.
2. Открыть объект → «+ Создать задачу» → выбрать исполнителя →
   «Сохранить и отправить».
3. Для проверки разных статусов: под исполнителем взять задачу в
   работу, отправить на проверку; под менеджером — принять одну
   задачу и вернуть другую на доработку с комментарием.

## Деплой

### Vercel

1. Импортировать репозиторий.
2. Framework preset → **Vite**. Build command `npm run build`,
   output directory `dist`.
3. Environment Variables → добавить `VITE_SUPABASE_URL` и
   `VITE_SUPABASE_ANON_KEY` (для Production и Preview).
4. Deploy.

Для SPA-роутинга нужен `vercel.json` в корне — иначе прямой заход на
`/objects/abc` даст 404:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Netlify

`netlify.toml` в корне:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Environment variables — в настройках сайта, те же две.

## Структура сдачи

- Ссылка на приложение + учётки — в шапке этого README.
- Функции SQL — `migrations/Funcs.csv`.