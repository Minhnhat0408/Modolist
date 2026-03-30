"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGuestStore } from "@/stores/useGuestStore";
import { clearGuestCookie } from "@/hooks/useIsGuest";
import { GuestBanner } from "@/components/guest/GuestBanner";

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { guestId, isExpired, clearGuest } = useGuestStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Cookie exists but localStorage was cleared (desync)
    if (!guestId) {
      clearGuestCookie();
      router.replace("/auth/signin");
      return;
    }

    // Guest session expired
    if (isExpired()) {
      clearGuest();
      clearGuestCookie();
      router.replace("/auth/signin");
      return;
    }

    setReady(true);
  }, [guestId, isExpired, clearGuest, router]);

  if (!ready) return null;

  return (
    <>
      <GuestBanner />
      {children}
    </>
  );
}
