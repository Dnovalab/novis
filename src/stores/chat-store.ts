import { create } from "zustand";
import {
  type ChatHistory,
  loadChatHistory,
  saveChatHistory,
} from "@/stores/persistence";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: Message[];
  isProcessing: boolean;
  loaded: boolean;

  /** 从持久化存储加载历史（启动时调用） */
  loadFromDisk: () => Promise<void>;
  /** 添加消息 */
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  /** 设置处理状态 */
  setProcessing: (processing: boolean) => void;
  /** 清空所有消息 */
  clearMessages: () => void;
}

let messageId = Date.now();

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isProcessing: false,
  loaded: false,

  loadFromDisk: async () => {
    if (get().loaded) return;
    const history = await loadChatHistory();
    set({
      messages: history.messages,
      loaded: true,
    });
    // 恢复消息 ID 计数器
    const maxId = history.messages.reduce(
      (max, m) => Math.max(max, parseInt(m.id.split("-")[1] ?? "0")),
      0,
    );
    messageId = Math.max(messageId, maxId + 1);
  },

  addMessage: (message) =>
    set((state) => {
      const newMessages = [
        ...state.messages,
        {
          ...message,
          id: `msg-${++messageId}`,
          timestamp: Date.now(),
        },
      ];
      // 自动保存到磁盘（防抖）
      debouncedSave(newMessages);
      return { messages: newMessages };
    }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  clearMessages: () => {
    set({ messages: [] });
    // 立即清空持久化
    saveChatHistory({ messages: [], lastActive: 0 });
  },
}));

// ====== 防抖存储 ======

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(messages: Message[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveChatHistory({
      messages,
      lastActive: Date.now(),
    });
  }, 2000); // 2 秒防抖
}
