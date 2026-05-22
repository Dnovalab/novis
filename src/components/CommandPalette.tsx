/**
 * CommandPalette — 命令面板 (Ctrl+Shift+P / Cmd+Shift+P)
 *
 * 全局命令搜索和执行，类似 VS Code 的命令面板。
 * 显示所有已注册命令，支持模糊搜索。
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Command, type KeyBinding, formatBinding } from "@/lib/keyboard";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 过滤命令
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [query, commands]);

  // 按分类分组
  const grouped = useMemo(() => {
    const groups = new Map<string, Command[]>();
    for (const cmd of filtered) {
      if (!groups.has(cmd.category)) groups.set(cmd.category, []);
      groups.get(cmd.category)!.push(cmd);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  // 选中索引边界
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // 自动聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const executeCommand = (cmd: Command) => {
    cmd.execute();
    onClose();
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

  // 全局索引（用于 selectedIndex 定位）
  let globalIndex = -1;

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
            placeholder="输入命令名称…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <span className="text-[10px] text-muted-foreground/40">ESC</span>
        </div>

        {/* 命令列表 */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              未找到匹配的命令
            </div>
          ) : (
            grouped.map(([category, cmds]) => (
              <div key={category}>
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/60">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  globalIndex++;
                  const idx = globalIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-selected={idx === selectedIndex}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        idx === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "text-popover-foreground hover:bg-accent/50",
                      )}
                    >
                      <span className="flex-1 truncate">{cmd.name}</span>
                      <span className="text-[9px] text-muted-foreground/50">
                        {cmd.description}
                      </span>
                      {cmd.binding && (
                        <span className="shrink-0 rounded border bg-muted px-1 py-0.5 text-[9px] text-muted-foreground/60">
                          {formatBinding(cmd.binding)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t px-3 py-1.5 text-[9px] text-muted-foreground/40">
          ↑↓ 导航 · Enter 执行 · ESC 关闭
        </div>
      </div>
    </div>
  );
}
