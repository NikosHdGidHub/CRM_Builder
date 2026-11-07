import { supabase } from '../lib/supabase';
import type { AppRole } from '../types/db';

export interface DirectoryUser {
  id: string;
  display_name: string;
  role: AppRole;
}

export async function listExecutors(): Promise<DirectoryUser[]> {
  const { data, error } = await supabase
    .from('user_directory')
    .select('id, display_name, role')
    .eq('role', 'executor')
    .order('display_name');
  if (error) throw error;
  return data ?? [];
}

export async function getUserDirectory(): Promise<DirectoryUser[]> {
  const { data, error } = await supabase
    .from('user_directory')
    .select('id, display_name, role');
  if (error) throw error;
  return data ?? [];
}