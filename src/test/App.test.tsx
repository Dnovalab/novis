import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  it("应该渲染标题", () => {
    render(<App />);
    expect(screen.getByText("Novis")).toBeInTheDocument();
  });

  it("应该显示欢迎页", () => {
    render(<App />);
    expect(screen.getByText("打开项目")).toBeInTheDocument();
  });

  it("应该显示 AI 对话面板", () => {
    render(<App />);
    expect(screen.getByText("AI 对话")).toBeInTheDocument();
  });
});
