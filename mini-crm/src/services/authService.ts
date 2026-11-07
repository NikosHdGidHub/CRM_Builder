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
