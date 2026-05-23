/**
 * Manual mock for monaco-editor
 * Used by vitest in CI — prevents "Failed to resolve entry" error
 * because monaco-editor is ESM-only and can't be resolved by vitest's CJS resolver.
 *
 * MonacoEditor.tsx uses await import("monaco-editor") which vitest's module graph
 * traversal tries to resolve. This mock provides a resolvable file on disk so that
 * vitest never needs to resolve the real ESM-only package.
 */

export const editor = {
  create: () => ({
    getModel: () => null,
    setModel: () => {},
    getSelection: () => null,
    focus: () => {},
    getAction: () => null,
    addCommand: () => {},
    dispose: () => {},
    onDidChangeModelContent: () => {},
    onDidChangeCursorPosition: () => {},
    revealLineInCenter: () => {},
    setPosition: () => {},
    updateOptions: () => {},
  }),
  createModel: () => ({}),
  setTheme: () => {},
  getModel: () => null,
  getModelMarkers: () => [],
  onDidChangeMarkers: () => ({ dispose: () => {} }),
};

export const Uri = {
  parse: () => ({ path: "", toString: () => "" }),
};

export const KeyMod = {
  CtrlCmd: 2048,
  Shift: 1024,
  Alt: 512,
};

export const KeyCode = {
  KeyS: 49,
  KeyF: 33,
  Escape: 9,
  Enter: 3,
  Tab: 2,
};

export const MarkerSeverity = {
  Error: 8,
  Warning: 4,
  Info: 2,
  Hint: 1,
};

export const languages = {
  getDocumentSymbolProviders: () => [],
};

const monaco = { editor, Uri, KeyMod, KeyCode, MarkerSeverity, languages };
export default monaco;
