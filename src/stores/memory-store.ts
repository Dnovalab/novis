/**
 * Memory Store — AI 记忆系统
 *
 * 持久化存储项目事实、架构决策、编码偏好等信息，
 * 自动注入到 AI 对话的上下文中，让模型"记住"项目背景。
 */

import { create } from "zustand";

// ====== 类型定义 ======

export type MemoryType = "fact" | "decision" | "preference" | "note";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type MemorySort = "newest" | "oldest" | "type";

const typeLabels: Record<MemoryType, string> = {
  fact: "项目事实",
  decision: "架构决策",
  preference: "编码偏好",
  note: "通用笔记",
};

const typeColors: Record<MemoryType, string> = {
  fact: "text-blue-500 bg-blue-500/10",
  decision: "text-amber-500 bg-amber-500/10",
  preference: "text-green-500 bg-green-500/10",
  note: "text-muted-foreground bg-muted",
};

export { typeLabels, typeColors };

// ====== 持久化 ======

const STORAGE_KEY = "novis_memory";

interface PersistedMemory {
  entries: MemoryEntry[];
}

async function loadPersisted(): Promise<PersistedMemory> {
  try {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.fs.readFile(
        `novis-data-${STORAGE_KEY}.json`,
      );
      if (result.success && result.content) {
        return JSON.parse(result.content);
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 静默处理
  }
  return { entries: [] };
}

async function persistState(data: PersistedMemory): Promise<void> {
  try {
    const json = JSON.stringify(data, null, 2);
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      await (window as any).electronAPI.fs.writeFile(
        `novis-data-${STORAGE_KEY}.json`,
        json,
      );
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  } catch {
    // 静默处理
  }
}

// ====== ID 生成 ======

let idCounter = Date.now();
function genId(): string {
  return `mem-${++idCounter}`;
}

// ====== 防抖持久化 ======

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(getState: () => MemoryState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = getState();
    if (!state.loaded) return;
    persistState({ entries: state.entries });
  }, 1000);
}

// ====== Store ======

interface MemoryState {
  entries: MemoryEntry[];
  loaded: boolean;
  filterType: MemoryType | "all";
  sortBy: MemorySort;
  searchQuery: string;

  loadFromDisk: () => Promise<void>;

  // CRUD
  addEntry: (type: MemoryType, content: string, tags?: string[]) => string;
  updateEntry: (id: string, updates: Partial<Omit<MemoryEntry, "id" | "createdAt">>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;

  // 查询
  setFilterType: (type: MemoryType | "all") => void;
  setSortBy: (sort: MemorySort) => void;
  setSearchQuery: (query: string) => void;
  getFiltered: () => MemoryEntry[];

  // Chat 集成 — 格式化为上下文
  getMemoryContext: (maxEntries?: number) => string;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  entries: [],
  loaded: false,
  filterType: "all",
  sortBy: "newest",
  searchQuery: "",

  loadFromDisk: async () => {
    if (get().loaded) return;
    const data = await loadPersisted();

    // 恢复 ID 计数器
    const maxId = data.entries
      .map((e) => parseInt(e.id.split("-")[1] ?? "0"))
      .reduce((max, id) => Math.max(max, id), 0);
    idCounter = Math.max(idCounter, maxId + 1);

    set({ entries: data.entries, loaded: true });
  },

  addEntry: (type, content, tags = []) => {
    const id = genId();
    const now = Date.now();
    const entry: MemoryEntry = {
      id,
      type,
      content: content.trim(),
      tags,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ entries: [entry, ...state.entries] }));
    scheduleSave(get);
    return id;
  },

  updateEntry: (id, updates) => {
    const now = Date.now();
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: now } : e,
      ),
    }));
    scheduleSave(get);
  },

  removeEntry: (id) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
    scheduleSave(get);
  },

  clearAll: () => {
    set({ entries: [] });
    scheduleSave(get);
  },

  setFilterType: (filterType) => set({ filterType }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  getFiltered: () => {
    const state = get();
    let result = [...state.entries];

    // 筛选
    if (state.filterType !== "all") {
      result = result.filter((e) => e.type === state.filterType);
    }

    // 搜索
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.content.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // 排序
    switch (state.sortBy) {
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "oldest":
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "type":
        result.sort((a, b) => a.type.localeCompare(b.type));
        break;
    }

    return result;
  },

  getMemoryContext: (maxEntries = 15) => {
    const entries = get().entries.slice(0, maxEntries);
    if (entries.length === 0) return "";

    const lines: string[] = ["以下是关于当前项目的已知信息："];
    for (const entry of entries) {
      const typeTag = `[${typeLabels[entry.type]}]`;
      const tagsStr = entry.tags.length > 0
        ? ` (${entry.tags.join(", ")})`
        : "";
      lines.push(`- ${typeTag}${tagsStr} ${entry.content}`);
    }
    return lines.join("\n");
  },
}));
