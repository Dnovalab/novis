/**
 * 响应缓存 — 相同输入不重复计费
 *
 * 通过消息内容和模型配置的 hash 作为缓存键，
 * 在发送请求前检查是否已有缓存结果。
 */

import type { TokenUsage } from "@/types/electron";

interface CacheEntry {
  content: string;
  usage: TokenUsage;
  timestamp: number;
  modelId: string;
}

/** 缓存过期时间：5 分钟 */
const TTL_MS = 5 * 60 * 1000;
/** 最大缓存条目数 */
const MAX_ENTRIES = 100;

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * 生成缓存键 — 基于消息内容和模型 ID
   */
  makeKey(messages: Array<{ role: string; content: string }>, modelId: string): string {
    const content = messages
      .slice(-10) // 只用最近 10 条消息
      .map((m) => `${m.role}:${m.content.slice(0, 500)}`) // 每条最多 500 字符
      .join("|");
    return `${modelId}::${simpleHash(content)}`;
  }

  /**
   * 获取缓存
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存
   */
  set(key: string, content: string, usage: TokenUsage, modelId: string): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      content,
      usage,
      timestamp: Date.now(),
      modelId,
    });
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  stats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: MAX_ENTRIES };
  }
}

/** 简单字符串哈希 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/** 全局单例 */
export const responseCache = new ResponseCache();
