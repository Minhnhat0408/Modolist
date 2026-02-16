import { create } from "zustand";

interface FocusWorldStore {
  isOpen: boolean;
  isMinimized: boolean;
  openWorld: () => void;
  closeWorld: () => void;
  toggleMinimize: () => void;
}

export const useFocusWorldStore = create<FocusWorldStore>((set) => ({
  isOpen: false,
  isMinimized: false,

  openWorld: () => set({ isOpen: true, isMinimized: false }),
  closeWorld: () => set({ isOpen: false, isMinimized: false }),
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
}));
