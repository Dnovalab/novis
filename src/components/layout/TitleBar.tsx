/**
 * TitleBar — 应用标题栏 + 菜单系统
 *
 * VS Code 风格的菜单栏：File / Edit / View / Help
 * 支持鼠标 hover 切换菜单、键盘快捷键提示、分隔线
 */

import { useEffect, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileStore } from "@/stores/file-store";
import { APP_NAME, APP_VERSION } from "@/lib/utils";

interface MenuItemDef {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface TitleBarProps {
  onToggleSidebar: () => void;
  onOpenProject: () => void;
  onOpenCommandPalette: () => void;
  onNewFile?: () => void;
  onOpenAbout?: () => void;
  onOpenShortcutRef?: () => void;
}

export function TitleBar({
  onToggleSidebar,
  onOpenProject,
  onOpenCommandPalette,
  onNewFile,
  onOpenAbout,
  onOpenShortcutRef,
}: TitleBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!activeMenu) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    // 延迟添加，避免触发自身
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [activeMenu]);

  const handleMenuClick = (label: string) => {
    if (activeMenu === label) {
      setActiveMenu(null);
    } else {
      setActiveMenu(label);
    }
  };

  const handleMenuEnter = (label: string) => {
    setHoveredMenu(label);
    // 如果已有菜单打开，hover 切换
    if (activeMenu) {
      setActiveMenu(label);
    }
  };

  const handleMenuLeave = () => {
    setHoveredMenu(null);
  };

  const executeAndClose = (fn?: () => void) => {
    fn?.();
    setActiveMenu(null);
  };

  const switchPanel = (tab: string) => () => executeAndClose(() => {
    // 通过 store 调用
    const el = document.querySelector(`[data-sidebar-tab="${tab}"]`) as HTMLButtonElement | null;
    el?.click();
  });

  const menus: Record<string, MenuItemDef[]> = {
    File: [
      {
        label: "新建文件",
        shortcut: "⌘N",
        onClick: () => executeAndClose(onNewFile),
      },
      {
        label: "打开项目",
        shortcut: "⌘O",
        onClick: () => executeAndClose(onOpenProject),
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "保存",
        shortcut: "⌘S",
        onClick: () => executeAndClose(() => useFileStore.getState().requestSave()),
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "退出",
        onClick: () => {
          executeAndClose(() => {
            if (window.close) window.close();
          });
        },
      },
    ],
    Edit: [
      {
        label: "撤销",
        shortcut: "⌘Z",
        onClick: () => executeAndClose(() => document.execCommand("undo")),
      },
      {
        label: "重做",
        shortcut: "⇧⌘Z",
        onClick: () => executeAndClose(() => document.execCommand("redo")),
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "在项目中搜索",
        shortcut: "⇧⌘F",
        onClick: () => executeAndClose(switchPanel("search")),
      },
    ],
    View: [
      {
        label: "命令面板",
        shortcut: "⇧⌘P",
        onClick: () => executeAndClose(onOpenCommandPalette),
      },
      {
        label: "切换侧边栏",
        shortcut: "⌘B",
        onClick: () => executeAndClose(onToggleSidebar),
      },
      { separator: true, label: "", onClick: () => {} },
      { label: "文件浏览器", shortcut: "⌘E", onClick: switchPanel("files") },
      { label: "搜索", shortcut: "⇧⌘F", onClick: switchPanel("search") },
      { label: "Git", shortcut: "⇧⌘G", onClick: switchPanel("git") },
      { label: "终端", shortcut: "⌃`", onClick: switchPanel("terminal") },
      { separator: true, label: "", onClick: () => {} },
      { label: "设置", shortcut: "⌘,", onClick: switchPanel("settings") },
    ],
    Help: [
      {
        label: "关于 Novis",
        onClick: () => executeAndClose(onOpenAbout),
      },
      {
        label: "快捷键参考",
        onClick: () => executeAndClose(onOpenShortcutRef),
      },
    ],
  };

  const menuEntries = Object.entries(menus);

  return (
    <header className="flex h-11 items-center border-b bg-background" ref={menuRef}>
      {/* 菜单栏 */}
      <div
        className="flex h-full shrink-0 items-stretch"
        onMouseLeave={handleMenuLeave}
      >
        {menuEntries.map(([label]) => (
          <div
            key={label}
            className="relative flex items-stretch"
            onMouseEnter={() => handleMenuEnter(label)}
            onMouseLeave={() => hoveredMenu === label && setHoveredMenu(null)}
          >
            <button
              onClick={() => handleMenuClick(label)}
              className={cn(
                "flex items-center px-3 text-xs transition-colors",
                activeMenu === label
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              {label}
            </button>

            {/* 下拉菜单 */}
            {activeMenu === label && (
              <div
                className="absolute left-0 top-full z-50 min-w-[200px] rounded-md border bg-popover py-1 shadow-md"
                onMouseEnter={() => setHoveredMenu(label)}
              >
                {menus[label].map((item, i) => {
                  if (item.separator) {
                    return <div key={i} className="my-1 border-t" />;
                  }
                  return (
                    <button
                      key={i}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={cn(
                        "flex w-full items-center gap-4 px-3 py-1.5 text-left text-xs transition-colors",
                        item.disabled
                          ? "cursor-not-allowed opacity-40"
                          : "text-popover-foreground hover:bg-accent",
                      )}
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-muted-foreground/50">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 应用名称（居中） */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{APP_NAME}</span>
      </div>

      {/* 版本号 */}
      <div className="flex shrink-0 items-center px-4 text-xs text-muted-foreground">
        v{APP_VERSION}
      </div>
    </header>
  );
}
