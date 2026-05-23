import { create } from "zustand";

export interface OutlineSymbol {
  name: string;
  kind: SymbolKind;
  line: number;
  column: number;
  children: OutlineSymbol[];
  containerName?: string;
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
  symbols: OutlineSymbol[];
  currentFilePath: string | null;
  loading: boolean;
  setSymbols: (filePath: string, symbols: OutlineSymbol[]) => void;
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

export function symbolIcon(kind: SymbolKind): string {
  switch (kind) {
    case "class": return "C";
    case "interface": return "I";
    case "enum": return "E";
    case "function":
    case "method": return "f";
    case "variable":
    case "property":
    case "field": return "v";
    case "constant": return "c";
    case "constructor": return "▵";
    case "struct": return "S";
    case "module":
    case "namespace":
    case "package": return "□";
    case "array": return "a";
    default: return "•";
  }
}

export function symbolColor(kind: SymbolKind): string {
  switch (kind) {
    case "class": return "text-orange-400";
    case "interface": return "text-cyan-400";
    case "enum": return "text-yellow-400";
    case "function":
    case "method": return "text-purple-400";
    case "variable":
    case "property":
    case "field": return "text-blue-400";
    case "constant": return "text-green-400";
    case "constructor": return "text-pink-400";
    case "struct": return "text-orange-300";
    case "module":
    case "namespace": return "text-gray-400";
    default: return "text-muted-foreground";
  }
}
