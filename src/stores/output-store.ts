import { create } from "zustand";

export interface OutputChannel {
  /** 通道唯一标识 */
  id: string;
  /** 显示名称 */
  label: string;
  /** 输出条目 */
  entries: OutputEntry[];
}

export interface OutputEntry {
  /** 时间戳 */
  timestamp: number;
  /** 消息内容 */
  message: string;
  /** 级别 */
  level: "info" | "warn" | "error" | "success";
}

interface OutputStore {
  /** 所有输出通道 */
  channels: OutputChannel[];
  /** 当前激活的通道 ID */
  activeChannelId: string | null;

  /** 追加消息到指定通道（如通道不存在则自动创建） */
  append: (channelId: string, channelLabel: string, message: string, level?: OutputEntry["level"]) => void;
  /** 清空指定通道 */
  clear: (channelId: string) => void;
  /** 清空所有通道 */
  clearAll: () => void;
  /** 切换激活通道 */
  setActiveChannel: (channelId: string) => void;
}

/** 内置通道定义 */
export const BUILT_IN_CHANNELS: Array<{ id: string; label: string }> = [
  { id: "build", label: "构建" },
  { id: "git", label: "Git" },
  { id: "extension", label: "扩展" },
  { id: "agent", label: "Agent" },
];

export const useOutputStore = create<OutputStore>((set) => ({
  channels: BUILT_IN_CHANNELS.map((c) => ({ ...c, entries: [] })),
  activeChannelId: "build",

  append: (channelId, channelLabel, message, level = "info") =>
    set((state) => {
      const existing = state.channels.find((c) => c.id === channelId);
      if (existing) {
        return {
          channels: state.channels.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  entries: [
                    ...c.entries,
                    { timestamp: Date.now(), message, level },
                  ].slice(-1000), // 上限 1000 条
                }
              : c,
          ),
        };
      }
      // 自动创建新通道
      return {
        channels: [
          ...state.channels,
          { id: channelId, label: channelLabel, entries: [{ timestamp: Date.now(), message, level }] },
        ],
        activeChannelId: channelId,
      };
    }),

  clear: (channelId) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, entries: [] } : c,
      ),
    })),

  clearAll: () =>
    set((state) => ({
      channels: state.channels.map((c) => ({ ...c, entries: [] })),
    })),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
}));
