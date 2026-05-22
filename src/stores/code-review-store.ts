/**
 * Code Review Store — 代码审查状态管理
 *
 * 管理审查历史、当前审查结果、审查状态。
 * 不持久化（审查结果是瞬态的，需要新审查时重新生成）。
 */

import { create } from "zustand";

// ====== 类型定义 ======

export interface ReviewIssue {
  severity: "critical" | "warning" | "suggestion";
  file?: string;
  line?: number;
  title: string;
  description: string;
  suggestion?: string;
}

export interface ReviewResult {
  summary: string;
  score: number;
  issues: ReviewIssue[];
  error?: string;
}

export interface ReviewRecord {
  id: string;
  type: "diff" | "file" | "manual";
  label: string;
  result: ReviewResult;
  createdAt: number;
}

export type ReviewStatus =
  | "idle"
  | "loading"
  | "completed"
  | "error";

interface CodeReviewState {
  /** 当前审查状态 */
  status: ReviewStatus;
  /** 当前审查结果 */
  currentResult: ReviewResult | null;
  /** 审查历史 */
  history: ReviewRecord[];
  /** 错误消息 */
  error: string | null;

  /** 设置审查结果 */
  setResult: (result: ReviewResult) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置错误 */
  setError: (error: string) => void;
  /** 添加历史记录 */
  addHistory: (record: ReviewRecord) => void;
  /** 清空当前审查 */
  clearCurrent: () => void;
  /** 清空所有历史 */
  clearHistory: () => void;
}

let reviewIdCounter = Date.now();

export const useCodeReviewStore = create<CodeReviewState>((set, get) => ({
  status: "idle",
  currentResult: null,
  history: [],
  error: null,

  setResult: (result) =>
    set({
      currentResult: result,
      status: result.error ? "error" : "completed",
      error: result.error ?? null,
    }),

  setLoading: (loading) =>
    set({ status: loading ? "loading" : "idle" }),

  setError: (error) =>
    set({ status: "error", error, currentResult: null }),

  addHistory: (record) =>
    set((state) => ({
      history: [record, ...state.history].slice(0, 50), // 最多保留 50 条
    })),

  clearCurrent: () =>
    set({ currentResult: null, status: "idle", error: null }),

  clearHistory: () => set({ history: [] }),
}));

/** 生成审查记录 ID */
export function genReviewId(): string {
  return `review-${++reviewIdCounter}`;
}
