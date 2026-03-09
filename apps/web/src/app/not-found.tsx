import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            404 - Không tìm thấy
          </CardTitle>
          <CardDescription>
            Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Quay về trang chủ
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
