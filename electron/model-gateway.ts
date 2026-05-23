/**
 * Novis Model Gateway — 多模型代理网关
 *
 * 三重架构：
 *   1. Ollama 本地模型（免费，低延迟）
 *   2. 大厂 API（DeepSeek / Qwen / GLM / 混元）
 *   3. 智能路由（简单 → 本地，复杂 → API）
 */

import { BrowserWindow } from "electron";

// ====== 类型定义 ======

export interface ModelConfig {
  id: string;
  name: string;
  provider: "ollama" | "deepseek" | "qwen" | "glm" | "hunyuan" | "custom";
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** 每百万输入 token 价格（元） */
  inputPrice?: number;
  /** 每百万输出 token 价格（元） */
  outputPrice?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  model: string;
  isLocal: boolean;
}

// ====== 预设模型配置 ======

export const BUILTIN_MODELS: ModelConfig[] = [
  // --- Ollama 本地模型 ---
  {
    id: "ollama-deepseek-r1",
    name: "DeepSeek R1 (本地)",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "deepseek-r1:7b",
    inputPrice: 0,
    outputPrice: 0,
  },
  {
    id: "ollama-qwen2.5",
    name: "Qwen 2.5 (本地)",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "qwen2.5:7b",
    inputPrice: 0,
    outputPrice: 0,
  },
  {
    id: "ollama-glm4",
    name: "GLM-4 (本地)",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "glm4:9b",
    inputPrice: 0,
    outputPrice: 0,
  },

  // --- DeepSeek API ---
  {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    inputPrice: 2, // ¥2 / 百万 token
    outputPrice: 8,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-reasoner",
    inputPrice: 4,
    outputPrice: 16,
  },

  // --- Qwen (阿里通义千问) API ---
  {
    id: "qwen-max",
    name: "Qwen Max",
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    model: "qwen-max",
    inputPrice: 20,
    outputPrice: 60,
  },
  {
    id: "qwen-plus",
    name: "Qwen Plus",
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    model: "qwen-plus",
    inputPrice: 2,
    outputPrice: 6,
  },
  {
    id: "qwen-turbo",
    name: "Qwen Turbo",
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    model: "qwen-turbo",
    inputPrice: 0.8,
    outputPrice: 2,
  },

  // --- GLM (智谱) API ---
  {
    id: "glm-4-plus",
    name: "GLM-4 Plus",
    provider: "glm",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    inputPrice: 5,
    outputPrice: 5,
  },
  {
    id: "glm-4-air",
    name: "GLM-4 Air",
    provider: "glm",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-air",
    inputPrice: 0.5,
    outputPrice: 0.5,
  },
];

// ====== 模型网关 ======

export class ModelGateway {
  private models: Map<string, ModelConfig> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor() {
    // 加载预置模型
    for (const model of BUILTIN_MODELS) {
      this.models.set(model.id, model);
    }
  }

  /** 获取所有已注册模型 */
  getModels(): ModelInfo[] {
    return Array.from(this.models.values()).map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      model: m.model,
      isLocal: m.provider === "ollama",
    }));
  }

  /** 添加自定义模型 */
  addModel(config: ModelConfig): void {
    this.models.set(config.id, config);
  }

  /** 删除模型 */
  removeModel(id: string): void {
    this.models.delete(id);
  }

  /** 获取模型配置 */
  getModel(id: string): ModelConfig | undefined {
    return this.models.get(id);
  }

  /** 计算此次请求费用 */
  calculateCost(modelId: string, usage: TokenUsage): number {
    const model = this.models.get(modelId);
    if (!model || !model.inputPrice || !model.outputPrice) return 0;
    const inputCost = (usage.promptTokens / 1_000_000) * model.inputPrice;
    const outputCost =
      (usage.completionTokens / 1_000_000) * model.outputPrice;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  // ====== 核心请求方法 ======

  /**
   * 向模型发送聊天请求
   * @param modelId 模型 ID
   * @param request 请求参数
   * @param window  Electron BrowserWindow（用于流式推送）
   * @returns 流式模式返回 null（通过 IPC 推送），非流式返回完整响应
   */
  async chat(
    modelId: string,
    request: ChatRequest,
    window?: BrowserWindow,
  ): Promise<{ content: string; usage: TokenUsage } | null> {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`未知模型: ${modelId}`);

    const stream = request.stream ?? true;

    switch (model.provider) {
      case "ollama":
        return this.chatOllama(model, request, stream, window);
      case "deepseek":
      case "qwen":
      case "hunyuan":
        return this.chatOpenAICompat(model, request, stream, window);
      case "glm":
        return this.chatGLM(model, request, stream, window);
      default:
        // 按 OpenAI 兼容格式尝试
        return this.chatOpenAICompat(model, request, stream, window);
    }
  }

  /** 取消正在进行的请求 */
  abort(modelId: string): void {
    const controller = this.abortControllers.get(modelId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(modelId);
    }
  }

  // ====== Ollama ======

  private async chatOllama(
    model: ModelConfig,
    request: ChatRequest,
    stream: boolean,
    window?: BrowserWindow,
  ): Promise<{ content: string; usage: TokenUsage } | null> {
    const controller = new AbortController();
    this.abortControllers.set(model.id, controller);

    const body = JSON.stringify({
      model: model.model,
      messages: request.messages,
      stream,
      options: {
        temperature: request.temperature ?? 0.7,
        ...(request.maxTokens ? { num_predict: request.maxTokens } : {}),
      },
    });

    const response = await fetch(`${model.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama 请求失败 (${response.status}): ${text}`);
    }

    if (!stream || !window) {
      // 非流式模式 — 读完整响应
      const data = (await response.json()) as {
        message: { content: string };
        total_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const usage: TokenUsage = {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        cost: 0,
      };
      return { content: data.message.content, usage };
    }

    // 流式模式
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as {
              message?: { content: string };
              done?: boolean;
              prompt_eval_count?: number;
              eval_count?: number;
            };
            if (data.message?.content) {
              fullContent += data.message.content;
              window.webContents.send("model:stream-chunk", {
                id: requestId,
                chunk: data.message.content,
              });
            }
            if (data.done) {
              promptTokens = data.prompt_eval_count ?? 0;
              completionTokens = data.eval_count ?? 0;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.abortControllers.delete(model.id);
    }

    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost: 0, // Ollama 免费
    };

    window.webContents.send("model:stream-done", { id: requestId, usage });
    return { content: fullContent, usage };
  }

  // ====== OpenAI 兼容格式（DeepSeek / Qwen / 混元） ======

  private async chatOpenAICompat(
    model: ModelConfig,
    request: ChatRequest,
    stream: boolean,
    window?: BrowserWindow,
  ): Promise<{ content: string; usage: TokenUsage } | null> {
    const controller = new AbortController();
    this.abortControllers.set(model.id, controller);

    const body = JSON.stringify({
      model: model.model,
      messages: request.messages,
      stream,
      temperature: request.temperature ?? 0.7,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    });

    const response = await fetch(`${model.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey ?? ""}`,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${model.provider} 请求失败 (${response.status}): ${text}`);
    }

    if (!stream || !window) {
      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };
      const raw = data.usage;
      const usage: TokenUsage = {
        promptTokens: raw?.prompt_tokens ?? 0,
        completionTokens: raw?.completion_tokens ?? 0,
        totalTokens: raw?.total_tokens ?? 0,
        cost: 0,
      };
      usage.cost = this.calculateCost(model.id, usage);
      return {
        content: data.choices[0]?.message?.content ?? "",
        usage,
      };
    }

    // 流式模式
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr) as {
              choices?: Array<{
                delta: { content?: string };
                finish_reason?: string;
              }>;
              usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
              };
            };

            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              window.webContents.send("model:stream-chunk", {
                id: requestId,
                chunk: content,
              });
            }

            if (data.usage) {
              promptTokens = data.usage.prompt_tokens;
              completionTokens = data.usage.completion_tokens;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.abortControllers.delete(model.id);
    }

    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost: this.calculateCost(model.id, {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost: 0,
      }),
    };

    window.webContents.send("model:stream-done", { id: requestId, usage });
    return { content: fullContent, usage };
  }

  // ====== GLM（智谱）API — 格式略有不同 ======

  private async chatGLM(
    model: ModelConfig,
    request: ChatRequest,
    stream: boolean,
    window?: BrowserWindow,
  ): Promise<{ content: string; usage: TokenUsage } | null> {
    const controller = new AbortController();
    this.abortControllers.set(model.id, controller);

    // GLM 使用 /v4/chat/completions（不是 /v1/）
    const body = JSON.stringify({
      model: model.model,
      messages: request.messages,
      stream,
      temperature: request.temperature ?? 0.7,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    });

    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey ?? ""}`,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GLM 请求失败 (${response.status}): ${text}`);
    }

    if (!stream || !window) {
      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };
      const raw = data.usage;
      const usage: TokenUsage = {
        promptTokens: raw?.prompt_tokens ?? 0,
        completionTokens: raw?.completion_tokens ?? 0,
        totalTokens: raw?.total_tokens ?? 0,
        cost: 0,
      };
      usage.cost = this.calculateCost(model.id, usage);
      return {
        content: data.choices[0]?.message?.content ?? "",
        usage,
      };
    }

    // 流式模式 — GLM 也是 SSE 格式
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr) as {
              choices?: Array<{
                delta: { content?: string };
                finish_reason?: string;
              }>;
              usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
              };
            };

            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              window.webContents.send("model:stream-chunk", {
                id: requestId,
                chunk: content,
              });
            }

            if (data.usage) {
              promptTokens = data.usage.prompt_tokens;
              completionTokens = data.usage.completion_tokens;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.abortControllers.delete(model.id);
    }

    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost: this.calculateCost(model.id, {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost: 0,
      }),
    };

    window.webContents.send("model:stream-done", { id: requestId, usage });
    return { content: fullContent, usage };
  }
}

// ====== 智能路由策略 ======

export type RouteStrategy = "local-first" | "quality-first" | "manual";

/**
 * 判断任务复杂度 — 简单任务走本地模型，复杂任务走 API
 * 根据消息长度 + 关键词判断
 */
export function estimateComplexity(messages: ChatMessage[]): "simple" | "complex" {
  const fullText = messages.map((m) => m.content).join("\n");

  // 长度 > 2000 字视为复杂
  if (fullText.length > 2000) return "complex";

  // 包含以下关键词视为复杂
  const complexKeywords = [
    "代码", "code", "重构", "refactor",
    "调试", "debug", "错误", "error",
    "架构", "设计模式", "algorithm",
    "分析", "分析报告", "review",
  ];
  const lower = fullText.toLowerCase();
  for (const kw of complexKeywords) {
    if (lower.includes(kw)) return "complex";
  }

  return "simple";
}

/**
 * 智能选择模型
 * @param strategy 路由策略
 * @param messages 消息列表
 * @param localModels 可用的本地模型列表
 * @param apiModels 可用的 API 模型列表
 * @returns 选中的模型 ID
 */
export function selectModel(
  strategy: RouteStrategy,
  messages: ChatMessage[],
  localModels: ModelInfo[],
  apiModels: ModelInfo[],
): { modelId: string; reason: string } {
  switch (strategy) {
    case "local-first": {
      if (localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "本地优先策略 — 使用本地模型",
        };
      }
      // 没有本地模型则回退到 API
      if (apiModels.length > 0) {
        return {
          modelId: apiModels[0].id,
          reason: "本地模型不可用，回退到 API",
        };
      }
      throw new Error("没有可用模型");
    }

    case "quality-first": {
      if (apiModels.length > 0) {
        return {
          modelId: apiModels[0].id,
          reason: "质量优先策略 — 使用云端 API",
        };
      }
      if (localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "API 不可用，回退到本地模型",
        };
      }
      throw new Error("没有可用模型");
    }

    case "manual":
    default: {
      // 根据消息复杂度自动选择
      const complexity = estimateComplexity(messages);
      if (complexity === "simple" && localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "简单任务 → 本地免费模型",
        };
      }
      if (apiModels.length > 0) {
        return {
          modelId: apiModels[0].id,
          reason: `复杂任务 → 云端 API 模型`,
        };
      }
      if (localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "API 不可用，使用本地模型兜底",
        };
      }
      throw new Error("没有可用模型");
    }
  }
}
