import { useCallback, useEffect, useState, useMemo } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { Welcome } from "@/components/Welcome";
import { ChatPanel } from "@/components/ChatPanel";
import { ModelSettings } from "@/components/ModelSettings";
import { MonacoEditor } from "@/components/MonacoEditor";
import { FileTree, buildFileTree } from "@/components/FileTree";
import { PmPanel } from "@/components/PmPanel";
import { SearchPanel } from "@/components/SearchPanel";
import { MemoryPanel } from "@/components/MemoryPanel";
import { GitPanel } from "@/components/GitPanel";
import { ExtensionsPanel } from "@/components/ExtensionsPanel";
import { ProblemsPanel } from "@/components/ProblemsPanel";
import { OutputPanel } from "@/components/OutputPanel";
import { OutlinePanel } from "@/components/OutlinePanel";
import { TerminalPanel } from "@/components/TerminalPanel";
import { ReviewPanel } from "@/components/ReviewPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashScreen } from "@/components/SplashScreen";
import { useSettingsStore } from "@/stores/settings-store";
import { useFileStore } from "@/stores/file-store";
import { useTheme } from "@/hooks/useTheme";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickOpen } from "@/components/QuickOpen";
import { AboutDialog } from "@/components/AboutDialog";
import { ShortcutReference } from "@/components/ShortcutReference";
import { type Command, type KeyBinding, matchBinding, formatBinding } from "@/lib/keyboard";
import { useKeymapStore } from "@/stores/keymap-store";
import { KeymapPanel } from "@/components/KeymapPanel";
import type { ModelInfo } from "@/types/electron";

type PermissionMode = "suggest" | "auto" | "full";

export default function App() {
  useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState("files");
  const [hasProject, setHasProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [permissionMode] = useState<PermissionMode>("suggest");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shortcutRefOpen, setShortcutRefOpen] = useState(false);
  const [gatewayModels, setGatewayModels] = useState<ModelInfo[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [initMessage, setInitMessage] = useState("正在初始化…");
  const { models, addModel, setActiveModel, activeModelId, loadFromDisk: loadSettings } = useSettingsStore();
  const { setFiles, files, setWorkspaceRoot, addWorkspaceFolder } = useFileStore();

  // 启动时恢复持久化数据 + 加载可用模型
  useEffect(() => {
    const init = async () => {
      try {
        // 1. 恢复持久化设置
        setInitMessage("正在恢复设置…");
        await loadSettings();

        // 2. 加载可用模型（Electron 环境）
        if (!window.electronAPI) {
          setInitLoading(false);
          return;
        }

        setInitMessage("正在加载模型列表…");

        const modelList = await window.electronAPI.model.getModels();
        setGatewayModels(modelList);

        const state = useSettingsStore.getState();
        if (state.models.length === 0) {
          for (const m of modelList) {
            state.addModel({
              id: m.id,
              name: m.name,
              provider: m.provider,
              baseUrl: "",
              model: m.model,
              apiKey: "",
            });
          }
          const firstApi = modelList.find((m) => !m.isLocal);
          if (firstApi) {
            state.setActiveModel(firstApi.id);
          } else if (modelList.length > 0) {
            state.setActiveModel(modelList[0].id);
          }
        }

        setInitLoading(false);
      } catch (err) {
        console.error("[App] 初始化失败:", err);
        setInitMessage(`初始化出错: ${err instanceof Error ? err.message : String(err)}`);
        // 出错后延迟隐藏，让用户看到错误信息
        setTimeout(() => setInitLoading(false), 2000);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 打开项目 — 选择文件夹 */
  const handleOpenProject = useCallback(async () => {
    if (!window.electronAPI) {
      // 开发模式（非 Electron）：用模拟数据
      setHasProject(true);
      setProjectName("Novis 开发");
      setFiles(
        buildFileTree([
          "src/App.tsx",
          "src/main.tsx",
          "src/components/ChatPanel.tsx",
          "src/components/MonacoEditor.tsx",
          "src/components/FileTree.tsx",
          "src/components/ModelSettings.tsx",
          "src/stores/chat-store.ts",
          "src/stores/file-store.ts",
          "src/stores/settings-store.ts",
          "src/styles/globals.css",
          "electron/main.ts",
          "electron/preload.ts",
          "electron/model-gateway.ts",
          "package.json",
          "tsconfig.json",
          "vite.config.ts",
          "tailwind.config.ts",
        ]),
      );
      return;
    }

    const dir = await window.electronAPI.fs.selectDirectory();
    if (!dir) return;

    // 读取文件树
    const tree = await window.electronAPI.fs.readDirectoryTree(dir);
    const flatPaths = flattenTree(tree, "");
    const dirName = dir.split("/").pop() ?? "项目";
    addWorkspaceFolder({ path: dir, name: dirName }, flatPaths.map((f) => `${dir}/${f}`));
    setProjectName(dirName);
    setHasProject(true);
  }, [setFiles, addWorkspaceFolder]);

  /** 新建文件 */
  const handleNewFile = useCallback(async () => {
    const name = window.prompt("输入文件名（如 App.tsx）：");
    if (!name || !name.trim()) return;

    const { workspaceRoot, files, addFileNode, openFile } = useFileStore.getState();
    const trimmed = name.trim();

    // Electron 模式：在 workspaceRoot 下创建
    if (window.electronAPI?.fs?.createItem && workspaceRoot) {
      const result = await window.electronAPI.fs.createItem(workspaceRoot, trimmed, "file");
      if (!result.success) {
        alert(`创建失败: ${result.error}`);
      }
      // 重新加载文件树 TODO
    }

    // 在 store 中添加到根目录
    addFileNode("", { name: trimmed, path: trimmed, type: "file" });
    openFile(trimmed, trimmed);
  }, []);

  /** 切换侧边栏面板的命令工厂 */
  const switchPanel = useCallback(
    (tab: string) => () => {
      setSidebarCollapsed(false);
      setActiveSidebarTab(tab);
    },
    [],
  );

  /** 全局快捷键 + 命令面板执行器 */
  const commands: Command[] = useMemo(
    () => [
      {
        id: "command-palette",
        name: "显示所有命令",
        description: "命令面板",
        category: "视图",
        binding: { key: "p", modifiers: ["ctrl", "shift"], label: "⇧⌘P" },
        execute: () => setCommandPaletteOpen(true),
      },
      {
        id: "toggle-sidebar",
        name: "切换侧边栏",
        description: "显示/隐藏侧边栏",
        category: "视图",
        binding: { key: "b", modifiers: ["ctrl"], label: "⌘B" },
        execute: () => setSidebarCollapsed((v) => !v),
      },
      {
        id: "open-files",
        name: "文件浏览器",
        description: "显示文件列表",
        category: "面板",
        binding: { key: "e", modifiers: ["ctrl"], label: "⌘E" },
        execute: switchPanel("files"),
      },
      {
        id: "quick-open",
        name: "快速打开文件",
        description: "按文件名模糊搜索",
        category: "文件",
        binding: { key: "p", modifiers: ["ctrl"], label: "⌘P" },
        execute: () => setQuickOpenOpen(true),
      },
      {
        id: "open-search",
        name: "搜索",
        description: "搜索文件内容",
        category: "面板",
        binding: { key: "f", modifiers: ["ctrl", "shift"], label: "⇧⌘F" },
        execute: switchPanel("search"),
      },
      {
        id: "open-problems",
        name: "问题面板",
        description: "查看代码错误和警告",
        category: "面板",
        binding: { key: "m", modifiers: ["ctrl", "shift"], label: "⇧⌘M" },
        execute: switchPanel("problems"),
      },
      {
        id: "open-output",
        name: "输出面板",
        description: "查看构建和扩展输出日志",
        category: "面板",
        binding: { key: "u", modifiers: ["ctrl", "shift"], label: "⇧⌘U" },
        execute: switchPanel("output"),
      },
      {
        id: "open-outline",
        name: "大纲面板",
        description: "查看当前文件的符号结构",
        category: "面板",
        binding: { key: "o", modifiers: ["ctrl", "shift"], label: "⇧⌘O" },
        execute: switchPanel("outline"),
      },
      {
        id: "open-git",
        name: "Git 版本控制",
        description: "查看变更和提交",
        category: "面板",
        binding: { key: "g", modifiers: ["ctrl", "shift"], label: "⇧⌘G" },
        execute: switchPanel("git"),
      },
      {
        id: "open-terminal",
        name: "终端",
        description: "打开终端面板",
        category: "面板",
        binding: { key: "`", modifiers: ["ctrl"], label: "⌃`" },
        execute: switchPanel("terminal"),
      },
      {
        id: "open-pm",
        name: "项目管理",
        description: "计划和任务管理",
        category: "面板",
        execute: switchPanel("pm"),
      },
      {
        id: "open-review",
        name: "代码审查",
        description: "AI 代码审查",
        category: "面板",
        execute: switchPanel("review"),
      },
      {
        id: "open-memory",
        name: "AI 记忆系统",
        description: "查看和管理项目记忆",
        category: "面板",
        execute: switchPanel("memory"),
      },
      {
        id: "open-extensions",
        name: "扩展管理",
        description: "查看扩展列表",
        category: "面板",
        execute: switchPanel("extensions"),
      },
      {
        id: "open-settings",
        name: "设置",
        description: "模型和偏好设置",
        category: "面板",
        binding: { key: ",", modifiers: ["ctrl"], label: "⌘," },
        execute: switchPanel("settings"),
      },
      {
        id: "open-project",
        name: "打开项目",
        description: "选择项目文件夹",
        category: "文件",
        binding: { key: "o", modifiers: ["ctrl"], label: "⌘O" },
        execute: () => handleOpenProject(),
      },
      {
        id: "save-file",
        name: "保存文件",
        description: "保存当前编辑的文件",
        category: "文件",
        execute: () => useFileStore.getState().requestSave(),
      },
      {
        id: "format-document",
        name: "格式化文档",
        description: "自动格式化当前文件",
        category: "文件",
        binding: { key: "i", modifiers: ["ctrl", "shift"], label: "⇧⌘I" },
        execute: () => useFileStore.getState().requestFormat(),
      },
    ],
    [switchPanel, handleOpenProject],
  );

  /** 判断焦点是否在 Monaco 编辑器内部 */
  const isInMonaco = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return !!el.closest(".monaco-editor");
  };

  /** 在 Monaco 编辑器中不拦截的快捷键 ID 列表（与 Monaco 自身不冲突） */
  const monacoSafeCommandIds = new Set([
    "toggle-sidebar",
    "open-files",
    "open-problems",
    "open-output",
    "open-outline",
    "open-git",
    "open-terminal",
    "open-settings",
    "command-palette",
    "format-document",
  ]);

  // 全局键盘快捷键监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape 关闭浮层（优先级：QuickOpen → 快捷键参考 → 关于 → 命令面板）
      if (e.key === "Escape") {
        if (quickOpenOpen) {
          setQuickOpenOpen(false);
          e.preventDefault();
          return;
        }
        if (shortcutRefOpen) {
          setShortcutRefOpen(false);
          e.preventDefault();
          return;
        }
        if (aboutOpen) {
          setAboutOpen(false);
          e.preventDefault();
          return;
        }
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          e.preventDefault();
          return;
        }
      }

      // 获取命令的最终绑定（自定义覆盖优先）
      const getBinding = (cmd: Command): KeyBinding | undefined => {
        return useKeymapStore.getState().customBindings[cmd.id] ?? cmd.binding;
      };

      // Monaco 编辑器内部：只放行不冲突的快捷键
      const inMonaco = isInMonaco(e.target);
      if (inMonaco) {
        for (const cmd of commands) {
          const binding = getBinding(cmd);
          if (
            binding &&
            monacoSafeCommandIds.has(cmd.id) &&
            matchBinding(e, binding)
          ) {
            e.preventDefault();
            cmd.execute();
            return;
          }
        }
        return; // Monaco 内部未匹配的快捷键不拦截
      }

      // 输入框/文本域聚焦时，不拦截快捷键（除 Escape）
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";
      if (isInput) return;

      for (const cmd of commands) {
        const binding = getBinding(cmd);
        if (binding && matchBinding(e, binding)) {
          e.preventDefault();
          cmd.execute();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commands, commandPaletteOpen, aboutOpen, shortcutRefOpen, quickOpenOpen]);

  // 根据侧边栏标签显示不同面板
  const renderSidebarPanel = () => {
    switch (activeSidebarTab) {
      case "files":
        return <FileTree />;
      case "problems":
        return <ProblemsPanel />;
      case "output":
        return <OutputPanel />;
      case "outline":
        return <OutlinePanel />;
      case "terminal":
        return <TerminalPanel />;
      case "review":
        return <ReviewPanel />;
      case "pm":
        return <PmPanel />;
      case "search":
        return <SearchPanel />;
      case "memory":
        return <MemoryPanel />;
      case "git":
        return <GitPanel />;
      case "settings":
        return <ModelSettings gatewayModels={gatewayModels} />;
      case "extensions":
        return <ExtensionsPanel />;
      case "keymap":
        return <KeymapPanel commands={commands} />;
      default:
        return (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            <div>
              <p className="text-lg font-medium capitalize">
                {activeSidebarTab === "search"
                  ? "搜索"
                  : activeSidebarTab === "git"
                    ? "Git"
                    : "扩展"}
              </p>
              <p className="mt-1">功能开发中…</p>
            </div>
          </div>
        );
    }
  };

  if (initLoading) {
    return <SplashScreen message={initMessage} />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 标题栏 */}
      <TitleBar
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenProject={handleOpenProject}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onNewFile={handleNewFile}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenShortcutRef={() => setShortcutRefOpen(true)}
      />

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏图标 */}
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          isCollapsed={sidebarCollapsed}
        />

        {/* 侧边栏面板 + 内容区 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 侧边栏展开面板 */}
          {!sidebarCollapsed && (
            <div className="w-64 border-r bg-card">
              <ErrorBoundary componentName="SidebarPanel">
                {renderSidebarPanel()}
              </ErrorBoundary>
            </div>
          )}

          {/* 主内容区 */}
          <main className="flex flex-1 flex-col overflow-hidden">
            <ErrorBoundary componentName="MainContent">
              {hasProject ? (
                <MonacoEditor />
              ) : (
                <Welcome onOpenProject={handleOpenProject} />
              )}
            </ErrorBoundary>
          </main>

          {/* 右侧 AI 对话面板 */}
          <aside className="w-96 border-l bg-background">
            <ErrorBoundary componentName="ChatPanel">
              <ChatPanel />
            </ErrorBoundary>
          </aside>
        </div>
      </div>

      {/* 状态栏 */}
      <StatusBar
        projectName={projectName}
        modelName={
          models.find((m) => m.id === activeModelId)?.name ?? "未选择"
        }
        permissionMode={permissionMode}
        fileCount={files.length}
      />

      {/* 命令面板 */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />

      {/* 快速打开文件 */}
      <QuickOpen
        open={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
      />

      {/* 关于对话框 */}
      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* 快捷键参考 */}
      <ShortcutReference
        open={shortcutRefOpen}
        onClose={() => setShortcutRefOpen(false)}
      />
    </div>
  );
}

/** 将树形结构拍平为路径列表 */
function flattenTree(
  nodes: Array<{ name: string; path: string; type: string; children?: any[] }>,
  parent: string,
): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    const relativePath = parent ? `${parent}/${node.name}` : node.name;
    if (node.type === "file") {
      result.push(relativePath);
    }
    if (node.children) {
      result.push(...flattenTree(node.children, relativePath));
    }
  }
  return result;
}
