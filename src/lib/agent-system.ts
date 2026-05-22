/**
 * Agent System — 多 Agent 执行引擎
 *
 * 为 PM 计划中的每个任务分配角色化 Agent，调用 AI 模型生成执行结果。
 * 支持依赖解析（拓扑排序）、批量执行、进度回调。
 */

import type { PmPlan, PmTask } from "@/stores/pm-store";

// ====== Agent 角色定义 ======

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

export const AGENT_ROLES: AgentRole[] = [
  {
    id: "architect",
    name: "架构师",
    description: "系统设计、技术选型、代码评审",
    systemPrompt: `你是一位资深软件架构师，负责系统设计和技术决策。
请基于任务描述提供详细的架构设计方案，包括：
1. 技术选型理由
2. 模块划分和接口设计
3. 数据流和状态管理方案
4. 关键类/组件结构和关系
5. 潜在的坑和优化建议

请用中文回答，输出结构化的设计方案。`,
  },
  {
    id: "frontend",
    name: "前端",
    description: "UI 组件、交互逻辑、样式",
    systemPrompt: `你是一位前端开发专家，精通 React、TypeScript、Tailwind CSS。
请基于任务描述提供完整的前端实现方案，包括：
1. 组件结构和 Props 接口定义
2. 核心代码实现（React + TypeScript）
3. 状态管理和数据流
4. UI 布局和样式要点
5. 边界情况和错误处理

请提供可直接使用的代码片段。用中文解释，代码中用英文标识符。`,
  },
  {
    id: "backend",
    name: "后端",
    description: "API、数据层、业务逻辑",
    systemPrompt: `你是一位后端开发专家，精通 Node.js、Electron、数据库设计。
请基于任务描述提供完整的后端实现方案，包括：
1. API 接口设计
2. 核心业务逻辑实现
3. 数据模型和存储方案
4. 错误处理和边界情况
5. 性能和安全考虑

请提供可直接使用的代码片段。用中文解释，代码中用英文标识符。`,
  },
  {
    id: "designer",
    name: "设计",
    description: "UI/UX 设计、交互方案",
    systemPrompt: `你是一位 UI/UX 设计师，精通设计系统和用户体验。
请基于任务描述提供设计建议，包括：
1. 交互流程和用户操作路径
2. 布局方案和信息层级
3. 视觉风格和设计语言
4. 响应式和适配方案
5. 可访问性考虑

请用中文回答，可以结合伪代码或示意图文字说明。`,
  },
  {
    id: "tester",
    name: "测试",
    description: "测试策略、用例、质量保障",
    systemPrompt: `你是一位 QA 测试工程师，精通各种测试策略。
请基于任务描述提供完整的测试方案，包括：
1. 测试范围和策略
2. 核心测试用例（含正常路径和边界情况）
3. 测试数据和模拟方案
4. 自动化测试建议
5. 潜在风险和质量指标

请提供可用的测试代码。用中文解释，代码中用英文标识符。`,
  },
];

/** 根据 Agent 名称查找角色配置 */
export function getAgentRole(name: string): AgentRole {
  return (
    AGENT_ROLES.find(
      (r) => r.name === name || r.id === name,
    ) ?? {
      id: "general",
      name,
      description: "通用助理",
      systemPrompt: `你是一位 AI 助手，请基于任务描述提供专业的解答。
用中文回答，输出结构化的内容。`,
    }
  );
}

// ====== 依赖解析 ======

/**
 * 对任务进行拓扑排序，返回按依赖顺序排列的任务批次。
 * 每批内的任务可以并行执行。
 */
export function resolveExecutionOrder(tasks: PmTask[]): PmTask[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const order: string[] = [];

  function dfs(id: string): boolean {
    if (inStack.has(id)) return false; // 循环依赖
    if (visited.has(id)) return true;
    visited.add(id);
    inStack.add(id);

    const task = taskMap.get(id);
    if (task) {
      for (const depId of task.dependsOn) {
        if (!dfs(depId)) return false;
      }
    }

    inStack.delete(id);
    order.push(id);
    return true;
  }

  // 拓扑排序
  for (const task of tasks) {
    if (!dfs(task.id)) {
      // 循环依赖 — 按原顺序返回单批
      return [tasks];
    }
  }

  // 按依赖深度分组
  const depthMap = new Map<string, number>();
  for (const id of order) {
    const task = taskMap.get(id);
    if (!task) continue;
    if (task.dependsOn.length === 0) {
      depthMap.set(id, 0);
    } else {
      const maxDepth = Math.max(
        ...task.dependsOn.map((d) => depthMap.get(d) ?? 0),
      );
      depthMap.set(id, maxDepth + 1);
    }
  }

  // 按深度分组
  const batches = new Map<number, PmTask[]>();
  for (const task of tasks) {
    const depth = depthMap.get(task.id) ?? 0;
    if (!batches.has(depth)) batches.set(depth, []);
    batches.get(depth)!.push(task);
  }

  return Array.from(batches.entries())
    .sort(([a], [b]) => a - b)
    .map(([, batch]) => batch);
}

// ====== Agent 执行 ======

export interface AgentResult {
  taskId: string;
  content: string;
  error?: string;
  duration: number; // ms
}

export interface ExecutionProgress {
  type: "start" | "complete" | "error" | "batch-start" | "batch-complete";
  taskId?: string;
  taskTitle?: string;
  agentName?: string;
  batchIndex?: number;
  totalBatches?: number;
  message: string;
}

/**
 * 执行单个 Agent 任务
 */
export async function executeAgentTask(
  task: PmTask,
  planGoal: string,
  allTasks: PmTask[],
  modelId: string,
  onProgress?: (progress: ExecutionProgress) => void,
): Promise<AgentResult> {
  const startTime = Date.now();
  const role = getAgentRole(task.agent);

  onProgress?.({
    type: "start",
    taskId: task.id,
    taskTitle: task.title,
    agentName: role.name,
    message: `[${role.name}] 开始执行: ${task.title}`,
  });

  // 构建上下文：前置任务的输出
  const dependencyContext = task.dependsOn
    .map((depId) => {
      const depTask = allTasks.find((t) => t.id === depId);
      if (depTask?.result) {
        return `## 前置任务: ${depTask.title}\n${depTask.result}\n`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  const userMessage = [
    `## 项目目标\n${planGoal}`,
    `## 任务描述\n${task.title}${task.description ? `\n${task.description}` : ""}`,
    dependencyContext ? `## 上下文依赖\n${dependencyContext}` : "",
    `\n请根据你作为「${role.name}」的职责，输出你的工作成果。`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    let content = "";

    if (typeof window !== "undefined" && (window as any).electronAPI) {
      // Electron 模式：调用模型
      const result = await (window as any).electronAPI.model.chat(
        modelId,
        {
          model: modelId,
          messages: [
            { role: "system", content: role.systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.5,
          maxTokens: 4096,
        },
      );

      if (!result.success) {
        throw new Error(result.error ?? "模型调用失败");
      }
      content = result.data?.content ?? "";
    } else {
      // 开发模式：模拟 Agent 输出
      content = [
        `## ${role.name} 执行报告\n`,
        `**任务**: ${task.title}`,
        `**Agent**: ${role.name}`,
        ``,
        `### 分析`,
        `在项目「${planGoal}」的背景下，我对任务「${task.title}」进行了全面分析：`,
        ``,
        `1. 需求理解：该任务需要${task.description || "实现相关功能"}`,
        `2. 技术方案：推荐采用模块化设计，保持代码可维护性`,
        `3. 实现要点：注意边界情况处理和错误处理`,
        ``,
        `### 执行结果`,
        `✅ 任务分析完成。在真实 Electron 环境中，此 Agent 将调用 AI 模型生成具体代码/方案。`,
        ``,
        `---`,
        `*模拟输出 · ${new Date().toLocaleString("zh-CN")}*`,
      ].join("\n");
    }

    const duration = Date.now() - startTime;

    onProgress?.({
      type: "complete",
      taskId: task.id,
      taskTitle: task.title,
      agentName: role.name,
      message: `[${role.name}] 完成: ${task.title} (${(duration / 1000).toFixed(1)}s)`,
    });

    return { taskId: task.id, content, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    onProgress?.({
      type: "error",
      taskId: task.id,
      taskTitle: task.title,
      agentName: role.name,
      message: `[${role.name}] 失败: ${task.title} — ${errorMsg}`,
    });

    return {
      taskId: task.id,
      content: "",
      error: errorMsg,
      duration,
    };
  }
}

/**
 * 执行整个计划（多 Agent 编排）
 */
export async function executePlan(
  plan: PmPlan,
  modelId: string,
  onProgress?: (progress: ExecutionProgress) => void,
): Promise<Map<string, AgentResult>> {
  const results = new Map<string, AgentResult>();
  const batches = resolveExecutionOrder(plan.tasks);
  const activeTasks = new Set(plan.tasks.map((t) => t.id));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    onProgress?.({
      type: "batch-start",
      batchIndex: i + 1,
      totalBatches: batches.length,
      message: `开始执行第 ${i + 1}/${batches.length} 批 (${batch.length} 个任务)`,
    });

    // 本批次任务并行执行
    const batchResults = await Promise.all(
      batch
        .filter((t) => activeTasks.has(t.id))
        .map((task) =>
          executeAgentTask(
            task,
            plan.goal,
            plan.tasks,
            modelId,
            onProgress,
          ),
        ),
    );

    for (const result of batchResults) {
      results.set(result.taskId, result);
    }

    onProgress?.({
      type: "batch-complete",
      batchIndex: i + 1,
      totalBatches: batches.length,
      message: `第 ${i + 1}/${batches.length} 批执行完成`,
    });
  }

  return results;
}
