import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock MonacoEditor 和 MonacoDiffViewer
vi.mock("@/components/MonacoEditor", () => ({
  MonacoEditor: () => <div data-testid="monaco-editor" />,
}));
vi.mock("@/components/MonacoDiffViewer", () => ({
  MonacoDiffViewer: () => <div data-testid="monaco-diff-viewer" />,
}));

import App from "@/App";

describe("App", () => {
  it("应该渲染标题 Novis", async () => {
    render(<App />);
    expect(await screen.findByText("Novis")).toBeInTheDocument();
  });

  it("应该显示欢迎页（打开项目按钮）", async () => {
    render(<App />);
    expect(await screen.findByText("打开项目")).toBeInTheDocument();
  });

  it("应该显示 AI 对话面板空状态", async () => {
    render(<App />);
    expect(await screen.findByText("选择模型后开始对话")).toBeInTheDocument();
  });

  it("应该显示侧边栏图标按钮", async () => {
    render(<App />);
    const tabButtons = await screen.findAllByRole("button");
    expect(tabButtons.length).toBeGreaterThan(0);
  });
});
