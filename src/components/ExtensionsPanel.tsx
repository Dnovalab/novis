/**
 * ExtensionsPanel — 扩展/集成面板
 *
 * 展示当前可用的工具和集成，以及开发中的功能预告。
 */

import { Puzzle, GitBranch, Terminal, Cpu, Search, Brain, ListTodo, FlaskConical, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtensionItem {
  id: string;
  name: string;
  description: string;
  icon: typeof Puzzle;
  status: "ready" | "dev" | "planned";
  version?: string;
}

const extensions: ExtensionItem[] = [
  {
    id: "git",
    name: "Git 版本控制",
    description: "查看变更、暂存、提交、切换分支、查看历史",
    icon: GitBranch,
    status: "ready",
    version: "1.0",
  },
  {
    id: "search",
    name: "文件搜索",
    description: "按文件名和内容搜索项目文件",
    icon: Search,
    status: "ready",
    version: "1.0",
  },
  {
    id: "memory",
    name: "AI 记忆系统",
    description: "持久化项目记忆，自动注入对话上下文",
    icon: Brain,
    status: "ready",
    version: "1.0",
  },
  {
    id: "pm",
    name: "项目管理",
    description: "计划和任务管理、AI 自动生成计划、检查点",
    icon: ListTodo,
    status: "ready",
    version: "1.0",
  },
  {
    id: "terminal",
    name: "终端集成",
    description: "在 IDE 内执行终端命令",
    icon: Terminal,
    status: "ready",
    version: "1.0",
  },
  {
    id: "multi-agent",
    name: "多 Agent 流水线",
    description: "PM Agent 分配任务到子 Agent 自动执行",
    icon: Cpu,
    status: "ready",
    version: "1.0",
  },
  {
    id: "code-review",
    name: "AI 代码审查",
    description: "自动审查代码变更，发现潜在问题",
    icon: FlaskConical,
    status: "ready",
    version: "1.0",
  },
];

const statusLabels: Record<string, string> = {
  ready: "已就绪",
  dev: "开发中",
  planned: "规划中",
};

const statusColors: Record<string, string> = {
  ready: "text-green-500 bg-green-500/10",
  dev: "text-amber-500 bg-amber-500/10",
  planned: "text-muted-foreground bg-muted",
};

export function ExtensionsPanel() {
  return (
    <div className="flex h-full flex-col">
      {/* 面板头部 */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Puzzle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">扩展与集成</span>
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground/60">
          Novis 的功能以扩展方式组织
        </p>
      </div>

      {/* 扩展列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {extensions.map((ext) => (
            <div
              key={ext.id}
              className={cn(
                "rounded-md border bg-card p-2.5 transition-colors",
                ext.status === "ready" && "hover:border-primary/30",
                ext.status === "dev" && "border-dashed",
                ext.status === "planned" && "border-dashed opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <ext.icon className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  ext.status === "ready" ? "text-primary" : "text-muted-foreground",
                )} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium">{ext.name}</span>
                    <span className={cn(
                      "rounded px-1 py-0 text-[8px]",
                      statusColors[ext.status],
                    )}>
                      {statusLabels[ext.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                    {ext.description}
                  </p>
                  {ext.version && (
                    <p className="mt-0.5 text-[8px] text-muted-foreground/40">
                      v{ext.version}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部信息 */}
        <div className="mt-4 border-t pt-3 text-center">
          <p className="text-[9px] text-muted-foreground/40">
            Novis v0.1.0-alpha · 开源本地 AI 编程平台
          </p>
        </div>
      </div>
    </div>
  );
}
