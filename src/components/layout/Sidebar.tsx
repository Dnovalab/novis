import { cn } from "@/lib/utils";
import {
  FileText,
  Search,
  GitBranch,
  Puzzle,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const sidebarItems: SidebarItem[] = [
  { id: "files", label: "文件", icon: FileText },
  { id: "search", label: "搜索", icon: Search },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "extensions", label: "扩展", icon: Puzzle },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
}

export function Sidebar({ activeTab, onTabChange, isCollapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar transition-all duration-200",
        isCollapsed ? "w-0 overflow-hidden border-r-0" : "w-14",
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 pb-2">
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
            activeTab === "settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
          title="设置"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
