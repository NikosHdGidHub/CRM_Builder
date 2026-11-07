import type { AppRole } from '../types/db';

export function homePathFor(role: AppRole): string {
  return role === 'manager' ? '/objects' : '/my-tasks';
}
