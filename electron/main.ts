import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { ModelGateway } from "./model-gateway";

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// ====== 模型网关 ======

const gateway = new ModelGateway();

// ====== 窗口管理 ======

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: "Novis",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // 外部链接在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

// ====== IPC 处理器 ======

// 应用信息
ipcMain.handle("get-app-info", () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    isDev,
    platform: process.platform,
  };
});

// ====== 模型相关 IPC ======

/** 获取可用模型列表 */
ipcMain.handle("model:get-models", () => {
  return gateway.getModels();
});

/** 添加自定义模型 */
ipcMain.handle("model:add-model", (_event, config) => {
  gateway.addModel(config);
  return { success: true };
});

/** 删除模型 */
ipcMain.handle("model:remove-model", (_event, id: string) => {
  gateway.removeModel(id);
  return { success: true };
});

/** 发送聊天请求（非流式） */
ipcMain.handle(
  "model:chat",
  async (
    _event,
    modelId: string,
    request: { model: string; messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number },
  ) => {
    try {
      const result = await gateway.chat(modelId, request, undefined);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  },
);

/** 发送聊天请求（流式） */
ipcMain.handle(
  "model:chat-stream",
  async (
    _event,
    modelId: string,
    request: { model: string; messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number },
  ) => {
    try {
      await gateway.chat(modelId, { ...request, stream: true }, mainWindow!);
      return { success: true };
    } catch (error) {
      // 通过流式通道发送错误
      mainWindow?.webContents.send("model:stream-error", {
        id: `chat-${Date.now()}`,
        error: error instanceof Error ? error.message : "未知错误",
      });
      return { success: false };
    }
  },
);

/** 取消请求 */
ipcMain.handle("model:abort", (_event, modelId: string) => {
  gateway.abort(modelId);
  return { success: true };
});

// ====== 文件系统 IPC ======

/** 选择文件夹对话框 */
ipcMain.handle("fs:select-directory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "选择项目文件夹",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

/** 读取目录内容（一层） */
ipcMain.handle("fs:read-directory", async (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files: Array<{ name: string; path: string; type: "file" | "directory" }> = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      files.push({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        type: entry.isDirectory() ? "directory" : "file",
      });
    }
    return files;
  } catch {
    return [];
  }
});

/** 递归读取目录树（最多 4 层） */
ipcMain.handle("fs:read-directory-tree", async (_event, dirPath: string) => {
  try {
    return readDirectoryTree(dirPath, dirPath, 0);
  } catch {
    return [];
  }
});

/** 读取文件内容 */
ipcMain.handle("fs:read-file", async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, content };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/** 写入文件 */
ipcMain.handle("fs:write-file", async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ====== 辅助函数 ======

interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeEntry[];
}

function readDirectoryTree(rootPath: string, currentPath: string, depth: number): TreeEntry[] {
  if (depth > 4) return [];
  try {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    const result: TreeEntry[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        const children = readDirectoryTree(rootPath, fullPath, depth + 1);
        result.push({ name: entry.name, path: fullPath, type: "directory", children });
      } else {
        result.push({ name: entry.name, path: fullPath, type: "file" });
      }
    }
    return result;
  } catch {
    return [];
  }
}

// ====== 应用生命周期 ======

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
