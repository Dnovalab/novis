import "@testing-library/jest-dom";
import { vi } from "vitest";

// Monaco Editor 在 jsdom 环境下无法加载，需要 mock
vi.mock("monaco-editor", () => ({}));
