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
  },

  // TODO: 终端操作
  // TODO: Git 操作
};

contextBridge.exposeInMainWorld("electronAPI", api);
