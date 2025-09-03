import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
// Belangrijk: importeer rechtstreeks uit de map-index.
// We gebruiken *named* imports zodat TS exact weet dat deze bestaan.
import {
  me as apiMe,
  login as apiLogin,
  logout as apiLogout,
} from "./api/index";

// Lokale definitie voorkomt type-resolutie-gedoe met barrels/caching
type LoginResponse = { user: any; token?: string };

type User =
  | {
      id: string;
      email: string;
      name?: string;
      role?: string;
      tenant_id?: string | null;
    }
  | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  // Sessie laden bij app-start (Bearer + cookies)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiMe();
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
    const res: LoginResponse = await apiLogin(email, password);
    const u = res?.user ?? null;
    setUser(u);
    return u;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  };

  const refresh = async () => {
    const res = await apiMe();
    const u = res?.user ?? null;
    setUser(u);
    return u;
  };

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
