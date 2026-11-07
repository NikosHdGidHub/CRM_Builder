#!/usr/bin/env python3
"""
Скрипт-скаффолдер mini-CRM (frontend).

Создаёт структуру папок views/ services/ app/, кладёт файлы,
переписывает main.tsx, убирает App.tsx (в .bak).

Запуск из корня проекта (где лежит package.json):

    python scaffold.py
    python scaffold.py --force     # перезаписать существующие файлы
    python scaffold.py --install   # после скаффолдинга поставить react-router-dom

Идемпотентен:
  * если файл уже есть с тем же содержимым — пропускает;
  * если с другим — предупреждает и не трогает без --force.
"""

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()

DIRS = [
    "src/app",
    "src/views",
    "src/services",
    "src/components/ui",
    "src/lib",
    "src/types",
]

# ---------------------------------------------------------------
# Содержимое файлов
# ---------------------------------------------------------------

FILES: dict[str, str] = {}

FILES["src/types/db.ts"] = """\
export type AppRole = 'manager' | 'executor';

export type TaskStatus =
  | 'draft'
  | 'new'
  | 'in_progress'
  | 'in_review'
  | 'accepted'
  | 'revision';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  created_at: string;
}

export interface ConstructionObject {
  id: string;
  name: string;
  address: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  object_id: string;
  executor_id: string | null;
  status: TaskStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TaskStatusHistoryEntry {
  id: number;
  task_id: string;
  changed_by: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  comment: string | null;
  created_at: string;
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  draft: 'Черновик',
  new: 'Новая',
  in_progress: 'В работе',
  in_review: 'На проверке',
  accepted: 'Принята',
  revision: 'На доработке',
};

export const roleLabels: Record<AppRole, string> = {
  manager: 'Постановщик',
  executor: 'Исполнитель',
};
"""

FILES["src/lib/supabase.ts"] = """\
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Не заданы VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
"""

FILES["src/env.d.ts"] = """\
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
"""

FILES["src/services/authService.ts"] = """\
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/db';

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchCurrentProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function subscribeToAuthChanges(
  cb: (event: 'signed_in' | 'signed_out' | 'refreshed') => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') cb('signed_in');
    else if (event === 'SIGNED_OUT') cb('signed_out');
    else if (event === 'TOKEN_REFRESHED') cb('refreshed');
  });
  return () => data.subscription.unsubscribe();
}
"""

FILES["src/services/objectsService.ts"] = """\
import { supabase } from '../lib/supabase';
import type { ConstructionObject } from '../types/db';

export async function listObjects(): Promise<ConstructionObject[]> {
  const { data, error } = await supabase
    .from('objects')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getObject(id: string): Promise<ConstructionObject> {
  const { data, error } = await supabase
    .from('objects')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  return data;
}

export async function createObject(name: string, address: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_object', {
    p_name: name,
    p_address: address,
  });
  if (error) throw error;
  return data as string;
}

export async function updateObject(id: string, name: string, address: string): Promise<void> {
  const { error } = await supabase.rpc('update_object', {
    p_object_id: id,
    p_name: name,
    p_address: address,
  });
  if (error) throw error;
}

export async function softDeleteObject(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_object', { p_object_id: id });
  if (error) throw error;
}

export async function restoreObject(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_object', { p_object_id: id });
  if (error) throw error;
}
"""

FILES["src/services/tasksService.ts"] = """\
import { supabase } from '../lib/supabase';
import type { Task, TaskStatus, TaskStatusHistoryEntry } from '../types/db';

export async function listMyTasks(): Promise<Task[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Нет сессии');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('executor_id', session.user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listTasksByObject(objectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('object_id', objectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTask(id: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  return data;
}

export async function getTaskHistory(taskId: string): Promise<TaskStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('task_status_history')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(
  title: string,
  description: string | null,
  objectId: string
): Promise<string> {
  const { data, error } = await supabase.rpc('create_task', {
    p_title: title,
    p_description: description,
    p_object_id: objectId,
  });
  if (error) throw error;
  return data as string;
}

export async function updateTaskDraft(params: {
  taskId: string;
  title: string;
  description: string | null;
  objectId: string;
  executorId: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('update_task_draft', {
    p_task_id: params.taskId,
    p_title: params.title,
    p_description: params.description,
    p_object_id: params.objectId,
    p_executor_id: params.executorId,
  });
  if (error) throw error;
}

export async function sendTask(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('send_task', { p_task_id: taskId });
  if (error) throw error;
}

export async function transitionTask(
  taskId: string,
  toStatus: TaskStatus,
  comment: string | null = null
): Promise<void> {
  const { error } = await supabase.rpc('transition_task', {
    p_task_id: taskId,
    p_to_status: toStatus,
    p_comment: comment,
  });
  if (error) throw error;
}

export async function softDeleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_task', { p_task_id: taskId });
  if (error) throw error;
}

export async function restoreTask(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_task', { p_task_id: taskId });
  if (error) throw error;
}
"""

FILES["src/app/AuthProvider.tsx"] = """\
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Profile } from '../types/db';
import {
  fetchCurrentProfile,
  signOut as signOutService,
  subscribeToAuthChanges,
} from '../services/authService';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  profile: Profile | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const p = await fetchCurrentProfile();
        if (cancelled) return;
        setProfile(p);
        setStatus(p ? 'authenticated' : 'unauthenticated');
      } catch {
        if (cancelled) return;
        setProfile(null);
        setStatus('unauthenticated');
      }
    }

    refresh();
    const unsubscribe = subscribeToAuthChanges(() => {
      refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    await signOutService();
    setProfile(null);
    setStatus('unauthenticated');
  }

  return (
    <AuthContext.Provider value={{ status, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
"""

FILES["src/app/homePath.ts"] = """\
import type { AppRole } from '../types/db';

export function homePathFor(role: AppRole): string {
  return role === 'manager' ? '/objects' : '/my-tasks';
}
"""

FILES["src/app/guards.tsx"] = """\
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { homePathFor } from './homePath';
import type { AppRole } from '../types/db';

export function RequireAuth({ requiredRole }: { requiredRole?: AppRole }) {
  const { status, profile } = useAuth();

  if (status === 'loading') return <div>Загрузка…</div>;
  if (status === 'unauthenticated' || !profile) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={homePathFor(profile.role)} replace />;
  }
  return <Outlet />;
}
"""

FILES["src/app/HomeRedirect.tsx"] = """\
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { homePathFor } from './homePath';

export function HomeRedirect() {
  const { status, profile } = useAuth();
  if (status === 'loading') return <div>Загрузка…</div>;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(profile.role)} replace />;
}
"""

FILES["src/app/router.tsx"] = """\
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './guards';
import { HomeRedirect } from './HomeRedirect';
import { LoginView } from '../views/LoginView';
import { ObjectsListView } from '../views/ObjectsListView';
import { ObjectDetailView } from '../views/ObjectDetailView';
import { TaskDetailView } from '../views/TaskDetailView';
import { MyTasksView } from '../views/MyTasksView';
import { NotFoundView } from '../views/NotFoundView';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginView /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/objects', element: <ObjectsListView /> },
      { path: '/objects/:id', element: <ObjectDetailView /> },
      { path: '/tasks/:id', element: <TaskDetailView /> },
      {
        element: <RequireAuth requiredRole="executor" />,
        children: [{ path: '/my-tasks', element: <MyTasksView /> }],
      },
    ],
  },
  { path: '*', element: <NotFoundView /> },
]);
"""

FILES["src/views/LoginView.tsx"] = """\
export function LoginView() {
  return <div>Вход</div>;
}
"""

FILES["src/views/ObjectsListView.tsx"] = """\
export function ObjectsListView() {
  return <div>Список объектов</div>;
}
"""

FILES["src/views/ObjectDetailView.tsx"] = """\
import { useParams } from 'react-router-dom';

export function ObjectDetailView() {
  const { id } = useParams<{ id: string }>();
  return <div>Объект: {id}</div>;
}
"""

FILES["src/views/TaskDetailView.tsx"] = """\
import { useParams } from 'react-router-dom';

export function TaskDetailView() {
  const { id } = useParams<{ id: string }>();
  return <div>Задача: {id}</div>;
}
"""

FILES["src/views/MyTasksView.tsx"] = """\
export function MyTasksView() {
  return <div>Мои задачи</div>;
}
"""

FILES["src/views/NotFoundView.tsx"] = """\
export function NotFoundView() {
  return <div>404 — страница не найдена</div>;
}
"""

FILES["src/main.tsx"] = """\
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
"""

# ---------------------------------------------------------------

def write_file(path: Path, content: str, force: bool) -> str:
    """Возвращает символ статуса для отчёта: + = создан, = = без изменений, ! = конфликт."""
    if path.exists() and not force:
        existing = path.read_text(encoding="utf-8")
        if existing == content:
            return "="
        return "!"
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    return "+"


def main() -> int:
    parser = argparse.ArgumentParser(description="Скаффолдер структуры mini-CRM")
    parser.add_argument("--force", action="store_true", help="перезаписать существующие файлы")
    parser.add_argument("--install", action="store_true", help="выполнить npm install react-router-dom")
    args = parser.parse_args()

    if not (ROOT / "package.json").exists():
        print("Ошибка: package.json не найден в текущей папке.")
        print(f"Текущая папка: {ROOT}")
        print("Запускайте скрипт из корня проекта (там же, где package.json).")
        return 1

    print(f"Корень проекта: {ROOT}\n")

    print("Создаю папки:")
    for d in DIRS:
        (ROOT / d).mkdir(parents=True, exist_ok=True)
        print(f"  ✓ {d}/")

    print("\nСоздаю файлы:")
    conflicts: list[str] = []
    for rel, content in FILES.items():
        full = ROOT / rel
        full.parent.mkdir(parents=True, exist_ok=True)
        status = write_file(full, content, force=args.force)
        if status == "+":
            print(f"  + {rel}")
        elif status == "=":
            print(f"  = {rel} (без изменений)")
        else:
            print(f"  ! {rel} — уже существует с другим содержимым")
            conflicts.append(rel)

    # App.tsx больше не нужен: логика переехала в main.tsx.
    app_tsx = ROOT / "src" / "App.tsx"
    if app_tsx.exists():
        backup = app_tsx.with_suffix(".tsx.bak")
        app_tsx.rename(backup)
        print(f"  → src/App.tsx переименован в src/App.tsx.bak")

    # gitkeep, чтобы пустая папка не потерялась в git
    gitkeep = ROOT / "src" / "components" / "ui" / ".gitkeep"
    if not gitkeep.exists():
        gitkeep.write_text("", encoding="utf-8")

    print()
    if conflicts:
        print(f"⚠  {len(conflicts)} файл(ов) не тронуты, потому что содержимое отличается.")
        print("   Если хотите перезаписать — запустите с --force.")
        for c in conflicts:
            print(f"     - {c}")
        print()

    if args.install:
        print("Устанавливаю react-router-dom…")
        try:
            subprocess.run(["npm", "install", "react-router-dom"], check=True, cwd=ROOT)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Не удалось выполнить npm install: {e}")
            print("Поставьте вручную: npm install react-router-dom")
            return 2
    else:
        print("Следующий шаг: npm install react-router-dom")

    print("\nГотово. Проверьте:")
    print("  1) npm run dev — открывается /login без ошибок в консоли")
    print("  2) прямой заход на /objects без логина → редирект на /login")
    print("  3) после входа: менеджер → /objects, исполнитель → /my-tasks")
    return 0


if __name__ == "__main__":
    sys.exit(main())