import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFileStore } from "@/stores/file-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  useDiagnosticsStore,
  type MonacoMarker,
} from "@/stores/diagnostics-store";
import { useCursorStore } from "@/stores/cursor-store";
import { useOutlineStore, type OutlineSymbol, type SymbolKind } from "@/stores/outline-store";
import { findTheme } from "@/lib/themes";

/* ── 上下文菜单类型 ── */
interface ContextMenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
  divider?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/**
 * Monaco Editor 组件
 * 动态加载 monaco-editor，支持语法高亮、多标签、内容加载、保存
 */
export function MonacoEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const {
    openFiles,
    activeFilePath,
    closeFile,
    setActiveFile,
    markDirty,
    workspaceRoot,
    saveCounter,
    formatCounter,
    requestSave,
  } = useFileStore();

  // 从设置中获取主题 + 编辑器配置
  const settingsTheme = useSettingsStore((s) => s.theme);
  const editorConfig = useSettingsStore((s) => s.editor);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const loadContent = useCallback(
    async (filePath: string): Promise<string> => {
      // Electron 模式：通过 IPC 读取
      if (window.electronAPI?.fs?.readFile) {
        try {
          const result = await window.electronAPI.fs.readFile(filePath);
          if (result.success && result.content !== undefined) {
            return result.content;
          }
          return `// 加载失败: ${result.error}\n`;
        } catch (err) {
          return `// 加载出错: ${err}\n`;
        }
      }

      // 开发模式：尝试用 fetch（仅对 public 目录文件有效）
      try {
        const resp = await fetch(filePath);
        if (resp.ok) return await resp.text();
      } catch {
        // 忽略 fetch 错误
      }

      // 回退：显示占位符
      const fileName = filePath.split("/").pop() ?? filePath;
      return `// ${fileName}\n// 开发模式下无法读取文件内容\n// 请启动 Electron 以编辑实际文件\n`;
    },
    [],
  );

  /** 保存当前文件 */
  const handleSave = useCallback(async () => {
    const editor = editorInstance.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFilePath) return;

    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const filePath = absolutePath(activeFilePath);

    setSaving(true);
    setSaveMessage(null);

    if (window.electronAPI?.fs?.writeFile) {
      try {
        const result = await window.electronAPI.fs.writeFile(filePath, content);
        if (result.success) {
          markDirty(activeFilePath, false);
          setSaveMessage("已保存");
        } else {
          setSaveMessage(`保存失败: ${result.error}`);
        }
      } catch (err) {
        setSaveMessage(`保存出错: ${err}`);
      }
    } else {
      // 开发模式：模拟保存
      markDirty(activeFilePath, false);
      setSaveMessage("已保存（开发模式 — 未写入磁盘）");
    }

    setSaving(false);

    // 3 秒后清除消息
    setTimeout(() => setSaveMessage(null), 3000);
  }, [activeFilePath, markDirty]);

  /** 将相对路径转为绝对路径 */
  function absolutePath(storePath: string): string {
    if (workspaceRoot) {
      return workspaceRoot + "/" + storePath;
    }
    return storePath;
  }

  /** 初始化 Monaco */
  useEffect(() => {
    if (!editorRef.current || loaded) return;

    let cancelled = false;

    const init = async () => {
      try {
        // 配置 Monaco Worker 加载路径
        (window as any).MonacoEnvironment = {
          getWorker(_workerId: string, label: string) {
            const getWorker = async (modulePath: string) => {
              const worker = new Worker(modulePath, { type: "module" });
              return worker;
            };

            switch (label) {
              case "json":
                return getWorker(
                  "/node_modules/monaco-editor/esm/vs/language/json/json.worker.js",
                );
              case "css":
              case "scss":
              case "less":
                return getWorker(
                  "/node_modules/monaco-editor/esm/vs/language/css/css.worker.js",
                );
              case "html":
              case "handlebars":
              case "razor":
                return getWorker(
                  "/node_modules/monaco-editor/esm/vs/language/html/html.worker.js",
                );
              case "typescript":
              case "javascript":
                return getWorker(
                  "/node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js",
                );
              default:
                return getWorker(
                  "/node_modules/monaco-editor/esm/vs/editor/editor.worker.js",
                );
            }
          },
        };

        const monaco = await import("monaco-editor");
        monacoRef.current = monaco;

        if (cancelled) return;

        // 根据设置主题解析 Monaco 主题
        const initialTheme = (() => {
          if (settingsTheme === "light") return "vs";
          if (settingsTheme === "dark") return "vs-dark";
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          return prefersDark ? "vs-dark" : "vs";
        })();

        const editorCfg = useSettingsStore.getState().editor;

        editorInstance.current = monaco.editor.create(editorRef.current!, {
          value: "// 选择一个文件开始编辑",
          language: "plaintext",
          theme: initialTheme,
          fontSize: editorCfg.fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          lineNumbers: "on",
          minimap: { enabled: editorCfg.minimapEnabled },
          scrollBeyondLastLine: false,
          wordWrap: editorCfg.wordWrap,
          tabSize: editorCfg.tabSize,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          renderWhitespace: "selection",
          padding: { top: 8 },
          cursorBlinking: "smooth",
          smoothScrolling: true,
        });

        // 内容变更时标记 dirty + 防抖自动保存
        editorInstance.current.onDidChangeModelContent(() => {
          const currentPath = useFileStore.getState().activeFilePath;
          if (currentPath) {
            useFileStore.getState().markDirty(currentPath, true);
          }

          // 防抖自动保存：停止输入 2 秒后自动保存
          if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
          autoSaveTimer.current = setTimeout(() => {
            const editor = editorInstance.current;
            if (!editor) return;
            const model = editor.getModel();
            if (!model) return;
            const fp = useFileStore.getState().activeFilePath;
            if (!fp) return;
            const content = model.getValue();
            const root = useFileStore.getState().workspaceRoot;
            const absPath = root ? `${root}/${fp}` : fp;

            if (window.electronAPI?.fs?.writeFile) {
              window.electronAPI.fs.writeFile(absPath, content).then((r) => {
                if (r.success) {
                  useFileStore.getState().markDirty(fp, false);
                }
              });
            } else {
              useFileStore.getState().markDirty(fp, false);
            }
          }, 2000);
        });

        // 监听 Monaco 标记变化 → 同步到 diagnostics-store
        const markerListener = monaco.editor.onDidChangeMarkers(([resource]) => {
          if (!resource) return;
          const markers = monaco.editor.getModelMarkers({ resource });

          const filePath = resource.path.replace(/^\//, "");
          const fileName = filePath.split("/").pop() ?? filePath;

          const converted: MonacoMarker[] = markers.map((m) => ({
            message: m.message,
            severity:
              m.severity === monaco.MarkerSeverity.Error
                ? "error"
                : m.severity === monaco.MarkerSeverity.Warning
                  ? "warning"
                  : m.severity === monaco.MarkerSeverity.Info
                    ? "info"
                    : "hint",
            startLineNumber: m.startLineNumber,
            startColumn: m.startColumn,
            endLineNumber: m.endLineNumber,
            endColumn: m.endColumn,
            code: typeof m.code === "string" ? m.code : m.code?.value,
            source: m.source,
            owner: m.owner,
          }));

          useDiagnosticsStore
            .getState()
            .setDiagnosticsForFile(filePath, fileName, converted);
        });

        // 光标位置变化 → 同步到 cursor-store
        editorInstance.current.onDidChangeCursorPosition((e: any) => {
          const model = editorInstance.current?.getModel();
          let selectionLength = 0;
          const sel = editorInstance.current?.getSelection();
          if (sel && !sel.isEmpty()) {
            selectionLength = model
              ? Math.abs(
                  model.getOffsetAt(sel.getStartPosition()) -
                    model.getOffsetAt(sel.getEndPosition()),
                )
              : 0;
          }
          useCursorStore.getState().setPosition({
            lineNumber: e.position.lineNumber,
            column: e.position.column,
            selectionLength,
          });
        });

        // 注册 Ctrl+S 保存快捷键（使用 store.getState() 避免闭包过期）
        editorInstance.current.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
          () => {
            const editor = editorInstance.current;
            if (!editor) return;
            const model = editor.getModel();
            if (!model) return;
            const currentPath = useFileStore.getState().activeFilePath;
            if (!currentPath) return;
            const content = model.getValue();
            const root = useFileStore.getState().workspaceRoot;
            const absPath = root ? `${root}/${currentPath}` : currentPath;

            if (window.electronAPI?.fs?.writeFile) {
              window.electronAPI.fs.writeFile(absPath, content).then((r) => {
                if (r.success) {
                  useFileStore.getState().markDirty(currentPath, false);
                }
              });
            } else {
              useFileStore.getState().markDirty(currentPath, false);
            }
          },
        );

        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            `Monaco Editor 加载失败: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      editorInstance.current?.dispose();
      editorInstance.current = null;
      monacoRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 切换文件时更新编辑器内容 */
  useEffect(() => {
    const editor = editorInstance.current;
    const monaco = monacoRef.current;
    if (!editor || !loaded || !monaco) return;

    const switchFile = async () => {
      const filePath = activeFilePath;
      const file = activeFile;
      if (!filePath) return;

      let currentModel: import("monaco-editor").editor.ITextModel | null = null;

      if (file) {
        const uri = monaco.Uri.parse(`file://${filePath}`);
        let model = monaco.editor.getModel(uri);

        if (model) {
          editor.setModel(model);
          currentModel = model;
        } else {
          // 从磁盘加载内容
          const content = await loadContent(filePath);
          model = monaco.editor.createModel(
            content ?? "",
            file.language,
            uri,
          );
          editor.setModel(model);
          // 新创建的内容不是脏的
          markDirty(filePath, false);
          currentModel = model;
        }
      } else {
        const uri = monaco.Uri.parse("file:///welcome.ts");
        let model = monaco.editor.getModel(uri);
        if (!model) {
          model = monaco.editor.createModel(
            "// 欢迎使用 Novis\n// 从文件树选择一个文件开始编辑\n",
            "typescript",
            uri,
          );
        }
        editor.setModel(model);
        currentModel = model;
      }

      // 提取文档符号（大纲）
      if (currentModel && filePath) {
        try {
          const providers = (monaco.languages as any).getDocumentSymbolProviders();
          if (providers.length > 0) {
            const results = await Promise.all(
              providers.map((p: any) =>
                p.provideDocumentSymbols(currentModel!, null!),
              ),
            );
            const allSymbols = results.flat().filter(Boolean);

            const outlineSymbols: OutlineSymbol[] = [];
            const seen = new Map<string, number>();

            for (const s of allSymbols) {
              if (!s) continue;
              const name = s.name;
              const count = seen.get(name) ?? 0;
              seen.set(name, count + 1);
              const fullName = count > 0 ? `${name}_${count}` : name;

              const kind = ((): SymbolKind => {
                const k = s.kind;
                const map: Record<number, SymbolKind> = {
                  0: "file", 1: "module", 2: "namespace", 3: "package",
                  4: "class", 5: "method", 6: "property", 7: "field",
                  8: "constructor", 9: "enum", 10: "interface",
                  11: "function", 12: "variable", 13: "constant",
                  14: "string", 15: "number", 16: "boolean", 17: "array",
                  18: "object", 19: "key", 20: "null",
                  21: "enum-member", 22: "struct", 23: "event",
                  24: "operator", 25: "type-parameter",
                };
                return map[k] ?? "variable";
              })();

              const children: OutlineSymbol[] = [];
              if ("children" in s && Array.isArray((s as any).children)) {
                for (const c of (s as any).children) {
                  if (!c) continue;
                  children.push({
                    name: c.name,
                    kind: kind,
                    line: c.range?.startLineNumber ?? 0,
                    column: c.range?.startColumn ?? 0,
                    children: [],
                    fullName: `${fullName}.${c.name}`,
                    containerName: name,
                  });
                }
              }

              outlineSymbols.push({
                name,
                kind,
                line: s.range?.startLineNumber ?? 0,
                column: s.range?.startColumn ?? 0,
                children,
                fullName,
              });
            }

            // 按行号排序
            outlineSymbols.sort((a, b) => a.line - b.line);
            useOutlineStore.getState().setSymbols(filePath, outlineSymbols);
          } else {
            useOutlineStore.getState().clear();
          }
        } catch {
          useOutlineStore.getState().clear();
        }
      } else {
        useOutlineStore.getState().clear();
      }
    };

    switchFile();
  }, [activeFilePath, activeFile, loaded, loadContent, markDirty]);

  /** 监听外部保存请求（如 Ctrl+S 来自 App.tsx 命令面板） */
  useEffect(() => {
    if (saveCounter > 0) {
      handleSave();
    }
  }, [saveCounter, handleSave]);

  /** 监听格式化请求 */
  useEffect(() => {
    if (formatCounter <= 0) return;
    const editor = editorInstance.current;
    if (!editor || !loaded) return;
    try {
      const formatAction = editor.getAction("editor.action.formatDocument");
      if (formatAction) {
        formatAction.run().catch(() => {});
      }
    } catch {
      // 格式化失败时静默处理
    }
  }, [formatCounter, loaded]);

  /** 监听诊断面板的跳转请求 */
  useEffect(() => {
    const unsub = useDiagnosticsStore.subscribe((state, prevState) => {
      if (!state.scrollToPosition) return;
      if (state.scrollToPosition === prevState.scrollToPosition) return;

      const editor = editorInstance.current;
      if (!editor || !loaded) return;

      const { filePath, line } = state.scrollToPosition;
      const currentPath = useFileStore.getState().activeFilePath;
      if (currentPath !== filePath) return;

      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
      useDiagnosticsStore.getState().clearScrollTo();
    });

    return unsub;
  }, [loaded]);

  /** 主题同步：设置主题变化时更新 Monaco 编辑器主题 */
  useEffect(() => {
    const editor = editorInstance.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !loaded) return;

    // 根据选中的主题 ID 解析 Monaco 主题
    const resolveMonacoTheme = () => {
      const { themeId } = useSettingsStore.getState();
      const t = findTheme(themeId);
      return t.monacoTheme;
    };

    const monacoTheme = resolveMonacoTheme();
    try {
      monaco.editor.setTheme(monacoTheme);
    } catch {
      // Monaco 可能尚未完全加载，忽略
    }
  }, [settingsTheme, loaded]);

  /** 编辑器配置同步：字体/制表符/换行/小地图变化时实时更新 */
  useEffect(() => {
    const editor = editorInstance.current;
    if (!editor || !loaded) return;
    editor.updateOptions({
      fontSize: editorConfig.fontSize,
      tabSize: editorConfig.tabSize,
      wordWrap: editorConfig.wordWrap,
      minimap: { enabled: editorConfig.minimapEnabled },
    });
  }, [editorConfig, loaded]);

  /** 组件卸载时清理自动保存定时器 */
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, []);

  /* ── 上下文菜单：右键打开自定义菜单 ── */
  useEffect(() => {
    const container = editorRef.current;
    if (!container || !loaded) return;

    const onContext = (e: MouseEvent) => {
      e.preventDefault();

      const editor = editorInstance.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;

      const items: ContextMenuItem[] = [];

      // 复制
      items.push({
        label: "复制",
        shortcut: "⌘C",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.clipboardCopyAction")?.run();
        },
      });

      // 粘贴
      items.push({
        label: "粘贴",
        shortcut: "⌘V",
        action: async () => {
          editor.focus();
          try {
            const text = await navigator.clipboard.readText();
            editor.executeEdits("paste", [
              {
                range: editor.getSelection() ?? editor.getModel()?.getFullModelRange(),
                text,
                forceMoveMarkers: true,
              },
            ]);
          } catch {
            // 剪贴板读取失败时使用 paste 命令
            editor.getAction("editor.action.clipboardPasteAction")?.run();
          }
        },
      });

      // 剪切
      items.push({
        label: "剪切",
        shortcut: "⌘X",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.clipboardCutAction")?.run();
        },
      });

      // 分隔线 + 格式化
      items.push({ label: "", action: () => {}, divider: true });
      items.push({
        label: "格式化文档",
        shortcut: "⇧⌘I",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.formatDocument")?.run();
        },
      });

      // 分隔线 + 全选
      items.push({ label: "", action: () => {}, divider: true });
      items.push({
        label: "全选",
        shortcut: "⌘A",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.selectAll")?.run();
        },
      });

      // 切换行注释
      items.push({
        label: "切换行注释",
        shortcut: "⌘/",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.commentLine")?.run();
        },
      });

      // 切换块注释
      items.push({
        label: "切换块注释",
        shortcut: "⇧⌘A",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.commentBlock")?.run();
        },
      });

      // 分隔线 + Go to Definition
      items.push({ label: "", action: () => {}, divider: true });
      items.push({
        label: "转到定义",
        shortcut: "F12",
        action: () => {
          editor.focus();
          editor.getAction("editor.action.revealDefinition")?.run();
        },
      });

      // 显示位置（边界检测）
      let x = e.clientX;
      let y = e.clientY;
      const menuW = 200;
      const menuH = items.filter((i) => !i.divider).length * 30 + 20;
      if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
      if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;

      setContextMenu({ x, y, items });
    };

    container.addEventListener("contextmenu", onContext);
    return () => container.removeEventListener("contextmenu", onContext);
  }, [loaded]);

  // 点击外部关闭上下文菜单
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    // 延迟添加以避免右键点击事件本身关闭菜单
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium text-destructive">编辑器不可用</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请确认 node_modules 中已安装 monaco-editor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 文件标签栏 */}
      {openFiles.length > 0 && (
        <div className="flex items-center border-b bg-muted/30">
          {openFiles.map((file) => (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className={`group flex cursor-pointer items-center gap-1 border-r px-3 py-1.5 text-xs transition-colors ${
                file.path === activeFilePath
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <FileIcon fileName={file.name} />
              <span>{file.name}</span>
              {file.isDirty && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (file.isDirty) {
                    const confirmed = window.confirm(
                      `"${file.name}" 有未保存的更改，确定关闭吗？`,
                    );
                    if (!confirmed) return;
                  }
                  closeFile(file.path);
                }}
                className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted-foreground/20"
                title="关闭"
              >
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            </div>
          ))}

          {/* 保存状态 */}
          <div className="ml-auto px-3">
            {saving && (
              <span className="text-[10px] text-muted-foreground/60">保存中…</span>
            )}
            {saveMessage && (
              <span
                className={`text-[10px] ${
                  saveMessage === "已保存"
                    ? "text-green-500"
                    : saveMessage.startsWith("已保存")
                      ? "text-amber-500"
                      : "text-red-500"
                }`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 面包屑导航 */}
      {activeFilePath && (
        <div className="flex items-center gap-0.5 border-b bg-muted/20 px-3 py-0.5 text-[11px] text-muted-foreground/60">
          {renderBreadcrumb(activeFilePath, workspaceRoot)}
        </div>
      )}

      {/* 编辑器区域 */}
      <div ref={editorRef} className="flex-1" />

      {/* 自定义上下文菜单（Portal） */}
      {contextMenu &&
        createPortal(
          <ContextMenuOverlay
            ref={contextMenuRef}
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />,
          document.body,
        )}
    </div>
  );
}

/**
 * 渲染面包屑导航
 * 将文件路径拆分为可点击的路径段
 */
function renderBreadcrumb(filePath: string, workspaceRoot: string): React.ReactNode {
  // 如果包含 workspaceRoot，去掉根路径前缀
  const relativePath = workspaceRoot && filePath.startsWith(workspaceRoot)
    ? filePath.slice(workspaceRoot.length + 1)
    : filePath;

  const segments = relativePath.split("/");
  const parts: Array<{ name: string; fullPath: string }> = [];
  let accumulated = "";
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    accumulated = accumulated ? `${accumulated}/${name}` : name;
    parts.push({ name, fullPath: accumulated });
  }

  return (
    <>
      {parts.map((part, idx) => (
        <span key={part.fullPath} className="flex items-center gap-0.5">
          {idx > 0 && (
            <span className="text-muted-foreground/30 mx-0.5">/</span>
          )}
          <span
            className={`rounded-sm px-0.5 transition-colors cursor-default ${
              idx === parts.length - 1
                ? "text-foreground/70 font-medium"
                : "hover:bg-muted/40 hover:text-foreground/60 cursor-pointer"
            }`}
          >
            {part.name}
          </span>
        </span>
      ))}
    </>
  );
}

/** 根据文件名显示对应文件图标 */
function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    ts: "text-blue-500",
    tsx: "text-blue-500",
    js: "text-yellow-500",
    jsx: "text-yellow-500",
    json: "text-yellow-500",
    md: "text-gray-400",
    css: "text-pink-500",
    html: "text-orange-500",
    py: "text-blue-400",
    rs: "text-orange-600",
    go: "text-cyan-500",
    yaml: "text-red-400",
    yml: "text-red-400",
    toml: "text-gray-400",
  };

  return (
    <span className={`text-xs ${colorMap[ext ?? ""] ?? "text-foreground"}`}>
      <FileTypeIcon ext={ext} />
    </span>
  );
}

function FileTypeIcon({ ext }: { ext?: string }) {
  const charMap: Record<string, string> = {
    ts: "T",
    tsx: "T",
    js: "J",
    jsx: "J",
    json: "{",
    md: "M",
    css: "#",
    html: "<",
    py: "P",
    rs: "R",
    go: "G",
    yaml: "Y",
    yml: "Y",
    toml: "T",
    sql: "S",
    sh: ">",
  };
  return <>{charMap[ext ?? ""] ?? "•"}</>;
}

/* ── 自定义上下文菜单覆盖层 ── */
const ContextMenuOverlay = React.forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
  }
>(function ContextMenuOverlay({ x, y, items, onClose }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  // 键盘导航
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const handleKey = (e: KeyboardEvent) => {
      const visibleItems = items.filter((i) => !i.divider);
      let idx = selectedIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          idx = selectedIndex === -1 ? 0 : Math.min(selectedIndex + 1, visibleItems.length - 1);
          setSelectedIndex(idx);
          break;
        case "ArrowUp":
          e.preventDefault();
          idx = selectedIndex === -1 ? visibleItems.length - 1 : Math.max(selectedIndex - 1, 0);
          setSelectedIndex(idx);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < visibleItems.length) {
            visibleItems[selectedIndex].action();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    menu.addEventListener("keydown", handleKey);
    return () => menu.removeEventListener("keydown", handleKey);
  }, [items, selectedIndex, onClose]);

  // 聚焦菜单以接收键盘事件
  useEffect(() => {
    const timer = setTimeout(() => {
      menuRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const visibleItems = items.filter((i) => !i.divider);

  return (
    <div
      ref={(node) => {
        (menuRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      tabIndex={-1}
      role="menu"
      className="fixed z-[9999] min-w-[180px] rounded-lg border bg-popover p-1 shadow-xl outline-none"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={`div-${i}`}
              className="my-1 border-t border-border"
            />
          );
        }

        const visibleIdx = visibleItems.indexOf(item);
        const isSelected = visibleIdx === selectedIndex;

        return (
          <button
            key={`item-${i}`}
            role="menuitem"
            className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            onClick={() => {
              item.action();
              onClose();
            }}
            onMouseEnter={() => setSelectedIndex(visibleIdx)}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span
                className={`ml-6 text-[10px] tabular-nums ${
                  isSelected
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground"
                }`}
              >
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
