import { useCallback, useEffect, useState } from 'react';
import { listMyTasks } from '../services/tasksService';
import type { Task } from '../types/db';

export function useMyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMyTasks();
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { tasks, loading, error, refresh };
}