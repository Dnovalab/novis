import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock monaco-editor with manual mock in __mocks__/monaco-editor.ts
// Prevents vitest from failing to resolve the ESM-only monaco-editor package
vi.mock("monaco-editor");
