import { supabase } from "./client";

export async function signInWithMagicLink(email: string) {
  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: siteUrl,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
