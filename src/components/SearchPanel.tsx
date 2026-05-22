/**
 * SearchPanel — 项目文件搜索
 *
 * 功能：
 * - 按文件名搜索
 * - 按文件内容搜索（Electron 模式）
 * - 点击结果打开文件
 * - 搜索结果分组展示
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  Loader2,
  ChevronRight,
  Replace,
  AlertTriangle,
  Check,
  X,
  type LucideIcon,
} from "lucide-react";
import { useFileStore, type FileNode } from "@/stores/file-store";
import { cn } from "@/lib/utils";

/** 文件类型图标映射 */
const fileIconMap: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  json: FileJson,
  md: FileText,
  css: FileType,
  html: FileCode,
  py: FileCode,
  rs: FileCode,
  go: FileCode,
};

function getFileIcon(name: string): LucideIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return fileIconMap[ext] ?? File;
}

interface SearchResult {
  name: string;
  path: string;
  dir: string;
  /** 内容匹配行（内容搜索用） */
  matchLine?: string;
  matchIndex?: number;
}

export function SearchPanel() {
  const files = useFileStore((s) => s.files);
  const openFile = useFileStore((s) => s.openFile);
  const workspaceRoot = useFileStore((s) => s.workspaceRoot);
  const openFiles = useFileStore((s) => s.openFiles);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"filename" | "content">("filename");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [contentSearchInBrowser, setContentSearchInBrowser] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [replaceResult, setReplaceResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 将文件树拍平为列表
  const allFiles = useMemo(() => {
    return flattenTree(files);
  }, [files]);

  // 文件名搜索
  const filenameResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allFiles
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 50)
      .map((f) => ({
        name: f.name,
        path: f.path,
        dir: parentDir(f.path, workspaceRoot),
      }));
  }, [query, allFiles, workspaceRoot]);

  // 内容搜索
  const doContentSearch = useCallback(async () => {
    if (!query.trim()) return;
    if (!window.electronAPI) {
      // 开发模式（浏览器）：不支持内容搜索
      setContentSearchInBrowser(true);
      setResults([]);
      return;
    }
    setContentSearchInBrowser(false);
    setSearching(true);

    try {
      const q = query.toLowerCase();
      const matches: SearchResult[] = [];

      for (const file of allFiles.slice(0, 100)) {
        // 跳过二进制扩展名
        if (isBinaryExt(file.name)) continue;

        const r = await window.electronAPI.fs.readFile(file.path);
        if (!r.success || !r.content) continue;

        const lines = r.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            matches.push({
              name: file.name,
              path: file.path,
              dir: parentDir(file.path, workspaceRoot),
              matchLine: lines[i].trim().slice(0, 120),
              matchIndex: i + 1,
            });
            if (matches.length >= 30) break;
          }
        }
        if (matches.length >= 30) break;
      }

      setResults(matches);
    } catch {
      // 静默处理
    } finally {
      setSearching(false);
    }
  }, [query, allFiles, workspaceRoot]);

  // 切换模式时搜索
  useEffect(() => {
    setContentSearchInBrowser(false);
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    if (mode === "filename") {
      setResults(filenameResults);
    }
  }, [query, mode, filenameResults]);

  // 按需触发内容搜索
  useEffect(() => {
    if (mode === "content" && query.trim()) {
      doContentSearch();
    }
  }, [mode, doContentSearch]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleOpen = (result: SearchResult) => {
    openFile(result.path, result.name);
  };

  /** 内容搜索模式下：替换全部匹配项 */
  const handleReplaceAll = useCallback(async () => {
    if (!query.trim() || replaceText === undefined) return;
    if (!window.electronAPI) {
      alert("替换功能仅在桌面应用模式下可用");
      return;
    }
    if (results.length === 0) return;

    const q = query.trim();
    const rText = replaceText.trim();
    const confirmed = window.confirm(
      `确定在所有匹配文件中将 "${q}" 替换为 "${rText}"？\n\n此操作不可撤销！`,
    );
    if (!confirmed) return;

    setReplacing(true);
    setReplaceResult(null);

    // 收集需要处理的文件（去重）
    const fileSet = new Set<string>();
    for (const r of results) {
      fileSet.add(r.path);
    }

    let replacedCount = 0;
    let fileCount = 0;

    for (const filePath of fileSet) {
      try {
        const r = await window.electronAPI.fs.readFile(filePath);
        if (!r.success || !r.content) continue;

        const regex = new RegExp(escapeRegex(q), "gi");
        const newContent = r.content.replace(regex, rText);

        if (newContent !== r.content) {
          const writeResult = await window.electronAPI.fs.writeFile(
            filePath,
            newContent,
          );
          if (writeResult.success) {
            replacedCount += (r.content.match(regex) || []).length;
            fileCount++;
            // 如果文件已在编辑器中打开，通知 store
            const store = useFileStore.getState();
            if (store.openFiles.some((f) => f.path === filePath)) {
              store.markDirty(filePath, true);
            }
          }
        }
      } catch {
        // 跳过出错文件
      }
    }

    setReplacing(false);
    setReplaceResult(
      `替换完成：共替换 ${replacedCount} 处，涉及 ${fileCount} 个文件`,
    );

    // 3 秒后重新搜索
    setTimeout(() => {
      setReplaceResult(null);
      if (mode === "content") {
        doContentSearch();
      }
    }, 3000);
  }, [query, replaceText, results, mode, doContentSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleOpen(results[selectedIndex]);
    }
  };

  const hasProject = allFiles.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* 搜索输入 */}
      <div className="border-b p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={mode === "filename" ? "搜索文件名…" : "搜索文件内容…"}
            className="w-full rounded-md border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>

        {/* 模式切换 */}
        <div className="mt-2 flex gap-1 rounded-md bg-muted p-0.5">
          <button
            onClick={() => { setMode("filename"); setReplaceMode(false); }}
            className={cn(
              "flex-1 rounded px-2 py-0.5 text-[10px] transition-colors",
              mode === "filename"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            文件名
          </button>
          <button
            onClick={() => setMode("content")}
            className={cn(
              "flex-1 rounded px-2 py-0.5 text-[10px] transition-colors",
              mode === "content"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            内容
          </button>
        </div>

        {/* 替换模式切换（内容搜索时可用） */}
        {mode === "content" && (
          <div className="mt-2">
            <button
              onClick={() => setReplaceMode(!replaceMode)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors",
                replaceMode
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Replace className="h-3 w-3" />
              {replaceMode ? "关闭替换" : "替换"}
            </button>

            {/* 替换输入框 */}
            {replaceMode && (
              <div className="mt-2 space-y-1.5">
                <div className="relative">
                  <Replace className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-destructive/60" />
                  <input
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="替换为…"
                    className="w-full rounded-md border border-destructive/30 bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-destructive"
                  />
                </div>

                {/* 替换操作按钮 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReplaceAll}
                    disabled={replacing || !query.trim() || results.length === 0}
                    className="flex items-center gap-1 rounded bg-destructive px-2.5 py-1 text-[10px] text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40"
                  >
                    {replacing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    替换全部
                  </button>
                  <span className="text-[10px] text-muted-foreground/60">
                    {results.length > 0
                      ? `${results.length} 个匹配结果`
                      : "无匹配结果"}
                  </span>
                </div>

                {/* 替换结果提示 */}
                {replaceResult && (
                  <div className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-[10px] text-green-500">
                    <Check className="h-3 w-3" />
                    {replaceResult}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 搜索结果 */}
      <div className="flex-1 overflow-y-auto">
        {!hasProject ? (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <div>
              <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                请先打开一个项目
              </p>
            </div>
          </div>
        ) : !query.trim() ? (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <p className="text-[10px] text-muted-foreground/60">
              输入关键字开始搜索
            </p>
          </div>
        ) : searching ? (
          <div className="flex items-center justify-center gap-2 p-6">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">搜索中…</span>
          </div>
        ) : contentSearchInBrowser ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              内容搜索仅在桌面应用模式下可用
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              请切换到「文件名」搜索，或启动 Electron 应用
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">未找到匹配结果</p>
          </div>
        ) : (
          <div className="py-1">
            <p className="px-3 pb-1 text-[9px] text-muted-foreground">
              找到 {results.length} 个结果
            </p>
            {results.map((result, i) => {
              const Icon = getFileIcon(result.name);
              return (
                <button
                  key={`${result.path}:${result.matchIndex ?? 0}`}
                  onClick={() => handleOpen(result)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-accent",
                    selectedIndex === i && "bg-accent",
                  )}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">{result.name}</p>
                    <p className="truncate text-[9px] text-muted-foreground/60">
                      {result.dir}
                    </p>
                    {result.matchLine && (
                      <p className="mt-0.5 truncate rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        <span className="text-muted-foreground/40">
                          L{result.matchIndex}{" "}
                        </span>
                        {result.matchLine}
                      </p>
                    )}
                  </div>
                  {result.matchIndex && (
                    <span className="shrink-0 text-[9px] text-muted-foreground/40">
                      L{result.matchIndex}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== 工具函数 ======

/** 将文件树拍平为列表 */
function flattenTree(nodes: FileNode[]): Array<{ name: string; path: string }> {
  const result: Array<{ name: string; path: string }> = [];
  for (const node of nodes) {
    if (node.type === "file") {
      result.push({ name: node.name, path: node.path });
    }
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

/** 获取文件所在目录的显示名 */
function parentDir(filePath: string, workspaceRoot: string): string {
  const normalized = filePath.replace(workspaceRoot, "").replace(/^\//, "");
  const parts = normalized.split("/");
  if (parts.length <= 1) return "/";
  return parts.slice(0, -1).join("/");
}

/** 常见二进制文件扩展名 */
const binaryExts = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico",
  "woff", "woff2", "ttf", "eot",
  "mp3", "mp4", "webm", "wav", "ogg",
  "zip", "gz", "tar", "rar", "7z",
  "exe", "dll", "so", "dylib",
  "pdf", "doc", "docx", "xls", "xlsx",
  "ttf", "otf",
]);

function isBinaryExt(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return binaryExts.has(ext);
}

/** 转义正则表达式特殊字符 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 统计字符串中子串出现次数（大小写不敏感） */
function countMatches(content: string, search: string): number {
  const regex = new RegExp(escapeRegex(search), "gi");
  return (content.match(regex) || []).length;
}
