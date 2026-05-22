import { create } from "zustand";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface Diagnostic {
  /** 唯一 ID */
  id: string;
  /** 文件路径 */
  filePath: string;
  /** 文件名（显示用） */
  fileName: string;
  /** 行号（1-based） */
  line: number;
  /** 列号（1-based） */
  column: number;
  /** 消息内容 */
  message: string;
  /** 严重级别 */
  severity: DiagnosticSeverity;
  /** 错误代码（可选，如 TS2322） */
  code?: string;
  /** 来源（TypeScript / ESLint / CSS 等） */
  source?: string;
  /** Monaco marker owner */
  owner?: string;
}

interface DiagnosticsStore {
  /** 所有诊断消息（上限 500 条） */
  diagnostics: Diagnostic[];
  /** 当前筛选的严重级别（null = 全部显示） */
  filterSeverity: DiagnosticSeverity | null;
  /** 当前筛选的文件路径（null = 全部文件） */
  filterFile: string | null;

  /** 替换指定文件的所有诊断（从 Monaco markers 转换） */
  setDiagnosticsForFile: (
    filePath: string,
    fileName: string,
    markers: MonacoMarker[],
  ) => void;
  /** 清除指定文件的所有诊断 */
  clearDiagnosticsForFile: (filePath: string) => void;
  /** 清除所有诊断 */
  clearAll: () => void;
  /** 跳转到指定位置（由 ProblemsPanel 设置，MonacoEditor 消费后清除） */
  scrollToPosition: { filePath: string; line: number } | null;
  /** 请求跳转到指定位置 */
  requestScrollTo: (filePath: string, line: number) => void;
  /** 清除跳转请求 */
  clearScrollTo: () => void;
  /** 设置严重级别筛选 */
  setFilterSeverity: (severity: DiagnosticSeverity | null) => void;
  /** 设置文件筛选 */
  setFilterFile: (filePath: string | null) => void;
}

export interface MonacoMarker {
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code?: string;
  source?: string;
  owner?: string;
}

let _idCounter = 0;
function nextId(): string {
  return `diag_${++_idCounter}`;
}

export const useDiagnosticsStore = create<DiagnosticsStore>((set) => ({
  diagnostics: [],
  filterSeverity: null,
  filterFile: null,
  scrollToPosition: null,

  setDiagnosticsForFile: (filePath, fileName, markers) =>
    set((state) => {
      // 先移除该文件旧的诊断
      const withoutOld = state.diagnostics.filter(
        (d) => d.filePath !== filePath,
      );

      // 转换 markers 为 Diagnostic
      const newDiagnostics: Diagnostic[] = markers.map((m) => ({
        id: nextId(),
        filePath,
        fileName,
        line: m.startLineNumber,
        column: m.startColumn,
        message: m.message,
        severity: m.severity,
        code: m.code,
        source: m.source || m.owner,
        owner: m.owner,
      }));

      // 合并后限制上限
      const merged = [...withoutOld, ...newDiagnostics];
      if (merged.length > 500) {
        return { diagnostics: merged.slice(-500) };
      }
      return { diagnostics: merged };
    }),

  clearDiagnosticsForFile: (filePath) =>
    set((state) => ({
      diagnostics: state.diagnostics.filter((d) => d.filePath !== filePath),
    })),

  clearAll: () => set({ diagnostics: [] }),

  requestScrollTo: (filePath, line) =>
    set({ scrollToPosition: { filePath, line } }),

  clearScrollTo: () => set({ scrollToPosition: null }),

  setFilterSeverity: (severity) => set({ filterSeverity: severity }),

  setFilterFile: (filePath) => set({ filterFile: filePath }),
}));

/** 严重级别排序权重（用于面板分组排序） */
export function severityWeight(s: DiagnosticSeverity): number {
  switch (s) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
    case "hint":
      return 3;
  }
}

/** 严重级别对应的颜色（Tailwind class） */
export function severityColor(s: DiagnosticSeverity): string {
  switch (s) {
    case "error":
      return "text-red-500";
    case "warning":
      return "text-amber-500";
    case "info":
      return "text-blue-500";
    case "hint":
      return "text-muted-foreground";
  }
}

/** 严重级别对应的图标 SVG */
export function severityIcon(s: DiagnosticSeverity): string {
  switch (s) {
    case "error":
      return "●";
    case "warning":
      return "◆";
    case "info":
      return "●";
    case "hint":
      return "○";
  }
}
