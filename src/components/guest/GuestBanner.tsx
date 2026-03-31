"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useGuestStore } from "@/stores/useGuestStore";
import { UserCircle } from "lucide-react";

const GUEST_EXPIRY_DAYS = 30;

export function GuestBanner() {
  const createdAt = useGuestStore((s) => s.createdAt);
  const t = useTranslations("guest");

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
        {t("bannerText", { days: daysLeft })}{" "}
        <Link
          href="/auth/signup"
          className="underline underline-offset-2 hover:text-white/90"
        >
          {t("signUpPermanent")}
        </Link>
      </span>
    </div>
  );
}
