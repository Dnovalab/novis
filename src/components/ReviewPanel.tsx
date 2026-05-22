/**
 * ReviewPanel — AI 代码审查面板
 *
 * 支持三种审查模式：
 * 1. Diff 审查 — 审查 Git 变更（从 GitPanel 触发）
 * 2. 文件审查 — 审查编辑器中的文件
 * 3. 手动审查 — 粘贴代码审查
 */

import { useState, useCallback, useRef } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  FileCode,
  GitBranch,
  Code2,
  Loader2,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { useCodeReviewStore, type ReviewIssue, type ReviewResult } from "@/stores/code-review-store";
import { useSettingsStore } from "@/stores/settings-store";
import { performReview, type ReviewRequest } from "@/lib/code-review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ====== 子组件：严重级别标签 ======

function SeverityBadge({ severity }: { severity: ReviewIssue["severity"] }) {
  const config = {
    critical: {
      icon: AlertCircle,
      color: "text-red-500 bg-red-500/10",
      label: "严重",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-amber-500 bg-amber-500/10",
      label: "警告",
    },
    suggestion: {
      icon: Info,
      color: "text-blue-500 bg-blue-500/10",
      label: "建议",
    },
  }[severity];

  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px]", config.color)}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

// ====== 子组件：审查结果展示 ======

function ReviewResultView({ result }: { result: ReviewResult }) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const scoreColor =
    result.score >= 90
      ? "text-green-500"
      : result.score >= 70
        ? "text-amber-500"
        : result.score >= 50
          ? "text-orange-500"
          : "text-red-500";

  const criticalCount = result.issues.filter((i) => i.severity === "critical").length;
  const warningCount = result.issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="space-y-3">
      {/* 评分概览 */}
      <div className="flex items-center gap-3 rounded-md border bg-card p-3">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold", scoreColor)}>
          {result.score}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium">代码质量评分</p>
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            {result.summary}
          </p>
        </div>
      </div>

      {/* 问题统计 */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-md bg-red-500/5 p-2 text-center">
          <p className="text-xs font-bold text-red-500">{criticalCount}</p>
          <p className="text-[9px] text-red-500/70">严重</p>
        </div>
        <div className="flex-1 rounded-md bg-amber-500/5 p-2 text-center">
          <p className="text-xs font-bold text-amber-500">{warningCount}</p>
          <p className="text-[9px] text-amber-500/70">警告</p>
        </div>
        <div className="flex-1 rounded-md bg-blue-500/5 p-2 text-center">
          <p className="text-xs font-bold text-blue-500">{result.issues.length}</p>
          <p className="text-[9px] text-blue-500/70">总计</p>
        </div>
      </div>

      {/* 问题列表 */}
      {result.issues.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
            发现的问题 ({result.issues.length})
          </p>
          <div className="space-y-1">
            {result.issues.map((issue, i) => {
              const issueId = `issue-${i}`;
              const isExpanded = expandedIssue === issueId;
              return (
                <div
                  key={issueId}
                  className="rounded-md border bg-card"
                >
                  <button
                    onClick={() => setExpandedIssue(isExpanded ? null : issueId)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <SeverityBadge severity={issue.severity} />
                    <span className="flex-1 truncate text-[10px] font-medium">
                      {issue.title}
                    </span>
                    {issue.file && (
                      <span className="shrink-0 truncate text-[9px] text-muted-foreground max-w-[80px]">
                        {issue.file.split("/").pop()}:{issue.line}
                      </span>
                    )}
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t px-2 py-1.5 space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        {issue.description}
                      </p>
                      {issue.suggestion && (
                        <div className="rounded bg-muted p-1.5">
                          <p className="text-[9px] font-medium text-muted-foreground mb-0.5">建议:</p>
                          <p className="text-[9px] text-muted-foreground/80">
                            {issue.suggestion}
                          </p>
                        </div>
                      )}
                      {issue.file && (
                        <p className="text-[9px] text-muted-foreground/60">
                          文件: {issue.file}{issue.line ? `:${issue.line}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 无问题 */}
      {result.issues.length === 0 && !result.error && (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <ShieldCheck className="h-8 w-8 text-green-500" />
          <p className="text-xs font-medium text-green-500">未发现问题</p>
          <p className="text-[10px] text-muted-foreground">代码质量良好</p>
        </div>
      )}

      {result.error && (
        <div className="rounded-md bg-red-500/10 p-2 text-[10px] text-red-600">
          {result.error}
        </div>
      )}
    </div>
  );
}

// ====== 主组件 ======

export function ReviewPanel() {
  const { currentResult, status, setResult, setLoading, addHistory, clearCurrent, history } =
    useCodeReviewStore();
  const { activeModelId } = useSettingsStore();

  const [mode, setMode] = useState<"manual" | "history">("manual");
  const [manualCode, setManualCode] = useState("");
  const [fileName, setFileName] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleManualReview = useCallback(async () => {
    if (!manualCode.trim()) return;
    if (!activeModelId) {
      setResult({
        summary: "",
        score: 0,
        issues: [],
        error: "请先在设置中选择一个模型",
      });
      return;
    }

    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const request: ReviewRequest = {
        type: "manual",
        content: manualCode.trim(),
        fileName: fileName.trim() || undefined,
      };

      const result = await performReview(request, activeModelId, abortRef.current.signal);
      setResult(result);

      if (!result.error) {
        addHistory({
          id: `review-${Date.now()}`,
          type: "manual",
          label: fileName.trim() || `手动审查 (${manualCode.length} 字符)`,
          result,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResult({
        summary: "",
        score: 0,
        issues: [],
        error: String(err),
      });
    }
  }, [manualCode, fileName, activeModelId, setResult, setLoading, addHistory]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const loading = status === "loading";

  return (
    <div className="flex h-full flex-col">
      {/* 面板头部 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">代码审查</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMode("manual")}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px]",
              mode === "manual"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            审查
          </button>
          <button
            onClick={() => setMode("history")}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px]",
              mode === "history"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            历史 ({history.length})
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {mode === "history" ? (
          /* 历史记录 */
          <div className="p-2 space-y-1">
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-8 text-center">
                <FileCode className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground">暂无审查历史</p>
              </div>
            ) : (
              history.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setResult(record.result)}
                  className="flex w-full items-center gap-2 rounded-md border bg-card p-2 text-left hover:border-primary/30"
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                    record.result.score >= 90
                      ? "bg-green-500/10 text-green-500"
                      : record.result.score >= 70
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-red-500/10 text-red-500",
                  )}>
                    {record.result.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium">
                      {record.label}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {record.result.issues.length} 个问题 · {new Date(record.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : currentResult ? (
          /* 审查结果 */
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground">审查结果</span>
              <button
                onClick={clearCurrent}
                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-accent"
              >
                <X className="h-2.5 w-2.5" />
                关闭
              </button>
            </div>
            <ReviewResultView result={currentResult} />

            {/* 再次审查按钮 */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearCurrent}
                className="h-7 w-full text-[10px]"
              >
                <Code2 className="h-3 w-3 mr-1" />
                继续审查
              </Button>
            </div>
          </div>
        ) : (
          /* 手动审查表单 */
          <div className="p-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <Code2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">
                粘贴代码进行审查
              </span>
            </div>

            {/* 文件名（可选） */}
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="文件名（可选，如 src/App.tsx）"
              className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
            />

            {/* 代码输入 */}
            <textarea
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="在此粘贴代码或 diff…"
              className="min-h-[120px] w-full resize-none rounded border bg-background p-2 text-[10px] font-mono outline-none focus:border-primary"
              rows={8}
            />

            {/* 操作按钮 */}
            <div className="flex gap-1">
              {loading ? (
                <Button
                  onClick={handleCancel}
                  className="h-7 flex-1 text-[10px]"
                >
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  取消
                </Button>
              ) : (
                <Button
                  onClick={handleManualReview}
                  disabled={!manualCode.trim() || !activeModelId}
                  className="h-7 flex-1 text-[10px]"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI 审查
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManualCode("")}
                disabled={!manualCode || loading}
                className="h-7 px-2 text-[10px]"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* 模型提示 */}
            {!activeModelId && (
              <p className="text-[9px] text-amber-500">
                请先在设置中选择模型
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
