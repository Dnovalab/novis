import { GitBranch, Shield, Cpu, FolderOpen } from "lucide-react";

interface StatusBarProps {
  modelName?: string;
  projectName?: string;
  permissionMode?: "suggest" | "auto" | "full";
  fileCount?: number;
}

const permissionLabels = {
  suggest: "仅建议",
  auto: "自动编辑",
  full: "完全自主",
};

export function StatusBar({
  modelName = "未选择",
  projectName = "",
  permissionMode = "suggest",
  fileCount = 0,
}: StatusBarProps) {
  return (
    <footer className="flex h-6 items-center justify-between border-t bg-sidebar px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        {projectName && (
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {projectName}
            {fileCount > 0 && <span className="ml-0.5 opacity-60">({fileCount})</span>}
          </span>
        )}
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          main
        </span>
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          {modelName}
        </span>
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          {permissionLabels[permissionMode]}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>行 1, 列 1</span>
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
