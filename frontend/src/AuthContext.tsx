import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient, User as SupabaseUser } from "@supabase/supabase-js";

// Vul je env vars in zoals in je project!
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = supabase.auth.session?.();
    if (session && session.user) {
      // Ophalen van role uit je eigen users-tabel (Supabase)
      fetchUserRole(session.user);
    } else {
      setUser(null);
      setRole("");
      setIsLoading(false);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session && session.user) {
          fetchUserRole(session.user);
        } else {
          setUser(null);
          setRole("");
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  // Haal uit je eigen `users` tabel de rol (en evt. andere info)
  async function fetchUserRole(user: SupabaseUser) {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    if (data) {
      setUser({ id: data.id, email: data.email, role: data.role });
      setRole(data.role);
    } else {
      setUser({
        id: user.id,
        email: user.email,
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

// Handige hook voor gebruik in componenten
export function useAuth() {
  return useContext(AuthContext);
}
