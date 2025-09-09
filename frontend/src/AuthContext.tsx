import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import api from "./api/index"; // default export met alle API-methodes

type User = {
  id: string;
  email: string;
  name?: string | null;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Init: haal sessie op
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await api.me();
        if (!alive) return;
        setUser(res?.user ?? null);
      } catch {
        if (!alive) return;
        setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res: any = await api.login(email, password);
    const u: User | null = res?.user ?? null;
    setUser(u);
    return u;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  const refresh = async () => {
    const res: any = await api.me();
    const u: User | null = res?.user ?? null;
    setUser(u);
    return u;
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
