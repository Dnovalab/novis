/**
 * AboutDialog — 关于 Novis 信息对话框
 *
 * 显示应用版本、平台信息、技术栈和版权信息。
 */

import { useEffect } from "react";
import { Terminal, X } from "lucide-react";
import { APP_VERSION } from "@/lib/utils";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
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

  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  //  Electron 环境下获取平台信息
  const platform = isElectron
    ? window.electronAPI!.platform
    : navigator.platform;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-lg border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">Novis</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground/60">
          版本 {APP_VERSION}
        </p>

        {/* 信息区 */}
        <div className="mt-4 space-y-2 rounded-md bg-muted p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/70">运行模式</span>
            <span className="text-[10px] font-medium text-foreground/80">
              {isElectron ? "Electron" : "浏览器"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/70">平台</span>
            <span className="text-[10px] font-medium text-foreground/80">{platform}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/70">引擎</span>
            <span className="text-[10px] font-medium text-foreground/80">
              {navigator.userAgent.split("/")[0] ?? "Chromium"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/70">架构</span>
            <span className="text-[10px] font-medium text-foreground/80">
              {navigator.platform.includes("arm") ? "ARM64" : "x64"}
            </span>
          </div>
        </div>

        {/* 描述 */}
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/60">
          开源、本地优先的 AI 编程平台，集 AI 对话、代码编辑、项目管理、版本控制于一体。
        </p>
        <p className="mt-1 text-[9px] text-muted-foreground/40">
          基于 Electron + React + TypeScript + Monaco Editor
        </p>

        {/* 版权 */}
        <p className="mt-3 text-[9px] text-muted-foreground/30">
          &copy; {new Date().getFullYear()} Dnovalab. MIT License.
        </p>

        {/* 关闭按钮 */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-primary px-4 py-1 text-[11px] text-primary-foreground hover:opacity-90"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
