import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { CheckCircle, Target, Users, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">
              Modolist
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/auth/signin">
              <Button variant="ghost">Đăng nhập</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Đăng ký</Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Quản lý công việc và{" "}
              <span className="text-primary">tập trung hiệu quả</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Modolist giúp bạn tổ chức công việc, theo dõi tiến độ và
              cộng tác cùng đội nhóm một cách dễ dàng với giao diện trực quan và
              tính năng mạnh mẽ.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg">
                  Bắt đầu ngay
                </Button>
              </Link>
              <Link href="/auth/signin">
                <Button size="lg" variant="outline" className="text-lg">
                  Tìm hiểu thêm
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Nhanh chóng & Hiệu quả</CardTitle>
                <CardDescription>
                  Tạo và quản lý task chỉ trong vài giây với giao diện kéo thả
                  trực quan
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Cộng tác nhóm</CardTitle>
                <CardDescription>
                  Làm việc cùng đội nhóm với tính năng chia sẻ và phân công công
                  việc
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Theo dõi tiến độ</CardTitle>
                <CardDescription>
                  Nắm bắt tiến độ dự án một cách trực quan qua bảng Kanban và
                  biểu đồ
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="py-16">
          <Card className="border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Tính năng nổi bật</CardTitle>
              <CardDescription className="text-lg">
                Mọi thứ bạn cần để quản lý công việc hiệu quả
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">Bảng Kanban trực quan</h3>
                    <p className="text-sm text-muted-foreground">
                      Kéo thả task dễ dàng giữa các cột trạng thái
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">Thông báo thời gian thực</h3>
                    <p className="text-sm text-muted-foreground">
                      Cập nhật ngay lập tức khi có thay đổi
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">Giao diện tối/sáng</h3>
                    <p className="text-sm text-muted-foreground">
                      Tùy chỉnh giao diện theo sở thích của bạn
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold">Bảo mật cao</h3>
                    <p className="text-sm text-muted-foreground">
                      Dữ liệu được mã hóa và bảo vệ an toàn
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="py-20 text-center">
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-4xl font-bold text-foreground">
              Sẵn sàng bắt đầu?
            </h2>
            <p className="text-xl text-muted-foreground">
              Tham gia cùng hàng nghìn người dùng đang sử dụng Modolist để
              quản lý công việc hiệu quả hơn
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg">
                  Đăng ký miễn phí
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center space-x-2">
              <Target className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">
                Modolist
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Modolist. Tất cả quyền được bảo lưu.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
