import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { exec, spawn } from "child_process";
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

/** 新建文件/目录 */
ipcMain.handle("fs:create-item", async (_event, parentPath: string, name: string, type: "file" | "directory") => {
  try {
    const fullPath = path.join(parentPath, name);
    if (type === "directory") {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.writeFileSync(fullPath, "", "utf-8");
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/** 删除文件/目录 */
ipcMain.handle("fs:delete-item", async (_event, targetPath: string) => {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/** 重命名文件/目录 */
ipcMain.handle("fs:rename-item", async (_event, oldPath: string, newName: string) => {
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ====== Git IPC ======

/**
 * 在指定目录执行 git 命令并返回输出
 */
function gitExec(repoPath: string, args: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`git ${args}`, { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // git 命令返回非零退出码也可能是正常情况（如 status 有未跟踪文件）
        reject(new Error(stderr.trim() || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

/** 检查是否 git 仓库 */
ipcMain.handle("git:is-repo", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, "rev-parse --git-dir");
    return { success: true, data: true };
  } catch {
    return { success: true, data: false };
  }
});

/** 初始化 git 仓库 */
ipcMain.handle("git:init", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, "init");
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** 获取仓库状态 */
ipcMain.handle("git:status", async (_event, repoPath: string) => {
  try {
    // 解析 git status --porcelain -b
    const output = await gitExec(repoPath, "status --porcelain -b");
    const lines = output.split("\n").filter((l) => l.trim());

    // 第一行是分支信息: "## main...origin/main [ahead 1, behind 2]"
    const branchLine = lines[0] || "## unknown";
    const branchMatch = branchLine.match(/^## (\S+)/);
    const currentBranch = branchMatch ? branchMatch[1] : "unknown";

    // 解析 ahead/behind
    const aheadMatch = branchLine.match(/ahead (\d+)/);
    const behindMatch = branchLine.match(/behind (\d+)/);
    const ahead = aheadMatch ? parseInt(aheadMatch[1]) : 0;
    const behind = behindMatch ? parseInt(behindMatch[1]) : 0;

    // 解析变更文件
    const changes: Array<{
      path: string;
      oldPath?: string;
      status: string;
      staged: boolean;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 3) continue;

      const xy = line.substring(0, 2);
      const rawPath = line.substring(3).trim();

      // 解析重命名: "R  oldPath -> newPath"
      let filePath = rawPath;
      let oldPath: string | undefined;
      const renameMatch = rawPath.match(/^(.+?) -> (.+)$/);
      if (renameMatch) {
        oldPath = renameMatch[1];
        filePath = renameMatch[2];
      }

      // XY 编码: X=staged status, Y=unstaged status
      const stagedChar = xy[0];
      const unstagedChar = xy[1];

      let status: string;
      if (stagedChar !== " " && stagedChar !== "?") {
        status = stagedChar;
      } else if (unstagedChar !== " " && unstagedChar !== "?") {
        status = unstagedChar;
      } else {
        continue;
      }

      const statusMap: Record<string, string> = {
        M: "modified",
        A: "added",
        D: "deleted",
        R: "renamed",
        "?": "untracked",
        U: "conflict",
        C: "added",
      };

      changes.push({
        path: filePath,
        oldPath,
        status: statusMap[status] || "modified",
        staged: stagedChar !== " " && stagedChar !== "?",
      });
    }

    const hasConflict = changes.some((c) => c.status === "conflict");

    return {
      success: true,
      data: {
        currentBranch,
        changes,
        ahead,
        behind,
        hasConflict,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** 获取文件 diff */
ipcMain.handle(
  "git:diff",
  async (_event, repoPath: string, filePath: string, staged: boolean) => {
    try {
      const args = staged
        ? `diff --cached -- "${filePath}"`
        : `diff -- "${filePath}"`;
      const content = await gitExec(repoPath, args);
      return {
        success: true,
        data: { filePath, staged, content },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 获取指定 ref 的文件内容（用于 diff 编辑器对比） */
ipcMain.handle(
  "git:show-file",
  async (_event, repoPath: string, filePath: string, ref: string) => {
    try {
      if (ref === "working") {
        const fullPath = path.join(repoPath, filePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        return { success: true, data: { content } };
      }
      const content = await gitExec(repoPath, `show ${ref}:"${filePath}"`);
      return { success: true, data: { content } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 提交暂存变更 */
ipcMain.handle(
  "git:commit",
  async (_event, repoPath: string, message: string) => {
    try {
      await gitExec(repoPath, `commit -m "${message.replace(/"/g, '\\"')}"`);
      return { success: true, data: { message } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 获取提交历史 */
ipcMain.handle(
  "git:log",
  async (_event, repoPath: string, maxCount = 30) => {
    try {
      const format = `--format="%H|%h|%s|%an|%ai|%D"`;
      const output = await gitExec(
        repoPath,
        `log ${format} --max-count=${maxCount}`,
      );
      const commits = output
        .split("\n")
        .filter((l) => l.trim())
        .map((line) => {
          const parts = line.split("|");
          return {
            hash: parts[0] || "",
            shortHash: parts[1] || "",
            message: parts[2] || "",
            author: parts[3] || "",
            date: parts[4] || "",
            refs: parts[5] || "",
          };
        });
      return { success: true, data: commits };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 获取分支列表 */
ipcMain.handle("git:branches", async (_event, repoPath: string) => {
  try {
    const output = await gitExec(repoPath, "branch");
    const branches = output
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => ({
        name: line.replace(/^\*?\s*/, "").trim(),
        current: line.startsWith("*"),
      }));
    return { success: true, data: branches };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** 切换分支或 checkout 文件 */
ipcMain.handle(
  "git:checkout",
  async (_event, repoPath: string, target: string) => {
    try {
      await gitExec(repoPath, `checkout "${target}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 暂存文件 */
ipcMain.handle(
  "git:add",
  async (_event, repoPath: string, filePath: string) => {
    try {
      await gitExec(repoPath, `add "${filePath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 取消暂存 */
ipcMain.handle(
  "git:unstage",
  async (_event, repoPath: string, filePath: string) => {
    try {
      await gitExec(repoPath, `reset HEAD -- "${filePath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 批量暂存所有 */
ipcMain.handle("git:add-all", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, `add -A`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** 取消暂存所有 */
ipcMain.handle("git:unstage-all", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, `reset HEAD -- .`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** 丢弃文件更改 */
ipcMain.handle(
  "git:discard",
  async (_event, repoPath: string, filePath: string) => {
    try {
      await gitExec(repoPath, `checkout -- "${filePath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 推送到远程 */
ipcMain.handle(
  "git:push",
  async (_event, repoPath: string, branch?: string) => {
    try {
      const target = branch ? `origin "${branch}"` : "";
      await gitExec(repoPath, `push ${target}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
);

/** 从远程拉取 */
ipcMain.handle("git:pull", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, `pull --ff-only`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ====== 终端 IPC ======

/** 正在运行的终端进程映射 */
const terminalProcesses = new Map<string, {
  proc: ReturnType<typeof spawn>;
  cwd: string;
}>();

let terminalIdCounter = 0;

/** 创建新终端会话 */
ipcMain.handle("terminal:spawn", async (_event, cwd?: string) => {
  const sessionId = `term-${++terminalIdCounter}`;
  const shellPath = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
  const shellArgs = process.platform === "win32" ? [] : ["--login"];

  const proc = spawn(shellPath, shellArgs, {
    cwd: cwd || process.cwd() || require("os").homedir(),
    env: { ...process.env, TERM: "xterm-256color" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  terminalProcesses.set(sessionId, {
    proc,
    cwd: cwd || process.cwd() || require("os").homedir(),
  });

  // stdout 数据 → 渲染进程
  proc.stdout?.on("data", (chunk: Buffer) => {
    mainWindow?.webContents.send("terminal:stdout", {
      sessionId,
      data: chunk.toString("utf-8"),
    });
  });

  // stderr 数据 → 渲染进程（合并到 stdout）
  proc.stderr?.on("data", (chunk: Buffer) => {
    mainWindow?.webContents.send("terminal:stdout", {
      sessionId,
      data: chunk.toString("utf-8"),
    });
  });

  // 进程退出
  proc.on("exit", (code) => {
    terminalProcesses.delete(sessionId);
    mainWindow?.webContents.send("terminal:exit", {
      sessionId,
      code,
    });
  });

  // 进程错误
  proc.on("error", (err) => {
    terminalProcesses.delete(sessionId);
    mainWindow?.webContents.send("terminal:exit", {
      sessionId,
      code: -1,
    });
  });

  return { sessionId };
});

/** 向终端写入数据（标准输入） */
ipcMain.handle("terminal:stdin", async (_event, sessionId: string, data: string) => {
  const entry = terminalProcesses.get(sessionId);
  if (!entry) return;
  entry.proc.stdin?.write(data);
});

/** 调整终端尺寸 */
ipcMain.handle("terminal:resize", async (_event, sessionId: string, _cols: number, _rows: number) => {
  // child_process.spawn 不支持动态 resize，此处保留接口兼容
  // 完整 PTY resize 需要 node-pty
});

/** 终止终端会话 */
ipcMain.handle("terminal:kill", async (_event, sessionId: string) => {
  const entry = terminalProcesses.get(sessionId);
  if (!entry) return;
  entry.proc.kill("SIGTERM");
  // 2 秒后强制杀死
  setTimeout(() => {
    const stillAlive = terminalProcesses.get(sessionId);
    if (stillAlive) {
      stillAlive.proc.kill("SIGKILL");
      terminalProcesses.delete(sessionId);
    }
  }, 2000);
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
