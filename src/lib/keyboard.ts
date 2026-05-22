/**
 * Keyboard — 键盘快捷键系统
 *
 * 定义全局快捷键绑定，提供命令注册和执行能力。
 * 支持 macOS (Cmd) 和 Windows/Linux (Ctrl) 双平台。
 */

export type KeyMod = "ctrl" | "alt" | "shift" | "meta";

export interface KeyBinding {
  key: string;
  modifiers: KeyMod[];
  /** 显示标签（如 ⌘P） */
  label: string;
}

export interface Command {
  id: string;
  name: string;
  description: string;
  /** 快捷键绑定 */
  binding?: KeyBinding;
  /** 分类（用于命令面板分组） */
  category: "文件" | "编辑" | "视图" | "面板" | "终端" | "AI" | "项目管理" | "其他";
  /** 执行函数 */
  execute: () => void;
}

/** 是否为 macOS */
const isMac = typeof navigator !== "undefined" && navigator.platform?.includes("Mac");

/** 修饰键显示名 */
export function modLabel(mod: KeyMod): string {
  if (mod === "meta") return isMac ? "⌘" : "Win";
  if (mod === "ctrl") return isMac ? "⌃" : "Ctrl";
  if (mod === "alt") return isMac ? "⌥" : "Alt";
  if (mod === "shift") return isMac ? "⇧" : "Shift";
  return "";
}

/** 格式化快捷键显示 */
export function formatBinding(binding: KeyBinding): string {
  const mods = binding.modifiers.map(modLabel).join("");
  const key = binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
  return `${mods}${key}`;
}

/**
 * 检查键盘事件是否匹配快捷键绑定
 */
export function matchBinding(
  e: KeyboardEvent,
  binding: KeyBinding,
): boolean {
  const key = e.key.toLowerCase();
  const targetKey = binding.key.toLowerCase();

  // 修饰键检查
  const ctrl = e.ctrlKey || e.metaKey; // Cmd 或 Ctrl 都算
  const hasCtrl = binding.modifiers.includes("ctrl") || binding.modifiers.includes("meta");
  const hasAlt = binding.modifiers.includes("alt");
  const hasShift = binding.modifiers.includes("shift");

  if (hasCtrl !== ctrl) return false;
  if (hasAlt !== e.altKey) return false;
  if (hasShift !== e.shiftKey) return false;

  // 特殊键映射
  const keyMap: Record<string, string[]> = {
    " ": [" "],
    ",": [","],
    ".": ["."],
    "`": ["`", "~"],
  };

  const possibleKeys = keyMap[targetKey] ?? [targetKey];
  return possibleKeys.includes(key);
}
