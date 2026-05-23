/**
 * MonacoDiffViewer — Monaco 双栏差异对比编辑器
 *
 * 用于 Git 面板的 diff 展示，替代纯文本 DiffViewer。
 * Electron 模式下加载真实 Monaco 编辑器，实现 VS Code 风格的双栏对比。
 * 自动根据文件名推断语言。
 */

import { useEffect, useRef } from "react";

interface MonacoDiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  fileName?: string;
  language?: string;
}

/** 文件扩展名到 Monaco language 映射 */
const extensionLanguageMap: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  hbs: "html",
  md: "markdown",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  sh: "shell",
  bash: "shell",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

function detectLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extensionLanguageMap[ext] || "plaintext";
}

export function MonacoDiffViewer({
  originalContent,
  modifiedContent,
  fileName = "file",
  language,
}: MonacoDiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const lang = language ?? detectLanguage(fileName);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    const init = async () => {
      try {
        ;(window as any).MonacoEnvironment = {
          getWorker(_workerId: string, label: string) {
            const getWorker = async (modulePath: string) => {
              return new Worker(modulePath, { type: "module" });
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
        monacoRef.current = monaco;

        // 检测当前主题
        const isDark =
          document.documentElement.classList.contains("dark") ||
          (document.documentElement.classList.contains("dark") === false &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);

        diffEditorRef.current = monaco.editor.createDiffEditor(
          containerRef.current!,
          {
            fontSize: 13,
            fontFamily:
              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            theme: isDark ? "vs-dark" : "vs",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            renderSideBySide: true,
            automaticLayout: true,
            diffCodeLens: true,
            originalEditable: false,
            bracketPairColorization: { enabled: true },
            padding: { top: 4 },
          },
        );

        const originalModel = monaco.editor.createModel(
          originalContent,
          lang,
        );
        const modifiedModel = monaco.editor.createModel(
          modifiedContent,
          lang,
        );

        diffEditorRef.current.setModel({
          original: originalModel,
          modified: modifiedModel,
        });
      } catch (err) {
        console.error("[MonacoDiffViewer] 初始化失败:", err);
      }
    };

    init();

    return () => {
      cancelled = true;
      diffEditorRef.current?.dispose();
      diffEditorRef.current = null;
      monacoRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 内容变化时更新模型
  useEffect(() => {
    const editor = diffEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (model) {
      model.original.setValue(originalContent);
      model.modified.setValue(modifiedContent);
    } else {
      // 尚未设置模型，创建新模型
      const originalModel = monaco.editor.createModel(
        originalContent,
        lang,
      );
      const modifiedModel = monaco.editor.createModel(
        modifiedContent,
        lang,
      );
      editor.setModel({
        original: originalModel,
        modified: modifiedModel,
      });
    }
  }, [originalContent, modifiedContent, lang]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: 200 }}
    />
  );
}
