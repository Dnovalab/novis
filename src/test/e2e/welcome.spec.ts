import { test, expect } from "@playwright/test";

test("欢迎页应正确显示", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Novis")).toBeVisible();
  await expect(page.getByText("打开项目")).toBeVisible();
  await expect(page.getByText("支持的模型")).toBeVisible();
});

test("点击打开项目按钮应切换界面", async ({ page }) => {
  await page.goto("/");
  await page.getByText("打开项目").click();
  // 点击后欢迎页应消失，显示项目就绪状态
  await expect(page.getByText("编辑器区域（后续实现）")).toBeVisible();
});
