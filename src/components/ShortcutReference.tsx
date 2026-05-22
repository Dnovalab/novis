/**
 * ShortcutReference — 快捷键参考弹窗
 *
 * 按分类展示所有可用键盘快捷键，便于用户快速上手。
 */

import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutRefItem {
  category: string;
  items: Array<{ name: string; binding: string }>;
}

interface ShortcutReferenceProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts: ShortcutRefItem[] = [
  {
    category: "面板",
    items: [
      { name: "命令面板", binding: "⇧ ⌘ P" },
      { name: "切换侧边栏", binding: "⌘ B" },
      { name: "文件浏览器", binding: "⌘ E" },
      { name: "搜索", binding: "⇧ ⌘ F" },
      { name: "版本控制 (Git)", binding: "⇧ ⌘ G" },
      { name: "终端", binding: "⌃ `" },
      { name: "设置", binding: "⌘ ," },
    ],
  },
  {
    category: "文件",
    items: [
      { name: "新建文件", binding: "⌘ N" },
      { name: "打开项目", binding: "⌘ O" },
      { name: "保存", binding: "⌘ S" },
    ],
  },
  {
    category: "编辑",
    items: [
      { name: "撤销", binding: "⌘ Z" },
      { name: "重做", binding: "⇧ ⌘ Z" },
    ],
  },
  {
    category: "编辑器",
    items: [
      { name: "查找", binding: "⌘ F" },
      { name: "替换", binding: "⌥ ⌘ F" },
      { name: "跳转到行", binding: "⌃ G" },
      { name: "选择所有匹配项", binding: "⇧ ⌘ L" },
      { name: "代码格式化", binding: "⇧ ⌥ F" },
      { name: "折叠/展开代码块", binding: "⌘ ⇧ [" },
    ],
  },
];

export function ShortcutReference({ open, onClose }: ShortcutReferenceProps) {
  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">快捷键参考</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 快捷键列表 */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {shortcuts.map((group) => (
            <div key={group.category} className="mb-4 last:mb-0">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                {group.category}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded px-2 py-1 hover:bg-accent/50"
                  >
                    <span className="text-xs text-foreground/80">
                      {item.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {item.binding}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 提示 */}
        <div className="border-t px-4 py-2 text-center text-[9px] text-muted-foreground/40">
          在命令面板中可以查看所有可用命令 (⇧⌘P)
        </div>
      </div>
    </div>
  );
}
