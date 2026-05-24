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

/** ä¸ä¸æèåä½ç½®ä¿¡æ¯ */
interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null;
  /** ç¶ç®å½è·¯å¾ï¼ç¨äº"æ°å»º"æä½ï¼ */
  parentPath: string;
}

/** ææ½æ¾ç½®ä½ç½® */
type DropPosition = "before" | "after" | "inside";

/** ææ½ç¶æ */
interface DragState {
  node: FileNode;
  sourcePath: string;
}

/**
 * æä»¶æ ç»ä»¶ â æ¾ç¤ºå·¥ä½åºç®å½ç»æï¼å³é®èåæ¯ææä»¶æä½
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

  // å³é®èåç¶æ
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>("before");
  const dragNodeRef = useRef<DragState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** æ·»å æä»¶å¤¹å°å·¥ä½åº */
  const handleAddFolder = useCallback(async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.fs.selectDirectory();
    if (!dir) return;

    const tree = await window.electronAPI.fs.readDirectoryTree(dir);
    const flat = flattenDirTree(tree, "");
    const dirName = dir.split("/").pop() ?? "é¡¹ç®";
    addWorkspaceFolder({ path: dir, name: dirName }, flat.map((f) => `${dir}/${f}`));
  }, [addWorkspaceFolder]);

  /** å·æ°æä»¶æ ï¼ä»ç£çéæ°è¯»åï¼ */
  const handleRefresh = useCallback(async () => {
    if (!workspaceRoot || !window.electronAPI) return;
    if (refreshing) return;
    setRefreshing(true);
    try {
      const tree = await window.electronAPI.fs.readDirectoryTree(workspaceRoot);
      const flat = flattenDirTree(tree, "");
      setFiles(buildFileTree(flat));
    } catch {
      // éé»å¤ç
    } finally {
      setRefreshing(false);
    }
  }, [workspaceRoot, setFiles, refreshing]);

  // å³é®å¤ç
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FileNode | null) => {
      e.preventDefault();
      e.stopPropagation();

      // è®¡ç®ç¶è·¯å¾
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

  // ç¹å»å¤é¨å³é­èå
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    // å»¶è¿æ·»å ï¼é¿åç«å³è§¦å
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

  /** æ°å»ºæä»¶ */
  const handleNewFile = useCallback(async () => {
    if (!ctxMenu) return;
    const name = window.prompt("è¾å¥æä»¶åï¼");
    if (!name || name.trim() === "") return;

    const parent = ctxMenu.parentPath;
    const fullPath = parent ? `${parent}/${name.trim()}` : name.trim();

    // Electron æ¨¡å¼ï¼éè¿ IPC åå»º
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
        alert(`åå»ºå¤±è´¥: ${result.error}`);
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

  /** æ°å»ºæä»¶å¤¹ */
  const handleNewFolder = useCallback(async () => {
    if (!ctxMenu) return;
    const name = window.prompt("è¾å¥æä»¶å¤¹eï¼");
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
        alert(`åå»ºå¤±è´¥: ${result.error}`);
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

  /** éå½å */
  const handleRename = useCallback(async () => {
    if (!ctxMenu?.node) return;
    const oldName = ctxMenu.node.name;
    const newName = window.prompt("éå½åä¸ºï¼", oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;

    const trimmed = newName.trim();
    if (window.electronAPI?.fs?.renameItem) {
      const absPath = workspaceRoot
        ? `${workspaceRoot}/${ctxMenu.node.path}`
        : ctxMenu.node.path;
      const result = await window.electronAPI.fs.renameItem(absPath, trimmed);
      if (!result.success) {
        alert(`éå½åå¤±è´¥: ${result.error}`);
        return;
      }
    }

    renameFileNode(ctxMenu.node.path, trimmed);
    setCtxMenu(null);
  }, [ctxMenu, workspaceRoot, renameFileNode]);

  /** å é¤ */
  const handleDelete = useCallback(async () => {
    if (!ctxMenu?.node) return;
    const typeName = ctxMenu.node.type === "directory" ? "æä»¶å¤¹" : "æä»¶";
    const confirmed = window.confirm(
      `ç¡®å®å é¤${typeName} "${ctxMenu.node.name}" åï¼æ­¤æä½ä¸å¯æ¤éã`,
    );
    if (!confirmed) return;

    if (window.electronAPI?.fs?.deleteItem) {
      const absPath = workspaceRoot
        ? `${workspaceRoot}/${ctxMenu.node.path}`
        : ctxMenu.node.path;
      const result = await window.electronAPI.fs.deleteItem(absPath);
      if (!result.success) {
        alert(`å é¤å¤±è´¥: ${result.error}`);
        return;
      }
    }

    removeFileNode(ctxMenu.node.path);
    setCtxMenu(null);
  }, [ctxMenu, workspaceRoot, removeFileNode]);

  /* ââ ææ½å¤ç ââ */
  const handleDragStart = useCallback(
    (e: React.DragEvent, node: FileNode) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", node.path);
      dragNodeRef.current = { node, sourcePath: node.path };
      // è®©ææ½æ¶æåéæææ
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
      // ä¸è½æå°èªå·±èº«ä¸
      if (dragNodeRef.current.sourcePath === targetPath) {
        setDragOverPath(null);
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      // å¤æ­ææ¾ä½ç½®
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

      // Electron æ¨¡å¼ï¼å®éç§»å¨æä»¶
      if (window.electronAPI?.fs?.renameItem && workspaceRoot) {
        const targetParts = targetPath.split("/");
        const _targetName = targetParts[targetParts.length - 1];
        const targetDir = targetPath.substring(0, targetPath.lastIndexOf("/"));

        // è®¡ç®ç®æ ç®å½
        let destDir: string;
        if (pos === "inside") {
          destDir = targetPath;
        } else {
          destDir = targetDir;
        }

        const sourceName = drag.node.name;
        const _destPath = destDir ? `${workspaceRoot}/${destDir}/${sourceName}` : `${workspaceRoot}/${sourceName}`;
        const sourceAbsPath = `${workspaceRoot}/${drag.sourcePath}`;

        window.electronAPI.fs.renameItem(sourceAbsPath, sourceName).then((r) => {
          if (!r.success) {
            alert(`ç§»å¨å¤±è´¥: ${r.error}`);
            return;
          }
          // æ´æ° store ä¸­çæ 
          moveFileNode(drag.sourcePath, targetPath, pos);
        });
      } else {
        // å¼åæ¨¡å¼ï¼ç´æ¥æ´æ°æ 
        moveFileNode(drag.sourcePath, targetPath, pos);
      }

      dragNodeRef.current = null;
    },
    [workspaceRoot, moveFileNode, dropPosition],
  );

  // æ¸çææ½æ ·å¼
  useEffect(() => {
    const handleDragEnd = () => {
      dragNodeRef.current = null;
      setDragOverPath(null);
      // æ¢å¤ææèç¹çéæåº¦
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
        <p>ææ æå¼çé¡¹ç®</p>
        <p className="mt-1 text-xs">éæ©æä»¶å¤¹ä»¥æµè§æä»¶</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* æ é¢æ  */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-[10px] font-medium text-muted-foreground/70">
          {workspaceRoots.length > 1
            ? `å·¥ä½åº (${workspaceRoots.length})`
            : workspaceRoot
              ? workspaceRoot.split("/").pop() || "é¡¹ç®"
              : "æä»¶"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={expandAll}
            className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors"
            title="å¨é¨å±å½¿"
          >
            <ChevronsUpDown className="h-3 w-3 rotate-90" />
          </button>
          <button
            onClick={collapseAll}
            className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors"
            title="å¨é¨æå "
          >
            <ChevronsUpDown className="h-3 w-3 -rotate-90" />
          </button>
          {window.electronAPI && (
            <>
              <button
                onClick={handleAddFolder}
                className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors"
                title="æ·»å æä»¶å¤¹ç¨æå·¥ä½åº"
              >
                <FolderKanban className="h-3 w-3" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                title="å·æ°æä»¶æ "
              >
                <RefreshCw
                  className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </>
          )}
        </div>
      </div>

      {/* å¤æ ¹ç®å½æ ç­¾ */}
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
                title="ç§»åºå·¥ä½åº"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* æä»¶åè¡¨ */}
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
      ))}

      {/* å³é®èå */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover py-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {/* èç¹ç¸å³æä½ */}
          {(ctxMenu.node?.type === "directory" || ctxMenu.node === null) && (
            <>
              <MenuItem
                icon={<FilePlus className="h-3.5 w-3.5" />}
                label="æ°å»ºæä»¶"
                onClick={handleNewFile}
              />
              <MenuItem
                icon={<FolderPlus className="h-3.5 w-3.5" />}
                label="æ°å»ºæä»¶å¤¹"
                onClick={handleNewFolder}
              />
              {ctxMenu.node && <div className="my-1 border-t" />}
            </>
          )}
          {ctxMenu.node && (
            <>
              <MenuItem
                icon={<Pencil className="h-3.5 w-3.5" />}
                label="éå½å"
                onClick={handleRename}
              />
              <MenuItem
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="å é¤"
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

/** å³é®èåé¡¹ */
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

  /** æ¸²ææ¾ç½®æç¤ºçº¿ï¼é¡¶é¨/åºé¨è¾¹æ¡ï¼ */
  const dropIndicatorClass = (() => {
    if (!isDragOver) return "";
    if (dropPosition === "before") return "border-t-2 border-t-primary";
    if (dropPosition === "after") return "border-b-2 border-b-primary";
    return ""; // inside ç¨èæ¯è²è¡¨ç¤º
  })();

  /** æå¥ç®å½æ¶èæ¯é«äº® */
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

// ====== buildFileTree (ç¨äºæ¨¡ææ°æ®) ======

/**
 * ä»æä»¶è·¯å¾æ°ç»æå»ºæä»¶æ ç»æ
 * @param paths æä»¶è·¯å¾æ°ç»ï¼ååäºå·¥ä½åºæ ¹ç®å½ï¼
 * @returns FileNode æ 
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

/** å° IPC è¿åçç®å½æ få¹³ä¸ºè·¯å¾åè¡¨ */
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
