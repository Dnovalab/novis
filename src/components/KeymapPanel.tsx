/**
 * KeymapPanel — 快捷键自定义面板
 *
 * 展示所有可用命令及其当前快捷键绑定，支持录制自定义快捷键。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Keyboard, RotateCcw, RotateCcwIcon, AlertTriangle } from "lucide-react";
import { useKeymapStore } from "@/stores/keymap-store";
import type { KeyBinding, Command } from "@/lib/keyboard";
import { formatBinding, modLabel } from "@/lib/keyboard";

interface KeymapPanelProps {
  /** 从 App.tsx 传入的完整命令列表 */
  commands: Command[];
}

export function KeymapPanel({ commands }: KeymapPanelProps) {
  const { customBindings, recording, setBinding, resetBinding, resetAll, startRecording, stopRecording } = useKeymapStore();
  const [search, setSearch] = useState("");
  const [changedCount, setChangedCount] = useState(0);

  // 监听快捷键录制
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 解析按下的键
      const key = e.key;
      // 排除单独的修饰键
      if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return;
      // 排除 Escape（取消录制）
      if (key === "Escape") {
        stopRecording();
        return;
      }

      const modifiers: Array<"ctrl" | "alt" | "shift" | "meta"> = [];
      if (e.ctrlKey || e.metaKey) modifiers.push(e.metaKey ? "meta" : "ctrl");
      if (e.altKey) modifiers.push("alt");
      if (e.shiftKey) modifiers.push("shift");

      // 至少需要一个修饰键
      if (modifiers.length === 0) return;

      const binding: KeyBinding = {
        key: key.length === 1 ? key.toLowerCase() : key,
        modifiers,
        label: "",
      };
      binding.label = formatBinding(binding);

      if (recordingRef.current) {
        setBinding(recordingRef.current, binding);
        setChangedCount((c) => c + 1);
      }
      stopRecording();
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, setBinding, stopRecording]);

  // 3 秒后清除变更提示
  useEffect(() => {
    if (changedCount === 0) return;
    const t = setTimeout(() => setChangedCount(0), 3000);
    return () => clearTimeout(t);
  }, [changedCount]);

  // 获取命令的当前绑定（自定义优先）
  const getEffectiveBinding = useCallback(
    (cmd: Command): KeyBinding | undefined => {
      return customBindings[cmd.id] ?? cmd.binding;
    },
    [customBindings],
  );

  const hasCustom = useCallback(
    (cmdId: string): boolean => {
      return cmdId in customBindings;
    },
    [customBindings],
  );

  // 按分类分组
  const categories = new Map<string, Command[]>();
  for (const cmd of commands) {
    if (search && !cmd.name.includes(search) && !cmd.id.includes(search)) continue;
    const list = categories.get(cmd.category) ?? [];
    list.push(cmd);
    categories.set(cmd.category, list);
  }

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">快捷键</h2>
        </div>
        <div className="flex items-center gap-2">
          {changedCount > 0 && (
            <span className="text-[10px] text-green-500">已保存</span>
          )}
          <button
            onClick={resetAll}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="重置所有快捷键"
          >
            <RotateCcwIcon className="h-3 w-3" />
            重置全部
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="border-b px-4 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索命令…"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
      </div>

      {/* 提示 */}
      <div className="border-b bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <p>点击命令右侧的快捷键区域，然后按下新的快捷键组合来修改。</p>
        <p className="mt-0.5">按 <kbd className="rounded-sm bg-muted px-1 font-mono text-[9px]">Esc</kbd> 取消录制，修改后的快捷键立即生效。</p>
      </div>

      {/* 命令列表 */}
      <div className="flex-1 overflow-y-auto">
        {categories.size === 0 && (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <AlertTriangle className="mx-auto h-6 w-6 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">
                {search ? "未找到匹配的命令" : "暂无可用命令"}
              </p>
            </div>
          </div>
        )}

        {Array.from(categories.entries()).map(([category, cmds]) => (
          <div key={category} className="border-b border-border/50">
            <div className="sticky top-0 bg-card px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {category}
            </div>
            {cmds.map((cmd) => {
              const binding = getEffectiveBinding(cmd);
              const isRecording = recording === cmd.id;
              const isCustom = hasCustom(cmd.id);
              return (
                <KeymapItem
                  key={cmd.id}
                  command={cmd}
                  binding={binding}
                  isRecording={isRecording}
                  isCustom={isCustom}
                  onRecord={() => {
                    if (recording === cmd.id) {
                      stopRecording();
                    } else {
                      startRecording(cmd.id);
                    }
                  }}
                  onReset={() => resetBinding(cmd.id)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 单项 ── */
function KeymapItem({
  command,
  binding,
  isRecording,
  isCustom,
  onRecord,
  onReset,
}: {
  command: Command;
  binding?: KeyBinding;
  isRecording: boolean;
  isCustom: boolean;
  onRecord: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {command.name}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {command.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {isRecording ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            按下快捷键…
          </span>
        ) : binding ? (
          <button
            onClick={onRecord}
            className="rounded-md border border-border px-2 py-1 text-[10px] font-mono text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            title="点击修改快捷键"
          >
            {binding.label}
          </button>
        ) : (
          <button
            onClick={onRecord}
            className="rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:border-primary hover:text-primary"
            title="添加快捷键"
          >
            添加
          </button>
        )}

        {isCustom && (
          <button
            onClick={onReset}
            className="rounded-md p-1 text-muted-foreground/40 hover:text-foreground"
            title="恢复默认"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
