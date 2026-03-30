"use client";

import Link from "next/link";
import { useGuestStore } from "@/stores/useGuestStore";
import { UserCircle } from "lucide-react";

const GUEST_EXPIRY_DAYS = 30;

export function GuestBanner() {
  const createdAt = useGuestStore((s) => s.createdAt);

  const daysLeft = createdAt
    ? Math.max(
        0,
        GUEST_EXPIRY_DAYS -
          Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
      <UserCircle className="h-4 w-4 shrink-0" />
      <span>
        Chế độ khách · Dữ liệu chỉ lưu trong trình duyệt này · Còn{" "}
        {daysLeft} ngày ·{" "}
        <Link
          href="/auth/signup"
          className="underline underline-offset-2 hover:text-white/90"
        >
          Đăng ký để lưu vĩnh viễn →
        </Link>
      </span>
    </div>
  );
}
