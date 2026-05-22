/**
 * PM Store — 多 Agent 计划/任务/检查点管理
 *
 * 管理用户定义的项目计划、任务分解、执行状态追踪和检查点快照。
 * 支持持久化存储（localStorage / Electron fs）。
 */

import { create } from "zustand";

// ====== 类型定义 ======

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type PlanStatus = "draft" | "active" | "completed" | "archived";

export interface PmTask {
  id: string;
  title: string;
  description: string;
  /** 负责的 Agent 角色（如 "前端"、"后端"、"设计"、"测试"） */
  agent: string;
  status: TaskStatus;
  /** 依赖的任务 ID 列表 */
  dependsOn: string[];
  /** 执行结果摘要 */
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PmPlan {
  id: string;
  /** 计划目标描述 */
  goal: string;
  tasks: PmTask[];
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PmCheckpoint {
  id: string;
  planId: string;
  name: string;
  description: string;
  /** 快照 — 保存时各任务的状态 */
  taskSnapshots: Array<{
    taskId: string;
    status: TaskStatus;
    result?: string;
  }>;
  planStatus: PlanStatus;
  createdAt: number;
}

// ====== 持久化帮助函数 ======

const STORAGE_KEY = "novis_pm";

interface PersistedPm {
  plans: PmPlan[];
  activePlanId: string | null;
  checkpoints: PmCheckpoint[];
}

async function loadPersisted(): Promise<PersistedPm> {
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
  return { plans: [], activePlanId: null, checkpoints: [] };
}

async function persistState(data: PersistedPm): Promise<void> {
  try {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      await (window as any).electronAPI.fs.writeFile(
        `novis-data-${STORAGE_KEY}.json`,
        JSON.stringify(data, null, 2),
      );
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // 静默处理
  }
}

// ====== 工具函数 ======

let taskIdCounter = Date.now();
let planIdCounter = Date.now();
let checkpointIdCounter = Date.now();

function genTaskId(): string {
  return `task-${++taskIdCounter}`;
}
function genPlanId(): string {
  return `plan-${++planIdCounter}`;
}
function genCheckpointId(): string {
  return `cp-${++checkpointIdCounter}`;
}

// ====== 防抖持久化 ======

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(getState: () => PmState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = getState();
    if (!state.loaded) return;
    persistState({
      plans: state.plans,
      activePlanId: state.activePlanId,
      checkpoints: state.checkpoints,
    });
  }, 1500);
}

// ====== Store ======

interface PmState {
  plans: PmPlan[];
  activePlanId: string | null;
  checkpoints: PmCheckpoint[];
  loaded: boolean;

  loadFromDisk: () => Promise<void>;

  // 计划操作
  addPlan: (goal: string, tasks?: Omit<PmTask, "id" | "createdAt" | "updatedAt">[]) => string;
  removePlan: (planId: string) => void;
  setActivePlan: (planId: string | null) => void;
  updatePlanGoal: (planId: string, goal: string) => void;
  updatePlanStatus: (planId: string, status: PlanStatus) => void;

  // 任务操作
  addTask: (
    planId: string,
    task: Omit<PmTask, "id" | "createdAt" | "updatedAt">,
  ) => void;
  updateTaskStatus: (planId: string, taskId: string, status: TaskStatus) => void;
  updateTaskResult: (planId: string, taskId: string, result: string) => void;
  updateTask: (planId: string, taskId: string, updates: Partial<Omit<PmTask, "id" | "createdAt" | "updatedAt">>) => void;
  removeTask: (planId: string, taskId: string) => void;
  reorderTasks: (planId: string, taskIds: string[]) => void;

  // 检查点
  saveCheckpoint: (planId: string, name: string, description?: string) => string;
  restoreCheckpoint: (checkpointId: string) => void;
  removeCheckpoint: (checkpointId: string) => void;

  // Agent 角色预设
  availableAgents: string[];
}

export const usePmStore = create<PmState>((set, get) => ({
  plans: [],
  activePlanId: null,
  checkpoints: [],
  loaded: false,

  availableAgents: ["架构师", "前端", "后端", "设计", "测试"],

  loadFromDisk: async () => {
    if (get().loaded) return;
    const data = await loadPersisted();
    // 恢复 ID 计数器
    const maxTaskId = data.plans
      .flatMap((p) => p.tasks.map((t) => parseInt(t.id.split("-")[1] ?? "0")))
      .reduce((max, id) => Math.max(max, id), 0);
    taskIdCounter = Math.max(taskIdCounter, maxTaskId + 1);

    const maxPlanId = data.plans
      .map((p) => parseInt(p.id.split("-")[1] ?? "0"))
      .reduce((max, id) => Math.max(max, id), 0);
    planIdCounter = Math.max(planIdCounter, maxPlanId + 1);

    const maxCpId = data.checkpoints
      .map((c) => parseInt(c.id.split("-")[1] ?? "0"))
      .reduce((max, id) => Math.max(max, id), 0);
    checkpointIdCounter = Math.max(checkpointIdCounter, maxCpId + 1);

    set({
      plans: data.plans,
      activePlanId: data.activePlanId,
      checkpoints: data.checkpoints,
      loaded: true,
    });
  },

  // ====== 计划操作 ======

  addPlan: (goal, tasks) => {
    const planId = genPlanId();
    const now = Date.now();
    const newPlan: PmPlan = {
      id: planId,
      goal,
      status: "draft",
      tasks: (tasks ?? []).map((t) => ({
        ...t,
        id: genTaskId(),
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      plans: [newPlan, ...state.plans],
      activePlanId: planId,
    }));
    scheduleSave(get);
    return planId;
  },

  removePlan: (planId) => {
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== planId),
      activePlanId:
        state.activePlanId === planId ? null : state.activePlanId,
      checkpoints: state.checkpoints.filter((c) => c.planId !== planId),
    }));
    scheduleSave(get);
  },

  setActivePlan: (planId) => {
    set({ activePlanId: planId });
    scheduleSave(get);
  },

  updatePlanGoal: (planId, goal) => {
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, goal, updatedAt: Date.now() } : p,
      ),
    }));
    scheduleSave(get);
  },

  updatePlanStatus: (planId, status) => {
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, status, updatedAt: Date.now() } : p,
      ),
    }));
    scheduleSave(get);
  },

  // ====== 任务操作 ======

  addTask: (planId, task) => {
    const now = Date.now();
    const newTask: PmTask = {
      ...task,
      id: genTaskId(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, tasks: [...p.tasks, newTask], updatedAt: now }
          : p,
      ),
    }));
    scheduleSave(get);
  },

  updateTaskStatus: (planId, taskId, status) => {
    const now = Date.now();
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, status, updatedAt: now }
                  : t,
              ),
              updatedAt: now,
            }
          : p,
      ),
    }));
    scheduleSave(get);
  },

  updateTaskResult: (planId, taskId, result) => {
    const now = Date.now();
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, result, updatedAt: now }
                  : t,
              ),
              updatedAt: now,
            }
          : p,
      ),
    }));
    scheduleSave(get);
  },

  updateTask: (planId, taskId, updates) => {
    const now = Date.now();
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, ...updates, updatedAt: now }
                  : t,
              ),
              updatedAt: now,
            }
          : p,
      ),
    }));
    scheduleSave(get);
  },

  removeTask: (planId, taskId) => {
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              tasks: p.tasks.filter((t) => t.id !== taskId),
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
    scheduleSave(get);
  },

  reorderTasks: (planId, taskIds) => {
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        const taskMap = new Map(p.tasks.map((t) => [t.id, t]));
        const reordered = taskIds
          .map((id) => taskMap.get(id))
          .filter(Boolean) as PmTask[];
        // 补充不在排序列表中的任务
        const remaining = p.tasks.filter((t) => !taskIds.includes(t.id));
        return {
          ...p,
          tasks: [...reordered, ...remaining],
          updatedAt: Date.now(),
        };
      }),
    }));
    scheduleSave(get);
  },

  // ====== 检查点 ======

  saveCheckpoint: (planId, name, description = "") => {
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) return "";

    const cpId = genCheckpointId();
    const checkpoint: PmCheckpoint = {
      id: cpId,
      planId,
      name,
      description,
      taskSnapshots: plan.tasks.map((t) => ({
        taskId: t.id,
        status: t.status,
        result: t.result,
      })),
      planStatus: plan.status,
      createdAt: Date.now(),
    };

    set((state) => ({
      checkpoints: [checkpoint, ...state.checkpoints],
    }));
    scheduleSave(get);
    return cpId;
  },

  restoreCheckpoint: (checkpointId) => {
    const cp = get().checkpoints.find((c) => c.id === checkpointId);
    if (!cp) return;

    const now = Date.now();
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== cp.planId) return p;
        const snapshotMap = new Map(
          cp.taskSnapshots.map((s) => [s.taskId, s]),
        );
        return {
          ...p,
          status: cp.planStatus,
          tasks: p.tasks.map((t) => {
            const snap = snapshotMap.get(t.id);
            return snap
              ? { ...t, status: snap.status, result: snap.result, updatedAt: now }
              : t;
          }),
          updatedAt: now,
        };
      }),
    }));
    scheduleSave(get);
  },

  removeCheckpoint: (checkpointId) => {
    set((state) => ({
      checkpoints: state.checkpoints.filter((c) => c.id !== checkpointId),
    }));
    scheduleSave(get);
  },
}));
