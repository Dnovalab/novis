/**
 * 持久化工具 — 自动保存/恢复应用状态
 * 开发模式用 localStorage，Electron 模式优先用 fs IPC
 */

const STORAGE_KEYS = {
  CHAT_HISTORY: "novis_chat_history",
  SETTINGS: "novis_settings",
} as const;

/** 检查当前是否运行在 Electron 环境 */
function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

// ====== 通用读写 ======

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    // Electron 模式：从用户数据目录的 JSON 文件读取
    if (isElectron()) {
      const result = await window.electronAPI!.fs.readFile(
        getDataPath(key),
      );
      if (result.success && result.content) {
        return JSON.parse(result.content) as T;
      }
      return fallback;
    }

    // 开发模式：localStorage
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    return fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, data: T): Promise<void> {
  try {
    const json = JSON.stringify(data, null, 2);

    if (isElectron()) {
      await window.electronAPI!.fs.writeFile(getDataPath(key), json);
    } else {
      localStorage.setItem(key, json);
    }
  } catch {
    // 写入失败时静默处理
  }
}

/** 获取数据文件路径 */
function getDataPath(key: string): string {
  // 在 Electron 中，数据存放在用户目录
  // 这里用绝对路径 + 文件名
  return `novis-data-${key}.json`;
}

// ====== 聊天历史 ======

export interface ChatHistory {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
    };
  }>;
  lastActive: number;
}

export async function loadChatHistory(): Promise<ChatHistory> {
  return read<ChatHistory>(STORAGE_KEYS.CHAT_HISTORY, {
    messages: [],
    lastActive: 0,
  });
}

export async function saveChatHistory(history: ChatHistory): Promise<void> {
  await write(STORAGE_KEYS.CHAT_HISTORY, {
    ...history,
    lastActive: Date.now(),
  });
}

// ====== 设置 ======

export type RouteStrategy = "local-first" | "quality-first" | "manual";

export interface EditorConfig {
  fontSize: number;
  tabSize: number;
  wordWrap: "on" | "off";
  minimapEnabled: boolean;
}

export interface PersistedSettings {
  theme: "light" | "dark" | "system";
  /** 具体主题 ID（如 "one-dark", "nord"），优先于 theme 字段 */
  themeId: string;
  permissionMode: "suggest" | "auto" | "full";
  editor: EditorConfig;
  models: Array<{
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  }>;
  activeModelId: string | null;
  sidebarCollapsed: boolean;

  // Phase 3 — 智能路由 + 省钱体系
  routeStrategy: RouteStrategy;
  monthlyBudgetLimit: number;    // 月度预算上限（元），0 表示不限制
  currentMonthSpending: number;  // 本月已花费（元）
  budgetMonth: string;           // 当前预算月份 "YYYY-MM"
}

export async function loadSettings(): Promise<PersistedSettings> {
  return read<PersistedSettings>(STORAGE_KEYS.SETTINGS, {
    theme: "light",
    themeId: "default-dark",
    permissionMode: "suggest",
    models: [],
    activeModelId: null,
    sidebarCollapsed: false,
    routeStrategy: "manual",
    monthlyBudgetLimit: 30,
    currentMonthSpending: 0,
    budgetMonth: getCurrentMonth(),
    editor: { fontSize: 14, tabSize: 2, wordWrap: "on", minimapEnabled: true },
  });
}

/** 默认编辑器配置 */
export function defaultEditorConfig(): EditorConfig {
  return { fontSize: 14, tabSize: 2, wordWrap: "on", minimapEnabled: true };
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function saveSettings(
  settings: PersistedSettings,
): Promise<void> {
  await write(STORAGE_KEYS.SETTINGS, settings);
}
