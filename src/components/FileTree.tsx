import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
  FilePlus,
  FolderPlus,
  RefreshCw,
  ChevronsUpDown,
  FolderKanban,
  X,
} from "lucide-react";
import { useFileStore, type FileNode } from "@/stores/file-store";
import { cn } from "@/lib/utils";

/** 上下文菜单位置信息 */
interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null;
  /** 父目录路径（用于"新建"操作） */
  parentPath: string;
}

/** 拖拽放置位置 */
type DropPosition = "before" | "after" | "inside";

/** 拖拽状态 */
interface DragState {
  node: FileNode;
  sourcePath: string;
}

/**
 * 文件树组件 — 显示工作区目录结构，右键菜单支持文件操作
 */
export function FileTree() {
  const {
    files,
    activeFilePath,
    openFile,
    toggleDirectory,
    workspaceRoot,
    workspaceRoots,
    addFileNode,
    removeFileNode,
    renameFileNode,
    moveFileNode,
    setFiles,
    expandAll,
    collapseAll,
    addWorkspaceFolder,
    removeWorkspaceFolder,
  } = useFileStore();

  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>("before");
  const dragNodeRef = useRef<DragState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** 添加文件夹到工作区 */
  const handleAddFolder = useCallback(async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.fs.selectDirectory();
    if (!dir) return;

    const tree = await window.electronAPI.fs.readDirectoryTree(dir);
    const flat = flattenDirTree(tree, "");
    const dirName = dir.split("/").pop() ?? "项目";
    addWorkspaceFolder({ path: dir, name: dirName }, flat.map((f) => `${dir}/${f}`));
  }, [addWorkspaceFolder]);

  /** 刷新文件树（从磁盘重新读取） */
  const handleRefresh = useCallback(async () => {
    if (!workspaceRoot || !window if (!window.electronAPI) return;
    if (refreshing) return;
    setRefreshing(true);
    try {
      const tree = await window.electronAPI.fs.readDirectoryTree(workspaceRoot);
      const flat = flattenDirTree(tree, "");
      setFiles(buildFileTree(flat));
    } catch {
      // 静默处理
    } finally {
      setRefreshing(false);
    }
  }, [workspaceRoot, setFiles, refreshing]);

  // 右键处理
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FileNode | null) => {
      e.preventDefault();
      e.stopPropagation();

      // 计算父路径
      let parentPath = "";
      if (node?.type === "directory") {
        parentPath = node.path;
      } else if (node?.type === "file") {
        parentPath = node.path.substring(0, node.path.lastIndexOf("/"));
      }

      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        node,
        parentPath,
      });
    },
    [],
  );

  // 点击外部关闭菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    // 延迟添加，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ctxMenu]);

  /** 新建文件 */
  const handleNewFile = useCallback(async () => {
    if (!ctxMenu) return;
    const name = window.prompt("输入文件名：");
    if (!name || name.trim() === "") return;

    const parent = ctxMenu.parentPath;
    const fullPath = parent ? `${parent}/${name.trim()}` : name.trim();

    // Electron 模式：通过 IPC 创建
    if (window.electronAPI?.fs?.createItem) {
      const _absPath = workspaceRoot
        ? `${workspaceRoot}/${fullPath}`
        : fullPath;
      const result = await window.electronAPI.fs.createItem(
        workspaceRoot ? `${workspaceRoot}/${parent}` : parent || ".",
        name.trim(),
        "file",
      );
      if (!result.success) {
        alert(`创建失败: ${result.error}`);
        return;
      }
    }

    addFileNode(parent, {
      name: name.trim(),
      path: fullPath,
      type: "file",
    });
    setCtxMenu(null);
  }, [ctxMenu, workspaceRoot, addFileNode]);

  /** 新建文件夹 */
  const handleNewFolder = useCallback(async () => {
    if (!ctxMenu) return;
    const name = window.prompt("输入文件夹名：");    if (!ctxMenu) return;
    const name = window.prompt("输入文件夹名：");
    if (!name || name.trim() === "") return;

    const parent = ctxMenu.parentPath;
    const fullPath = parent ? `${parent}/${name.trim()}` : name.trim();

    if (window.electronAPI?.fs?.createItem) {
      const result = await window.electronAPI.fs.createItem(
        workspaceRoot ? `${workspaceRoot}/${parent}` : parent || ".",
        name.trim(),
        "directory",
      );
      if (!result.success) {
        alert(`创建失败: ${result.error}`);
        return;
      }
    }

    addFileNode(parent, {
      name: name.trim(),
      path: fullPath,
      type: "directory",
      children: [],
      expanded: true,
    });
    setCtxMenu(null);
  }, [ctxMenu, workspaceRoot, addFileNode]);

  /** 重命名 */
  const handleRename = useCallback(async () => {
    if (!ctxMenu?.node) return;
    const oldName = ctxMenu.node.name;
    const newName = window.prompt("重命名为：", oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;

    const trimmed = newName.trim();
    if (window.electronAPI?.fs?.renameItem) {
      const absPath = workspaceRoot
        ? `${workspaceRoot}/${ctxMenu.node.path}`
        : ctxMenu.node.path;
      const result = await window.electronAPI.fs.renameItem(absPath, trimmed);
      if (!result.success) {
        alert(`重命名失败: ${result.error}`);
        return;
      }
    }

    renameFileNode(ctxMenu.node.path, trimmed);
    setCtxMenu(null);
  }, [ctxMenu, workspaceRoot, renameFileNode]);

  /** 删除 */
  const handleDelete = useCallback(async () => {
    if (!ctxMenu?.node) return;
    const typeName = ctxMenu.node.type === "directory" ? "文件夹" : "文件";
    const confirmed = window.confirm(
      `确定删除${typeName} "${ctxMenu.node.name}" 吗？此操作不可撤销。`,
    );
    if (!confirmed) return;

    if (window.electronAPI?.fs?.deleteItem) {
      const absPath = workspaceRoot
        ? `${workspaceRoot}/${ctxMenu.node.path}`
        : ctxMenu.node.path;
      const result = await window.electronAPI.fs.deleteItem(absPath);
      if (!result.success) {
        alert(`删除失败: ${result.error}`);
        return;
      }
    }

    removeFileNode(ctxMenu.node.path);
    setCtxMenu(null);
  }, [ctxMenu, workspaceRoot, removeFileNode]);

  /* ── 拖拽处理 ── */
  const handleDragStart = useCallback(
    (e: React.DragEvent, node: FileNode) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", node.path);
      dragNodeRef.current = { node, sourcePath: node.path };
      // 让拖拽时有半透明效果
      const el = e.currentTarget as HTMLElement;
      requestAnimationFrame(() => {
        el.style.opacity = "0.5";
      });
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetPath: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (!dragNodeRef.current) return;
      // 不能拖到自己身上
      if (dragNodeRef.current.sourcePath === targetPath) {
        setDragOverPath(null);
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      // 判断拖放位置
      let pos: DropPosition;
      if (targetPath !== dragNodeRef.current.sourcePath && y < height * 0.25) {
        pos = "before";
      } else if (y > height * 0.75) {
        pos = "after";
      } else {
        pos = "inside";
      }

      setDragOverPath(targetPath);
      setDropPosition(pos);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverPath(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPath: string) => {
      e.preventDefault();
      setDragOverPath(null);

      const drag = dragNodeRef.current;
      if (!drag) return;
      if (drag.sourcePath === targetPath) return;

      const pos = dropPosition;

      // Electron 模式：实际移动文件
      if (window.electronAPI?.fs?.renameItem && workspaceRoot) {
        const targetParts = targetPath.split("/");
        const targetName = targetParts[targetParts.length - 1];
        const targetDir = targetPath.substring(0, targetPath.lastIndexOf("/"));

        // 计算目标目录
        let destDir: string;
        if (pos === "inside") {
          destDir = targetPath;
        } else {
          destDir = targetDir;
        }

        const sourceName = drag.node.name;
        const destPath = destDir ? `${workspaceRoot}/${destDir}/${sourceName}` : `${workspaceRoot}/${sourceName}`;
        const sourceAbsPath = `${workspaceRoot}/${drag.sourcePath}`;

        window.electronAPI.fs.renameItem(sourceAbsPath, sourceName).then((r) => {
          if (!r.success) {
            alert(`移动失败: ${r.error}`);
            return;
          }
          // 更新 store 中的树
          moveFileNode(drag.sourcePath, targetPath, pos);
        });
      } else {
        // 开发模式：直接更新树
        moveFileNode(drag.sourcePath, targetPath, pos);
      }

      dragNodeRef.current = null;
    },
    [workspaceRoot, moveFileNode, dropPosition],
  );

  // 清理拖拽样式
  useEffect(() => {
    const handleDragEnd = () => {
      dragNodeRef.current = null;
      setDragOverPath(null);
      // 恢复所有节点的透明度
      document.querySelectorAll('[draggable="true"]').forEach((el) => {
        (el as HTMLElement).style.opacity = "";
      });
    };
    document.addEventListener("dragend", handleDragEnd);
    return () => document.removeEventListener("dragend", handleDragEnd);
  }, []);

  if (files.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        <Folder className="mb-2 h-8 w-8 opacity-30" />
        <p>暂无打开的项目</p>
        <p className="mt-1 text-xs">选择文件夹以浏览文件</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-[10px] font-medium text-muted-foreground/70">
          {workspaceRoots.length > 1
            ? `工作区 (${workspaceRoots.length})`
            : workspaceRoot
              ? workspaceRoot.split("/").pop() || "项目"
              : "文件"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={expandAll}
            className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors"
            title="全部展开"
          >
            <ChevronsUpDown className="h-3 w-3 rotate-90" />
          </button>
          <button
            onClick={collapseAll}
            className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors"
            title="全部折叠"
          >
            <ChevronsUpDown className="h-3 w-3 -rotate-90" />
          </button>
          {window.electronAPI && (
            <>
              <button
                onClick={handleAddFolder}
                className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors"
                title="添加文件夹到工作区"
              >
                <FolderKanban className="h-3 w-3" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                title="刷新文件树"
              >
                <RefreshCw
                  className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 多根目录标签 */}
      {workspaceRoots.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b bg-muted/10 px-2 py-1.5">
          {workspaceRoots.map((root) => (
            <span
              key={root.path}
              className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
            >
              <FolderKanban className="h-2.5 w-2.5" />
              {root.name}
              <button
                onClick={() => removeWorkspaceFolder(root.path)}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20"
                title="移出工作区"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 文件列表 */}
      <div
        className="flex-1 select-none overflow-y-auto py-1"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {files.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          activeFilePath={activeFilePath}
          onFileClick={openFile}
          onToggleDir={toggleDirectory}
          onContextMenu={handleContextMenu}
          dragOverPath={dragOverPath}
          dropPosition={dropPosition}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      )}
          

      {/* 右键菜单 */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover py-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {/* 节点相关操作 */}
          {(ctxMenu.node?.type === "directory" || ctxMenu.node === null) && (
            <>
              <MenuItem
                icon={<FilePlus className="h-3.5 w-3.5" />}
                label="新建文件"
                onClick={handleNewFile}
              />
              <MenuItem
                icon={<FolderPlus className="h-3.5 w-3.5" />}
                label="新建文件夹"
                onClick={handleNewFolder}
              />
              {ctxMenu.node && <div className="my-1 border-t" />}
            </>
          )}
          {ctxMenu.node && (
            <>
              <MenuItem
                icon={<Pencil className="h-3.5 w-3.5" />}
                label="重命名"
                onClick={handleRename}
              />
              <MenuItem
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="删除"
                onClick={handleDelete}
                danger
              />
            </>
          )}
        </div>
      )}
    </div>
  </div>
  );
}

/** 右键菜单项 */
function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-popover-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ====== TreeNode ======

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  onFileClick: (path: string, name: string) => void;
  onToggleDir: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  dragOverPath: string | null;
  dropPosition: DropPosition;
  onDragStart: (e: React.DragEvent, node: FileNode) => void;
  onDragOver: (e: React.DragEvent, targetPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetPath: string) => void;
}

function TreeNode({
  node,
  depth,
  activeFilePath,
  onFileClick,
  onToggleDir,
  onContextMenu,
  dragOverPath,
  dropPosition,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: TreeNodeProps) {
  const isActive = activeFilePath === node.path;
  const isDragOver = dragOverPath === node.path;

  /** 渲染放置指示线（顶部/底部边框） */
  const dropIndicatorClass = (() => {
    if (!isDragOver) return "";
    if (dropPosition === "before") return "border-t-2 border-t-primary";
    if (dropPosition === "after") return "border-b-2 border-b-primary";
    return ""; // inside 用背景色表示
  })();

  /** 拖入目录时背景高亮 */
  const dropInsideClass =
    isDragOver && dropPosition === "inside"
      ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
      : "";

  if (node.type === "directory") {
    const isExpanded = node.expanded ?? false;

    return (
      <div>
        <button
          draggable
          onClick={() => onToggleDir(node.path)}
          onContextMenu={(e) => onContextMenu(e, node)}
          onDragStart={(e) => onDragStart(e, node)}
          onDragOver={(e) => onDragOver(e, node.path)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, node.path)}
          className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50 ${
            isActive ? "bg-muted text-foreground" : "text-muted-foreground"
          } ${dropIndicatorClass} ${dropInsideClass}`}
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
              onContextMenu={onContextMenu}
              dragOverPath={dragOverPath}
              dropPosition={dropPosition}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      draggable
      onClick={() => onFileClick(node.path, node.name)}
      onContextMenu={(e) => onContextMenu(e, node)}
      onDragStart={(e) => onDragStart(e, node)}
      onDragOver={(e) => onDragOver(e, node.path)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, node.path)}
      className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50 ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground"
      } ${dropIndicatorClass} ${dropInsideClass}`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      <File className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ====== buildFileTree (用于模拟数据) ======

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
        current.push({
          name: part,
          path: fullPath,
          type: "file",
        });
      } else {
        let dir = current.find(
          (n) => n.name === part && n.type === "directory",
        ) as FileNode | undefined;

        if (!dir) {
          dir = {
            name: part,
            path: fullPath,
            type: "directory",
            children: [],
            expanded: i === 0,
          };
          current.push(dir);
        }
        current = dir.children!;
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

/** 将 IPC 返回的目录树拍平为路径列表 */
function flattenDirTree(
  nodes: Array<{ name: string; path: string; type: string; children?: any[] }>,
  parent: string,
): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    const relativePath = parent ? `${parent}/${node.name}` : node.name;
    if (node.type === "file") {
      result.push(relativePath);
    }
    if (node.children) {
      result.push(...flattenDirTree(node.children, relativePath));
    }
  }
  return result;
}
