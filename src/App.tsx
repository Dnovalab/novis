import { useCallback, useEffect, useState } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { Welcome } from "@/components/Welcome";
import { ChatPanel } from "@/components/ChatPanel";
import { ModelSettings } from "@/components/ModelSettings";
import { MonacoEditor } from "@/components/MonacoEditor";
import { FileTree, buildFileTree } from "@/components/FileTree";
import { useSettingsStore } from "@/stores/settings-store";
import { useFileStore } from "@/stores/file-store";
import type { ModelInfo } from "@/types/electron";

type PermissionMode = "suggest" | "auto" | "full";

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState("files");
  const [hasProject, setHasProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [permissionMode] = useState<PermissionMode>("suggest");
  const [gatewayModels, setGatewayModels] = useState<ModelInfo[]>([]);
  const { models, addModel, setActiveModel, activeModelId, loadFromDisk: loadSettings } = useSettingsStore();
  const { setFiles, files, setWorkspaceRoot } = useFileStore();

  // 启动时恢复持久化数据 + 加载可用模型
  useEffect(() => {
    const init = async () => {
      // 1. 恢复持久化设置
      await loadSettings();

      // 2. 加载可用模型（Electron 环境）
      if (!window.electronAPI) return;

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

    setWorkspaceRoot(dir);

    // 读取文件树
    const tree = await window.electronAPI.fs.readDirectoryTree(dir);
    const flatPaths = flattenTree(tree, "");
    setFiles(buildFileTree(flatPaths));
    setProjectName(dir.split("/").pop() ?? "项目");
    setHasProject(true);
  }, [setFiles, setWorkspaceRoot]);

  // 根据侧边栏标签显示不同面板
  const renderSidebarPanel = () => {
    switch (activeSidebarTab) {
      case "files":
        return <FileTree />;
      case "settings":
        return <ModelSettings gatewayModels={gatewayModels} />;
      case "search":
      case "git":
      case "extensions":
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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 标题栏 */}
      <TitleBar
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
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
              {renderSidebarPanel()}
            </div>
          )}

          {/* 主内容区 */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {hasProject ? (
              <MonacoEditor />
            ) : (
              <Welcome onOpenProject={handleOpenProject} />
            )}
          </main>

          {/* 右侧 AI 对话面板 */}
          <aside className="w-96 border-l bg-background">
            <ChatPanel />
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
