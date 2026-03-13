import { create } from "zustand";
import { useFocusStore } from "./useFocusStore";

interface FocusWorldStore {
  isOpen: boolean;
  isMinimized: boolean;
  /** Number of other users currently online (synced from FloatingWorldButton) */
  onlineCount: number;
  /** Whether the WebSocket to Focus World is connected */
  isWorldConnected: boolean;
  openWorld: () => void;
  closeWorld: () => void;
  toggleMinimize: () => void;
  /** Called by FloatingWorldButton to sync live data into the store for PiP */
  setOnlineData: (count: number, connected: boolean) => void;
}

export const useFocusWorldStore = create<FocusWorldStore>((set) => ({
  isOpen: false,
  isMinimized: false,
  onlineCount: 0,
  isWorldConnected: false,

  openWorld: () => set({ isOpen: true, isMinimized: false }),
  closeWorld: () =>
    set((state) => {
      if (!state.isOpen) return state;
      return {
        isOpen: false,
        isMinimized: false,
        onlineCount: 0,
        isWorldConnected: false,
      };
    }),
  toggleMinimize: () =>
    set((state) => {
      if (!state.isOpen) return state;
      return { isMinimized: !state.isMinimized };
    }),
  setOnlineData: (count, connected) =>
    set({ onlineCount: count, isWorldConnected: connected }),
}));

// ── Auto-close Focus World when the timer stops ─────────────────────────
// Focus World is only meaningful while a focus session is active.
// Subscribe to useFocusStore at the module level (runs once, no component needed).
const STOPPED_STATUSES = new Set(["idle", "completed", "all_completed"]);

useFocusStore.subscribe((state, prevState) => {
  if (
    STOPPED_STATUSES.has(state.status) &&
    !STOPPED_STATUSES.has(prevState.status)
  ) {
    useFocusWorldStore.getState().closeWorld();
  }
});
