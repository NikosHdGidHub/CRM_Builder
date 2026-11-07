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
