import { Terminal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeProps {
  onOpenProject: () => void;
}

export function Welcome({ onOpenProject }: WelcomeProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Terminal className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold">Novis</h1>
        <p className="text-sm text-muted-foreground">
          开源、本地优先的 AI 编程平台
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={onOpenProject} size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          打开项目
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          创建新项目
        </Button>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-6 text-center text-xs text-muted-foreground">
        <div>
          <div className="mb-1 text-lg font-bold text-foreground">3</div>
          支持的模型
        </div>
        <div>
          <div className="mb-1 text-lg font-bold text-foreground">Suggest</div>
          权限模式
        </div>
        <div>
          <div className="mb-1 text-lg font-bold text-foreground">100%</div>
          本地部署
        </div>
      </div>
    </div>
  );
}
