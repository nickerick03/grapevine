import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep runtime warning visible in development without crashing static preview routes.
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Supabase features are disabled.");
}

const resolvedUrl = supabaseUrl || "https://placeholder.supabase.co";
const resolvedAnonKey = supabaseAnonKey || "public-anon-key-placeholder";

export const supabase = createClient(resolvedUrl, resolvedAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
