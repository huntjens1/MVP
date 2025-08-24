import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

type User = {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1) Bij mount: check cookie via backend
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/me");
        if (res.authenticated && res.user) {
          setUser(res.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 2) Login → backend zet cookie
  async function login(email: string, password: string): Promise<boolean> {
    setIsLoading(true);
    try {
      const res = await api.post("/api/login", { email, password });
      if (res?.ok && res?.user) {
        setUser(res.user);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  // 3) Logout → backend cleart cookie
  async function logout() {
    try {
      await api.post("/api/logout");
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
