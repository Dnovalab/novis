import { create } from "zustand";

interface CursorPosition {
  lineNumber: number;
  column: number;
  /** 选中字符数（0 表示无选中） */
  selectionLength: number;
}

interface CursorStore {
  position: CursorPosition | null;
  setPosition: (pos: CursorPosition) => void;
  clearPosition: () => void;
}

export const useCursorStore = create<CursorStore>((set) => ({
  position: null,
  setPosition: (pos) => set({ position: pos }),
  clearPosition: () => set({ position: null }),
}));
