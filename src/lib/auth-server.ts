/**
 * Auth helpers — SERVER SIDE ONLY.
 * Only import this in Server Components, API Routes, and Server Actions.
 */

import { createClient } from "@/lib/supabase/server";

/**
 * Get current user (server-side, for use in Server Components / API Routes).
 */
export async function getServerSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
