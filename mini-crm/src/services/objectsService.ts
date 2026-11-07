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
