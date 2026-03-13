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
export async function openPip(): Promise<boolean> {
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
      width: 480,
      height: 140,
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
    pipRoot = createRoot(container);
    pipRoot.render(createElement(PipContent, { onClose: closePip }));

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

/**
 * Resize the PiP window.
 * - Pass an explicit `height` to set it directly.
 * - Omit `height` to auto-detect: 150px when Focus World tab is visible, 130px otherwise.
 */
export function resizePIP(height: number): void {
  if (!pipWindow) return;
  pipWindow.resizeTo(480, height);
}
