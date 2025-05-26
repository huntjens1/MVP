import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type User = {
  id: string;
  email: string;
  role: string | null; // bijv. "admin", "support", "user"
  tenant_id: string | null;
};

type AuthContextProps = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<any>;
};

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper om extra user-info op te halen (rol + tenant)
  const fetchUserDetails = async (id: string) => {
    // Haal user info uit Supabase (uit je "users" tabel!)
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, tenant_id")
      .eq("id", id)
      .single();

    if (error) return null;
    return data as User;
  };

  useEffect(() => {
    // "session" wordt niet als variable gedeclareerd
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserDetails(session.user.id).then((details) => {
          setUser(details);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserDetails(session.user.id).then((details) => setUser(details));
      } else {
        setUser(null);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    return error;
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    return error;
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
