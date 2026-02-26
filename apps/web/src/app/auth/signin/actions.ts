"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function authenticate(_currentState: unknown, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Email hoặc mật khẩu không đúng.";
        default:
          return "Đã có lỗi xảy ra. Vui lòng thử lại.";
      }
    }
    throw error;
  }
}

export async function authenticateWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}
