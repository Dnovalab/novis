/**
 * PM Panel — 多 Agent 计划管理面板
 *
 * 功能：
 * - 创建/管理项目计划
 * - 任务分解（手动或 AI 辅助生成）
 * - 任务状态追踪（待处理/进行中/已完成/失败）
 * - Agent 角色分配
 * - 依赖关系管理
 * - 检查点保存/恢复
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ListTodo,
  Save,
  RotateCcw,
  GitFork,
  Play,
  Pause,
  Archive,
  FileText,
  UserCheck,
  Bot,
  Sparkles,
  ChevronRight,
  ChevronDown,
  GripVertical,
  X,
} from "lucide-react";
import { usePmStore, type PmTask, type PmPlan } from "@/stores/pm-store";
import { useAgentStore } from "@/stores/agent-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ====== 状态图标映射 ======

const statusIcons: Record<string, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const statusColors: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-500",
  completed: "text-green-500",
  failed: "text-red-500",
};

const statusLabels: Record<string, string> = {
  pending: "待处理",
  in_progress: "进行中",
  completed: "已完成",
  failed: "失败",
};

// ====== 子组件：新建计划 ======

function NewPlanForm({ onClose }: { onClose: () => void }) {
  const [goal, setGoal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const addPlan = usePmStore((s) => s.addPlan);

  const handleSubmit = () => {
    if (!goal.trim()) return;
    addPlan(goal.trim());
    setGoal("");
    onClose();
  };

  /** AI 自动生成计划 — 调用模型分解任务 */
  const handleAiGenerate = async () => {
    if (!goal.trim()) return;
    setAiLoading(true);
    setAiError("");

    try {
      // 开发模式（非 Electron）用模拟数据
      if (!window.electronAPI) {
        await simulateAiPlan(goal.trim(), addPlan, onClose);
        return;
      }

      // 获取当前激活的模型
      const settingsStore = (await import("@/stores/settings-store")).useSettingsStore;
      const state = settingsStore.getState();
      const modelId = state.activeModelId;
      if (!modelId) {
        setAiError("请先在设置中选择一个模型");
        setAiLoading(false);
        return;
      }

      // 构建 prompt
      const systemPrompt = `你是一个软件项目管理专家。请将以下开发目标分解为具体可执行的任务。
每个任务指定负责的角色，角色可选：架构师、前端、后端、设计、测试。

返回格式（必须是纯 JSON，不要包含 markdown 代码块标记）：
{
  "tasks": [
    {"title": "任务标题", "description": "任务描述", "agent": "前端"}
  ]
}

注意：
- title 控制在 20 字以内
- description 控制在 100 字以内
- 任务数量 3-10 个
- 按合理的依赖顺序排列`

      const result = await window.electronAPI.model.chat(modelId, {
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: goal.trim() },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      if (!result.success) {
        setAiError(result.error ?? "AI 生成失败");
        return;
      }

      // 解析响应 — 兼容多种格式
      const rawContent = extractContent(result.data);
      const parsed = parseTasksFromAi(rawContent);

      if (!parsed || parsed.length === 0) {
        setAiError("AI 返回格式无法解析，请重试或手动创建");
        return;
      }

      // 创建计划并填充任务
      addPlan(
        goal.trim(),
        parsed.map((t) => ({
          title: t.title,
          description: t.description ?? "",
          agent: t.agent ?? "前端",
          status: "pending" as const,
          dependsOn: [],
        })),
      );
      onClose();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium">新建计划</h3>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="描述你的开发目标…"
        className="min-h-[60px] w-full resize-none rounded border bg-background p-2 text-xs outline-none focus:border-primary"
        rows={3}
      />
      {aiError && (
        <p className="text-[10px] text-red-500">{aiError}</p>
      )}
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={handleAiGenerate}
          disabled={!goal.trim() || aiLoading}
        >
          <Bot className="mr-1 h-3 w-3" />
          {aiLoading ? "生成中…" : "AI 生成"}
        </Button>
        <Button
          size="sm"
          className="h-7 text-[11px]"
          onClick={handleSubmit}
          disabled={!goal.trim() || aiLoading}
        >
          <Plus className="mr-1 h-3 w-3" />
          创建
        </Button>
      </div>
    </div>
  );
}

/** 从 AI 响应中提取 JSON */
function extractContent(data: any): string {
  // OpenAI 格式: data.choices[0].message.content
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  // 直接返回字符串
  if (typeof data === "string") return data;
  // fallback
  return JSON.stringify(data);
}

/** 解析 AI 返回的 JSON 任务列表 */
function parseTasksFromAi(
  raw: string,
): Array<{ title: string; description?: string; agent?: string }> | null {
  try {
    // 尝试提取 JSON（可能被 markdown 包裹）
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;

    const parsed = JSON.parse(jsonStr.trim());
    let tasks = parsed.tasks ?? parsed;
    if (!Array.isArray(tasks)) tasks = [tasks];

    return tasks.map((t: any) => ({
      title: t.title ?? t.name ?? "未命名任务",
      description: t.description ?? "",
      agent: t.agent ?? t.role ?? "前端",
    }));
  } catch {
    return null;
  }
}

/** 开发模式回退 — 从目标文本智能猜测任务 */
async function simulateAiPlan(
  goal: string,
  addPlan: (goal: string, tasks?: any[]) => string,
  onClose: () => void,
) {
  // 延迟模拟 AI 响应
  await new Promise((r) => setTimeout(r, 1500));

  const defaultTasks = [
    { title: "需求分析与设计", description: "分析需求，确定技术方案", agent: "架构师" },
    { title: "前端界面开发", description: "实现用户界面和交互", agent: "前端" },
    { title: "后端服务开发", description: "实现业务逻辑和 API", agent: "后端" },
    { title: "测试与联调", description: "集成测试和 Bug 修复", agent: "测试" },
  ];

  addPlan(
    goal,
    defaultTasks.map((t) => ({ ...t, status: "pending" as const, dependsOn: [] })),
  );
  onClose();
}

// ====== 子组件：任务卡片 ======

function TaskCard({
  task,
  planId,
  onStatusChange,
}: {
  task: PmTask;
  planId: string;
  onStatusChange?: (taskId: string, status: PmTask["status"]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = statusIcons[task.status] || Circle;

  return (
    <div className="rounded-md border bg-card">
      <div
        className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            const nextStatus =
              task.status === "pending"
                ? "in_progress"
                : task.status === "in_progress"
                  ? "completed"
                  : task.status === "completed"
                    ? "failed"
                    : "pending";
            onStatusChange?.(task.id, nextStatus);
          }}
          className="shrink-0"
          title={statusLabels[task.status]}
        >
          <StatusIcon
            className={cn("h-3.5 w-3.5", statusColors[task.status])}
          />
        </button>

        <span
          className={cn(
            "flex-1 truncate text-xs",
            task.status === "completed" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>

        {task.agent && (
          <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary">
            {task.agent}
          </span>
        )}

        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </div>

      {expanded && (
        <div className="border-t px-2 py-1.5">
          {task.description && (
            <p className="mb-1 text-[10px] text-muted-foreground">
              {task.description}
            </p>
          )}
          {task.dependsOn.length > 0 && (
            <p className="mb-1 text-[10px] text-muted-foreground">
              依赖: {task.dependsOn.join(", ")}
            </p>
          )}
          {task.result && (
            <p className="mb-1 rounded bg-muted p-1 text-[10px] text-muted-foreground">
              {task.result}
            </p>
          )}
          <div className="flex gap-1">
            {task.status === "pending" && (
              <button
                onClick={() => onStatusChange?.(task.id, "in_progress")}
                className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-600 hover:bg-blue-500/20"
              >
                开始
              </button>
            )}
            {task.status === "in_progress" && (
              <button
                onClick={() => onStatusChange?.(task.id, "completed")}
                className="rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-600 hover:bg-green-500/20"
              >
                完成
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ====== 子组件：添加任务表单 ======

function AddTaskForm({
  planId,
  onClose,
}: {
  planId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agent, setAgent] = useState("前端");
  const addTask = usePmStore((s) => s.addTask);
  const availableAgents = usePmStore((s) => s.availableAgents);

  const handleSubmit = () => {
    if (!title.trim()) return;
    addTask(planId, {
      title: title.trim(),
      description: description.trim(),
      agent,
      status: "pending",
      dependsOn: [],
    });
    setTitle("");
    setDescription("");
    onClose();
  };

  return (
    <div className="space-y-2 rounded-md border bg-card p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="任务名称"
        className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="任务描述（可选）"
        className="min-h-[40px] w-full resize-none rounded border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        >
          {availableAgents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <Button size="sm" className="h-7 text-[11px]" onClick={handleSubmit} disabled={!title.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          添加
        </Button>
      </div>
    </div>
  );
}

// ====== 子组件：检查点管理 ======

function CheckpointSection({ planId }: { planId: string }) {
  const checkpoints = usePmStore((s) =>
    s.checkpoints.filter((c) => c.planId === planId),
  );
  const saveCheckpoint = usePmStore((s) => s.saveCheckpoint);
  const restoreCheckpoint = usePmStore((s) => s.restoreCheckpoint);
  const removeCheckpoint = usePmStore((s) => s.removeCheckpoint);
  const [cpName, setCpName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">
          检查点 ({checkpoints.length})
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
        >
          <Save className="h-2.5 w-2.5" />
          保存
        </button>
      </div>

      {showForm && (
        <div className="flex items-center gap-1">
          <input
            value={cpName}
            onChange={(e) => setCpName(e.target.value)}
            placeholder="检查点名称"
            className="flex-1 rounded border bg-background px-1.5 py-0.5 text-[10px] outline-none focus:border-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter" && cpName.trim()) {
                saveCheckpoint(planId, cpName.trim());
                setCpName("");
                setShowForm(false);
              }
            }}
          />
          <Button
            size="sm"
            className="h-5 px-1.5 text-[9px]"
            onClick={() => {
              if (cpName.trim()) {
                saveCheckpoint(planId, cpName.trim());
                setCpName("");
                setShowForm(false);
              }
            }}
            disabled={!cpName.trim()}
          >
            保存
          </Button>
        </div>
      )}

      {checkpoints.map((cp) => (
        <div
          key={cp.id}
          className="flex items-center gap-1 rounded bg-muted/50 px-1.5 py-1"
        >
          <RotateCcw className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-[10px]">{cp.name}</span>
          {confirmRestore === cp.id ? (
            <>
              <button
                onClick={() => {
                  restoreCheckpoint(cp.id);
                  setConfirmRestore(null);
                }}
                className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-600 hover:bg-amber-500/20"
              >
                确认恢复
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                className="rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-accent"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmRestore(cp.id)}
                className="rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-accent"
                title="恢复到此检查点"
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={() => removeCheckpoint(cp.id)}
                className="rounded px-1 py-0.5 text-muted-foreground hover:bg-accent"
                title="删除"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ====== 子组件：计划详情 ======

function PlanDetail({ plan }: { plan: PmPlan }) {
  const updateTaskStatus = usePmStore((s) => s.updateTaskStatus);
  const updatePlanStatus = usePmStore((s) => s.updatePlanStatus);
  const removePlan = usePmStore((s) => s.removePlan);
  const [showAddTask, setShowAddTask] = useState(false);

  // 多 Agent 执行状态
  const session = useAgentStore((s) => s.session);
  const startExecution = useAgentStore((s) => s.startExecution);
  const cancelExecution = useAgentStore((s) => s.cancelExecution);
  const isExecuting = session?.planId === plan.id && session?.status === "running";
  const hasExecutionResult = session?.planId === plan.id &&
    (session?.status === "completed" || session?.status === "error" || session?.status === "cancelled");

  const taskCounts = {
    total: plan.tasks.length,
    completed: plan.tasks.filter((t) => t.status === "completed").length,
    inProgress: plan.tasks.filter((t) => t.status === "in_progress").length,
    failed: plan.tasks.filter((t) => t.status === "failed").length,
  };

  const progress =
    plan.tasks.length > 0
      ? Math.round((taskCounts.completed / plan.tasks.length) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col">
      {/* 计划头部 */}
      <div className="border-b p-3">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-xs font-medium leading-relaxed">{plan.goal}</h3>
        </div>

        {/* 状态 + 操作 */}
        <div className="mb-2 flex items-center gap-1">
          <span
            className={cn(
              "rounded px-1 py-0.5 text-[9px] font-medium",
              plan.status === "draft" && "bg-muted text-muted-foreground",
              plan.status === "active" && "bg-blue-500/10 text-blue-600",
              plan.status === "completed" && "bg-green-500/10 text-green-600",
              plan.status === "archived" && "bg-amber-500/10 text-amber-600",
            )}
          >
            {plan.status === "draft"
              ? "草稿"
              : plan.status === "active"
                ? "进行中"
                : plan.status === "completed"
                  ? "已完成"
                  : "已归档"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {plan.status === "draft" && (
            <button
              onClick={() => updatePlanStatus(plan.id, "active")}
              className="flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-600 hover:bg-blue-500/20"
            >
              <Play className="h-2.5 w-2.5" />
              开始执行
            </button>
          )}
          {plan.status === "active" && (
            <button
              onClick={() => updatePlanStatus(plan.id, "completed")}
              className="flex items-center gap-0.5 rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-600 hover:bg-green-500/20"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              标记完成
            </button>
          )}
          {plan.status === "completed" && (
            <button
              onClick={() => updatePlanStatus(plan.id, "archived")}
              className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 hover:bg-amber-500/20"
            >
              <Archive className="h-2.5 w-2.5" />
              归档
            </button>
          )}

          {/* 多 Agent 自动执行 */}
          {(plan.status === "draft" || plan.status === "active") && plan.tasks.length > 0 && (
            isExecuting ? (
              <button
                onClick={() => cancelExecution()}
                className="flex items-center gap-0.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-600 hover:bg-red-500/20"
              >
                <X className="h-2.5 w-2.5" />
                取消执行
              </button>
            ) : (
              <button
                onClick={() => startExecution(plan.id)}
                disabled={session?.status === "running"}
                className="flex items-center gap-0.5 rounded bg-purple-500/10 px-1.5 py-0.5 text-[9px] text-purple-600 hover:bg-purple-500/20"
              >
                <Bot className="h-2.5 w-2.5" />
                Agent 执行
              </button>
            )
          )}

          <button
            onClick={() => {
              if (confirm("确定删除此计划？所有任务和检查点都将被删除。")) {
                removePlan(plan.id);
              }
            }}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-2.5 w-2.5" />
            删除
          </button>
        </div>

        {/* 进度条 */}
        {plan.tasks.length > 0 && (
          <div className="mt-2">
            <div className="mb-0.5 flex justify-between text-[9px] text-muted-foreground">
              <span>
                进度 {taskCounts.completed}/{taskCounts.total}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* 统计摘要 */}
        {plan.tasks.length > 0 && (
          <div className="mb-2 flex gap-2 text-[9px] text-muted-foreground">
            <span>共 {taskCounts.total} 任务</span>
            {taskCounts.inProgress > 0 && (
              <span className="text-blue-500">
                {taskCounts.inProgress} 进行中
              </span>
            )}
            {taskCounts.failed > 0 && (
              <span className="text-red-500">{taskCounts.failed} 失败</span>
            )}
          </div>
        )}

        <div className="space-y-1">
          {plan.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              planId={plan.id}
              onStatusChange={(taskId, status) =>
                updateTaskStatus(plan.id, taskId, status)
              }
            />
          ))}
        </div>

        {/* 添加任务按钮 */}
        {showAddTask ? (
          <div className="mt-2">
            <AddTaskForm
              planId={plan.id}
              onClose={() => setShowAddTask(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowAddTask(true)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[10px] text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            添加任务
          </button>
        )}

        {/* 检查点 */}
        {plan.tasks.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <CheckpointSection planId={plan.id} />
          </div>
        )}

        {/* 多 Agent 执行日志 */}
        {(isExecuting || hasExecutionResult) && session && (
          <div className="mt-3 border-t pt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                Agent 执行日志
              </span>
              <span className={cn(
                "text-[9px]",
                session.status === "running" && "text-blue-500",
                session.status === "completed" && "text-green-500",
                session.status === "error" && "text-red-500",
                session.status === "cancelled" && "text-amber-500",
              )}>
                {session.status === "running" && "执行中…"}
                {session.status === "completed" && "已完成"}
                {session.status === "error" && "执行异常"}
                {session.status === "cancelled" && "已取消"}
              </span>
            </div>

            {/* 进度概览 */}
            {isExecuting && session.totalBatches > 0 && (
              <div className="mb-2">
                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                  <span>第 {session.currentBatch}/{session.totalBatches} 批</span>
                  <span>{session.completedTasks}/{session.totalTasks} 任务</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${session.totalTasks > 0 ? (session.completedTasks / session.totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* 日志列表 */}
            <div className="max-h-[200px] space-y-0.5 overflow-y-auto rounded-md bg-muted/50 p-1.5">
              {session.logs.map((log, i) => (
                <div key={i} className="flex gap-1 text-[9px] leading-relaxed">
                  <span className={cn(
                    "shrink-0 font-mono",
                    log.level === "info" && "text-muted-foreground",
                    log.level === "success" && "text-green-500",
                    log.level === "error" && "text-red-500",
                    log.level === "debug" && "text-muted-foreground/50",
                  )}>
                    [{log.level === "success" ? "OK" : log.level === "error" ? "ERR" : "INF"}]
                  </span>
                  <span className="text-muted-foreground/80">{log.message}</span>
                </div>
              ))}
              {isExecuting && (
                <div className="flex items-center gap-1 text-[9px] text-blue-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  执行中…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ====== 子组件：计划列表 ======

function PlanList({
  onSelect,
}: {
  onSelect: (planId: string) => void;
}) {
  const plans = usePmStore((s) => s.plans);
  const activePlanId = usePmStore((s) => s.activePlanId);

  if (plans.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <ListTodo className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">暂无计划</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
          创建一个计划来管理你的开发任务
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {plans.map((plan) => {
        const completed = plan.tasks.filter(
          (t) => t.status === "completed",
        ).length;
        const total = plan.tasks.length;
        const isActive = plan.id === activePlanId;

        return (
          <button
            key={plan.id}
            onClick={() => onSelect(plan.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors",
              isActive
                ? "bg-primary/10"
                : "hover:bg-accent",
            )}
          >
            <div className="flex-1">
              <p className="line-clamp-1 text-xs font-medium">
                {plan.goal}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                <span>{plan.status === "draft" ? "草稿" : plan.status === "active" ? "进行中" : plan.status === "completed" ? "已完成" : "已归档"}</span>
                {total > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {completed}/{total}
                    </span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground",
                isActive && "text-primary",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ====== 主组件 ======

export function PmPanel() {
  const loadFromDisk = usePmStore((s) => s.loadFromDisk);
  const activePlanId = usePmStore((s) => s.activePlanId);
  const setActivePlan = usePmStore((s) => s.setActivePlan);
  const plans = usePmStore((s) => s.plans);
  const [showNewForm, setShowNewForm] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");

  // 启动时加载持久化数据
  useEffect(() => {
    loadFromDisk();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activePlan = plans.find((p) => p.id === activePlanId);

  const handleSelectPlan = (planId: string) => {
    setActivePlan(planId);
    setView("detail");
  };

  const handleBack = () => {
    setView("list");
  };

  return (
    <div className="flex h-full flex-col">
      {/* 面板头部 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        {view === "detail" ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleBack}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
            </button>
            <span className="text-xs font-medium">计划详情</span>
          </div>
        ) : (
          <span className="text-xs font-medium">项目管理</span>
        )}
        {!showNewForm && view === "list" && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            新建
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {showNewForm ? (
          <NewPlanForm onClose={() => setShowNewForm(false)} />
        ) : view === "detail" && activePlan ? (
          <PlanDetail plan={activePlan} />
        ) : (
          <PlanList onSelect={handleSelectPlan} />
        )}
      </div>
    </div>
  );
}
