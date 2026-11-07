import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/db';

export interface DirectoryUser {
  id: string;
  display_name: string;
  email: string;
  role: AppRole;
}

/**
 * Отображаемое имя пользователя.
 * Приоритет: display_name → email → прочерк.
 * Пустая строка display_name (дефолт в profiles) не должна скрывать email.
 */
export function displayUser(user: DirectoryUser | null | undefined): string {
  if (!user) return '—';
  return user.display_name?.trim() || user.email || '—';
}

export async function listExecutors(): Promise<DirectoryUser[]> {
  const { data, error } = await supabase
    .from('user_directory')
    .select('id, display_name, email, role')
    .eq('role', 'executor')
    .order('display_name');
  if (error) throw error;
  return data ?? [];
}

export async function getUserDirectory(): Promise<DirectoryUser[]> {
  const { data, error } = await supabase
    .from('user_directory')
    .select('id, display_name, email, role');
  if (error) throw error;
  return data ?? [];
}