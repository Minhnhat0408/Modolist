"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface SessionData {
  user: {
    id: string;
    email: string | undefined;
    name: string | undefined;
    image: string | undefined;
  } | null;
}

/**
 * Drop-in replacement for next-auth/react useSession.
 * Returns { data: { user }, status } similar to NextAuth's useSession.
 */
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setStatus(user ? "authenticated" : "unauthenticated");
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "authenticated" : "unauthenticated");
    });

    return () => subscription.unsubscribe();
  }, []);

  const data: SessionData | null = user
    ? {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name,
          image: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        },
      }
    : null;

  return { data, status };
}
