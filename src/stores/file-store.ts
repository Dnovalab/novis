import { create } from "zustand";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  expanded?: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  language: string;
  isDirty: boolean;
}

interface FileStore {
  /** 工作区跟目录路径 */
  workspaceRoot: string;
  /** 文件树节点列表 */
  files: FileNode[];
  /** 当前打开的文件列表（标签页） */
  openFiles: OpenFile[];
  /** 当前激活的文件路径 */
  activeFilePath: string | null;

  /** 设置工作区根目录 */
  setWorkspaceRoot: (root: string) => void;
  /** 设置文件树 */
  setFiles: (files: FileNode[]) => void;
  /** 展开/折叠目录 */
  toggleDirectory: (path: string) => void;
  /** 打开文件（或切换到已打开的文件） */
  openFile: (path: string, name: string) => void;
  /** 关闭文件标签页 */
  closeFile: (path: string) => void;
  /** 设置当前激活文件 */
  setActiveFile: (path: string) => void;
  /** 标记文件为已修改 */
  markDirty: (path: string, dirty: boolean) => void;
}

/** 根据文件扩展名推断 Monaco language ID */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "cpp",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    xml: "xml",
    svg: "xml",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    graphql: "graphql",
    vue: "html",
    svelte: "html",
  };
  return langMap[ext] ?? "plaintext";
}

export const useFileStore = create<FileStore>((set) => ({
  workspaceRoot: "",
  files: [],
  openFiles: [],
  activeFilePath: null,

  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),

  setFiles: (files) => set({ files }),

  toggleDirectory: (targetPath) =>
    set((state) => ({
      files: toggleNodeExpanded(state.files, targetPath),
    })),

  openFile: (path, name) =>
    set((state) => {
      // 如果已打开，只切换激活
      if (state.openFiles.some((f) => f.path === path)) {
        return { activeFilePath: path };
      }
      return {
        openFiles: [
          ...state.openFiles,
          {
            path,
            name,
            language: getLanguageFromPath(path),
            isDirty: false,
          },
        ],
        activeFilePath: path,
      };
    }),

  closeFile: (path) =>
    set((state) => {
      const idx = state.openFiles.findIndex((f) => f.path === path);
      const newOpen = state.openFiles.filter((f) => f.path !== path);

      let newActive = state.activeFilePath;
      if (newActive === path && newOpen.length > 0) {
        // 关闭当前激活的文件后，选相邻的
        const nextIdx = Math.min(idx, newOpen.length - 1);
        newActive = newOpen[nextIdx]?.path ?? null;
      } else if (newActive === path) {
        newActive = null;
      }

      return { openFiles: newOpen, activeFilePath: newActive };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  markDirty: (path, dirty) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty: dirty } : f,
      ),
    })),
}));

/** 递归展开/折叠目录节点 */
function toggleNodeExpanded(
  nodes: FileNode[],
  targetPath: string,
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath && node.type === "directory") {
      return { ...node, expanded: !node.expanded };
    }
    if (node.children) {
      return {
        ...node,
        children: toggleNodeExpanded(node.children, targetPath),
      };
    }
    return node;
  });
}
