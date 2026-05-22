import { create } from "zustand";
import {
  type PersistedSettings,
  loadSettings,
  saveSettings,
} from "@/stores/persistence";

type PermissionMode = "suggest" | "auto" | "full";
type ThemeMode = "light" | "dark" | "system";

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface SettingsState {
  // 加载状态
  loaded: boolean;

  // 主题
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // 权限模式
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;

  // 模型配置
  models: ModelConfig[];
  activeModelId: string | null;
  addModel: (model: ModelConfig) => void;
  removeModel: (id: string) => void;
  setActiveModel: (id: string) => void;

  // 侧边栏
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 持久化
  loadFromDisk: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // 加载状态
  loaded: false,

  // 主题
  theme: "light",
  setTheme: (theme) => {
    set({ theme });
    persistSettings(get());
  },

  // 权限模式
  permissionMode: "suggest",
  setPermissionMode: (permissionMode) => {
    set({ permissionMode });
    persistSettings(get());
  },

  // 模型配置
  models: [],
  activeModelId: null,

  addModel: (model) => {
    set((state) => ({ models: [...state.models, model] }));
    persistSettings(get());
  },

  removeModel: (id) => {
    set((state) => ({
      models: state.models.filter((m) => m.id !== id),
      activeModelId:
        state.activeModelId === id ? null : state.activeModelId,
    }));
    persistSettings(get());
  },

  setActiveModel: (activeModelId) => {
    set({ activeModelId });
    persistSettings(get());
  },

  // 侧边栏
  sidebarCollapsed: false,
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
    persistSettings(get());
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed });
    persistSettings(get());
  },

  // 持久化
  loadFromDisk: async () => {
    if (get().loaded) return;
    const saved = await loadSettings();
    set({
      theme: saved.theme,
      permissionMode: saved.permissionMode,
      models: saved.models,
      activeModelId: saved.activeModelId,
      sidebarCollapsed: saved.sidebarCollapsed,
      loaded: true,
    });
  },
}));

/** 提取可持久化的字段 */
function extractPersistable(state: SettingsState): PersistedSettings {
  return {
    theme: state.theme,
    permissionMode: state.permissionMode,
    models: state.models,
    activeModelId: state.activeModelId,
    sidebarCollapsed: state.sidebarCollapsed,
  };
}

/** 持久化到磁盘（防抖） */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persistSettings(state: SettingsState) {
  if (!state.loaded) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettings(extractPersistable(state));
  }, 1000);
}
