import { Terminal, Menu } from "lucide-react";
import { APP_NAME } from "@/lib/utils";

interface TitleBarProps {
  onToggleSidebar: () => void;
}

export function TitleBar({ onToggleSidebar }: TitleBarProps) {
  return (
    <header className="flex h-11 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="切换侧边栏"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{APP_NAME}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>v0.1.0-alpha</span>
      </div>
    </header>
  );
}
