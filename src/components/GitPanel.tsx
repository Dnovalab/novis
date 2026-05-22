/**
 * GitPanel — Git 版本控制面板
 *
 * 功能：
 * - 查看当前分支和变更文件
 * - 暂存/取消暂存文件
 * - 查看文件 diff
 * - 提交变更
 * - 切换分支
 * - 查看提交历史
 * - 初始化 git 仓库
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  FileCode,
  Plus,
  Trash2,
  RotateCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CircleDot,
  Square,
  Check,
  X,
  Loader2,
  RefreshCw,
  ArrowLeft,
  History,
  ListTodo,
  AlertCircle,
  Upload,
  Download,
  Undo2,
  Shield,
} from "lucide-react";
import { useGitStore } from "@/stores/git-store";
import { useFileStore } from "@/stores/file-store";
import { useCodeReviewStore } from "@/stores/code-review-store";
import { performReview } from "@/lib/code-review";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import { MonacoDiffViewer } from "@/components/MonacoDiffViewer";
import { cn } from "@/lib/utils";
import type { GitChange } from "@/types/electron";

type PanelView = "changes" | "diff" | "log";

export function GitPanel() {
  const workspaceRoot = useFileStore((s) => s.workspaceRoot);
  const openFile = useFileStore((s) => s.openFile);

  const {
    repoPath,
    setRepoPath,
    isRepo,
    checkingRepo,
    status,
    loadingStatus,
    branches,
    commits,
    loadingLog,
    activeDiff,
    diffContent,
    originalContent,
    modifiedContent,
    loadingDiff,
    commitMessage,
    committing,
    error,
    checkRepo,
    initRepo,
    refreshAll,
    refreshStatus,
    refreshLog,
    loadDiff,
    clearDiff,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardFile,
    commit,
    setCommitMessage,
    switchBranch,
    push,
    pull,
    clearError,
  } = useGitStore();

  const [panelView, setPanelView] = useState<PanelView>("changes");
  const [showBranchList, setShowBranchList] = useState(false);
  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当 workspaceRoot 变化时同步到 git store
  useEffect(() => {
    if (workspaceRoot && workspaceRoot !== repoPath) {
      setRepoPath(workspaceRoot);
    }
  }, [workspaceRoot, repoPath, setRepoPath]);

  // 当 repoPath 变化时检查 git 仓库
  useEffect(() => {
    if (repoPath) {
      checkRepo();
    }
  }, [repoPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动聚焦提交输入框
  useEffect(() => {
    if (panelView === "changes") {
      inputRef.current?.focus();
    }
  }, [panelView]);

  const handleStage = useCallback(
    async (filePath: string) => {
      await stageFile(filePath);
    },
    [stageFile],
  );

  const handleUnstage = useCallback(
    async (filePath: string) => {
      await unstageFile(filePath);
    },
    [unstageFile],
  );

  const handleOpenDiff = useCallback(
    (filePath: string, staged: boolean) => {
      loadDiff(filePath, staged);
      setPanelView("diff");
    },
    [loadDiff],
  );

  const handleDiscard = useCallback(
    (filePath: string) => {
      if (confirm(`确定丢弃 ${filePath} 的更改？`)) {
        discardFile(filePath);
      }
    },
    [discardFile],
  );

  const handleOpenFile = useCallback(
    (filePath: string) => {
      const name = filePath.split("/").pop() ?? filePath;
      openFile(filePath, name);
    },
    [openFile],
  );

  const handleSwitchBranch = useCallback(
    async (branchName: string) => {
      setSwitchingBranch(branchName);
      try {
        await switchBranch(branchName);
      } finally {
        setSwitchingBranch(null);
        setShowBranchList(false);
      }
    },
    [switchBranch],
  );

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || committing) return;
    await commit();
  }, [commitMessage, committing, commit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
  };

  /** AI 审查暂存变更 */
  const handleReviewChanges = useCallback(async () => {
    const changesToReview = stagedChanges.length > 0 ? stagedChanges : unstagedChanges;
    if (changesToReview.length === 0) return;
    if (!window.electronAPI) return;

    const activeModelId = useSettingsStore.getState().activeModelId;
    if (!activeModelId) return;

    const reviewStore = useCodeReviewStore.getState();
    const status = useGitStore.getState().status;
    if (!status) return;

    // 收集变更文件的内容作为 diff
    reviewStore.setLoading(true);
    try {
      const diffParts: string[] = [];
      for (const change of changesToReview.slice(0, 10)) {
        try {
          const result = await window.electronAPI.git.diff(
            useGitStore.getState().repoPath,
            change.path,
            change.staged,
          );
          if (result.success && result.data?.content) {
            diffParts.push(result.data.content);
          }
        } catch {
          // 跳过无法获取 diff 的文件
        }
      }

      const diffContent = diffParts.join("\n\n");
      if (!diffContent) {
        reviewStore.setError("无法获取变更内容");
        return;
      }

      const result = await performReview(
        {
          type: "diff",
          content: diffContent,
          fileName: "git-diff",
          context: `分支: ${status.currentBranch}`,
        },
        activeModelId,
      );

      reviewStore.setResult(result);
      if (!result.error) {
        reviewStore.addHistory({
          id: `review-${Date.now()}`,
          type: "diff",
          label: `审查 ${changesToReview.length} 个变更文件`,
          result,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      reviewStore.setError(String(err));
    }
  }, [stagedChanges, unstagedChanges]);

  // 分组变更
  const stagedChanges = (status?.changes ?? []).filter((c) => c.staged);
  const unstagedChanges = (status?.changes ?? []).filter(
    (c) => !c.staged && c.status !== "untracked",
  );
  const untrackedFiles = (status?.changes ?? []).filter(
    (c) => c.status === "untracked",
  );

  // 状态图标
  const statusIcon = (s: string) => {
    switch (s) {
      case "modified":
        return <FileCode className="h-3 w-3 text-amber-500" />;
      case "added":
        return <Plus className="h-3 w-3 text-green-500" />;
      case "deleted":
        return <Trash2 className="h-3 w-3 text-red-500" />;
      case "renamed":
        return <GitCommit className="h-3 w-3 text-blue-500" />;
      case "conflict":
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <CircleDot className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      modified: "修改",
      added: "新增",
      deleted: "删除",
      renamed: "重命名",
      untracked: "未跟踪",
      conflict: "冲突",
    };
    return map[s] || s;
  };

  /** 渲染变更文件列表 */
  const renderChangeList = (
    changes: GitChange[],
    title: string,
    staged: boolean,
    emptyText: string,
  ) => (
    <div className="mb-1">
      <div className="flex items-center gap-1 px-3 py-1">
        <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          {title}
        </span>
        <span className="rounded bg-muted px-1 py-0 text-[8px] text-muted-foreground">
          {changes.length}
        </span>
      </div>
      {changes.length === 0 ? (
        <p className="px-3 py-1 text-[10px] text-muted-foreground/40">
          {emptyText}
        </p>
      ) : (
        changes.map((change) => (
          <div
            key={change.path + (staged ? "-staged" : "")}
            className="group flex items-center gap-1 px-3 py-1 text-[11px] hover:bg-accent/50 cursor-pointer"
            onClick={() => handleOpenDiff(change.path, staged)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                staged ? handleUnstage(change.path) : handleStage(change.path);
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              title={staged ? "取消暂存" : "暂存"}
            >
              {staged ? (
                <X className="h-2.5 w-2.5" />
              ) : (
                <Plus className="h-2.5 w-2.5" />
              )}
            </button>
            {statusIcon(change.status)}
            <span className="flex-1 truncate">{change.path}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenFile(change.path);
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground/30 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              title="在编辑器中打开"
            >
              <ChevronRight className="h-2.5 w-2.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );

  // ====== 未打开项目 ======
  if (!workspaceRoot) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <GitBranch className="mb-2 h-6 w-6 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground/60">请先打开一个项目</p>
      </div>
    );
  }

  // ====== 检查中 ======
  if (checkingRepo) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ====== 不是 git 仓库 ======
  if (!isRepo) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <GitBranch className="mb-2 h-6 w-6 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground/60">不是 Git 仓库</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/40">
          初始化后将启用版本控制
        </p>
        <Button
          size="sm"
          className="mt-3 h-7 text-[11px]"
          onClick={initRepo}
        >
          <GitBranch className="mr-1 h-3 w-3" />
          初始化仓库
        </Button>
      </div>
    );
  }

  // ====== 面板主体 ======
  return (
    <div className="flex h-full flex-col">
      {/* 头部：分支 + 刷新 + 视图切换 */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* 分支选择器 */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowBranchList(!showBranchList)}
              className="flex w-full items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <GitBranch className="h-3 w-3 shrink-0 text-primary" />
              <span className="flex-1 truncate font-medium">
                {status?.currentBranch ?? "main"}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>

            {/* 分支下拉列表 */}
            {showBranchList && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-card shadow-lg">
                {branches.map((branch) => (
                  <button
                    key={branch.name}
                    onClick={() => handleSwitchBranch(branch.name)}
                    disabled={switchingBranch === branch.name}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-[11px] transition-colors hover:bg-accent",
                      branch.current && "bg-primary/10 text-primary",
                    )}
                  >
                    {branch.current ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{branch.name}</span>
                    {switchingBranch === branch.name && (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 视图切换 + 刷新 */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setPanelView("changes")}
              className={cn(
                "rounded p-1 transition-colors",
                panelView === "changes"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
              title="变更"
            >
              <ListTodo className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setPanelView("log");
                refreshLog();
              }}
              className={cn(
                "rounded p-1 transition-colors",
                panelView === "log"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
              title="历史"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={refreshAll}
              className="rounded p-1 text-muted-foreground hover:bg-accent transition-colors"
              title="刷新"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingStatus && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ahead/behind 指示 */}
        {status && (status.ahead > 0 || status.behind > 0) && (
          <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground/60">
            {status.ahead > 0 && (
              <span className="flex items-center gap-0.5">
                <ChevronUp className="h-2.5 w-2.5" />
                ahead {status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="flex items-center gap-0.5">
                <ChevronDown className="h-2.5 w-2.5" />
                behind {status.behind}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-1 border-b border-red-500/20 bg-red-500/5 px-3 py-1.5">
          <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
          <span className="flex-1 truncate text-[10px] text-red-500">
            {error}
          </span>
          <button
            onClick={clearError}
            className="rounded p-0.5 text-red-500/60 hover:text-red-500"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      )}

      {/* 面板内容 */}
      <div className="flex-1 overflow-y-auto">
        {panelView === "changes" && (
          <div className="py-2">
            {loadingStatus ? (
              <div className="flex items-center justify-center gap-2 p-4">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground/60">
                  获取状态…
                </span>
              </div>
            ) : status && status.changes.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <Check className="mb-1 h-5 w-5 text-green-500/50" />
                <p className="text-[11px] text-muted-foreground/60">
                  工作区干净
                </p>
                <p className="text-[10px] text-muted-foreground/40">
                  没有未提交的变更
                </p>
              </div>
            ) : (
              <>
                {/* 批量操作按钮 */}
                <div className="flex items-center gap-0.5 px-3 pb-1">
                  <button
                    onClick={stageAll}
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-accent transition-colors"
                    title="暂存所有"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    全部暂存
                  </button>
                  <span className="text-muted-foreground/20">|</span>
                  <button
                    onClick={unstageAll}
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-accent transition-colors"
                    title="取消所有暂存"
                  >
                    <X className="h-2.5 w-2.5" />
                    取消暂存
                  </button>
                  <span className="text-muted-foreground/20">|</span>
                  <button
                    onClick={pull}
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-accent transition-colors"
                    title="拉取"
                  >
                    <Download className="h-2.5 w-2.5" />
                    拉取
                  </button>
                  <button
                    onClick={push}
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-accent transition-colors"
                    title="推送"
                  >
                    <Upload className="h-2.5 w-2.5" />
                    推送
                  </button>
                  <span className="text-muted-foreground/20">|</span>
                  <button
                    onClick={handleReviewChanges}
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-purple-500 hover:bg-purple-500/10 transition-colors"
                    title="AI 代码审查"
                  >
                    <Shield className="h-2.5 w-2.5" />
                    AI 审查
                  </button>
                </div>
                {stagedChanges.length > 0 &&
                  renderChangeList(
                    stagedChanges,
                    "已暂存",
                    true,
                    "已暂存变更",
                  )}
                {unstagedChanges.length > 0 &&
                  renderChangeList(
                    unstagedChanges,
                    "已变更",
                    false,
                    "无变更",
                  )}
                {untrackedFiles.length > 0 &&
                  renderChangeList(
                    untrackedFiles,
                    "未跟踪",
                    false,
                    "无未跟踪文件",
                  )}
              </>
            )}
          </div>
        )}

        {panelView === "diff" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-1 border-b px-3 py-1.5">
              <button
                onClick={() => {
                  clearDiff();
                  setPanelView("changes");
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <span className="flex-1 truncate text-[11px] font-medium">
                {activeDiff?.filePath ?? ""}
              </span>
              {activeDiff?.staged && (
                <span className="rounded bg-amber-500/10 px-1 py-0 text-[8px] text-amber-500">
                  已暂存
                </span>
              )}
              {!activeDiff?.staged && activeDiff?.filePath && (
                <button
                  onClick={() => {
                    const fp = activeDiff.filePath;
                    clearDiff();
                    setPanelView("changes");
                    handleDiscard(fp);
                  }}
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-red-500 hover:bg-red-500/10 transition-colors"
                  title="丢弃更改"
                >
                  <Undo2 className="h-2.5 w-2.5" />
                  丢弃
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-0">
              {loadingDiff ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              ) : diffContent ? (
                originalContent || modifiedContent ? (
                  <MonacoDiffViewer
                    originalContent={originalContent}
                    modifiedContent={modifiedContent}
                    fileName={activeDiff?.filePath ?? "file"}
                  />
                ) : (
                  <DiffViewer diffText={diffContent} />
                )
              ) : (
                <p className="p-2 text-[10px] text-muted-foreground/40">
                  无差异内容
                </p>
              )}
            </div>
          </div>
        )}

        {panelView === "log" && (
          <div className="py-2">
            {loadingLog ? (
              <div className="flex items-center justify-center gap-2 p-4">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground/60">
                  加载历史…
                </span>
              </div>
            ) : commits.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground/60">
                  暂无提交记录
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="flex items-start gap-2 px-3 py-1.5 text-[11px] hover:bg-accent/50"
                  >
                    <CircleDot className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{commit.message}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted-foreground/50">
                        <span>{commit.shortHash}</span>
                        <span>{commit.author}</span>
                        <span className="truncate">
                          {formatDate(commit.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部：提交输入（仅在 changes 视图） */}
      {panelView === "changes" && (
        <div className="border-t p-2">
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="提交说明…"
              disabled={committing}
              className="flex-1 rounded-md border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            />
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={
                !commitMessage.trim() || committing || stagedChanges.length === 0
              }
              className="h-7 shrink-0 px-2 text-[10px]"
            >
              {committing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          </div>
          <p className="mt-0.5 text-[8px] text-muted-foreground/40">
            {stagedChanges.length === 0
              ? "请先暂存文件"
              : `${stagedChanges.length} 个文件待提交`}
          </p>
        </div>
      )}
    </div>
  );
}

// ====== Diff 查看器组件 ======

function DiffViewer({ diffText }: { diffText: string }) {
  if (!diffText.trim()) {
    return (
      <p className="text-[10px] text-muted-foreground/40">
        无差异内容（可能为二进制文件）
      </p>
    );
  }

  const lines = diffText.split("\n");

  return (
    <pre className="font-mono text-[10px] leading-relaxed">
      {lines.map((line, i) => {
        let className = "";
        if (line.startsWith("+++") || line.startsWith("---")) {
          className = "text-blue-400 bg-blue-500/5";
        } else if (line.startsWith("@@")) {
          className = "text-cyan-400 bg-cyan-500/10";
        } else if (line.startsWith("+")) {
          className = "text-green-400 bg-green-500/10";
        } else if (line.startsWith("-")) {
          className = "text-red-400 bg-red-500/10";
        } else if (line.startsWith("diff --git") || line.startsWith("index ")) {
          className = "text-muted-foreground/40";
        }
        return (
          <div
            key={i}
            className={`${className} px-1`}
          >
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

// ====== 工具函数 ======

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
