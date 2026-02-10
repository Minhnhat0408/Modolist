"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AlertCircle, Home } from "lucide-react"
import { Suspense } from "react"

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Lỗi cấu hình",
    description: "Có vấn đề với cấu hình hệ thống. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
  },
  AccessDenied: {
    title: "Truy cập bị từ chối",
    description: "Bạn không có quyền truy cập vào tài nguyên này.",
  },
  Verification: {
    title: "Lỗi xác thực",
    description: "Link xác thực không hợp lệ hoặc đã hết hạn.",
  },
  OAuthAccountNotLinked: {
    title: "Tài khoản chưa được liên kết",
    description: "Email này đã được đăng ký bằng phương thức khác. Vui lòng đăng nhập bằng phương thức ban đầu.",
  },
  Default: {
    title: "Đã có lỗi xảy ra",
    description: "Xin lỗi, đã có lỗi trong quá trình xử lý. Vui lòng thử lại.",
  },
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "Default"
  const errorInfo = errorMessages[error] || errorMessages.Default

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{errorInfo?.title || "Lỗi xảy ra"}</CardTitle>
          <CardDescription className="text-base">
            {errorInfo?.description || "Xin lỗi, đã có lỗi trong quá trình xử lý. Vui lòng thử lại."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Link href="/" className="w-full">
              <Button variant="default" className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                Về trang chủ
              </Button>
            </Link>
            <Link href="/auth/signin" className="w-full">
              <Button variant="outline" className="w-full" size="lg">
                Thử đăng nhập lại
              </Button>
            </Link>
          </div>
          
          {error !== "Default" && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-semibold">Mã lỗi: {error}</p>
              <p className="mt-1">
                Nếu vấn đề vẫn tiếp diễn, vui lòng liên hệ bộ phận hỗ trợ với mã lỗi này.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
