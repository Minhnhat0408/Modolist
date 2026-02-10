import { auth } from "@/lib/auth"
import { UserNav } from "@/components/user-nav"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Bảng điều khiển</h1>
            <p className="text-muted-foreground">
              Chào mừng trở lại, {session?.user?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserNav user={session?.user} />
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div className="col-span-3">
            <h2 className="text-xl font-semibold mb-4">Bảng Kanban</h2>
          </div>
        </div>
      </div>
    </div>
  )
}
