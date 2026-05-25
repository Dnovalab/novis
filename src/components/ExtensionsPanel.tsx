/**
 * ExtensionsPanel - 扺展主插器）
 *
 * 자社当前可对无的已完和出现，哥及当前中的功能要钮。
 */

import { Puzzle, GitBranch, Terminal, Cpu, Search, Brain, ListTodo, FlaskConical } from "lucide-react";
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
    name: "Git 版信控解",
    description: "查看刕更、暂寸、提交、切探控到 ",
    icon: GitBranch,
    status: "ready",
    version: "1.0",
  },
  {
    id: "search",
    name: "文件搜素",
    description: "�'別文件名和/内容提查项目文件",
    icon: Search,
    status: "ready",
    version: "1.0",
  },
  {
    id: "memory",
    name: "AI 记兂系统",
    description: "持9c紨密寸扩式，自动方全开发话自下模文",
    icon: Brain,
    status: "ready",
    version: "1.0",
  },
  {
    id: "pm",
    name: "项目管理（ Command Prompt",
    description: "计划和任务管理！简包初别生成计划！检柄点！！",
    icon: ListTodo,
    status: "ready",
    version: "1.0",
  },
  {
    id: "terminal",
    name: "终构整戻",
    description: "在IDE内有控菜终构名令",
    icon: Terminal,
    status: "ready",
    version: "1.0",
  },
  {
    id: "multi-agent",
    name: "如�Agent浏水罨",
    description: "PM Agent分配任务到子丁Gent自动执行",
    icon: Cpu,
    status: "ready",
    version: "1.0",
  },
  {
    id: "code-review",
    name: "AI 代码客柭",
    description: "自动娪客柭代码受更，发现消息对序！",
    icon: FlaskConical,
    status: "ready",
    version: "1.0",
  },
];

const statusLabels: Record<string, string> = {
  ready: "已就明",
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
      {/* 非据大部 */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Puzzle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">扺展主插器</span>
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground/60">
          Novis 的功能以插出插入发组
        </p>
      </div>

      {/* 扺展列表 */}
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

        {/* 应部信息 */}
        <div className="mt-4 border-t pt-3 text-center">
          <p className="text-[9px] text-muted-foreground/40">
            Novis v0.1.0-alpha · 开源地厚 AI 编社布延经
          </p>
        </div>
      </div>
    </div>
  );
}
