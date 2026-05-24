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
    const name = window.prompt("è¾å¥æä»¶å¤»åï¼");
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
      `ç¡®å®å é¤${typeName} "${ctxMenu.node.name}" åï¼æ­¤æä½ä¸å¯æ¤éã`,
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
            title="å¨é¨å±å¼"
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
                title="æ·»å æä»¶å¤¹å°å·¥ä½åº"
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
            <>
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
            key={[ÙK]BÙO^ÖæöFWÐ¢FWF×³Ð¢7FfTfÆUF×¶7FfTfÆUFÐ¢öäfÆT6Æ6³×¶÷VäfÆWÐ¢öåFövvÆTF#×·FövvÆTF&V7F÷'Ð¢öä6öçFWDÖVçS×¶æFÆT6öçFWDÖVçWÐ¢G&t÷fW%F×¶G&t÷fW%FÐ¢G&÷÷6Föã×¶G&÷÷6FöçÐ¢öäG&u7F'C×¶æFÆTG&u7F'GÐ¢öäG&t÷fW#×¶æFÆTG&t÷fW'Ð¢öäG&tÆVfS×¶æFÆTG&tÆVfWÐ¢öäG&÷×¶æFÆTG&÷Ð¢óà¢Ð ¢²ò¢Xû>JîùÎXÙR¢÷Ð¢¶7GÖVçRbb¢ÆF`¢&Vc×¶ÖVçU&VgÐ¢6Æ74æÖSÒ&fVB¢ÓSÖâ×rÕ³cÒ&÷VæFVBÖÖB&÷&FW"&r×÷÷fW"Ó6F÷rÖÖB ¢7GÆS×·²ÆVgC¢7GÖVçRçÂF÷¢7GÖVçRç×Ð¢à¢²ò¢¨.x+y»X[>i8ÞKÙÂ¢÷Ð¢²7GÖVçRææöFSòçGRÓÓÒ&F&V7F÷'"ÇÂ7GÖVçRææöFRÓÓÒçVÆÂbb¢Ãà¢ÄÖVçTFVÐ¢6öã×³ÄfÆUÇW26Æ74æÖSÒ&Ó2ãRrÓ2ãR"óçÐ¢Æ&VÃÒ.ik[»®ih~K»b ¢öä6Æ6³×¶æFÆTæWtfÆWÐ¢óà¢ÄÖVçTFVÐ¢6öã×³ÄföÆFW%ÇW26Æ74æÖSÒ&Ó2ãRrÓ2ãR"óçÐ¢Æ&VÃÒ.ik[»®ih~K»nZK ¢öä6Æ6³×¶æFÆTæWtföÆFW'Ð¢óà¢¶7GÖVçRææöFRbbÆFb6Æ74æÖSÒ&×Ó&÷&FW"×B"óçÐ¢Ãà¢Ð¢¶7GÖVçRææöFRbb¢Ãà¢ÄÖVçTFVÐ¢6öã×³ÅVæ6Â6Æ74æÖSÒ&Ó2ãRrÓ2ãR"óçÐ¢Æ&VÃÒ.xÞYÞYÒ ¢öä6Æ6³×¶æFÆU&VæÖWÐ¢óà¢ÄÖVçTFVÐ¢6öã×³ÅG&6"6Æ74æÖSÒ&Ó2ãRrÓ2ãR"óçÐ¢Æ&VÃÒ.XB ¢öä6Æ6³×¶æFÆTFVÆWFWÐ¢FævW ¢óà¢Âóà¢Ð¢ÂöFcà¢Ð¢ÂöFcà¢ÂöFcà¢°§Ð ¢ò¢¢Xû>JîùÎXÙ^¢ð¦gVæ7FöâÖVçTFVÒ°¢6öâÀ¢Æ&VÂÀ¢öä6Æ6²À¢FævW"À§Ó¢°¢6öã¢&V7Bå&V7DæöFS°¢Æ&VÃ¢7G&æs°¢öä6Æ6³¢ÓâföC°¢FævW#ó¢&ööÆVã°§Ò°¢&WGW&â¢Æ'WGFöà¢öä6Æ6³×¶öä6Æ6·Ð¢6Æ74æÖS×¶6â¢&fÆWrÖgVÆÂFV×2Ö6VçFW"vÓ"Ó2ÓãRFWBÖÆVgBFWB×2G&ç6FöâÖ6öÆ÷'2"À¢FævW ¢ò'FWB×&VBÓS÷fW#¦&r×&VBÓSó ¢¢'FWB×÷÷fW"Öf÷&Vw&÷VæB÷fW#¦&rÖ66VçB"À¢Ð¢à¢¶6öçÐ¢¶Æ&VÇÐ¢Âö'WGFöãà¢°§Ð ¢òòÓÓÓÓÓÒG&VTæöFRÓÓÓÓÓÐ ¦çFW&f6RG&VTæöFU&÷2°¢æöFS¢fÆTæöFS°¢FWF¢çVÖ&W#°¢7FfTfÆUF¢7G&ærÂçVÆÃ°¢öäfÆT6Æ6³¢F¢7G&ærÂæÖS¢7G&ærÓâföC°¢öåFövvÆTF#¢F¢7G&ærÓâföC°¢öä6öçFWDÖVçS¢S¢&V7BäÖ÷W6TWfVçBÂæöFS¢fÆTæöFRÓâföC°¢G&t÷fW%F¢7G&ærÂçVÆÃ°¢G&÷÷6Föã¢G&÷÷6Föã°¢öäG&u7F'C¢S¢&V7BäG&tWfVçBÂæöFS¢fÆTæöFRÓâföC°¢öäG&t÷fW#¢S¢&V7BäG&tWfVçBÂF&vWEF¢7G&ærÓâföC°¢öäG&tÆVfS¢ÓâföC°¢öäG&÷¢S¢&V7BäG&tWfVçBÂF&vWEF¢7G&ærÓâföC°§Ð ¦gVæ7FöâG&VTæöFR°¢æöFRÀ¢FWFÀ¢7FfTfÆUFÀ¢öäfÆT6Æ6²À¢öåFövvÆTF"À¢öä6öçFWDÖVçRÀ¢G&t÷fW%FÀ¢G&÷÷6FöâÀ¢öäG&u7F'BÀ¢öäG&t÷fW"À¢öäG&tÆVfRÀ¢öäG&÷À§Ó¢G&VTæöFU&÷2°¢6öç7B47FfRÒ7FfTfÆUFÓÓÒæöFRçF°¢6öç7B4G&t÷fW"ÒG&t÷fW%FÓÓÒæöFRçF° ¢ò¢¢k.iùNiKî{ÚîhÈ~zK®{«þûÈn:þ:j(¾kþhÈ~yºî[Ù^ûÈ¢ð¢6öç7BG&÷æF6F÷$6Æ72ÒÓâ°¢b4G&t÷fW"&WGW&â"#°¢bG&÷÷6FöâÓÓÒ&&Vf÷&R"&WGW&â&&÷&FW"×BÓ"&÷&FW"×B×&Ö'#°¢bG&÷÷6FöâÓÓÒ&gFW""&WGW&â&&÷&FW"Ö"Ó"&÷&FW"Ö"×&Ö'#°¢&WGW&â"#²òòç6FRyJ8Îiþ».zK ¢Ò° ¢ò¢¢h¹nXZ^yºî[Ù^i{n8Îiþ¹Kªâ¢ð¢6öç7BG&÷ç6FT6Æ72Ð¢4G&t÷fW"bbG&÷÷6FöâÓÓÒ&ç6FR ¢ò&&r×&Ö'ó&ærÓ&ærÖç6WB&ær×&Ö'ó3 ¢¢"#° ¢bæöFRçGRÓÓÒ&F&V7F÷'"°¢6öç7B4WæFVBÒæöFRæWæFVBóòfÇ6S° ¢&WGW&â¢ÆFcà¢Æ'WGFöà¢G&vv&ÆP¢öä6Æ6³×²ÓâöåFövvÆTF"æöFRçFÐ¢öä6öçFWDÖVçS×²RÓâöä6öçFWDÖVçRRÂæöFRÐ¢öäG&u7F'C×²RÓâöäG&u7F'BRÂæöFRÐ¢öäG&t÷fW#×²RÓâöäG&t÷fW"RÂæöFRçFÐ¢öäG&tÆVfS×¶öäG&tÆVfWÐ¢öäG&÷×²RÓâöäG&÷RÂæöFRçFÐ¢6Æ74æÖS×¶fÆWrÖgVÆÂFV×2Ö6VçFW"vÓÓ"ÓFWBÖÆVgBFWB×2G&ç6FöâÖ6öÆ÷'2÷fW#¦&rÖ×WFVBóSG°¢47FfRò&&rÖ×WFVBFWBÖf÷&Vw&÷VæB"¢'FWBÖ×WFVBÖf÷&Vw&÷VæB ¢ÒG¶G&÷æF6F÷$6Æ77ÒG¶G&÷ç6FT6Æ77ÖÐ¢7GÆS×·²FFætÆVgC¢G¶FWF¢b²××Ð¢à¢¶4WæFVBò¢Ä6Wg&öäF÷vâ6Æ74æÖSÒ&Ó2rÓ26&æ²Ó"óà¢¢¢Ä6Wg&öå&vB6Æ74æÖSÒ&Ó2rÓ26&æ²Ó"óà¢Ð¢¶4WæFVBò¢ÄföÆFW$÷Vâ6Æ74æÖSÒ&Ó2ãRrÓ2ãR6&æ²ÓFWB×VÆÆ÷rÓS"óà¢¢¢ÄföÆFW"6Æ74æÖSÒ&Ó2ãRrÓ2ãR6&æ²ÓFWB×VÆÆ÷rÓS"óà¢Ð¢Ç7â6Æ74æÖSÒ'G'Væ6FR#ç¶æöFRææÖWÓÂ÷7ãà¢Âö'WGFöãà ¢¶4WæFVBb`¢æöFRæ6ÆG&VãòæÖ6ÆBÓâ¢ÅG&VTæöFP¢¶W×¶6ÆBçFÐ¢æöFS×¶6ÆGÐ¢FWF×¶FWF²Ð¢7FfTfÆUF×¶7FfTfÆUFÐ¢öäfÆT6Æ6³×¶öäfÆT6Æ6·Ð¢öåFövvÆTF#×¶öåFövvÆTF'Ð¢öä6öçFWDÖVçS×¶öä6öçFWDÖVçWÐ¢G&t÷fW%F×¶G&t÷fW%FÐ¢G&÷÷6Föã×¶G&÷÷6FöçÐ¢öäG&u7F'C×¶öäG&u7F'GÐ¢öäG&t÷fW#×¶öäG&t÷fW'Ð¢öäG&tÆVfS×¶öäG&tÆVfWÐ¢öäG&÷×¶öäG&÷Ð¢óà¢Ð¢ÂöFcà¢°¢Ð ¢&WGW&â¢Æ'WGFöà¢G&vv&ÆP¢öä6Æ6³×²ÓâöäfÆT6Æ6²æöFRçFÂæöFRææÖRÐ¢öä6öçFWDÖVçS×²RÓâöä6öçFWDÖVçRRÂæöFRÐ¢öäG&u7F'C×²RÓâöäG&u7F'BRÂæöFRÐ¢öäG&t÷fW#×²RÓâöäG&t÷fW"RÂæöFRçFÐ¢öäG&tÆVfS×¶öäG&tÆVfWÐ¢öäG&÷×²RÓâöäG&÷RÂæöFRçFÐ¢6Æ74æÖS×¶fÆWrÖgVÆÂFV×2Ö6VçFW"vÓÓ"ÓFWBÖÆVgBFWB×2G&ç6FöâÖ6öÆ÷'2÷fW#¦&rÖ×WFVBóSG°¢47FfP¢ò&&r×&Ö'óFWB×&Ö' ¢¢'FWBÖ×WFVBÖf÷&Vw&÷VæB ¢ÒG¶G&÷æF6F÷$6Æ77ÒG¶G&÷ç6FT6Æ77ÖÐ¢7GÆS×·²FFætÆVgC¢G¶FWF¢b²#G××Ð¢à¢ÄfÆR6Æ74æÖSÒ&Ó2ãRrÓ2ãR6&æ²Ó÷6GÓc"óà¢Ç7â6Æ74æÖSÒ'G'Væ6FR#ç¶æöFRææÖWÓÂ÷7ãà¢Âö'WGFöãà¢°§Ð ¢òòÓÓÓÓÓÒ'VÆDfÆUG&VRÂ¥Â®K¨îjh¹þi[hÚâÓÓÓÓÓÐ ¢ò¢ ¢¢K¸îih~K»nzþ[èNi[{¸NièN[»®ih~K»nj	{¹>iè@¢¢&ÒF2ih~K»nzþ[èNi[{¸NûÈy»ZûK¨î[z^KÙÎXË®jyºî[Ù^ûÈ¢¢&WGW&ç2fÆTæöFRj	¢¢ð¦W÷'BgVæ7Föâ'VÆDfÆUG&VRF3¢7G&æuµÒ¢fÆTæöFUµÒ°¢6öç7B&ö÷C¢fÆTæöFUµÒÒµÓ° ¢f÷"6öç7BfÆUFöbF2°¢6öç7B'G2ÒfÆUFç7ÆB"ò"°¢ÆWB7W'&VçBÒ&ö÷C° ¢f÷"ÆWBÒ²Â'G2æÆVæwF²²²°¢6öç7B'BÒ'G5¶Ó°¢6öç7B4Æ7BÒÓÓÒ'G2æÆVæwFÒ°¢6öç7BgVÆÅFÒ'G2ç6Æ6RÂ²æ¦öâ"ò"° ¢b4Æ7B°¢7W'&VçBçW6°¢æÖS¢'BÀ¢F¢gVÆÅFÀ¢GS¢&fÆR"À¢Ò°¢ÒVÇ6R°¢ÆWBF"Ò7W'&VçBæfæB¢âÓââææÖRÓÓÒ'BbbâçGRÓÓÒ&F&V7F÷'"À¢2fÆTæöFRÂVæFVfæVC° ¢bF"°¢F"Ò°¢æÖS¢'BÀ¢F¢gVÆÅFÀ¢GS¢&F&V7F÷'"À¢6ÆG&Vã¢µÒÀ¢WæFVC¢ÓÓÒÀ¢Ó°¢7W'&VçBçW6F"°¢Ð¢7W'&VçBÒF"æ6ÆG&Vâ°¢Ð¢Ð¢Ð ¢&WGW&â6÷'DfÆUG&VR&ö÷B°§Ð ¦W÷'BgVæ7Föâ6÷'DfÆUG&VRæöFW3¢fÆTæöFUµÒ¢fÆTæöFUµÒ°¢6öç7BF'2ÒæöFW0¢æfÇFW"âÓââçGRÓÓÒ&F&V7F÷'"¢æÖâÓâ°¢ââæâÀ¢6ÆG&Vã¢âæ6ÆG&Vâò6÷'DfÆUG&VRâæ6ÆG&Vâ¢âæ6ÆG&VâÀ¢Ò¢ç6÷'BÂ"ÓâææÖRæÆö6ÆT6ö×&R"ææÖR° ¢6öç7BfÆW2ÒæöFW0¢æfÇFW"âÓââçGRÓÓÒ&fÆR"¢ç6÷'BÂ"ÓâææÖRæÆö6ÆT6ö×&R"ææÖR° ¢&WGW&â²ââæF'2ÂââæfÆW5Ó°§Ð ¢ò¢¢[b2ùNY¹îy¨Nyºî[Ù^j	h¸Þ[>K®zþ[èNX~¢ð¦gVæ7FöâfÆGFVäF%G&VR¢æöFW3¢'&Ç²æÖS¢7G&æs²F¢7G&æs²GS¢7G&æs²6ÆG&Vãó¢çµÒÓâÀ¢&VçC¢7G&ærÀ¢¢7G&æuµÒ°¢6öç7B&W7VÇC¢7G&æuµÒÒµÓ°¢f÷"6öç7BæöFRöbæöFW2°¢6öç7B&VÆFfUFÒ&VçBòG·&VçGÒòG¶æöFRææÖWÖ¢æöFRææÖS°¢bæöFRçGRÓÓÒ&fÆR"°¢&W7VÇBçW6&VÆFfUF°¢Ð¢bæöFRæ6ÆG&Vâ°¢&W7VÇBçW6ââæfÆGFVäF%G&VRæöFRæ6ÆG&VâÂ&VÆFfUF°¢Ð¢Ð¢&WGW&â&W7VÇC°§Ð
