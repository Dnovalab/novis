/**
 * 上下文瘦身 — 长对话自动压缩摘要
 *
 * 当对话超过阈值时，将早期消息压缩为一段摘要（保持最后 N 条完整消息），
 * 减少发送给 API 的 token 消耗。
 */

import type { Message } from "@/stores/chat-store";

/** 触发压缩的消息数量阈值 */
const SLIM_THRESHOLD = 30;
/** 压缩后保留的完整消息数量 */
const KEEP_LATEST = 20;
/** 每条消息摘要的最大长度 */
const MAX_SUMMARY_LENGTH = 1200;

export interface SlimResult {
  messages: Message[];
  wasSlimmed: boolean;
  summary: string;
}

/**
 * 检查并执行上下文瘦身
 * @param messages 当前消息列表
 * @returns 压缩后的消息列表
 */
export function slimContext(messages: Message[]): SlimResult {
  if (messages.length <= SLIM_THRESHOLD) {
    return { messages, wasSlimmed: false, summary: "" };
  }

  // 只压缩 assistant + user 消息（保留 system 消息）
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  // 保留最新的 KEEP_LATEST 条
  const keepMessages = conversationMessages.slice(-KEEP_LATEST);
  const slimMessages = conversationMessages.slice(
    0,
    conversationMessages.length - KEEP_LATEST,
  );

  // 生成摘要
  const summary = generateSummary(slimMessages);

  // 构建新的消息列表：system + 摘要 + 保留的最新消息
  const summaryMessage: Message = {
    id: `summary-${Date.now()}`,
    role: "system",
    content: `以下是对对话早期内容的摘要，请基于此继续：\n\n${summary}`,
    timestamp: Date.now(),
  };

  return {
    messages: [...systemMessages, summaryMessage, ...keepMessages],
    wasSlimmed: true,
    summary,
  };
}

/**
 * 生成消息摘要 — 提取关键信息
 */
function generateSummary(messages: Message[]): string {
  const parts: string[] = [];
  let totalLength = 0;

  for (const msg of messages) {
    const role = msg.role === "user" ? "用户" : "助手";
    const content = truncateContent(msg.content, 200);
    const entry = `[${role}]: ${content}`;

    if (totalLength + entry.length > MAX_SUMMARY_LENGTH) {
      parts.push(`... 以及 ${messages.length - parts.length} 条消息`);
      break;
    }

    parts.push(entry);
    totalLength += entry.length;
  }

  return parts.join("\n");
}

/**
 * 截断消息内容至指定长度，保留开头和结尾
 */
function truncateContent(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen - 30) + "\n...\n" + content.slice(-30);
}

/**
 * 检查是否需要压缩（供外部调用判断）
 */
export function needsSlim(messages: Message[]): boolean {
  return messages.filter((m) => m.role !== "system").length > SLIM_THRESHOLD;
}
