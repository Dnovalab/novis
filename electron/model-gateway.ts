/**
 * Novis Model Gateway â å¤æ¨¡åä»£çç½å³
 *
 * ä¸éæ¶æï¼
 *   1. Ollama æ¬å°æ¨¡åï¼åè´¹ï¼ä½å»¶è¿ï¼
 *   2. å¤§å APIï¼DeepSeek / Qwen / GLM / æ··åï¼
 *   3. æºè½è·¯ç±ï¼ç®å â æ¬å°ï¼å¤æ â APIï¼
 */

import { BrowserWindow } from "electron";

// ====== ç±»åå®ä¹ ======

export interface ModelConfig {
  id: string;
  name: string;
  provider: "ollama" | "deepseek" | "qwen" | "glm" | "hunyuan" | "custom";
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** æ¯ç¾ä¸è¾å¥ token ä»·æ ¼ï¼åï¼ */
  inputPrice?: number;
  /** æ¯ç¾ä¸è¾åº token ä»·æ ¼ï¼åï¼ */
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

// ====== é¢è®¾æ¨¡åéç½® ======

export const BUILTIN_MODELS: ModelConfig[] = [
  // --- Ollama æ¬å°æ¨¡å ---
  {
    id: "ollama-deepseek-r1",
    name: "DeepSeek R1 (æ¬å°)",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "deepseek-r1:7b",
    inputPrice: 0,
    outputPrice: 0,
  },
  {
    id: "ollama-qwen2.5",
    name: "Qwen 2.5 (æ¬å°)",
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "qwen2.5:7b",
    inputPrice: 0,
    outputPrice: 0,
  },
  {
    id: "ollama-glm4",
    name: "GLM-4 (æ¬å°)",
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
    inputPrice: 2, // Â¥2 / ç¾ä¸ token
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

  // --- Qwen (é¿ééä¹åé®) API ---
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

  // --- GLM (æºè°±) API ---
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

// ====== æ¨¡åç½å³ ======

export class ModelGateway {
  private models: Map<string, ModelConfig> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor() {
    // å è½½é¢ç½®æ¨¡å
    for (const model of BUILTIN_MODELS) {
      this.models.set(model.id, model);
    }
  }

  /** è·åææå·²æ³¨åæ¨¡å */
  getModels(): ModelInfo[] {
    return Array.from(this.models.values()).map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      model: m.model,
      isLocal: m.provider === "ollama",
    }));
  }

  /** æ·»å èªå®ä¹æ¨¡å */
  addModel(config: ModelConfig): void {
    this.models.set(config.id, config);
  }

  /** å é¤æ¨¡å */
  removeModel(id: string): void {
    this.models.delete(id);
  }

  /** è·åæ¨¡åéç½® */
  getModel(id: string): ModelConfig | undefined {
    return this.models.get(id);
  }

  /** è®¡ç®æ­¤æ¬¡è¯·æ±è´¹ç¨ */
  calculateCost(modelId: string, usage: TokenUsage): number {
    const model = this.models.get(modelId);
    if (!model || !model.inputPrice || !model.outputPrice) return 0;
    const inputCost = (usage.promptTokens / 1_000_000) * model.inputPrice;
    const outputCost =
      (usage.completionTokens / 1_000_000) * model.outputPrice;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  // ====== æ ¸å¿è¯·æ±æ¹æ³ ======

  /**
   * åæ¨¡ååéèå¤©è¯·æ±
   * @param modelId æ¨¡å ID
   * @param request è¯·æ±åæ°
   * @param window  Electron BrowserWindowï¼ç¨äºæµå¼æ¨éï¼
   * @returns æµå¼æ¨¡å¼è¿å nullï¼éè¿ IPC æ¨éï¼ï¼éæµå¼è¿åå®æ´ååº
   */
  async chat(
    modelId: string,
    request: ChatRequest,
    window?: BrowserWindow,
  ): Promise<{ content: string; usage: TokenUsage } | null> {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`æªç¥æ¨¡å: ${modelId}`);

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
        // æ OpenAI å¼å®¹æ ¼å¼å°è¯
        return this.chatOpenAICompat(model, request, stream, window);
    }
  }

  /** åæ¶æ­£å¨è¿è¡çè¯·æ± */
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
      throw new Error(`Ollama è¯·æ±å¤±è´¥ (${response.status}): ${text}`);
    }

    if (!stream || !window) {
      // éæµå¼æ¨¡å¼ â è¯»å®æ´ååº
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

    // æµå¼æ¨¡å¼
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
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
            // å¿½ç¥è§£æéè¯¯
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
      cost: 0, // Ollama åè´¹
    };

    window.webContents.send("model:stream-done", { id: requestId, usage });
    return { content: fullContent, usage };
  }

  // ====== OpenAI å¼å®¹æ ¼å¼ï¼DeepSeek / Qwen / æ··åï¼ ======

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
      throw new Error(`${model.provider} è¯·æ±å¤±è´¥ (${response.status}): ${text}`);
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

    // æµå¼æ¨¡å¼
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
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
            // å¿½ç¥è§£æéè¯¯
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

  // ====== GLMï¼æºè°±ï¼API â æ ¼å¼ç¥æä¸å ======

  private async chatGLM(
    model: ModelConfig,
    request: ChatRequest,
    stream: boolean,
    window?: BrowserWindow,
  ): Promise<{ content: string; usage: TokenUsage } | null> {
    const controller = new AbortController();
    this.abortControllers.set(model.id, controller);

    // GLM ä½¿ç¨ /v4/chat/completionsï¼ä¸æ¯ /v1/ï¼
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
      throw new Error(`GLM è¯·æ±å¤±è´¥ (${response.status}): ${text}`);
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

    // æµå¼æ¨¡å¼ â GLM ä¹æ¯ SSE æ ¼å¼
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let fullContent = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
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
            // å¿½ç¥è§£æéè¯¯
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

// ====== æºè½è·¯ç±ç­ç¥ ======

export type RouteStrategy = "local-first" | "quality-first" | "manual";

/**
 * å¤æ­ä»»å¡å¤æåº¦ â ç®åä»»å¡èµ°æ¬å°æ¨¡åï¼å¤æä»»å¡èµ° API
 * æ ¹æ®æ¶æ¯é¿åº¦ + å³é®è¯å¤æ­
 */
export function estimateComplexity(messages: ChatMessage[]): "simple" | "complex" {
  const fullText = messages.map((m) => m.content).join("\n");

  // é¿åº¦ > 2000 å­è§ä¸ºå¤æ
  if (fullText.length > 2000) return "complex";

  // åå«ä»¥ä¸å³é®è¯è§ä¸ºå¤æ
  const complexKeywords = [
    "ä»£ç ", "code", "éæ", "refactor",
    "è°è¯", "debug", "éè¯¯", "error",
    "æ¶æ", "è®¾è®¡æ¨¡å¼", "algorithm",
    "åæ", "åææ¥å", "review",
  ];
  const lower = fullText.toLowerCase();
  for (const kw of complexKeywords) {
    if (lower.includes(kw)) return "complex";
  }

  return "simple";
}

/**
 * æºè½éæ©æ¨¡å
 * @param strategy è·¯ç±ç­ç¥
 * @param messages æ¶æ¯åè¡¨
 * @param localModels å¯ç¨çæ¬å°æ¨¡ååè¡¨
 * @param apiModels å¯ç¨ç API æ¨¡ååè¡¨
 * @returns éä¸­çæ¨¡å ID
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
          reason: "æ¬å°ä¼åç­ç¥ â ä½¿ç¨æ¬å°æ¨¡å",
        };
      }
      // æ²¡ææ¬å°æ¨¡åååéå° API
      if (apiModels.length > 0) {
        return {
          modelId: apiModels[0].id,
          reason: "æ¬å°æ¨¡åä¸å¯ç¨ï¼åéå° API",
        };
      }
      throw new Error("æ²¡æå¯ç¨æ¨¡å");
    }

    case "quality-first": {
      if (apiModels.length > 0) {
        return {
          modelId: apiModels[0].id,
          reason: "è´¨éä¼åç­ç¥ â ä½¿ç¨äºç«¯ API",
        };
      }
      if (localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "API ä¸å¯ç¨ï¼åéå°æ¬å°æ¨¡å",
        };
      }
      throw new Error("æ²¡æå¯ç¨æ¨¡å");
    }

    case "manual":
    default: {
      // æ ¹æ®æ¶æ¯å¤æåº¦èªå¨éæ©
      const complexity = estimateComplexity(messages);
      if (complexity === "simple" && localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "ç®åä»»å¡ â æ¬å°åè´¹æ¨¡å",
        };
      }
      if (apiModels.length > 0) {
        return {
          modelId: apiModels[0].id,
          reason: `å¤æä»»å¡ â äºç«¯ API æ¨¡å`,
        };
      }
      if (localModels.length > 0) {
        return {
          modelId: localModels[0].id,
          reason: "API ä¸å¯ç¨ï¼ä½¿ç¨æ¬å°æ¨¡åååº",
        };
      }
      throw new Error("æ²¡æå¯ç¨æ¨¡å");
    }
  }
}
