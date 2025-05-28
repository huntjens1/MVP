import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const apiBase = import.meta.env.VITE_API_BASE || "";

type User = {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, tenant_id: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("jwt");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("jwt", token);
    } else {
      localStorage.removeItem("jwt");
    }
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [token, user]);

  async function login(email: string, password: string) {
    setIsLoading(true);
    const res = await axios.post(`${apiBase}/api/login`, { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    setIsLoading(false);
  }

  async function register(email: string, password: string, tenant_id: string) {
    setIsLoading(true);
    const res = await axios.post(`${apiBase}/api/register`, { email, password, tenant_id });
    setToken(res.data.token);
    setUser(res.data.user);
    setIsLoading(false);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
