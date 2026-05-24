/**
 * CommandPalette â å½ä»¤é¢æ¿ (Ctrl+Shift+P / Cmd+Shift+P)
 *
 * å¨å±å½ä»¤æç´¢åæ§è¡ï¼ç±»ä¼¼ VS Code çå½ä»¤é¢æ¿ã
 * æ¾ç¤ºææå·²æ³¨åå½ä»¤ï¼æ¯ææ¨¡ç³æç´¢ã
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Command, formatBinding } from "@/lib/keyboard";

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

  // è¿æ»¤å½ä»¤
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

  // æåç±»åç»
  const grouped = useMemo(() => {
    const groups = new Map<string, Command[]>();
    for (const cmd of filtered) {
      if (!groups.has(cmd.category)) groups.set(cmd.category, []);
      groups.get(cmd.category)!.push(cmd);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  // éä¸­ç´¢å¼è¾¹ç
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // èªå¨èç¦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // é®çå¯¼èª
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

  // æ»å¨å°éä¸­é¡¹
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  // å¨å±ç´¢å¼ï¼ç¨äº selectedIndex å®ä½ï¼
  let globalIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border bg-popover shadow-2xl">
        {/* æç´¢æ¡ */}
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
            placeholder="è¾å¥å½ä»¤åç§°â¦"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <span className="text-[10px] text-muted-foreground/40">ESC</span>
        </div>

        {/* å½ä»¤åè¡¨ */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              æªæ¾å°å¹éçå½ä»¤
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

        {/* åºé¨æç¤º */}
        <div className="border-t px-3 py-1.5 text-[9px] text-muted-foreground/40">
          ââ å¯¼èª Â· Enter æ§è¡ Â· ESC å³é­
        </div>
      </div>
    </div>
  );
}
