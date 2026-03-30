import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Get the authenticated user from the Supabase session.
 * Returns { user, supabase } or a 401 NextResponse.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, supabase, error: null };
}
