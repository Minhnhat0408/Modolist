"use client";

import { useSyncExternalStore } from "react";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function setGuestCookie() {
  document.cookie = "guestMode=1; path=/; max-age=2592000; SameSite=Lax"; // 30 days
}

export function clearGuestCookie() {
  document.cookie = "guestMode=; path=/; max-age=0";
}

function subscribe(cb: () => void) {
  // Re-check on storage changes (e.g. other tabs)
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getSnapshot() {
  return getCookie("guestMode") === "1";
}

function getServerSnapshot() {
  return false;
}

export function useIsGuest(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
