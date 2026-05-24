/**
 * Git Store — git 状态管理
 *
 * 管理当前仓库的 git 状态、变更列表、分支、提交历史、diff。
 * 所有 git 操作通过 Electron IPC 在子进程执行。
 */

import { create } from "zustand";
import type { GitStatus, GitCommit, GitBranch } from "@/types/electron";
import { useOutputStore } from "./output-store";

interface GitState {
  /** 仓库路径（来自 workspaceRoot） */
  repoPath: string;
  /** 是否为 git 仓库 */
  isRepo: boolean;
  /** 是否正在检查 git 仓库 */
  checkingRepo: boolean;

  /** 当前 git 状态 */
  status: GitStatus | null;
  /** 是否正在获取状态 */
  loadingStatus: boolean;

  /** 分支列表 */
  branches: GitBranch[];
  /** 是否正在加载分支 */
  loadingBranches: boolean;

  /** 提交历史 */
  commits: GitCommit[];
  /** 是否正在加载历史 */
  loadingLog: boolean;

  /** 当前查看的 diff */
  activeDiff: { filePath: string; staged: boolean } | null;
  diffContent: string;
  /** 原始版本内容（Monaco diff editor 用） */
  originalContent: string;
  /** 修改后版本内容（Monaco diff editor 用） */
  modifiedContent: string;
  loadingDiff: boolean;

  /** 提交消息 */
  commitMessage: string;
  /** 是否正在提交 */
  committing: boolean;

  /** 错误信息 */
  error: string | null;

  // Actions
  setRepoPath: (path: string) => void;
  checkRepo: () => Promise<void>;
  initRepo: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshLog: () => Promise<void>;
  refreshAll: () => Promise<void>;
  loadDiff: (filePath: string, staged: boolean) => Promise<void>;
  clearDiff: () => void;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  discardFile: (filePath: string) => Promise<void>;
  commit: () => Promise<void>;
  setCommitMessage: (msg: string) => void;
  switchBranch: (branchName: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  clearError: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  repoPath: "",
  isRepo: false,
  checkingRepo: false,

  status: null,
  loadingStatus: false,

  branches: [],
  loadingBranches: false,

  commits: [],
  loadingLog: false,

  activeDiff: null,
  diffContent: "",
  originalContent: "",
  modifiedContent: "",
  loadingDiff: false,

  commitMessage: "",
  committing: false,

  error: null,

  setRepoPath: (path) => set({ repoPath: path }),

  checkRepo: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) {
      set({ isRepo: false });
      return;
    }
    set({ checkingRepo: true });
    try {
      const result = await window.electronAPI.git.isRepo(repoPath);
      const isRepo = result.success && result.data === true;
      set({ isRepo, checkingRepo: false });
      if (isRepo) {
        get().refreshAll();
      }
    } catch {
      set({ isRepo: false, checkingRepo: false });
    }
  },

  initRepo: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      useOutputStore.getState().append("git", "Git", `初始化仓库: ${repoPath}`);
      const result = await window.electronAPI.git.init(repoPath);
      if (result.success) {
        set({ isRepo: true });
        useOutputStore.getState().append("git", "Git", "仓库初始化成功", "success");
        get().refreshAll();
      } else {
        set({ error: result.error ?? "初始化失败" });
        useOutputStore.getState().append("git", "Git", `初始化失败: ${result.error}`, "error");
      }
    } catch (e) {
      set({ error: String(e) });
      useOutputStore.getState().append("git", "Git", `初始化异常: ${e}`, "error");
    }
  },

  refreshStatus: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    set({ loadingStatus: true, error: null });
    try {
      const result = await window.electronAPI.git.status(repoPath);
      if (result.success) {
        set({ status: result.data, loadingStatus: false });
      } else {
        set({ error: result.error ?? "获取状态失败", loadingStatus: false });
      }
    } catch (e) {
      set({ error: String(e), loadingStatus: false });
    }
  },

  refreshBranches: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    set({ loadingBranches: true });
    try {
      const result = await window.electronAPI.git.branches(repoPath);
      if (result.success) {
        set({ branches: result.data, loadingBranches: false });
      } else {
        set({ loadingBranches: false });
      }
    } catch {
      set({ loadingBranches: false });
    }
  },

  refreshLog: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    set({ loadingLog: true });
    try {
      const result = await window.electronAPI.git.log(repoPath);
      if (result.success) {
        set({ commits: result.data, loadingLog: false });
      } else {
        set({ loadingLog: false });
      }
    } catch {
      set({ loadingLog: false });
    }
  },

  refreshAll: async () => {
    await Promise.all([
      get().refreshStatus(),
      get().refreshBranches(),
      get().refreshLog(),
    ]);
  },

  loadDiff: async (filePath, staged) => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    set({ loadingDiff: true, activeDiff: { filePath, staged } });
    try {
      // 并行加载：diff 内容 + 原始版本 + 修改版本
      const [diffResult, originalResult, modifiedResult] = await Promise.all([
        window.electronAPI.git.diff(repoPath, filePath, staged),
        window.electronAPI.git.showFile(repoPath, filePath, staged ? ":" : "HEAD"),
        staged
          ? window.electronAPI.fs.readFile(
              repoPath.endsWith("/") ? repoPath + filePath : repoPath + "/" + filePath,
            )
          : window.electronAPI.git.showFile(repoPath, filePath, "working"),
      ]);

      let diffText = "";
      if (diffResult.success) {
        diffText = diffResult.data.content;
      }

      let origContent = "";
      if (originalResult.success && originalResult.data) {
        origContent = originalResult.data.content ?? "";
      } else if (originalResult.success) {
        origContent = (originalResult as any).content ?? "";
      }

      let modContent = "";
      if (modifiedResult.success && (modifiedResult as any).data) {
        modContent = (modifiedResult as any).data.content ?? "";
      } else if (modifiedResult.success) {
        modContent = (modifiedResult as any).content ?? "";
      }

      set({
        diffContent: diffText,
        originalContent: origContent,
        modifiedContent: modContent,
        loadingDiff: false,
      });
    } catch {
      set({
        diffContent: "// 获取 diff 失败",
        originalContent: "",
        modifiedContent: "",
        loadingDiff: false,
      });
    }
  },

  clearDiff: () => set({
    activeDiff: null,
    diffContent: "",
    originalContent: "",
    modifiedContent: "",
  }),

  stageFile: async (filePath) => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      await window.electronAPI.git.add(repoPath, filePath);
      await get().refreshStatus();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  unstageFile: async (filePath) => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      await window.electronAPI.git.unstage(repoPath, filePath);
      await get().refreshStatus();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  stageAll: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      await window.electronAPI.git.addAll(repoPath);
      await get().refreshStatus();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  unstageAll: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      await window.electronAPI.git.unstageAll(repoPath);
      await get().refreshStatus();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  discardFile: async (filePath) => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      await window.electronAPI.git.discard(repoPath, filePath);
      await get().refreshStatus();
      get().clearDiff();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  commit: async () => {
    const { repoPath, commitMessage } = get();
    if (!repoPath || !commitMessage.trim() || !window.electronAPI) return;
    set({ committing: true, error: null });
    try {
      useOutputStore.getState().append("git", "Git", `提交: ${commitMessage.trim()}`);
      const result = await window.electronAPI.git.commit(
        repoPath,
        commitMessage.trim(),
      );
      if (result.success) {
        set({ commitMessage: "", committing: false });
        useOutputStore.getState().append("git", "Git", "提交成功", "success");
        await get().refreshAll();
      } else {
        set({
          error: result.error ?? "提交失败",
          committing: false,
        });
        useOutputStore.getState().append("git", "Git", `提交失败: ${result.error}`, "error");
      }
    } catch (e) {
      set({ error: String(e), committing: false });
      useOutputStore.getState().append("git", "Git", `提交异常: ${e}`, "error");
    }
  },

  setCommitMessage: (msg) => set({ commitMessage: msg }),

  switchBranch: async (branchName) => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      const result = await window.electronAPI.git.checkout(
        repoPath,
        branchName,
      );
      if (result.success) {
        await get().refreshAll();
      } else {
        set({ error: result.error ?? "切换分支失败" });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  push: async () => {
    const { repoPath, status } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      const branch = status?.currentBranch ?? "未知";
      useOutputStore.getState().append("git", "Git", `推送分支 ${branch} 到远程...`);
      const result = await window.electronAPI.git.push(
        repoPath,
        branch,
      );
      if (result.success) {
        useOutputStore.getState().append("git", "Git", "推送成功", "success");
        await get().refreshStatus();
      } else {
        set({ error: result.error ?? "推送失败" });
        useOutputStore.getState().append("git", "Git", `推送失败: ${result.error}`, "error");
      }
    } catch (e) {
      set({ error: String(e) });
      useOutputStore.getState().append("git", "Git", `推送异常: ${e}`, "error");
    }
  },

  pull: async () => {
    const { repoPath } = get();
    if (!repoPath || !window.electronAPI) return;
    try {
      useOutputStore.getState().append("git", "Git", "拉取远程变更...");
      const result = await window.electronAPI.git.pull(repoPath);
      if (result.success) {
        useOutputStore.getState().append("git", "Git", "拉取成功", "success");
        await get().refreshAll();
      } else {
        set({ error: result.error ?? "拉取失败" });
        useOutputStore.getState().append("git", "Git", `拉取失败: ${result.error}`, "error");
      }
    } catch (e) {
      set({ error: String(e) });
      useOutputStore.getState().append("git", "Git", `拉取异常: ${e}`, "error");
    }
  },

  clearError: () => set({ error: null }),
}));
