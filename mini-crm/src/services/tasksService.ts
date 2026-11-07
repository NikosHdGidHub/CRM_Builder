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
