import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock MonacoEditor 和 MonacoDiffViewer，避免 vitest 解析 monaco-editor
vi.mock("@/components/MonacoEditor", () => ({
  MonacoEditor: () => <div data-testid="monaco-editor" />,
}));
vi.mock("@/components/MonacoDiffViewer", () => ({
  MonacoDiffViewer: () => <div data-testid="monaco-diff-viewer" />,
}));

import App from "@/App";

describe("App", () => {
  it("应该渲染标题 Novis", () => {
    render(<App />);
    expect(screen.getByText("Novis")).toBeInTheDocument();
  });

  it("应该显示欢迎页（打开项目按钮）", () => {
    render(<App />);
    expect(screen.getByText("打开项目")).toBeInTheDocument();
  });

  it("应该显示 AI 对话面板空状态", () => {
    render(<App />);
    expect(screen.getByText("选择模型后开始对话")).toBeInTheDocument();
  });

  it("应该显示侧边栏图标按钮", () => {
    render(<App />);
    const tabButtons = screen.getAllByRole("button");
    expect(tabButtons.length).toBeGreaterThan(0);
  });
});
