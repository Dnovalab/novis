/**
 * TerminalPanel — 终端集成面板
 *
 * 通过 xterm.js 在 IDE 内提供终端模拟。
 * Electron 模式下 spawn 真实 shell 进程，开发模式提供模拟终端。
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal, type ITerminalOptions } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { useFileStore } from "@/stores/file-store";
import { Loader2, Play, Trash2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME: ITerminalOptions = {
  theme: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    selectionBackground: "#585b70",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
  },
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 12,
  lineHeight: 1.35,
  cursorBlink: true,
  cursorStyle: "bar",
  allowTransparency: true,
  cols: 80,
  rows: 20,
};

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const inputBufferRef = useRef("");
  const { workspaceRoot } = useFileStore();

  /** 创建终端会话 */
  const startTerminal = useCallback(async () => {
    if (!window.electronAPI) {
      // 开发模式：模拟终端
      setLoading(true);
      setTimeout(() => {
        const term = xtermRef.current;
        if (!term) return;
        term.writeln("\x1b[33m⚠ Novis 终端（开发模式 — 模拟）\x1b[0m");
        term.writeln("\x1b[90mElectron 环境下将启动真实 shell 进程\x1b[0m");
        term.writeln("");
        term.write("\x1b[32m$\x1b[0m ");
        setLoading(false);
        setRunning(true);
      }, 500);
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.terminal.spawn(
        workspaceRoot || undefined,
      );
      setSessionId(result.sessionId);
      setRunning(true);
    } catch (e) {
      const term = xtermRef.current;
      if (term) {
        term.writeln(`\x1b[31m❌ 启动终端失败: ${e}\x1b[0m`);
      }
    }
    setLoading(false);
  }, [workspaceRoot]);

  /** 写入终端输入 */
  const writeStdin = useCallback(
    (data: string) => {
      if (!sessionId || !window.electronAPI) return;
      window.electronAPI.terminal.stdin(sessionId, data);
    },
    [sessionId],
  );

  /** 杀死终端进程 */
  const killTerminal = useCallback(async () => {
    if (sessionId && window.electronAPI) {
      await window.electronAPI.terminal.kill(sessionId);
    }
    setSessionId(null);
    setRunning(false);
  }, [sessionId]);

  // 初始化 xterm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal(THEME);
    xtermRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);

    // 延迟 resize 以获取正确容器尺寸
    setTimeout(() => fitAddon.fit(), 50);

    // 窗口 resize 时自适应
    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    // 键盘输入处理
    term.onData((data) => {
      if (sessionId) {
        writeStdin(data);
      } else {
        // 开发模式：本地处理
        if (data === "\r") {
          const cmd = inputBufferRef.current.trim();
          inputBufferRef.current = "";

          if (cmd === "clear") {
            term.clear();
            term.write("\x1b[32m$\x1b[0m ");
            return;
          }

          term.writeln("");
          if (cmd) {
            term.writeln(
              `\x1b[90m[模拟终端] 收到命令: ${cmd}\x1b[0m`,
            );
            term.writeln(
              `\x1b[90m启动 Electron 后将执行真实命令\x1b[0m`,
            );
          }
          term.write("\x1b[32m$\x1b[0m ");
        } else if (data === "\x7f") {
          // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            term.write("\b \b");
          }
        } else {
          inputBufferRef.current += data;
          term.write(data);
        }
      }
    });

    // 显示初始提示
    term.writeln("\x1b[90m按「启动终端」创建终端会话\x1b[0m");

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      xtermRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Electron 模式下注册 IPC 监听
  useEffect(() => {
    if (!window.electronAPI || !sessionId) return;

    const unsubStdout = window.electronAPI.terminal.onStdout((data) => {
      if (data.sessionId === sessionId) {
        xtermRef.current?.write(data.data);
      }
    });

    const unsubExit = window.electronAPI.terminal.onExit((data) => {
      if (data.sessionId === sessionId) {
        xtermRef.current?.writeln(
          `\r\n\x1b[90m进程已退出 (code: ${data.code})\x1b[0m`,
        );
        setSessionId(null);
        setRunning(false);
      }
    });

    return () => {
      unsubStdout();
      unsubExit();
    };
  }, [sessionId]);

  // sessionId 变化后调整 resize → xterm 通知主进程
  useEffect(() => {
    if (!sessionId || !window.electronAPI) return;

    const fitAddon = fitAddonRef.current;
    if (!fitAddon) return;

    // 首次 resize
    const updateSize = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        window.electronAPI.terminal.resize(
          sessionId,
          dims.cols,
          dims.rows,
        );
      }
    };

    updateSize();

    const handleResize = () => updateSize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [sessionId]);

  // xterm 在 Electron 模式下的 onData 处理
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !sessionId || !window.electronAPI) return;

    const disposable = term.onData((data) => {
      writeStdin(data);
    });

    return () => disposable.dispose();
  }, [sessionId, writeStdin]);

  return (
    <div className="flex h-full flex-col">
      {/* 面板头部 */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">终端</span>
        <div className="flex items-center gap-1">
          {running ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={killTerminal}
              className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600"
              title="终止终端"
            >
              <Square className="h-2.5 w-2.5 mr-1" />
              终止
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startTerminal}
              disabled={loading}
              className="h-6 px-2 text-[10px]"
            >
              {loading ? (
                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-2.5 w-2.5 mr-1" />
              )}
              启动终端
            </Button>
          )}
        </div>
      </div>

      {/* 终端区域 */}
      <div className="flex-1 overflow-hidden bg-[#1e1e2e]">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
}
