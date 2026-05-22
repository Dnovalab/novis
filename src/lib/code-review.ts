/**
 * Code Review — AI 代码审查引擎
 *
 * 对代码差异或文件内容进行 AI 审查，返回结构化审查结果。
 * 支持 Git diff 审查和文件审查两种模式。
 */

import type { ReviewIssue, ReviewResult } from "@/stores/code-review-store";

// ====== 系统 Prompt ======

const SYSTEM_PROMPT = `你是一位资深代码审查专家。请对提供的代码变更进行全面的代码审查。

## 审查维度
1. **正确性** — 逻辑错误、边界情况、空指针、并发问题
2. **安全性** — SQL 注入、XSS、权限泄露、敏感信息硬编码
3. **性能** — 不必要的循环、内存泄漏、过度渲染、大数据量处理
4. **可维护性** — 命名规范、代码重复、单一职责、模块依赖
5. **最佳实践** — TypeScript 严格模式、React hooks 规则、错误处理

## 返回格式（必须是纯 JSON，不要包含 markdown 代码块标记）
{
  "summary": "审查总结（1-2 句话）",
  "score": 85,
  "issues": [
    {
      "severity": "critical" | "warning" | "suggestion",
      "file": "src/file.tsx",
      "line": 42,
      "title": "问题简短标题",
      "description": "问题详细描述",
      "suggestion": "改进建议"
    }
  ]
}

## 评分规则
- 90-100: 优秀，代码质量很高
- 70-89: 良好，有小问题需要改进
- 50-69: 一般，有较多需要改进的地方
- 0-49: 需要大幅改进

注意：如果没有发现问题，issues 数组可以为空。`;

// ====== Review 引擎 ======

export interface ReviewRequest {
  /** 审查类型 */
  type: "diff" | "file" | "manual";
  /** 审查内容 */
  content: string;
  /** 文件名（可选） */
  fileName?: string;
  /** 语言/框架上下文 */
  context?: string;
}

/**
 * 执行代码审查
 */
export async function performReview(
  request: ReviewRequest,
  modelId: string,
  signal?: AbortSignal,
): Promise<ReviewResult> {
  // 构建用户消息
  let userMessage = "";

  switch (request.type) {
    case "diff":
      userMessage = `请审查以下代码变更（diff）：\n\`\`\`diff\n${request.content}\n\`\`\``;
      if (request.fileName) {
        userMessage = `文件: ${request.fileName}\n${userMessage}`;
      }
      break;

    case "file":
      userMessage = `请审查以下代码：\n\`\`\`${request.fileName?.split(".").pop() || ""}\n${request.content}\n\`\`\``;
      if (request.fileName) {
        userMessage = `文件: ${request.fileName}\n${userMessage}`;
      }
      break;

    case "manual":
      userMessage = `请审查以下代码：\n\`\`\`\n${request.content}\n\`\`\``;
      break;
  }

  if (request.context) {
    userMessage += `\n\n## 上下文\n${request.context}`;
  }

  try {
    let rawContent = "";

    if (typeof window !== "undefined" && (window as any).electronAPI) {
      // 检查是否已取消
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const result = await (window as any).electronAPI.model.chat(
        modelId,
        {
          model: modelId,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          maxTokens: 4096,
        },
      );

      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      if (!result.success) {
        throw new Error(result.error ?? "模型调用失败");
      }
      rawContent = result.data?.content ?? "";
    } else {
      // 开发模式：模拟审查
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const isDiff = request.type === "diff";
      rawContent = JSON.stringify({
        summary: isDiff
          ? "代码变更整体质量良好，有一些小问题需要改进。"
          : "代码结构清晰，符合最佳实践。部分地方可以进一步优化。",
        score: isDiff ? 78 : 85,
        issues: isDiff
          ? [
              {
                severity: "warning",
                file: request.fileName || "unknown",
                line: 15,
                title: "缺少错误处理",
                description: "该函数没有对异步操作进行 try/catch 包装，可能导致未捕获的 Promise 异常。",
                suggestion: "使用 try/catch 包裹 await 调用，或在调用处添加 .catch() 处理。",
              },
              {
                severity: "suggestion",
                file: request.fileName || "unknown",
                line: 28,
                title: "可以使用解构赋值简化",
                description: "多处重复使用 props.xxx，可以使用解构赋值使代码更简洁。",
                suggestion: "在函数参数处使用解构：`({ name, age }: Props)` 替代 `(props: Props)`",
              },
            ]
          : [
              {
                severity: "suggestion",
                file: request.fileName || "unknown",
                line: 0,
                title: "考虑添加类型导出",
                description: "组件 Props 类型没有导出，外部使用时无法复用。",
                suggestion: "添加 export 关键字导出接口定义。",
              },
            ],
      });
    }

    // 解析 JSON
    const parsed = parseReviewResult(rawContent);
    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      summary: `审查失败: ${error instanceof Error ? error.message : String(error)}`,
      score: 0,
      issues: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 解析 AI 返回的审查结果 JSON
 */
function parseReviewResult(raw: string): ReviewResult {
  try {
    // 提取 JSON（可能被 markdown 包裹）
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr.trim());

    return {
      summary: parsed.summary || "审查完成",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    // 解析失败时，把原始内容作为文本返回
    return {
      summary: raw.slice(0, 300),
      score: 0,
      issues: [],
    };
  }
}
