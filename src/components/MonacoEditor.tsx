import { useCallback, useEffect, useRef, useState } from "react";
import { useFileStore } from "@/stores/file-store";

/**
 * Monaco Editor 组件
 * 动态加载 monaco-editor，支持语法高亮、多标签、主题同步
 */
export function MonacoEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { openFiles, activeFilePath, closeFile, setActiveFile, markDirty } =
    useFileStore();

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  /** 初始化 Monaco */
  useEffect(() => {
    if (!editorRef.current || loaded) return;

    let cancelled = false;

    const init = async () => {
      try {
        // 配置 Monaco Worker 加载路径
        // @ts-expect-error — MonacoEnvironment 由 monaco-editor 注入
        window.MonacoEnvironment = {
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

        if (cancelled) return;

        editorInstance.current = monaco.editor.create(editorRef.current!, {
          value: "// 选择一个文件开始编辑",
          language: "plaintext",
          theme: "vs-dark",
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          lineNumbers: "on",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          renderWhitespace: "selection",
          padding: { top: 8 },
          cursorBlinking: "smooth",
          smoothScrolling: true,
        });

        // 内容变更时标记 dirty
        editorInstance.current.onDidChangeModelContent(() => {
          if (activeFilePath) {
            markDirty(activeFilePath, true);
          }
        });

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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 切换文件时更新编辑器内容 */
  useEffect(() => {
    const editor = editorInstance.current;
    if (!editor || !loaded) return;

    const initMonaco = async () => {
      const monaco = await import("monaco-editor");

      if (activeFile) {
        const model = monaco.editor.getModel(
          monaco.Uri.parse(`file://${activeFile.path}`),
        );
        if (model) {
          editor.setModel(model);
        } else {
          const newModel = monaco.editor.createModel(
            `// ${activeFile.name}\n`,
            activeFile.language,
            monaco.Uri.parse(`file://${activeFile.path}`),
          );
          editor.setModel(newModel);
        }
      } else {
        const model = monaco.editor.getModel(
          monaco.Uri.parse("file:///welcome.ts"),
        );
        if (!model) {
          const welcomeModel = monaco.editor.createModel(
            '// 欢迎使用 Novis\n// 从文件树选择一个文件开始编辑\n',
            "typescript",
            monaco.Uri.parse("file:///welcome.ts"),
          );
          editor.setModel(welcomeModel);
        } else {
          editor.setModel(model);
        }
      }
    };

    initMonaco();
  }, [activeFilePath, activeFile, loaded]);

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
        <div className="flex border-b bg-muted/30">
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
        </div>
      )}

      {/* 编辑器区域 */}
      <div ref={editorRef} className="flex-1" />
    </div>
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
