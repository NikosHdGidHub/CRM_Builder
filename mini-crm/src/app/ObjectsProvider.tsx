import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ConstructionObject } from '../types/db';
import { listObjects } from '../services/objectsService';
import { useAuth } from './AuthProvider';

interface ObjectsContextValue {
  objects: ConstructionObject[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ObjectsContext = createContext<ObjectsContextValue | null>(null);

export function ObjectsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [objects, setObjects] = useState<ConstructionObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listObjects();
      setObjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить объекты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      void refresh();
    } else if (status === 'unauthenticated') {
      setObjects([]);
      setError(null);
    }
  }, [status, refresh]);

  return (
    <ObjectsContext.Provider value={{ objects, loading, error, refresh }}>
      {children}
    </ObjectsContext.Provider>
  );
}

export function useObjects(): ObjectsContextValue {
  const ctx = useContext(ObjectsContext);
  if (!ctx) throw new Error('useObjects must be used within ObjectsProvider');
  return ctx;
}