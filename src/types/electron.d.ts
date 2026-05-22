export interface AppInfo {
  version: string;
  name: string;
  isDev: boolean;
  platform: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  model: string;
  isLocal: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  inputPrice?: number;
  outputPrice?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ElectronAPI {
  getAppInfo: () => Promise<AppInfo>;
  model: {
    getModels: () => Promise<ModelInfo[]>;
    addModel: (config: ModelConfig) => Promise<{ success: boolean }>;
    removeModel: (id: string) => Promise<{ success: boolean }>;
    chat: (
      modelId: string,
      request: { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number },
    ) => Promise<{ success: boolean; data?: { content: string; usage: TokenUsage }; error?: string }>;
    chatStream: (
      modelId: string,
      request: { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number },
    ) => Promise<{ success: boolean }>;
    abort: (modelId: string) => Promise<{ success: boolean }>;
    onStreamChunk: (callback: (data: { id: string; chunk: string }) => void) => () => void;
    onStreamDone: (callback: (data: { id: string; usage: TokenUsage }) => void) => () => void;
    onStreamError: (callback: (data: { id: string; error: string }) => void) => () => void;
  };
  fs: {
    selectDirectory: () => Promise<string | null>;
    readDirectory: (dirPath: string) => Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>;
    readDirectoryTree: (dirPath: string) => Promise<Array<{ name: string; path: string; type: 'file' | 'directory'; children?: any[] }>>;
    readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    createItem: (parentPath: string, name: string, type: 'file' | 'directory') => Promise<{ success: boolean; error?: string }>;
    deleteItem: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
    renameItem: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  };
  git: {
    status: (repoPath: string) => Promise<GitResult>;
    diff: (repoPath: string, filePath: string, staged: boolean) => Promise<GitResult>;
    commit: (repoPath: string, message: string) => Promise<GitResult>;
    log: (repoPath: string, maxCount?: number) => Promise<GitResult>;
    branches: (repoPath: string) => Promise<GitResult>;
    checkout: (repoPath: string, target: string) => Promise<GitResult>;
    add: (repoPath: string, filePath: string) => Promise<GitResult>;
    unstage: (repoPath: string, filePath: string) => Promise<GitResult>;
    init: (repoPath: string) => Promise<GitResult>;
    isRepo: (repoPath: string) => Promise<GitResult>;
    addAll: (repoPath: string) => Promise<GitResult>;
    unstageAll: (repoPath: string) => Promise<GitResult>;
    discard: (repoPath: string, filePath: string) => Promise<GitResult>;
    showFile: (repoPath: string, filePath: string, ref: string) => Promise<GitResult>;
    push: (repoPath: string, branch?: string) => Promise<GitResult>;
    pull: (repoPath: string) => Promise<GitResult>;
  };
  terminal: {
    spawn: (cwd?: string) => Promise<{ sessionId: string }>;
    stdin: (sessionId: string, data: string) => Promise<void>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
    kill: (sessionId: string) => Promise<void>;
    onStdout: (callback: (data: TerminalStdout) => void) => () => void;
    onExit: (callback: (data: TerminalExit) => void) => () => void;
  };
}

// ====== Git 类型定义 ======

export interface GitStatus {
  currentBranch: string;
  changes: GitChange[];
  ahead: number;
  behind: number;
  hasConflict: boolean;
}

export interface GitChange {
  path: string;
  oldPath?: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflict";
  staged: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface GitDiff {
  filePath: string;
  staged: boolean;
  content: string; // unified diff text
}

export interface GitResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ====== 终端类型定义 ======

export interface TerminalSession {
  id: string;
  cwd: string;
}

export interface TerminalStdout {
  sessionId: string;
  data: string;
}

export interface TerminalExit {
  sessionId: string;
  code: number | null;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
