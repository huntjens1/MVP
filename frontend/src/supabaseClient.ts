import { createClient } from '@supabase/supabase-js';

console.log("SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL);
console.log("SUPABASE_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
