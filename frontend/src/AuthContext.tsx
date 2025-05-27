import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type UserData = {
  id: string;
  email: string | null;
  role: string;
};

type AuthContextType = {
  user: UserData | null;
  role: string;
  signOut: () => Promise<void>;
  isLoading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "",
  signOut: async () => {},
  isLoading: false,
});

async function signOut() {
  await supabase.auth.signOut();
  setUser(null);
  setRole("");
  window.location.href = "/auth"; // Stuur altijd naar loginpagina
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!ignore) {
        if (session && session.user) {
          fetchUserRole(session.user);
        } else {
          setUser(null);
          setRole("");
          setIsLoading(false);
        }
      }
    }
    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        fetchUserRole(session.user);
      } else {
        setUser(null);
        setRole("");
      }
      setIsLoading(false);
    });
    return () => {
      ignore = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  async function fetchUserRole(user: SupabaseUser) {
    setIsLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    if (data) {
      setUser({ id: data.id, email: data.email ?? null, role: data.role ?? "" });
      setRole(data.role ?? "");
    } else {
      setUser({
        id: user.id,
        email: user.email ?? null,
        role: "",
      });
      setRole("");
    }
    setIsLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setRole("");
    window.location.href = "/"; // refresh of redirect naar login
  }

  return (
    <AuthContext.Provider value={{ user, role, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
