/**
 * QuickOpen — 快速文件搜索 (Ctrl+P / Cmd+P)
 *
 * 类似 VS Code 的 Quick Open，支持按文件名模糊搜索。
 * 键盘操作：↑↓ 导航 · Enter 打开 · ESC 关闭
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { File, Search, type LucideIcon } from "lucide-react";
import { useFileStore, type FileNode } from "@/stores/file-store";
import { cn } from "@/lib/utils";

interface QuickOpenProps {
  open: boolean;
  onClose: () => void;
}

/** 文件类型图标映射 */
const fileIconMap: Record<string, LucideIcon> = {
  ts: File,
  tsx: File,
  js: File,
  jsx: File,
  json: File,
  md: File,
  css: File,
  html: File,
  py: File,
};

function getFileIcon(name: string): LucideIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return fileIconMap[ext] ?? File;
}

/** 将文件树拍平为文件列表 */
function flattenTree(nodes: FileNode[]): Array<{ name: string; path: string; dir: string }> {
  const result: Array<{ name: string; path: string; dir: string }> = [];
  function walk(list: FileNode[], parentPath = "") {
    for (const node of list) {
      if (node.type === "file") {
        const parts = node.path.split("/");
        const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
        result.push({ name: node.name, path: node.path, dir });
      }
      if (node.children) walk(node.children, node.path);
    }
  }
  walk(nodes);
  return result;
}

/**
 * 简单模糊匹配：查询字符串的每个字符按顺序出现在目标中
 * 例如 "aot" 匹配 "App.tsx"（a → p(p) → t(sx)）
 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi >= q.length;
}

export function QuickOpen({ open, onClose }: QuickOpenProps) {
  const files = useFileStore((s) => s.files);
  const openFile = useFileStore((s) => s.openFile);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 项目所有文件（拍平列表）
  const allFiles = useMemo(() => flattenTree(files), [files]);

  // 模糊搜索过滤
  const filtered = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, 50);
    return allFiles.filter((f) => fuzzyMatch(query, f.name)).slice(0, 50);
  }, [query, allFiles]);

  // 选中索引边界
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // 打开时自动聚焦并清空
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const handleOpen = (path: string) => {
    openFile(path, path.split("/").pop() ?? path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleOpen(filtered[selectedIndex].path);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // 滚动到选中项
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  const hasFiles = allFiles.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border bg-popover shadow-2xl">
        {/* 搜索框 */}
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={hasFiles ? "输入文件名快速跳转…" : "请先打开一个项目"}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <span className="text-[10px] text-muted-foreground/40">ESC</span>
        </div>

        {/* 文件列表 */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1">
          {!hasFiles ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              尚未打开项目
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              未找到匹配文件
            </div>
          ) : (
            <div className="py-0.5">
              {filtered.map((file, idx) => {
                const Icon = getFileIcon(file.name);
                return (
                  <button
                    key={file.path}
                    data-selected={idx === selectedIndex}
                    onClick={() => handleOpen(file.path)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      idx === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-popover-foreground hover:bg-accent/50",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{file.name}</span>
                    {file.dir && (
                      <span className="shrink-0 text-[9px] text-muted-foreground/40">
                        {file.dir}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t px-3 py-1.5 text-[9px] text-muted-foreground/40">
          {hasFiles ? (
            <>
              {filtered.length} 个文件 · ↑↓ 导航 · Enter 打开 · ESC 关闭
            </>
          ) : (
            "打开一个项目后可用"
          )}
        </div>
      </div>
    </div>
  );
}
