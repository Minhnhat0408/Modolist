"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function authenticate(_currentState: unknown, formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return "Email hoặc mật khẩu không đúng.";
    }
    return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  }

  redirect("/dashboard");
}

export async function authenticateWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return "Đã có lỗi xảy ra với Google Sign In.";
  }

  if (data.url) {
    redirect(data.url);
  }
}
