import { contextBridge, ipcRenderer } from "electron";

// 暴露给渲染进程的安全 API
const api = {
  // 应用信息
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  // ====== 模型网关 API ======
  model: {
    /** 获取所有可用模型 */
    getModels: () => ipcRenderer.invoke("model:get-models"),

    /** 添加自定义模型 */
    addModel: (config: {
      id: string;
      name: string;
      provider: string;
      baseUrl: string;
      apiKey?: string;
      model: string;
      inputPrice?: number;
      outputPrice?: number;
    }) => ipcRenderer.invoke("model:add-model", config),

    /** 删除模型 */
    removeModel: (id: string) => ipcRenderer.invoke("model:remove-model", id),

    /** 非流式聊天 */
    chat: (
      modelId: string,
      request: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        maxTokens?: number;
      },
    ) => ipcRenderer.invoke("model:chat", modelId, request),

    /** 流式聊天 */
    chatStream: (
      modelId: string,
      request: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        maxTokens?: number;
      },
    ) => ipcRenderer.invoke("model:chat-stream", modelId, request),

    /** 取消请求 */
    abort: (modelId: string) => ipcRenderer.invoke("model:abort", modelId),

    // 流式事件监听
    onStreamChunk: (callback: (data: { id: string; chunk: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; chunk: string }) =>
        callback(data);
      ipcRenderer.on("model:stream-chunk", handler);
      // 返回清理函数
      return () => ipcRenderer.removeListener("model:stream-chunk", handler);
    },

    onStreamDone: (callback: (data: { id: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { id: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number } },
      ) => callback(data);
      ipcRenderer.on("model:stream-done", handler);
      return () => ipcRenderer.removeListener("model:stream-done", handler);
    },

    onStreamError: (callback: (data: { id: string; error: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; error: string }) =>
        callback(data);
      ipcRenderer.on("model:stream-error", handler);
      return () => ipcRenderer.removeListener("model:stream-error", handler);
    },
  },

  // ====== 文件系统 API ======
  fs: {
    /** 选择文件夹对话框 */
    selectDirectory: () => ipcRenderer.invoke("fs:select-directory"),

    /** 读取目录内容 */
    readDirectory: (dirPath: string) =>
      ipcRenderer.invoke("fs:read-directory", dirPath),

    /** 递归读取目录树 */
    readDirectoryTree: (dirPath: string) =>
      ipcRenderer.invoke("fs:read-directory-tree", dirPath),

    /** 读取文件内容 */
    readFile: (filePath: string) =>
      ipcRenderer.invoke("fs:read-file", filePath),

    /** 写入文件 */
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke("fs:write-file", filePath, content),

    /** 新建文件或目录 */
    createItem: (parentPath: string, name: string, type: "file" | "directory") =>
      ipcRenderer.invoke("fs:create-item", parentPath, name, type),

    /** 删除文件或目录 */
    deleteItem: (targetPath: string) =>
      ipcRenderer.invoke("fs:delete-item", targetPath),

    /** 重命名文件或目录 */
    renameItem: (oldPath: string, newName: string) =>
      ipcRenderer.invoke("fs:rename-item", oldPath, newName),
  },

  // ====== Git API ======
  git: {
    status: (repoPath: string) => ipcRenderer.invoke("git:status", repoPath),
    diff: (repoPath: string, filePath: string, staged: boolean) =>
      ipcRenderer.invoke("git:diff", repoPath, filePath, staged),
    commit: (repoPath: string, message: string) =>
      ipcRenderer.invoke("git:commit", repoPath, message),
    log: (repoPath: string, maxCount?: number) =>
      ipcRenderer.invoke("git:log", repoPath, maxCount ?? 30),
    branches: (repoPath: string) =>
      ipcRenderer.invoke("git:branches", repoPath),
    checkout: (repoPath: string, target: string) =>
      ipcRenderer.invoke("git:checkout", repoPath, target),
    add: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke("git:add", repoPath, filePath),
    unstage: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke("git:unstage", repoPath, filePath),
    init: (repoPath: string) => ipcRenderer.invoke("git:init", repoPath),
    isRepo: (repoPath: string) => ipcRenderer.invoke("git:is-repo", repoPath),
    addAll: (repoPath: string) => ipcRenderer.invoke("git:add-all", repoPath),
    unstageAll: (repoPath: string) => ipcRenderer.invoke("git:unstage-all", repoPath),
    discard: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke("git:discard", repoPath, filePath),
    push: (repoPath: string, branch?: string) =>
      ipcRenderer.invoke("git:push", repoPath, branch),
    pull: (repoPath: string) => ipcRenderer.invoke("git:pull", repoPath),
  },

  // ====== 终端 API ======
  terminal: {
    spawn: (cwd?: string) => ipcRenderer.invoke("terminal:spawn", cwd),
    stdin: (sessionId: string, data: string) =>
      ipcRenderer.invoke("terminal:stdin", sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke("terminal:kill", sessionId),

    onStdout: (callback: (data: { sessionId: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; data: string }) =>
        callback(data);
      ipcRenderer.on("terminal:stdout", handler);
      return () => ipcRenderer.removeListener("terminal:stdout", handler);
    },

    onExit: (callback: (data: { sessionId: string; code: number | null }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { sessionId: string; code: number | null },
      ) => callback(data);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    },
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
