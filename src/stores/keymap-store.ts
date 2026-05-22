/**
 * Keymap Store — 快捷键自定义持久化
 *
 * 用户可以覆盖默认快捷键绑定，自定义绑定保存在 localStorage (dev) / fs (Electron)。
 * keymapStore.getBinding(cmdId, defaultBinding) 返回最终生效的绑定。
 */
import { create } from "zustand";
import type { KeyBinding } from "@/lib/keyboard";

interface KeymapState {
  /** 自定义覆盖：commandId → 自定义 KeyBinding */
  customBindings: Record<string, KeyBinding>;

  /** 录制状态：当前正在录制的命令 ID */
  recording: string | null;

  /** 设置/覆盖命令的快捷键 */
  setBinding: (commandId: string, binding: KeyBinding) => void;

  /** 恢复某个命令为默认（删除自定义覆盖） */
  resetBinding: (commandId: string) => void;

  /** 恢复所有命令为默认 */
  resetAll: () => void;

  /** 获取命令的最终绑定（自定义覆盖优先，否则返回默认） */
  getBinding: (commandId: string, defaultBinding?: KeyBinding) => KeyBinding | undefined;

  /** 开始录制快捷键（设置 recording 状态） */
  startRecording: (commandId: string) => void;

  /** 停止录制 */
  stopRecording: () => void;

  /** 持久化到磁盘 */
  persist: () => void;

  /** 从磁盘加载 */
  loadFromDisk: () => Promise<void>;
}

const STORAGE_KEY = "novis_keymap";

function saveToDisk(data: Record<string, KeyBinding>) {
  try {
    if (window.electronAPI?.fs?.writeFile) {
      // Electron 模式：暂用 localStorage 兜底
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 持久化失败时静默处理
  }
}

function loadFromDiskSync(): Record<string, KeyBinding> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 解析失败时返回空
  }
  return {};
}

export const useKeymapStore = create<KeymapState>((set, get) => ({
  customBindings: loadFromDiskSync(),
  recording: null,

  setBinding: (commandId, binding) => {
    set((state) => {
      const updated = { ...state.customBindings, [commandId]: binding };
      saveToDisk(updated);
      return { customBindings: updated };
    });
  },

  resetBinding: (commandId) => {
    set((state) => {
      const updated = { ...state.customBindings };
      delete updated[commandId];
      saveToDisk(updated);
      return { customBindings: updated };
    });
  },

  resetAll: () => {
    set({ customBindings: {} });
    saveToDisk({});
  },

  getBinding: (commandId, defaultBinding) => {
    const state = get();
    return state.customBindings[commandId] ?? defaultBinding;
  },

  startRecording: (commandId) => {
    set({ recording: commandId });
  },

  stopRecording: () => {
    set({ recording: null });
  },

  persist: () => {
    saveToDisk(get().customBindings);
  },

  loadFromDisk: async () => {
    try {
      const data = loadFromDiskSync();
      set({ customBindings: data });
    } catch {
      // 加载失败时使用空配置
    }
  },
}));
