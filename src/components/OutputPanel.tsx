import { useCallback, useEffect, useRef } from "react";
import { Trash2, Terminal } from "lucide-react";
import { useOutputStore, BUILT_IN_CHANNELS } from "@/stores/output-store";
import { cn } from "@/lib/utils";

export function OutputPanel() {
  const {
    channels,
    activeChannelId,
    setActiveChannel,
    clear,
    clearAll,
  } = useOutputStore();

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新消息时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChannel?.entries.length]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
  };

  if (channels.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
        <Terminal className="mb-2 h-8 w-8 opacity-30" />
        <p>暂无输出</p>
        <p className="mt-1 text-xs">构建、Git 操作和扩展日志会显示在这里</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 通道切换栏 */}
      <div className="flex items-center justify-between border-b">
        <div className="flex items-center overflow-x-auto">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-xs transition-colors border-r",
                activeChannelId === ch.id
                  ? "bg-background text-foreground border-b-2 border-b-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {ch.label}
              {ch.entries.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground/40">
                  {ch.entries.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 pr-1">
          <button
            onClick={() => activeChannelId && clear(activeChannelId)}
            className="rounded p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
            title="清空当前通道"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 输出内容 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#1e1e1e] font-mono text-xs"
      >
        {activeChannel && activeChannel.entries.length > 0 ? (
          <div className="p-2">
            {activeChannel.entries.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 py-0.5 leading-5",
                  entry.level === "error"
                    ? "text-red-400"
                    : entry.level === "warn"
                      ? "text-amber-400"
                      : entry.level === "success"
                        ? "text-green-400"
                        : "text-gray-300",
                )}
              >
                <span className="shrink-0 text-gray-500 tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>通道为空</p>
          </div>
        )}
      </div>
    </div>
  );
}
