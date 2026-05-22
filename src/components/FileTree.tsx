import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { useFileStore, type FileNode } from "@/stores/file-store";

/**
 * 文件树组件 — 显示工作区目录结构，点击文件在编辑器中打开
 */
export function FileTree() {
  const { files, activeFilePath, openFile, toggleDirectory } = useFileStore();

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
        <Folder className="mb-2 h-8 w-8 opacity-30" />
        <p>暂无打开的项目</p>
        <p className="mt-1 text-xs">选择文件夹以浏览文件</p>
      </div>
    );
  }

  return (
    <div className="select-none overflow-y-auto py-1">
      {files.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          activeFilePath={activeFilePath}
          onFileClick={openFile}
          onToggleDir={toggleDirectory}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  onFileClick: (path: string, name: string) => void;
  onToggleDir: (path: string) => void;
}

function TreeNode({
  node,
  depth,
  activeFilePath,
  onFileClick,
  onToggleDir,
}: TreeNodeProps) {
  const isActive = activeFilePath === node.path;

  if (node.type === "directory") {
    const isExpanded = node.expanded ?? false;

    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50 ${
            isActive ? "bg-muted text-foreground" : "text-muted-foreground"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>

        {isExpanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onFileClick={onFileClick}
              onToggleDir={onToggleDir}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileClick(node.path, node.name)}
      className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50 ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground"
      }`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      <File className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

/**
 * 从文件路径数组构建文件树结构
 * @param paths 文件路径数组（相对于工作区根目录）
 * @returns FileNode 树
 */
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      if (isLast) {
        // 文件
        current.push({
          name: part,
          path: fullPath,
          type: "file",
        });
      } else {
        // 目录 — 查找或创建
        let dir = current.find(
          (n) => n.name === part && n.type === "directory",
        ) as FileNode | undefined;

        if (!dir) {
          dir = {
            name: part,
            path: fullPath,
            type: "directory",
            children: [],
            expanded: i === 0, // 仅展开第一层
          };
          current.push(dir);
        }
        current = dir.children!;
      }
    }
  }

  // 排序：目录在前，文件在后，各自按名称排序
  return sortFileTree(root);
}

function sortFileTree(nodes: FileNode[]): FileNode[] {
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
