/**
 * Auth helpers using Supabase Auth — CLIENT SIDE ONLY.
 * Do NOT import server.ts here (would break client components).
 */

import { createClient } from "@/lib/supabase/client";

/**
 * Sign in with Google OAuth (client-side).
 */
export async function signInWithGoogle(redirectTo?: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/**
 * Sign in with email/password (client-side).
 */
export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign up with email/password (client-side).
 */
export async function signUp(email: string, password: string, name?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out (client-side).
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
