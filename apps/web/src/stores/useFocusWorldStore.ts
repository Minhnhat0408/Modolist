import { resizePIP } from "@/hooks/usePictureInPicture";
import { create } from "zustand";

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
      resizePIP(140);
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
      resizePIP(200);
      return { isMinimized: !state.isMinimized };
    }),
  setOnlineData: (count, connected) =>
    set({ onlineCount: count, isWorldConnected: connected }),
}));
