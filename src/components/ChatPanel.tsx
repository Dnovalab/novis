import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Square, Trash2, Cpu, DollarSign } from "lucide-react";
import { useChatStore, type Message } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import type { TokenUsage } from "@/types/electron";

export function ChatPanel() {
  const { messages, isProcessing, addMessage, setProcessing, clearMessages, loadFromDisk } =
    useChatStore();
  const { models, activeModelId } = useSettingsStore();
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastUsage, setLastUsage] = useState<{
    [messageId: string]: TokenUsage;
  }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<Array<() => void>>([]);

  // 启动时加载聊天历史
  useEffect(() => {
    loadFromDisk();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // 注册流式事件监听
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanChunk = window.electronAPI.model.onStreamChunk((data) => {
      setStreamingContent((prev) => prev + data.chunk);
    });

    const cleanDone = window.electronAPI.model.onStreamDone((data) => {
      // 流完成 — 将内容正式存入消息列表
      const msgId = `msg-${Date.now()}`;
      addMessage({ role: "assistant", content: streamingContentRef.current });
      setLastUsage((prev) => ({ ...prev, [msgId]: data.usage }));
      setStreamingContent("");
      setStreamingId(null);
      setProcessing(false);
    });

    const cleanError = window.electronAPI.model.onStreamError((data) => {
      addMessage({
        role: "assistant",
        content: `**错误**: ${data.error}`,
      });
      setStreamingContent("");
      setStreamingId(null);
      setProcessing(false);
    });

    cleanupRef.current = [cleanChunk, cleanDone, cleanError];

    return () => {
      cleanupRef.current.forEach((fn) => fn());
    };
  }, [addMessage, setProcessing]);

  // 用 ref 保存 streamingContent 供 done 回调使用
  const streamingContentRef = useRef(streamingContent);
  streamingContentRef.current = streamingContent;

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    if (!activeModelId) {
      addMessage({
        role: "assistant",
        content: "请先在设置中选择一个模型",
      });
      return;
    }
    if (!window.electronAPI) {
      addMessage({
        role: "assistant",
        content: "Electron API 不可用 — 请在桌面版 Novis 中使用",
      });
      return;
    }

    const userMessage = input.trim();
    setInput("");
    addMessage({ role: "user", content: userMessage });

    // 准备消息历史
    const history = [
      {
        role: "system" as const,
        content:
          "你是一个 AI 编程助手，名叫 Novis。请用中文回答，提供准确、简洁的技术建议。",
      },
      ...messages
        .filter((m) => m.role !== "system")
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    setProcessing(true);
    setStreamingId(`stream-${Date.now()}`);
    setStreamingContent("");

    // 发送流式请求
    await window.electronAPI.model.chatStream(activeModelId, {
      model: activeModelId,
      messages: history,
    });
  }, [input, isProcessing, activeModelId, messages, addMessage, setProcessing]);

  const handleCancel = useCallback(() => {
    if (activeModelId && window.electronAPI) {
      window.electronAPI.model.abort(activeModelId);
    }
    setStreamingContent("");
    setStreamingId(null);
    setProcessing(false);
  }, [activeModelId, setProcessing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 格式化价格
  const formatCost = (cost: number): string => {
    if (cost <= 0) return "免费";
    if (cost < 0.01) return "¥<0.01";
    return `¥${cost.toFixed(2)}`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶部：模型选择 + 操作按钮 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <select
            value={activeModelId ?? ""}
            onChange={(e) =>
              useSettingsStore.getState().setActiveModel(e.target.value)
            }
            className="rounded border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          >
            <option value="">选择模型</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearMessages}
          disabled={messages.length === 0}
          className="h-7 gap-1 text-xs"
        >
          <Trash2 className="h-3 w-3" />
          清空对话
        </Button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !streamingContent ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
            <Cpu className="mb-3 h-10 w-10 text-primary/30" />
            <p>选择模型后开始对话</p>
            <p className="mt-1 text-xs">
              Novis 支持本地模型（Ollama）和大厂 API 模型
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages
              .filter((m) => m.role !== "system")
              .map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {/* 价格显示 */}
                    {msg.role === "assistant" && lastUsage[msg.id] && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatCost(lastUsage[msg.id].cost)}
                        <span className="ml-1">
                          ({(lastUsage[msg.id].totalTokens / 1000).toFixed(1)}K
                          tokens)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* 流式输出 */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    正在生成…
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isProcessing
                ? "正在处理…"
                : activeModelId
                  ? "输入消息 (Enter 发送)..."
                  : "请先选择一个模型"
            }
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            disabled={isProcessing || !activeModelId}
          />
          {isProcessing ? (
            <Button
              variant="outline"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8 shrink-0"
              title="取消"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || !activeModelId}
              className="h-8 w-8 shrink-0"
              title="发送"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
