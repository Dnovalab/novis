import { useCallback } from "react";
import { File, ListTree } from "lucide-react";
import {
  useOutlineStore,
  type OutlineSymbol,
  symbolIcon,
  symbolColor,
} from "@/stores/outline-store";
import { useFileStore } from "@/stores/file-store";
import { cn } from "@/lib/utils";

export function OutlinePanel() {
  const { symbols, currentFilePath, loading } = useOutlineStore();
  const activeFilePath = useFileStore((s) => s.activeFilePath);

  /** 点击符号 → 跳转到对应行 */
  const handleSymbolClick = useCallback(
    (sym: OutlineSymbol) => {
      if (!currentFilePath) return;
      const store = useFileStore.getState();
      // 如果文件未打开，先打开
      if (store.activeFilePath !== currentFilePath) {
        const fileName = currentFilePath.split("/").pop() ?? currentFilePath;
        store.openFile(currentFilePath, fileName);
      }
      useFileStore.getState().openFile(currentFilePath, currentFilePath.split("/").pop() ?? currentFilePath);
    },
    [currentFilePath],
  );

  // 无文件打开
  if (!activeFilePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
        <ListTree className="mb-2 h-8 w-8 opacity-30" />
        <p>大纲</p>
        <p className="mt-1 text-xs">打开文件查看符号列表</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="border-b px-3 py-1.5">
        <span className="text-[10px] font-medium text-muted-foreground/70">
          大纲: {activeFilePath.split("/").pop()}
        </span>
      </div>

      {/* 符号列表 */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && (
          <div className="px-3 py-2 text-xs text-muted-foreground/60">
            加载中…
          </div>
        )}

        {!loading && symbols.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground/40">
            未找到符号
          </div>
        )}

        {!loading &&
          symbols.map((sym, idx) => (
            <SymbolItem
              key={`${sym.fullName}-${idx}`}
              symbol={sym}
              depth={0}
              onClick={handleSymbolClick}
              currentFile={currentFilePath}
            />
          ))}
      </div>
    </div>
  );
}

function SymbolItem({
  symbol,
  depth,
  onClick,
  currentFile,
}: {
  symbol: OutlineSymbol;
  depth: number;
  onClick: (sym: OutlineSymbol) => void;
  currentFile: string | null;
}) {
  const handleClick = useCallback(() => {
    onClick(symbol);
  }, [onClick, symbol]);

  return (
    <>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-xs transition-colors hover:bg-muted/30"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className={cn("shrink-0 font-mono text-[10px]", symbolColor(symbol.kind))}>
          {symbolIcon(symbol.kind)}
        </span>
        <span className="truncate text-foreground/80">{symbol.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/30 tabular-nums">
          {symbol.line}
        </span>
      </button>

      {/* 递归显示子符号 */}
      {symbol.children.map((child, idx) => (
        <SymbolItem
          key={`${child.fullName}-${idx}`}
          symbol={child}
          depth={depth + 1}
          onClick={onClick}
          currentFile={currentFile}
        />
      ))}
    </>
  );
}
