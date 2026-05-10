import { supabase } from "./client";
import { getAuthCallbackUrl } from "@/lib/auth/redirect";

export async function signInWithMagicLink(email: string) {
  const callbackUrl = getAuthCallbackUrl();

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
