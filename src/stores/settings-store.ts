import { create } from "zustand";
import {
  type PersistedSettings,
  type EditorConfig,
  type RouteStrategy,
  defaultEditorConfig,
  loadSettings,
  saveSettings,
} from "@/stores/persistence";
import { DEFAULT_THEME_ID } from "@/lib/themes";

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
  /** 具体主题 ID（如 "one-dark", "nord"） */
  themeId: string;
  /** 设置具体主题 */
  setThemeId: (id: string) => void;

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

  // Phase 3 — 智能路由
  routeStrategy: RouteStrategy;
  setRouteStrategy: (strategy: RouteStrategy) => void;
  routeReason: string;
  setRouteReason: (reason: string) => void;

  // Phase 3 — 月度预算
  monthlyBudgetLimit: number;
  currentMonthSpending: number;
  setMonthlyBudgetLimit: (limit: number) => void;
  addSpending: (cost: number) => void;

  // 编辑器配置
  editor: EditorConfig;
  setEditorConfig: (config: Partial<EditorConfig>) => void;
  setFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
  setWordWrap: (wrap: "on" | "off") => void;
  setMinimapEnabled: (enabled: boolean) => void;

  // 持久化
  loadFromDisk: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // 加载状态
  loaded: false,

  // 主题
  theme: "light",
  themeId: DEFAULT_THEME_ID,
  setTheme: (theme) => {
    set({ theme });
    persistSettings(get());
  },
  setThemeId: (themeId) => {
    set({ themeId });
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

  // Phase 3 — 智能路由
  routeStrategy: "manual",
  setRouteStrategy: (routeStrategy) => {
    set({ routeStrategy });
    persistSettings(get());
  },
  routeReason: "",
  setRouteReason: (routeReason) => set({ routeReason }),

  // Phase 3 — 月度预算
  monthlyBudgetLimit: 30,
  currentMonthSpending: 0,
  setMonthlyBudgetLimit: (monthlyBudgetLimit) => {
    set({ monthlyBudgetLimit });
    persistSettings(get());
  },
  addSpending: (cost) => {
    const state = get();
    if (cost <= 0) return;
    const newTotal = state.currentMonthSpending + cost;
    set({ currentMonthSpending: newTotal });
    persistSettings(get());
  },

  // 编辑器配置
  editor: { fontSize: 14, tabSize: 2, wordWrap: "on", minimapEnabled: true },
  setEditorConfig: (config) => {
    set((state) => ({ editor: { ...state.editor, ...config } }));
    persistSettings(get());
  },
  setFontSize: (fontSize) => {
    set((state) => ({ editor: { ...state.editor, fontSize } }));
    persistSettings(get());
  },
  setTabSize: (tabSize) => {
    set((state) => ({ editor: { ...state.editor, tabSize } }));
    persistSettings(get());
  },
  setWordWrap: (wordWrap) => {
    set((state) => ({ editor: { ...state.editor, wordWrap } }));
    persistSettings(get());
  },
  setMinimapEnabled: (minimapEnabled) => {
    set((state) => ({ editor: { ...state.editor, minimapEnabled } }));
    persistSettings(get());
  },

  // 持久化
  loadFromDisk: async () => {
    if (get().loaded) return;
    const saved = await loadSettings();
    const budgetReset = checkBudgetReset(saved);
    set({
      theme: saved.theme,
      themeId: saved.themeId ?? DEFAULT_THEME_ID,
      permissionMode: saved.permissionMode,
      editor: saved.editor ?? defaultEditorConfig(),
      models: saved.models,
      activeModelId: saved.activeModelId,
      sidebarCollapsed: saved.sidebarCollapsed,
      routeStrategy: saved.routeStrategy,
      monthlyBudgetLimit: saved.monthlyBudgetLimit,
      currentMonthSpending: budgetReset.currentMonthSpending,
      loaded: true,
    });
  },
}));

/** 提取可持久化的字段 */
function extractPersistable(state: SettingsState): PersistedSettings {
  return {
    theme: state.theme,
    themeId: state.themeId,
    permissionMode: state.permissionMode,
    editor: state.editor,
    models: state.models,
    activeModelId: state.activeModelId,
    sidebarCollapsed: state.sidebarCollapsed,
    routeStrategy: state.routeStrategy,
    monthlyBudgetLimit: state.monthlyBudgetLimit,
    currentMonthSpending: state.currentMonthSpending,
    budgetMonth: getCurrentMonth(),
  };
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 检查是否是新的月份，如果是则重置月度花费 */
export function checkBudgetReset(saved: { currentMonthSpending: number; budgetMonth: string }): { currentMonthSpending: number; budgetMonth: string } {
  const current = getCurrentMonth();
  if (saved.budgetMonth !== current) {
    return { currentMonthSpending: 0, budgetMonth: current };
  }
  return { currentMonthSpending: saved.currentMonthSpending, budgetMonth: saved.budgetMonth };
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
