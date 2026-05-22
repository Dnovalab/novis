/**
 * Agent Store — 多 Agent 执行状态管理
 *
 * 管理 Agent 执行会话的生命周期：启动、进度追踪、日志、结果收集。
 * 不持久化（执行状态是瞬态的），结果通过 PM Store 持久化。
 */

import { create } from "zustand";
import { usePmStore, type PmPlan } from "@/stores/pm-store";
import {
  executePlan,
  type ExecutionProgress,
  type AgentResult,
} from "@/lib/agent-system";

export type ExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "error";

export interface AgentLog {
  timestamp: number;
  level: "info" | "success" | "error" | "debug";
  message: string;
}

export interface ExecutionSession {
  planId: string;
  status: ExecutionStatus;
  currentBatch: number;
  totalBatches: number;
  completedTasks: number;
  totalTasks: number;
  logs: AgentLog[];
  results: Map<string, AgentResult>;
  startedAt: number | null;
  completedAt: number | null;
}

interface AgentState {
  /** 当前执行会话（同一时间只能执行一个计划） */
  session: ExecutionSession | null;

  /** 启动计划执行 */
  startExecution: (planId: string) => Promise<void>;
  /** 取消执行 */
  cancelExecution: () => void;
  /** 重置状态 */
  reset: () => void;
}

const initialState: ExecutionSession = {
  planId: "",
  status: "idle",
  currentBatch: 0,
  totalBatches: 0,
  completedTasks: 0,
  totalTasks: 0,
  logs: [],
  results: new Map(),
  startedAt: null,
  completedAt: null,
};

let abortFlag = false;

export const useAgentStore = create<AgentState>((set, get) => ({
  session: null,

  startExecution: async (planId: string) => {
    const plan = usePmStore
      .getState()
      .plans.find((p) => p.id === planId);
    if (!plan) return;

    abortFlag = false;

    // 从 settings store 获取当前模型（动态 import 避免循环依赖）
    let modelId = "";
    try {
      const { useSettingsStore } = await import("@/stores/settings-store");
      modelId = useSettingsStore.getState().activeModelId ?? "";
    } catch {
      modelId = "";
    }

    if (!modelId && typeof window !== "undefined" && !(window as any).electronAPI) {
      // 开发模式：使用模拟模型 ID
      modelId = "dev-mode";
    }

    // 计划状态
    const pmStore = usePmStore.getState();
    const session: ExecutionSession = {
      planId,
      status: "running",
      currentBatch: 0,
      totalBatches: 0,
      completedTasks: 0,
      totalTasks: plan.tasks.length,
      logs: [
        {
          timestamp: Date.now(),
          level: "info",
          message: `开始执行计划: ${plan.goal}`,
        },
      ],
      results: new Map(),
      startedAt: Date.now(),
      completedAt: null,
    };

    set({ session });

    // 更新计划状态
    pmStore.updatePlanStatus(planId, "active");

    // 将所有任务置为 pending
    for (const task of plan.tasks) {
      if (task.status === "pending" || task.status === "failed") {
        pmStore.updateTaskStatus(planId, task.id, "pending");
      }
    }

    const addLog = (
      level: AgentLog["level"],
      message: string,
    ) => {
      set((state) => {
        if (!state.session) return state;
        return {
          session: {
            ...state.session,
            logs: [
              ...state.session.logs,
              { timestamp: Date.now(), level, message },
            ],
          },
        };
      });
    };

    const onProgress = (progress: ExecutionProgress) => {
      if (abortFlag) return;

      addLog(
        progress.type === "error"
          ? "error"
          : progress.type === "complete"
            ? "success"
            : "info",
        progress.message,
      );

      set((state) => {
        if (!state.session) return state;
        const updates: Partial<ExecutionSession> = {};

        if (progress.batchIndex !== undefined) {
          updates.currentBatch = progress.batchIndex;
        }
        if (progress.totalBatches !== undefined) {
          updates.totalBatches = progress.totalBatches;
        }
        if (progress.type === "complete") {
          updates.completedTasks = (state.session.completedTasks ?? 0) + 1;
        }

        return {
          session: { ...state.session, ...updates },
        };
      });
    };

    try {
      const results = await executePlan(plan, modelId, onProgress);

      if (abortFlag) {
        addLog("info", "计划执行已取消");
        set((state) => ({
          session: state.session
            ? {
                ...state.session,
                status: "cancelled" as ExecutionStatus,
                completedAt: Date.now(),
              }
            : null,
        }));
        return;
      }

      // 更新 PM Store 任务状态和结果
      for (const [, result] of results) {
        const task = plan.tasks.find((t) => t.id === result.taskId);
        if (!task) continue;

        if (result.error) {
          pmStore.updateTaskStatus(planId, result.taskId, "failed");
          pmStore.updateTaskResult(
            planId,
            result.taskId,
            `**错误**: ${result.error}`,
          );
        } else {
          pmStore.updateTaskStatus(planId, result.taskId, "completed");
          pmStore.updateTaskResult(planId, result.taskId, result.content);
        }
      }

      // 检查是否所有任务都完成了
      const updatedPlan = usePmStore
        .getState()
        .plans.find((p) => p.id === planId);
      const allDone = updatedPlan?.tasks.every(
        (t) => t.status === "completed" || t.status === "failed",
      );
      if (allDone) {
        const hasFailures = updatedPlan?.tasks.some(
          (t) => t.status === "failed",
        );
        pmStore.updatePlanStatus(
          planId,
          hasFailures ? "active" : "completed",
        );
      }

      addLog(
        "success",
        `计划执行完成: ${results.size}/${plan.tasks.length} 个任务`,
      );

      set((state) => ({
        session: state.session
          ? {
              ...state.session,
              status: "completed" as ExecutionStatus,
              completedTasks: results.size,
              results,
              completedAt: Date.now(),
            }
          : null,
      }));
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      addLog("error", `执行异常: ${errorMsg}`);

      set((state) => ({
        session: state.session
          ? {
              ...state.session,
              status: "error" as ExecutionStatus,
              completedAt: Date.now(),
            }
          : null,
      }));
    }
  },

  cancelExecution: () => {
    abortFlag = true;
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            status: "cancelled" as ExecutionStatus,
            completedAt: Date.now(),
          }
        : null,
    }));
  },

  reset: () => set({ session: null }),
}));
