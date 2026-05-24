import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Square, Trash2, Cpu, DollarSign, Columns2 } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useMemoryStore } from "@/stores/memory-store";
import { Button } from "@/components/ui/button";
import { RouteIndicator } from "@/components/RouteIndicator";
import { BudgetIndicator } from "@/components/BudgetIndicator";
import { responseCache } from "@/lib/response-cache";
import type { ChatMessage, TokenUsage } from "@/types/electron";

export function ChatPanel() {
  const { messages, isProcessing, addMessage, setProcessing, clearMessages, loadFromDisk } =
    useChatStore();
  const { models, activeModelId } = useSettingsStore();
  const [input, setInput] = useState("");
  const [_streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastUsage, setLastUsage] = useState<{
    [messageId: string]: TokenUsage;
  }>({});

  // 多模型 PK 状态
  const [pkMode, setPkMode] = useState(false);
  const [pkModelId, setPkModelId] = useState<string | null>(null);
  const [pkStreamingContent, setPkStreamingContent] = useState("");
  const [pkLastUsage, setPkLastUsage] = useState<{
    [messageId: string]: TokenUsage;
  }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const lastHistoryRef = useRef<Array<{ role: string; content: string }> | null>(null);
  // PK 模式引用（用于流式事件闭包）
  const pkModeRef = useRef(pkMode);
  const pkModelIdRef = useRef(pkModelId);
  const isPkPhaseRef = useRef(false);

  // 启动时加载聊天历史
  useEffect(() => {
    loadFromDisk();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, pkStreamingContent]);

  // 注册流式事件监听
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanChunk = window.electronAPI.model.onStreamChunk((data) => {
      if (isPkPhaseRef.current) {
        setPkStreamingContent((prev) => prev + data.chunk);
      } else {
        setStreamingContent((prev) => prev + data.chunk);
      }
    });

    const cleanDone = window.electronAPI.model.onStreamDone((data) => {
      if (isPkPhaseRef.current) {
        // PK 流完成 — 保存在组件状态中展示对比
        const finalContent = pkStreamingContentRef.current;
        isPkPhaseRef.current = false;
        const pkMsgId = `pk-${Date.now()}`;
        setPkLastUsage((prev) => ({ ...prev, [pkMsgId]: data.usage }));
        if (data.usage?.cost > 0) {
          useSettingsStore.getState().addSpending(data.usage.cost);
        }
        // PK 模型也写缓存
        if (data.usage?.totalTokens > 0 && pkModelIdRef.current) {
          const cacheKey = responseCache.makeKey(
            lastHistoryRef.current ?? [],
            pkModelIdRef.current,
          );
          responseCache.set(cacheKey, finalContent, data.usage, pkModelIdRef.current);
        }
        setPkStreamingContent(finalContent); // 保留最终内容
        setStreamingId(null);
        setProcessing(false);
        return;
      }

      // 主模型流完成 — 将内容正式存入消息列表
      const msgId = `msg-${Date.now()}`;
      const content = streamingContentRef.current;
      addMessage({ role: "assistant", content });
      setLastUsage((prev) => ({ ...prev, [msgId]: data.usage }));
      // 追踪月度花费
      if (data.usage?.cost > 0) {
        useSettingsStore.getState().addSpending(data.usage.cost);
      }
      // 写入响应缓存
      if (data.usage?.totalTokens > 0 && lastHistoryRef.current && activeModelId) {
        const cacheKey = responseCache.makeKey(
          lastHistoryRef.current,
          activeModelId,
        );
        responseCache.set(cacheKey, content, data.usage, activeModelId);
      }
      setStreamingContent("");

      // PK 模式：主模型完成后自动发送给对比模型
      if (pkModeRef.current && pkModelIdRef.current) {
        isPkPhaseRef.current = true;
        setPkStreamingContent("");
        window.electronAPI.model
          .chatStream(pkModelIdRef.current, {
            model: pkModelIdRef.current,
            messages: (lastHistoryRef.current ?? []) as ChatMessage[],
          })
          .catch(console.error);
      } else {
        setStreamingId(null);
        setProcessing(false);
      }
    });

    const cleanError = window.electronAPI.model.onStreamError((data) => {
      if (isPkPhaseRef.current) {
        isPkPhaseRef.current = false;
        setPkStreamingContent(`**错误**: ${data.error}`);
        setStreamingId(null);
        setProcessing(false);
        return;
      }
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
  }, [addMessage, setProcessing, activeModelId]);

  // 用 ref 保存 streamingContent 供 done 回调使用
  const streamingContentRef = useRef(streamingContent);
  streamingContentRef.current = streamingContent;
  // PK 流的 content ref
  const pkStreamingContentRef = useRef(pkStreamingContent);
  pkStreamingContentRef.current = pkStreamingContent;
  // 同步 PK 状态到 ref
  pkModeRef.current = pkMode;
  pkModelIdRef.current = pkModelId;

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    if (!activeModelId) {
      addMessage({
        role: "assistant",
        content: "请先在设置中选择一个模型",
      });
      return;
    }

    // 预算检查
    const settings = useSettingsStore.getState();
    const hasLimit = settings.monthlyBudgetLimit > 0;
    const exceedBudget = hasLimit && settings.currentMonthSpending >= settings.monthlyBudgetLimit;
    if (exceedBudget) {
      const selectedModel = models.find((m) => m.id === activeModelId);
      const isApiModel = selectedModel && selectedModel.provider !== "ollama";
      if (isApiModel) {
        addMessage({
          role: "assistant",
          content: "本月预算已用完。请切换到本地免费模型（Ollama），或在设置中调整月度预算上限。",
        });
        return;
      }
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

    // 准备消息历史（含项目记忆上下文）
    const memoryContext = useMemoryStore.getState().getMemoryContext(10);
    const systemContent = memoryContext
      ? `你是一个 AI 编程助手，名叫 Novis。请用中文回答，提供准确、简洁的技术建议。\n\n## 项目记忆\n${memoryContext}`
      : "你是一个 AI 编程助手，名叫 Novis。请用中文回答，提供准确、简洁的技术建议。";

    const history = [
      {
        role: "system" as const,
        content: systemContent,
      },
      ...messages
        .filter((m) => m.role !== "system")
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    // PK 模式：清除上次对比结果
    if (pkModeRef.current) {
      setPkStreamingContent("");
    }
    setProcessing(true);
    setStreamingId(`stream-${Date.now()}`);
    setStreamingContent("");

    // 检查响应缓存
    const cacheKey = responseCache.makeKey(history, activeModelId);
    const cached = responseCache.get(cacheKey);
    if (cached) {
      // 缓存命中 — 模拟流式输出
      setTimeout(() => {
        // 逐字模拟流式效果
        let i = 0;
        const chars = cached.content.split("");
        const interval = setInterval(() => {
          if (i < chars.length) {
            setStreamingContent((prev) => prev + chars[i]);
            i++;
          } else {
            clearInterval(interval);
            const msgId = `msg-${Date.now()}`;
            addMessage({ role: "assistant", content: cached.content });
            setLastUsage((prev) => ({
              ...prev,
              [msgId]: cached.usage,
            }));
            setStreamingContent("");
            setStreamingId(null);
            setProcessing(false);

            // PK 模式：缓存命中后也自动发送给对比模型
            if (pkModeRef.current && pkModelIdRef.current) {
              isPkPhaseRef.current = true;
              setPkStreamingContent("");
              window.electronAPI.model
                .chatStream(pkModelIdRef.current, {
                  model: pkModelIdRef.current,
                  messages: (lastHistoryRef.current ?? []) as ChatMessage[],
                })
                .catch(console.error);
            }
          }
        }, 15); // 每 15ms 输出一个字，模拟流式
      }, 100);
      return;
    }

    // 保存本次历史用于缓存 key
    lastHistoryRef.current = history;

    // 发送流式请求
    await window.electronAPI.model.chatStream(activeModelId, {
      model: activeModelId,
      messages: history,
    });
  }, [input, isProcessing, activeModelId, messages, addMessage, setProcessing, models]);

  const handleCancel = useCallback(() => {
    // PK 阶段终止 PK 模型，否则终止主模型
    const targetModel = isPkPhaseRef.current ? pkModelIdRef.current : activeModelId;
    if (targetModel && window.electronAPI) {
      window.electronAPI.model.abort(targetModel);
    }
    isPkPhaseRef.current = false;
    setStreamingContent("");
    setPkStreamingContent("");
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
      {/* 顶部：模型选择 + 路由/预算/PK + 操作按钮 */}
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

          {/* PK 模型选择 */}
          {pkMode && (
            <select
              value={pkModelId ?? ""}
              onChange={(e) => setPkModelId(e.target.value || null)}
              className="rounded border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            >
              <option value="">选择对比模型</option>
              {models
                .filter((m) => m.id !== activeModelId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          )}

          {/* 智能路由 & 月度预算 */}
          {!pkMode && <RouteIndicator />}
          <BudgetIndicator />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={pkMode ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setPkMode(!pkMode);
              if (!pkMode) {
                // 进入 PK 模式 — 自动选第二个模型
                const other = models.find((m) => m.id !== activeModelId);
                if (other) setPkModelId(other.id);
              } else {
                setPkModelId(null);
                setPkStreamingContent("");
              }
            }}
            className="h-7 gap-1 text-xs"
            title="多模型 PK"
          >
            <Columns2 className="h-3 w-3" />
            PK
          </Button>
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

            {/* 流式输出（非 PK 模式） */}
            {streamingContent && !pkMode && (
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

            {/* PK 对比区域 */}
            {pkMode && (streamingContent !== "" || pkStreamingContent !== "") && (
              <div className="rounded-lg border bg-card p-3">
                <div className="mb-2 text-[10px] font-medium text-muted-foreground">
                  多模型对比
                </div>
                <div className="flex gap-3">
                  {/* 主模型列 */}
                  <div className="flex-1">
                    <div className="mb-1 text-[10px] font-semibold text-muted-foreground">
                      {models.find((m) => m.id === activeModelId)?.name ?? activeModelId}
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingContent || "等待回答…"}
                        </ReactMarkdown>
                      </div>
                      {streamingContent !== "" && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          正在生成…
                        </span>
                      )}
                    </div>
                  </div>
                  {/* PK 模型列 */}
                  <div className="flex-1">
                    <div className="mb-1 text-[10px] font-semibold text-muted-foreground">
                      {models.find((m) => m.id === pkModelId)?.name ?? pkModelId}
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {pkStreamingContent || (streamingContent !== "" ? "等待主模型完成后开始…" : "PK 已完成")}
                        </ReactMarkdown>
                      </div>
                      {pkStreamingContent !== "" && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          正在生成…
                        </span>
                      )}
                    </div>
                    {/* PK 价格 */}
                    {Object.entries(pkLastUsage).length > 0 && (() => {
                      const entries = Object.entries(pkLastUsage);
                      const last = entries[entries.length - 1];
                      if (!last) return null;
                      return (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <DollarSign className="h-2.5 w-2.5" />
                          {formatCost(last[1].cost)}
                          <span className="ml-1">
                            ({(last[1].totalTokens / 1000).toFixed(1)}K tokens)
                          </span>
                        </div>
                      );
                    })()}
                  </div>
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
