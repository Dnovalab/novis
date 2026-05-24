/**
 * KeymapPanel â å¿«æ·é®èªå®ä¹é¢æ¿
 *
 * å±ç¤ºææå¯ç¨å½ä»¤åå¶å½åå¿«æ·é®ç»å®ï¼æ¯æå½å¶èªå®ä¹å¿«æ·é®ã
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Keyboard, RotateCcw, RotateCcwIcon, AlertTriangle } from "lucide-react";
import { useKeymapStore } from "@/stores/keymap-store";
import type { KeyBinding, Command } from "@/lib/keyboard";
import { formatBinding } from "@/lib/keyboard";

interface KeymapPanelProps {
  /** ä» App.tsx ä¼ å¥çå®æ´å½ä»¤åè¡¨ */
  commands: Command[];
}

export function KeymapPanel({ commands }: KeymapPanelProps) {
  const { customBindings, recording, setBinding, resetBinding, resetAll, startRecording, stopRecording } = useKeymapStore();
  const [search, setSearch] = useState("");
  const [changedCount, setChangedCount] = useState(0);

  // çå¬å¿«æ·é®å½å¶
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // è§£ææä¸çé®
      const key = e.key;
      // æé¤åç¬çä¿®é¥°é®
      if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return;
      // æé¤ Escapeï¼åæ¶å½å¶ï¼
      if (key === "Escape") {
        stopRecording();
        return;
      }

      const modifiers: Array<"ctrl" | "alt" | "shift" | "meta"> = [];
      if (e.ctrlKey || e.metaKey) modifiers.push(e.metaKey ? "meta" : "ctrl");
      if (e.altKey) modifiers.push("alt");
      if (e.shiftKey) modifiers.push("shift");

      // è³å°éè¦ä¸ä¸ªä¿®é¥°é®
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

  // 3 ç§åæ¸é¤åæ´æç¤º
  useEffect(() => {
    if (changedCount === 0) return;
    const t = setTimeout(() => setChangedCount(0), 3000);
    return () => clearTimeout(t);
  }, [changedCount]);

  // è·åå½ä»¤çå½åç»å®ï¼èªå®ä¹ä¼åï¼
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

  // æåç±»åç»
  const categories = new Map<string, Command[]>();
  for (const cmd of commands) {
    if (search && !cmd.name.includes(search) && !cmd.id.includes(search)) continue;
    const list = categories.get(cmd.category) ?? [];
    list.push(cmd);
    categories.set(cmd.category, list);
  }

  return (
    <div className="flex h-full flex-col">
      {/* å¤´é¨ */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">å¿«æ·é®</h2>
        </div>
        <div className="flex items-center gap-2">
          {changedCount > 0 && (
            <span className="text-[10px] text-green-500">å·²ä¿å­</span>
          )}
          <button
            onClick={resetAll}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="éç½®ææå¿«æ·é®"
          >
            <RotateCcwIcon className="h-3 w-3" />
            éç½®å¨é¨
          </button>
        </div>
      </div>

      {/* æç´¢æ¡ */}
      <div className="border-b px-4 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="æç´¢å½ä»¤â¦"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
      </div>

      {/* æç¤º */}
      <div className="border-b bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <p>ç¹å»å½ä»¤å³ä¾§çå¿«æ·é®åºåï¼ç¶åæä¸æ°çå¿«æ·é®ç»åæ¥ä¿®æ¹ã</p>
        <p className="mt-0.5">æ <kbd className="rounded-sm bg-muted px-1 font-mono text-[9px]">Esc</kbd> åæ¶å½å¶ï¼ä¿®æ¹åçå¿«æ·é®ç«å³çæã</p>
      </div>

      {/* å½ä»¤åè¡¨ */}
      <div className="flex-1 overflow-y-auto">
        {categories.size === 0 && (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <AlertTriangle className="mx-auto h-6 w-6 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">
                {search ? "æªâå°å¹éçå½ä»¤" : "ææ å¯ç¨å½ä»¤"}
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

/* ââ åé¡¹ ââ */
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
            Æä¸å¿«æ·é®â¦
          </span>
        ) : binding ? (
          <button
            onClick={onRecord}
            className="rounded-md border border-border px-2 py-1 text-[10px] font-mono text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            title="ç¹å»ä¿®æ¹å¿«æ·é®"
          >
            {binding.label}
          </button>
        ) : (
          <button
            onClick={onRecord}
            className="rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:border-primary hover:text-primary"
            title="æ·»å å¿«æ·é®"
          >
            æ·»å 
          </button>
        )}

        {isCustom && (
          <button
            onClick={onReset}
            className="rounded-md p-1 text-muted-foreground/40 hover:text-foreground"
            title="æ¢å¤é»è®¤"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
