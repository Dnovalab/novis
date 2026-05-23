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

export interface WorkspaceFolder {
  path: string;
  name: string;
}

interface FileStore {
  /** 工作区跟目录路径（向后兼容） */
  workspaceRoot: string;
  /** 多根目录支持 */
  workspaceRoots: WorkspaceFolder[];
  /** 文件树节点列表 */
  files: FileNode[];
  /** 当前打开的文件列表（标签页） */
  openFiles: OpenFile[];
  /** 当前激活的文件路径 */
  activeFilePath: string | null;

  /** 设置工作区根目录（向后兼容） */
  setWorkspaceRoot: (root: string) => void;
  /** 添加工作区文件夹 */
  addWorkspaceFolder: (folder: WorkspaceFolder, treeFiles: string[]) => void;
  /** 移除工作区文件夹 */
  removeWorkspaceFolder: (path: string) => void;
  /** 设置文件树（保留根目录兼容） */
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

  /** 保存触发器计数器（每次递增触发外部保存） */
  saveCounter: number;
  /** 请求保存当前文件 */
  requestSave: () => void;
  /** 格式化触发器计数器 */
  formatCounter: number;
  /** 请求格式化当前文件 */
  requestFormat: () => void;

  /** 在指定父节点下添加文件/目录 */
  addFileNode: (parentPath: string, newNode: FileNode) => void;
  /** 删除文件/目录 */
  removeFileNode: (targetPath: string) => void;
  /** 重命名文件/目录 */
  renameFileNode: (targetPath: string, newName: string) => void;
  /** 移动文件/目录（拖拽排序/换目录） */
  moveFileNode: (sourcePath: string, targetPath: string, position: "before" | "after" | "inside") => void;
  /** 展开所有目录 */
  expandAll: () => void;
  /** 折叠所有目录 */
  collapseAll: () => void;
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

/** 路径列表 → 文件树结构 */
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const p of paths) {
    if (!p || p === ".") continue;
    const parts = p.split("/").filter(Boolean);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const name = parts[i];
      const existing = currentLevel.find((n) => n.name === name);

      if (existing) {
        if (!isLast && existing.type === "directory") {
          currentLevel = existing.children || (existing.children = []);
        }
      } else {
        const node: FileNode = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          type: isLast ? "file" : "directory",
          children: isLast ? undefined : [],
          expanded: true,
        };
        currentLevel.push(node);
        if (!isLast) {
          currentLevel = node.children || (node.children = []);
        }
      }
    }
  }

  return sortFileTree(root);
}

export function sortFileTree(nodes: FileNode[]): FileNode[] {
  const dirs = nodes
    .filter((n) => n.type === "directory")
    .map((n) => ({
      ...n,
      children: n.children ? sortFileTree(n.children) : n.children,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = nodes
    .filter((n) => n.type === "file")
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

// 保存触发器（每次递增，外部可通过此触发 Monaco 保存）
let _saveCounter = 0;
// 格式化触发器
let _formatCounter = 0;

export const useFileStore = create<FileStore>((set) => ({
  workspaceRoot: "",
  workspaceRoots: [],
  files: [],
  openFiles: [],
  activeFilePath: null,
  saveCounter: 0,
  formatCounter: 0,

  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),

  addWorkspaceFolder: (folder, treeFiles) =>
    set((state) => {
      const exists = state.workspaceRoots.some((r) => r.path === folder.path);
      if (exists) return state;

      // 用根目录名作为顶级目录节点的名字
      const rootNode: FileNode = {
        name: folder.name,
        path: folder.name,
        type: "directory",
        expanded: true,
        children: buildFileTree(treeFiles.map((f) => {
          // 去掉根目录前缀，保持相对路径
          const rel = f.startsWith(folder.path + "/") ? f.slice(folder.path.length + 1) : f;
          return rel;
        })),
      };

      return {
        workspaceRoots: [...state.workspaceRoots, folder],
        workspaceRoot: folder.path,
        files: sortFileTree([rootNode]),
      };
    }),

  removeWorkspaceFolder: (path) =>
    set((state) => {
      const idx = state.workspaceRoots.findIndex((r) => r.path === path);
      if (idx === -1) return state;
      const folder = state.workspaceRoots[idx];
      const remaining = state.workspaceRoots.filter((r) => r.path !== path);

      // 从文件树中移除对应根目录的节点
      const filtered = state.files.filter((n) => n.name !== folder.name);

      return {
        workspaceRoots: remaining,
        workspaceRoot: remaining[0]?.path ?? "",
        files: filtered,
      };
    }),

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

  requestSave: () => {
    _saveCounter++;
    set({ saveCounter: _saveCounter });
  },

  requestFormat: () => {
    _formatCounter++;
    set({ formatCounter: _formatCounter });
  },

  addFileNode: (parentPath, newNode) =>
    set((state) => ({
      files: addNodeToTree(state.files, parentPath, newNode),
    })),

  removeFileNode: (targetPath) =>
    set((state) => ({
      files: removeNodeFromTree(state.files, targetPath),
      // 如果已打开的文件被删除，也清理标签
      openFiles: state.openFiles.filter((f) => f.path !== targetPath),
      activeFilePath:
        state.activeFilePath === targetPath ? null : state.activeFilePath,
    })),

  renameFileNode: (targetPath, newName) =>
    set((state) => ({
      files: renameNodeInTree(state.files, targetPath, newName),
      // 更新已打开文件的路径和名称
      openFiles: state.openFiles.map((f) => {
        if (f.path === targetPath) {
          return { ...f, name: newName, path: updatePath(targetPath, newName) };
        }
        return f;
      }),
      activeFilePath:
        state.activeFilePath === targetPath
          ? updatePath(targetPath, newName)
          : state.activeFilePath,
    })),

  moveFileNode: (sourcePath, targetPath, position) =>
    set((state) => {
      // 从树中移除源节点
      const removed = extractNodeFromTree(state.files, sourcePath);
      if (!removed) return state;
      const [sourceNode, remaining] = removed;

      // 插入到目标位置
      const updatedFiles = insertNodeIntoTree(
        remaining,
        sourceNode,
        targetPath,
        position,
      );
      return { files: updatedFiles };
    }),

  expandAll: () =>
    set((state) => ({
      files: setAllExpanded(state.files, true),
    })),

  collapseAll: () =>
    set((state) => ({
      files: setAllExpanded(state.files, false),
    })),
}));

/** 递归设置所有目录的 expanded 状态 */
function setAllExpanded(nodes: FileNode[], expanded: boolean): FileNode[] {
  return nodes.map((node) => {
    if (node.type === "directory") {
      return {
        ...node,
        expanded,
        children: node.children ? setAllExpanded(node.children, expanded) : node.children,
      };
    }
    return node;
  });
}

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

/** 在指定父目录下添加节点（已展开父目录） */
export function addNodeToTree(
  nodes: FileNode[],
  parentPath: string,
  newNode: FileNode,
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === parentPath && node.type === "directory") {
      return {
        ...node,
        expanded: true,
        children: [...(node.children || []), newNode].sort((a, b) => {
          // 目录在前，文件在后，按名排序
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
      };
    }
    if (node.children) {
      return {
        ...node,
        children: addNodeToTree(node.children, parentPath, newNode),
      };
    }
    return node;
  });
}

/** 从树中删除指定节点 */
export function removeNodeFromTree(
  nodes: FileNode[],
  targetPath: string,
): FileNode[] {
  return nodes
    .filter((node) => node.path !== targetPath)
    .map((node) => {
      if (node.children) {
        return {
          ...node,
          children: removeNodeFromTree(node.children, targetPath),
        };
      }
      return node;
    });
}

/** 重命名树中的节点 */
export function renameNodeInTree(
  nodes: FileNode[],
  targetPath: string,
  newName: string,
): FileNode[] {
  const parentPath = targetPath.substring(0, targetPath.lastIndexOf("/"));
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, name: newName, path: newPath };
    }
    if (node.children) {
      return {
        ...node,
        children: renameNodeInTree(node.children, targetPath, newName),
      };
    }
    return node;
  });
}

/** 计算重命名后的新路径 */
function updatePath(oldPath: string, newName: string): string {
  const parts = oldPath.split("/");
  parts[parts.length - 1] = newName;
  return parts.join("/");
}

/**
 * 从树中移除指定路径的节点，返回 [被移除的节点, 剩余树]
 */
export function extractNodeFromTree(
  nodes: FileNode[],
  targetPath: string,
): [FileNode, FileNode[]] | null {
  let removed: FileNode | null = null;

  const filter = (list: FileNode[]): FileNode[] => {
    const result: FileNode[] = [];
    for (const node of list) {
      if (node.path === targetPath) {
        removed = node;
        continue;
      }
      if (node.children) {
        result.push({ ...node, children: filter(node.children) });
      } else {
        result.push(node);
      }
    }
    return result;
  };

  const remaining = filter(nodes);
  if (!removed) return null;
  return [removed, remaining];
}

/**
 * 将节点插入到树中指定位置
 * @param nodes 当前树
 * @param sourceNode 要插入的节点
 * @param targetPath 目标位置路径
 * @param position before=插入到同级之前, after=插入到同级之后, inside=作为子节点
 */
export function insertNodeIntoTree(
  nodes: FileNode[],
  sourceNode: FileNode,
  targetPath: string,
  position: "before" | "after" | "inside",
): FileNode[] {
  return insertRecursive(nodes, sourceNode, targetPath, position);
}

function insertRecursive(
  nodes: FileNode[],
  sourceNode: FileNode,
  targetPath: string,
  position: "before" | "after" | "inside",
): FileNode[] {
  const result: FileNode[] = [];

  for (const node of nodes) {
    if (node.path === targetPath) {
      if (position === "before") {
        result.push(sourceNode);
        result.push(node);
      } else if (position === "after") {
        result.push(node);
        result.push(sourceNode);
      } else if (position === "inside" && node.type === "directory") {
        // 插入到目录的第一个位置
        result.push({
          ...node,
          children: [sourceNode, ...(node.children || [])],
        });
      } else {
        result.push(node);
      }
      continue;
    }

    if (node.children && node.children.length > 0) {
      result.push({
        ...node,
        children: insertRecursive(node.children, sourceNode, targetPath, position),
      });
    } else {
      result.push(node);
    }
  }

  return result;
}
