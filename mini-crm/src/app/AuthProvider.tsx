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
