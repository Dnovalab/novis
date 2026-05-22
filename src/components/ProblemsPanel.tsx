import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  X,
  ChevronRight,
  ChevronDown,
  File,
} from "lucide-react";
import { useDiagnosticsStore, type DiagnosticSeverity, severityColor, severityIcon } from "@/stores/diagnostics-store";
import type { Diagnostic } from "@/stores/diagnostics-store";
import { useFileStore } from "@/stores/file-store";
import { cn } from "@/lib/utils";

/** 严重级别筛选选项 */
interface SeverityFilter {
  level: DiagnosticSeverity | null;
  label: string;
  icon: typeof AlertCircle;
  color: string;
  count: number;
}

export function ProblemsPanel() {
  const {
    diagnostics,
    filterSeverity,
    filterFile,
    setFilterSeverity,
    setFilterFile,
    clearAll,
  } = useDiagnosticsStore();

  const openFile = useFileStore((s) => s.openFile);

  // 按文件分组
  const grouped = useMemo(() => {
    const filtered = filterSeverity
      ? diagnostics.filter((d) => d.severity === filterSeverity)
      : diagnostics;

    const map = new Map<string, typeof diagnostics>();
    for (const d of filtered) {
      const key = d.filePath;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }

    // 按文件路径排序
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [diagnostics, filterSeverity]);

  // 各严重级别计数
  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0, hint: 0 };
    for (const d of diagnostics) {
      c[d.severity]++;
    }
    return c;
  }, [diagnostics]);

  const filters: SeverityFilter[] = [
    {
      level: null,
      label: "全部",
      icon: AlertCircle,
      color: "text-muted-foreground",
      count: diagnostics.length,
    },
    {
      level: "error",
      label: "错误",
      icon: AlertCircle,
      color: "text-red-500",
      count: counts.error,
    },
    {
      level: "warning",
      label: "警告",
      icon: AlertTriangle,
      color: "text-amber-500",
      count: counts.warning,
    },
    {
      level: "info",
      label: "信息",
      icon: Info,
      color: "text-blue-500",
      count: counts.info,
    },
  ];

  /** 点击诊断条目 → 打开文件并定位到行 */
  const handleDiagnosticClick = useCallback(
    (filePath: string, fileName: string, line: number) => {
      openFile(filePath, fileName);
      useDiagnosticsStore.getState().requestScrollTo(filePath, line);
    },
    [openFile],
  );

  if (diagnostics.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <HeaderBar
          filters={filters}
          activeFilter={filterSeverity}
          onFilterChange={setFilterSeverity}
          onClear={clearAll}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
          <AlertCircle className="mb-2 h-8 w-8 opacity-30" />
          <p>暂无诊断信息</p>
          <p className="mt-1 text-xs">打开文件编辑后，代码错误和警告会显示在这里</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <HeaderBar
        filters={filters}
        activeFilter={filterSeverity}
        onFilterChange={setFilterSeverity}
        onClear={clearAll}
      />

      {/* 诊断列表 */}
      <div className="flex-1 overflow-y-auto">
        {grouped.map(([filePath, diags]) => (
          <FileGroup
            key={filePath}
            filePath={filePath}
            diagnostics={diags}
            activeFileFilter={filterFile}
            onFileFilterClick={setFilterFile}
            onDiagnosticClick={handleDiagnosticClick}
          />
        ))}
      </div>
    </div>
  );
}

// ====== Header Bar ======

function HeaderBar({
  filters,
  activeFilter,
  onFilterChange,
  onClear,
}: {
  filters: SeverityFilter[];
  activeFilter: DiagnosticSeverity | null;
  onFilterChange: (s: DiagnosticSeverity | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b px-2 py-1">
      <div className="flex items-center gap-0.5">
        {filters.map((f) => (
          <button
            key={f.label}
            onClick={() => onFilterChange(f.level)}
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
              activeFilter === f.level
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={f.color}>{severityIcon(f.level ?? "hint")}</span>
            <span>{f.label}</span>
            <span className={cn("ml-0.5 opacity-60", f.color)}>
              {f.count}
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={onClear}
        className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
        title="清除所有诊断"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ====== File Group ======

function FileGroup({
  filePath,
  diagnostics,
  activeFileFilter,
  onFileFilterClick,
  onDiagnosticClick,
}: {
  filePath: string;
  diagnostics: Array<{
    filePath: string;
    fileName: string;
    line: number;
    column: number;
    message: string;
    severity: DiagnosticSeverity;
    code?: string;
    source?: string;
  }>;
  activeFileFilter: string | null;
  onFileFilterClick: (path: string | null) => void;
  onDiagnosticClick: (filePath: string, fileName: string, line: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isFilterActive = activeFileFilter === filePath;

  // 按严重级别排序：error → warning → info → hint
  const sorted = useMemo(
    () =>
      [...diagnostics].sort((a, b) => {
        const w = { error: 0, warning: 1, info: 2, hint: 3 };
        return (w[a.severity] ?? 99) - (w[b.severity] ?? 99);
      }),
    [diagnostics],
  );

  // 统计该文件各级别数量
  const fileCounts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0, hint: 0 };
    for (const d of diagnostics) c[d.severity]++;
    return c;
  }, [diagnostics]);

  const fileName = diagnostics[0]?.fileName ?? filePath.split("/").pop() ?? filePath;

  return (
    <div>
      {/* 文件头 */}
      <button
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          onFileFilterClick(isFilterActive ? null : filePath);
        }}
        className={cn(
          "flex w-full items-center gap-1 px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50",
          isFilterActive ? "bg-accent" : "",
        )}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1">{fileName}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
          {fileCounts.error > 0 && <span className="text-red-500">{fileCounts.error}</span>}
          {fileCounts.warning > 0 && <span className="text-amber-500">{fileCounts.warning}</span>}
          {fileCounts.info > 0 && <span className="text-blue-500">{fileCounts.info}</span>}
        </span>
      </button>

      {/* 诊断条目列表 */}
      {expanded && (
        <div>
          {sorted.map((d) => (
            <button
              key={d.id ?? `${d.line}:${d.column}:${d.message}`}
              onClick={() => onDiagnosticClick(d.filePath, d.fileName, d.line)}
              className="flex w-full items-start gap-1 px-2 py-0.5 text-left text-[11px] transition-colors hover:bg-muted/30"
              style={{ paddingLeft: "28px" }}
            >
              <span className={cn("mt-0.5 shrink-0 text-[10px]", severityColor(d.severity))}>
                {severityIcon(d.severity)}
              </span>
              <span className="shrink-0 text-muted-foreground/50 tabular-nums">
                {d.line}:{d.column}
              </span>
              <span className="truncate text-muted-foreground">{d.message}</span>
              {d.code && (
                <span className="shrink-0 text-[10px] text-muted-foreground/40">
                  {d.code}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
