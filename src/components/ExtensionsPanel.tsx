/**
 * ExtensionsPanel â æ©å±/éæé¢æ¿
 *
 * å±ç¤ºå½åå¯ç¨çå·¥å·åéæï¼ä»¥åå¼åä¸­çåè½é¢åã
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
    name: "Git çæ¬æ§å¶",
    description: "æ¥çåæ´ãæå­ãæäº¤ãåæ¢åæ¯ãæ¥çåå²",
    icon: GitBranch,
    status: "ready",
    version: "1.0",
  },
  {
    id: "search",
    name: "æä»¶æç´¢",
    description: "ææä»¶åååå®¹æç´¢é¡¹ç®æä»¶",
    icon: Search,
    status: "ready",
    version: "1.0",
  },
  {
    id: "memory",
    name: "AI è®°å¿ç³»ç»",
    description: "æä¹åé¡¹ç®è®°å¿ï¼èªå¨æ³¨å¥å¯¹è¯ä¸ä¸æ",
    icon: Brain,
    status: "ready",
    version: "1.0",
  },
  {
    id: "pm",
    name: "é¡¹ç®ç®¡ç",
    description: "è®¡ååä»»å¡ç®¡çãAI èªå¨çæè®¡åãæ£æ¥ç¹",
    icon: ListTodo,
    status: "ready",
    version: "1.0",
  },
  {
    id: "terminal",
    name: "ç»ç«¯éæ",
    description: "å¨ IDE åæ§è¡ç»ç«¯å½ä»¤",
    icon: Terminal,
    status: "ready",
    version: "1.0",
  },
  {
    id: "multi-agent",
    name: "å¤ Agent æµæ°´çº¿",
    description: "PM Agent åéä»»å¡å°å­ Agent èªå¨æ§è¡",
    icon: Cpu,
    status: "ready",
    version: "1.0",
  },
  {
    id: "code-review",
    name: "AI ä»£ç å®¡æ¥",
    description: "èªå¨å®¡æ¥ä»£ç åæ´ï¼åç°æ½å¨é®é¢",
    icon: FlaskConical,
    status: "ready",
    version: "1.0",
  },
];

const statusLabels: Record<string, string> = {
  ready: "å·²å°±ç»ª",
  dev: "å¼åä¸­",
  planned: "è§åä¸­",
};

const statusColors: Record<string, string> = {
  ready: "text-green-500 bg-green-500/10",
  dev: "text-amber-500 bg-amber-500/10",
  planned: "text-muted-foreground bg-muted",
};

export function ExtensionsPanel() {
  return (
    <div className="flex h-full flex-col">
      {/* é¢æ¿å¤´é¨ */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Puzzle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">æ©å±ä¸éæ</span>
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground/60">
          Novis çåè½ä»¥æ©å±æ¹å¼ç»ç»
        </p>
      </div>

      {/* æ©å±åè¡¨ */}
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

        {/* åºé¨ä¿¡æ¯ */}
        <div className="mt-4 border-t pt-3 text-center">
          <p className="text-[9px] text-muted-foreground/40">
            Novis v0.1.0-alpha Â· å¼æºæ¬å° AI ç¼ç¨å¹³å°
          </p>
        </div>
      </div>
    </div>
  );
}
