"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Mail, Lock, ChromeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authenticate, authenticateWithGoogle } from "./actions";
import { useActionState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full" size="lg">
      {pending ? "Đang đăng nhập..." : "Đăng nhập"}
    </Button>
  );
}

export default function SignInPage() {
  const [errorMessage, dispatch] = useActionState(authenticate, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">Co-Focus Space</CardTitle>
          <CardDescription>
            Đăng nhập để bắt đầu quản lý công việc và tập trung hiệu quả
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email/Password Form */}
          <form action={dispatch} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="minhnhat@gmail.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="*****"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {errorMessage && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {errorMessage}
              </div>
            )}

            <SubmitButton />
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Hoặc tiếp tục với
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <form action={authenticateWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              <ChromeIcon className="mr-2 h-4 w-4" />
              Đăng nhập với Google
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Chưa có tài khoản? </span>
            <Link
              href="/auth/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Đăng ký ngay
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Bằng việc đăng nhập, bạn đồng ý với{" "}
            <a href="/terms" className="underline hover:text-primary">
              Điều khoản sử dụng
            </a>{" "}
            và{" "}
            <a href="/privacy" className="underline hover:text-primary">
              Chính sách bảo mật
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
