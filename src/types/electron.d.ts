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
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
