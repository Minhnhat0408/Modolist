"use client";

/**
 * Picture-in-Picture manager (Document PiP API).
 *
 * Opens a small always-on-top window that stays visible even when the user
 * switches to VS Code, another tab, or another app.
 *
 * Uses a SEPARATE React root inside the PiP window (because createPortal
 * can't forward native browser events across documents). Zustand stores
 * are global singletons, so PipContent subscribes to the same state.
 *
 * Fallback: if the browser doesn't support Document PiP, openPip() returns
 * false and the existing in-page floating widgets render normally.
 */

import { useSyncExternalStore, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// ── Module-level singleton ──────────────────────────────────────────────

let pipWindow: Window | null = null;
let pipRoot: Root | null = null;
let _active = false;
const subs = new Set<() => void>();

function notify() {
  _active = !!pipWindow;
  subs.forEach((fn) => fn());
}

// ── React hook ──────────────────────────────────────────────────────────

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const getSnapshot = () => _active;

/** Returns `true` while a PiP window is open. Reactive (triggers re-render). */
export function usePipActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function copyStyles(src: Document, dst: Document) {
  for (const sheet of src.styleSheets) {
    try {
      if (sheet.cssRules) {
        const style = dst.createElement("style");
        style.textContent = [...sheet.cssRules]
          .map((r) => r.cssText)
          .join("\n");
        dst.head.appendChild(style);
      }
    } catch {
      // Cross-origin sheet — copy as <link>
      if (sheet.href) {
        const link = dst.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        dst.head.appendChild(link);
      }
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Open a PiP window and render the focus timer inside it.
 * Must be called within a user gesture (click / keydown).
 * Returns `true` if PiP opened (or was already open).
 */
export async function openPip(height: number, width: number): Promise<boolean> {
  if (pipWindow) return true;
  if (
    typeof window === "undefined" ||
    !("documentPictureInPicture" in window)
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).documentPictureInPicture;
    const win: Window = await api.requestWindow({
      width: width,
      height: height,
    });
    pipWindow = win;

    // Copy all Tailwind / app styles so classes work
    copyStyles(document, win.document);

    // Propagate dark/light theme from main document
    win.document.documentElement.className = document.documentElement.className;

    // Keep pip theme in sync if user toggles while pip is open
    const themeObserver = new MutationObserver(() => {
      if (!pipWindow) return;
      pipWindow.document.documentElement.className =
        document.documentElement.className;
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    win.addEventListener("pagehide", () => themeObserver.disconnect(), {
      once: true,
    });

    const body = win.document.body;
    const isDark = document.documentElement.classList.contains("dark");
    body.className = isDark
      ? "m-0 p-0 min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 bg-no-repeat bg-fixed"
      : "m-0 p-0 min-h-screen bg-white bg-no-repeat bg-fixed";

    const container = win.document.createElement("div");
    container.style.cssText = "width:100%;height:100vh;";
    body.appendChild(container);

    // Lazy-import to avoid circular deps
    const { PipContent } = await import("../components/focus/PipContent");
    const { NextIntlClientProvider } = await import("next-intl");

    // Read locale from localStorage preference or NEXT_LOCALE cookie, fallback to "vi"
    const cookieLocale = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1];
    const locale = (localStorage.getItem("modolist-locale") ?? cookieLocale ?? "vi") as "vi" | "en" | "ja";
    const validLocales = ["vi", "en", "ja"];
    const safeLocale = validLocales.includes(locale) ? locale : "vi";
    const messages = (await import(`../messages/${safeLocale}.json`)).default as Record<string, unknown>;

    pipRoot = createRoot(container);
    pipRoot.render(
      createElement(
        NextIntlClientProvider,
        { locale: safeLocale, messages },
        createElement(PipContent, { onClose: closePip }),
      ),
    );

    // When user closes the PiP window manually → clean up
    win.addEventListener("pagehide", () => {
      pipRoot?.unmount();
      pipRoot = null;
      pipWindow = null;
      notify();
    });

    notify();
    return true;
  } catch (err) {
    console.warn("Picture-in-Picture failed:", err);
    return false;
  }
}

/** Close the PiP window and unmount its React root. */
export function closePip() {
  pipRoot?.unmount();
  pipRoot = null;
  pipWindow?.close();
  pipWindow = null;
  notify();
}

/** Feature-detect the Document PiP API. */
export function isPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

/** Returns true if a PiP window is currently open (non-reactive). */
export function isPipOpen(): boolean {
  return _active;
}

/** Content heights per tab type (px). */
export const PIP_CONTENT_H = { timer: 150, world: 120, spotify: 160 } as const;
/** Height of the tab bar when multiple tabs are visible. */
export const PIP_TAB_BAR_H = 38;

/**
 * Compute the correct PiP height given which tabs will be visible.
 * - Single tab → content height only (no tab bar)
 * - Multiple tabs → tab bar + tallest possible content (spotify if present, else 130)
 *
 * NOTE: call this from click handlers only — resizeTo() requires a user gesture.
 */
export function calcPIPHeight(tabs: {
  timer: boolean;
  world: boolean;
  spotify: boolean;
  target: "timer" | "world" | "spotify";
}): number {
  const contentH =
    tabs.spotify && tabs.target != "spotify"
      ? PIP_CONTENT_H.spotify
      : PIP_CONTENT_H.timer;

  return PIP_TAB_BAR_H + contentH;
}

/**
 * Resize the PiP window.
 * Must be called from a user-gesture handler (click / keydown).
 */
export function resizePIP(height: number): void {
  if (!pipWindow) return;
  pipWindow.resizeTo(460, height);
}
