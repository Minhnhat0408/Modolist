"use client";

import { signOut } from "@/lib/auth";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  BarChart3,
  Moon,
  Sun,
  Monitor,
  Sparkles,
  UserCircle,
  UserPlus,
} from "lucide-react";
import { useIsGuest } from "@/hooks/useIsGuest";
import { useGuestStore } from "@/stores/useGuestStore";
import { clearGuestCookie } from "@/hooks/useIsGuest";

interface UserNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onStatsClick?: () => void;
  onAIClick?: () => void;
}

export function UserNav({ user, onStatsClick, onAIClick }: UserNavProps) {
  const { theme, setTheme } = useTheme();
  const isGuest = useIsGuest();
  const router = useRouter();
  const clearGuest = useGuestStore((s) => s.clearGuest);

  const handleSignOut = async () => {
    if (isGuest) {
      clearGuest();
      clearGuestCookie();
      router.push("/auth/signin");
      return;
    }
    await signOut();
    window.location.href = "/auth/signin";
  };

  if (!user && !isGuest) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {isGuest ? (
              <AvatarFallback>
                <UserCircle className="h-5 w-5" />
              </AvatarFallback>
            ) : (
              <>
                <AvatarImage src={user?.image || ""} alt={user?.name || ""} />
                <AvatarFallback>
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </>
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {isGuest ? "👤 Khách" : user?.name}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {isGuest ? "Chế độ dùng thử" : user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isGuest && (
          <DropdownMenuItem
            className="cursor-pointer text-green-600 font-medium"
            onClick={() => router.push("/auth/signup")}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Đăng ký tài khoản
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "dark" ? (
              <Moon className="mr-2 h-4 w-4" />
            ) : theme === "light" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Monitor className="mr-2 h-4 w-4" />
            )}
            Giao diện
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Sáng
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Tối
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              Hệ thống
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {/* <DropdownMenuItem className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Cài đặt
        </DropdownMenuItem> */}
        <DropdownMenuItem className="cursor-pointer" onClick={onStatsClick}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Thống kê
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onAIClick} disabled={isGuest}>
          <Sparkles className="mr-2 h-4 w-4" />
          {isGuest ? "AI Tạo tasks (cần đăng ký)" : "AI Tạo tasks"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive cursor-pointer"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isGuest ? "Thoát chế độ khách" : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
