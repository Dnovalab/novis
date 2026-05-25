import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { exec, spawn } from "child_process";
import { ModelGateway, ChatRequest } from "./model-gateway";

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// ====== æ¨¡åç½å³ ======

const gateway = new ModelGateway();

// ====== çªå£ç®¡ç ======

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

  // çªå£åå¤å¥½ååæ¾ç¤ºï¼é¿åç½å±éªç
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // å¤é¨é¾æ¥å¨é»è®¤æµè§å¨æå¼
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

// ====== IPC å¤çå¨ ======

// åºç¨ä¿¡æ¯
ipcMain.handle("get-app-info", () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    isDev,
    platform: process.platform,
  };
});

// ====== æ¨¡åç¸å³ IPC ======

/** è·åå¯ç¨æ¨¡ååè¡¨ */
ipcMain.handle("model:get-models", () => {
  return gateway.getModels();
});

/** æ·»å èªå®ä¹æ¨¡å */
ipcMain.handle("model:add-model", (_event, config) => {
  gateway.addModel(config);
  return { success: true };
});

/** å é¤æ¨¡å */
ipcMain.handle("model:remove-model", (_event, id: string) => {
  gateway.removeModel(id);
  return { success: true };
});

/** åéèå¤©è¯·æ±ï¼ç¬¦åä½ï¼ */
ipcMain.handle(
  "model:chat",
  async (
    _event,
    modelId: string,
    request: ChatRequest,
  ) => {
    try {
      const result = await gateway.chat(modelId, request, undefined);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "æªç¥éè¯¯",
      };
    }
  },
);

/** åéèå¤©è¯·æ±ï¼æµå¼ï¼ */
ipcMain.handle(
  "model:chat-stream",
  async (
    _event,
    modelId: string,
    request: ChatRequest,
  ) => {
    try {
      await gateway.chat(modelId, { ...request, stream: true }, mainWindow!);
      return { success: true };
    } catch (error) {
      // éè¿æµå¼ééåééè¯¯
      mainWindow?.webContents.send("model:stream-error", {
        id: `chat-${Date.now()}`,
        error: error instanceof Error ? error.message : "æªç¥éè¯¯",
      });
      return { success: false };
    }
  },
);

/** åæ¶è¯·æ± */
ipcMain.handle("model:abort", (_event, modelId: string) => {
  gateway.abort(modelId);
  return { success: true };
});

// ====== æä»¶ç³»ç» IPC ======

/** éæ©æä»¶å¤¹å¯¹è¯æ¡ */
ipcMain.handle("fs:select-directory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "éæ©é¡¹ç®æä»¶å¤¹",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

/** è¯»åç®å½åå®¹ï¼ä¸å±ï¼ */
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

/** éå½è¯»åç®å½æ ï¼æå¤ 4 å±ï¼ */
ipcMain.handle("fs:read-directory-tree", async (_event, dirPath: string) => {
  try {
    return readDirectoryTree(dirPath, dirPath, 0);
  } catch {
    return [];
  }
});

/** è¯»åæä»¶åå®¹ */
ipcMain.handle("fs:read-file", async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, content };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/** åå¥æä»¶ */
ipcMain.handle("fs:write-file", async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/** æ°å»ºæä»¶/ç®å½ */
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

/** å é¤æä»¶/ç®å½ */
ipcMain.handle("fs:delete-item", async (_event, targetPath: string) => {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/** éå½åæä»¶/ç®å½ */
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
 * å¨æå®ç®å½æ§è¡ git å½ä»¤å¹¶è¿åè¾åº
 */
function gitExec(repoPath: string, args: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`git ${args}`, { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // git å½ä»¤è¿åéé¶éåºç ä¹å¯è½æ¯æ­£å¸¸æåµï¼å¦ status ææªè·è¸ªæä»¶ï¼
        reject(new Error(stderr.trim() || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

/** æ£æ¥æ¯å¦ git ä»åº */
ipcMain.handle("git:is-repo", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, "rev-parse --git-dir");
    return { success: true, data: true };
  } catch {
    return { success: true, data: false };
  }
});

/** åå§å git ä»åº */
ipcMain.handle("git:init", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, "init");
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** è·åä»åºç¶æ */
ipcMain.handle("git:status", async (_event, repoPath: string) => {
  try {
    // è§£æ git status --porcelain -b
    const output = await gitExec(repoPath, "status --porcelain -b");
    const lines = output.split("\n").filter((l) => l.trim());

    // ç¬¬ä¸è¡æ¯åæ¯ä¿¡æ¯: "## main...origin/main [ahead 1, behind 2]"
    const branchLine = lines[0] || "## unknown";
    const branchMatch = branchLine.match(/^## (\S+)/);
    const currentBranch = branchMatch ? branchMatch[1] : "unknown";

    // è§£æ ahead/behind
    const aheadMatch = branchLine.match(/ahead (\d+)/);
    const behindMatch = branchLine.match(/behind (\d+)/);
    const ahead = aheadMatch ? parseInt(aheadMatch[1]) : 0;
    const behind = behindMatch ? parseInt(behindMatch[1]) : 0;

    // è§£æåæ´æä»¶
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

      // è§£æéå½å: "R  oldPath -> newPath"
      let filePath = rawPath;
      let oldPath: string | undefined;
      const renameMatch = rawPath.match(/^(.+?) -> (.+)$/);
      if (renameMatch) {
        oldPath = renameMatch[1];
        filePath = renameMatch[2];
      }

      // XY ç¼ç : X=staged status, Y=unstaged status
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

/** è·åæä»¶ diff */
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

/** è·åæå® ref çæä»¶åå®¹ï¼ç¨äº diff ç¼è¾å¨å¯¹æ¯ï¼ */
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

/** æäº¤æå­åæ´ */
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

/** è·åæäº¤åå² */
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

/** è·ååæ¯åè¡¨ */
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

/** åæ¢åæ¯æ checkout æä»¶ */
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

/** æå­æä»¶ */
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

/** åæ¶æå­ */
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

/** æ¹éæå­ææ */
ipcMain.handle("git:add-all", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, `add -A`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** åæ¶æå­ææ */
ipcMain.handle("git:unstage-all", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, `reset HEAD -- .`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

/** ä¸¢å¼æä»¶æ´æ¹ */
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

/** æ¨éå°è¿ç¨ */
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

/** ä»è¿ç¨æå */
ipcMain.handle("git:pull", async (_event, repoPath: string) => {
  try {
    await gitExec(repoPath, `pull --ff-only`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ====== ç»ç«¯ IPC ======

/** æ­£å¨è¿è¡çç»ç«¯è¿ç¨æ å° */
const terminalProcesses = new Map<string, {
  proc: ReturnType<typeof spawn>;
  cwd: string;
}>();

let terminalIdCounter = 0;

/** åå»ºæ°ç»ç«¯ä¼è¯ */
ipcMain.handle("terminal:spawn", async (_event, cwd?: string) => {
  const sessionId = `term-${++terminalIdCounter}`;
  const shellPath = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
  const shellArgs = process.platform === "win32" ? [] : ["--login"];

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const homedir = require("os").homedir();
  const proc = spawn(shellPath, shellArgs, {
    cwd: cwd || process.cwd() || homedir,
    env: { ...process.env, TERM: "xterm-256color" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  terminalProcesses.set(sessionId, {
    proc,
    cwd: cwd || process.cwd() || homedir,
  });

  // stdout æ°æ® â æ¸²æè¿ç¨
  proc.stdout?.on("data", (chunk: Buffer) => {
    mainWindow?.webContents.send("terminal:stdout", {
      sessionId,
      data: chunk.toString("utf-8"),
    });
  });

  // stderr æ°æ® â æ¸²æè¿ç¨ï¼åå¹¶å° stdoutï¼
  proc.stderr?.on("data", (chunk: Buffer) => {
    mainWindow?.webContents.send("terminal:stdout", {
      sessionId,
      data: chunk.toString("utf-8"),
    });
  });

  // è¿ç¨éåº
  proc.on("exit", (code) => {
    terminalProcesses.delete(sessionId);
    mainWindow?.webContents.send("terminal:exit", {
      sessionId,
      code,
    });
  });

  // è¿ç¨éè¯¯
  proc.on("error", (_err) => {
    terminalProcesses.delete(sessionId);
    mainWindow?.webContents.send("terminal:exit", {
      sessionId,
      code: -1,
    });
  });

  return { sessionId };
});

/** åç»ç«¯åå¥æ°æ®ï¼æ åè¾å¥ï¼ */
ipcMain.handle("terminal:stdin", async (_event, sessionId: string, data: string) => {
  const entry = terminalProcesses.get(sessionId);
  if (!entry) return;
  entry.proc.stdin?.write(data);
});

/** è°æ´ç»ç«¯å°ºå¯¸ */
ipcMain.handle("terminal:resize", async (_event, _sessionId: string, _cols: number, _rows: number) => {
  // child_process.spawn ä¸æ¯æå¨æ resizeï¼æ­¤å¤ä¿çæ¥å£å¼å®¹
  // å®æ´ PTY resize éè¦ node-pty
});

/** ç»æ­¢ç»ç«¯ä¼è¯ */
ipcMain.handle("terminal:kill", async (_event, sessionId: string) => {
  const entry = terminalProcesses.get(sessionId);
  if (!entry) return;
  entry.proc.kill("SIGTERM");
  // 2 ç§åå¼ºå¶ææ­»
  setTimeout(() => {
    const stillAlive = terminalProcesses.get(sessionId);
    if (stillAlive) {
      stillAlive.proc.kill("SIGKILL");
      terminalProcesses.delete(sessionId);
    }
  }, 2000);
});

// ====== è¾å©å½æ° ======

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

// ====== åºç¨çå½å¨æ ======

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
