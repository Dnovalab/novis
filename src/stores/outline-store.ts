import { create } from "zustand";

export interface OutlineSymbol {
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  kind: SymbolKind;
  /** 行号（1-based） */
  line: number;
  /** 列号 */
  column: number;
  /** 子符号 */
  children: OutlineSymbol[];
  /** 容器名称（如类名下的方法，容器名为类名） */
  containerName?: string;
  /** 完整名称（带容器前缀） */
  fullName: string;
}

export type SymbolKind =
  | "file"
  | "module"
  | "namespace"
  | "package"
  | "class"
  | "method"
  | "property"
  | "field"
  | "constructor"
  | "enum"
  | "interface"
  | "function"
  | "variable"
  | "constant"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "key"
  | "null"
  | "enum-member"
  | "struct"
  | "event"
  | "operator"
  | "type-parameter";

interface OutlineStore {
  /** 当前文件的符号列表（扁平化，按行号排序） */
  symbols: OutlineSymbol[];
  /** 当前文件的路径 */
  currentFilePath: string | null;
  /** 是否正在加载 */
  loading: boolean;

  /** 设置符号 */
  setSymbols: (filePath: string, symbols: OutlineSymbol[]) => void;
  /** 清除 */
  clear: () => void;
}

export const useOutlineStore = create<OutlineStore>((set) => ({
  symbols: [],
  currentFilePath: null,
  loading: false,

  setSymbols: (filePath, symbols) =>
    set({ symbols, currentFilePath: filePath, loading: false }),

  clear: () => set({ symbols: [], currentFilePath: null, loading: false }),
}));

/** 符号类型 → 显示图标/文本 */
export function symbolIcon(kind: SymbolKind): string {
  switch (kind) {
    case "class":
      return "C";
    case "interface":
      return "I";
    case "enum":
      return "E";
    case "function":
    case "method":
      return "f";
    case "variable":
    case "property":
    case "field":
      return "v";
    case "constant":
      return "c";
    case "constructor":
      return "▵";
    case "struct":
      return "S";
    case "module":
    case "namespace":
    case "package":
      return "□";
    case "array":
      return "a";
    default:
      return "•";
  }
}

export function symbolColor(kind: SymbolKind): string {
  switch (kind) {
    case "class":
      return "text-orange-400";
    case "interface":
      return "text-cyan-400";
    case "enum":
      return "text-yellow-400";
    case "function":
    case "method":
      return "text-purple-400";
    case "variable":
    case "property":
    case "field":
      return "text-blue-400";
    case "constant":
      return "text-green-400";
    case "constructor":
      return "text-pink-400";
    case "struct":
      return "text-orange-300";
    case "module":
    case "namespace":
      return "text-gray-400";
    default:
      return "text-muted-foreground";
  }
}
