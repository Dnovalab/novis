import { GitBranch, Shield, Cpu, FolderOpen, AlertCircle, AlertTriangle } from "lucide-react";
import { useDiagnosticsStore } from "@/stores/diagnostics-store";
import { useCursorStore } from "@/stores/cursor-store";

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
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const cursorPos = useCursorStore((s) => s.position);

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

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
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-500 cursor-pointer">
            <AlertCircle className="h-3 w-3" />
            {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-500 cursor-pointer">
            <AlertTriangle className="h-3 w-3" />
            {warningCount}
          </span>
        )}
        {cursorPos && (
          <span className="tabular-nums">
            行 {cursorPos.lineNumber}, 列 {cursorPos.column}
            {cursorPos.selectionLength > 0 && (
              <span className="ml-1 text-muted-foreground/60">
                ({cursorPos.selectionLength} 选中)
              </span>
            )}
          </span>
        )}
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
