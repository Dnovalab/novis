import { useState } from "react";
import { Cpu, Wifi, WifiOff, Plus, Trash2, Check } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import type { ModelInfo } from "@/types/electron";

interface ModelSettingsProps {
  gatewayModels: ModelInfo[];
}

export function ModelSettings({ gatewayModels }: ModelSettingsProps) {
  const { models, activeModelId, addModel, removeModel, setActiveModel } =
    useSettingsStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    provider: "custom" as string,
    baseUrl: "",
    apiKey: "",
    model: "",
  });

  const handleAdd = () => {
    if (!formData.name || !formData.baseUrl || !formData.model) return;

    const id = formData.id || `custom-${Date.now()}`;
    addModel({
      id,
      name: formData.name,
      provider: formData.provider,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
      model: formData.model,
    });

    // 同步到网关
    if (window.electronAPI) {
      window.electronAPI.model.addModel({
        id,
        name: formData.name,
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey || undefined,
        model: formData.model,
      });
    }

    setFormData({ id: "", name: "", provider: "custom", baseUrl: "", apiKey: "", model: "" });
    setShowAddForm(false);
  };

  const handleRemove = (id: string) => {
    removeModel(id);
    if (window.electronAPI) {
      window.electronAPI.model.removeModel(id);
    }
  };

  const providerColors: Record<string, string> = {
    ollama: "text-green-500",
    deepseek: "text-blue-500",
    qwen: "text-orange-500",
    glm: "text-purple-500",
    hunyuan: "text-cyan-500",
    custom: "text-gray-500",
  };

  const providerLabels: Record<string, string> = {
    ollama: "Ollama",
    deepseek: "DeepSeek",
    qwen: "通义千问",
    glm: "智谱 GLM",
    hunyuan: "腾讯混元",
    custom: "自定义",
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">模型配置</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          添加模型
        </Button>
      </div>

      {/* 添加模型表单 */}
      {showAddForm && (
        <div className="mb-4 rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">添加自定义模型</h3>
          <div className="space-y-2">
            <input
              placeholder="名称（如：我的本地模型）"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="模型 ID（如：my-model-v1）"
              value={formData.id}
              onChange={(e) =>
                setFormData({ ...formData, id: e.target.value })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <select
              value={formData.provider}
              onChange={(e) =>
                setFormData({ ...formData, provider: e.target.value })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            >
              <option value="custom">自定义 (OpenAI 兼容)</option>
              <option value="ollama">Ollama</option>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">通义千问</option>
              <option value="glm">智谱 GLM</option>
              <option value="hunyuan">腾讯混元</option>
            </select>
            <input
              placeholder="API 地址（如：http://localhost:11434）"
              value={formData.baseUrl}
              onChange={(e) =>
                setFormData({ ...formData, baseUrl: e.target.value })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="API Key（本地模型可不填）"
              type="password"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData({ ...formData, apiKey: e.target.value })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="模型名（如：deepseek-chat）"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleAdd} className="h-8 gap-1 text-xs">
                <Check className="h-3 w-3" />
                保存
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="h-8 text-xs"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 模型列表 */}
      <div className="space-y-2">
        {models.length === 0 && !showAddForm && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>暂无模型配置</p>
            <p className="mt-1 text-xs">请添加模型或安装 Ollama</p>
          </div>
        )}

        {models.map((model) => {
          const info = gatewayModels.find((m) => m.id === model.id);
          const isActive = activeModelId === model.id;
          const isLocal = info?.isLocal ?? model.provider === "ollama";

          return (
            <div
              key={model.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                isActive ? "border-primary bg-primary/5" : "bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {model.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={providerColors[model.provider] ?? "text-gray-500"}>
                      {providerLabels[model.provider] ?? model.provider}
                    </span>
                    {isLocal ? (
                      <span className="flex items-center gap-1 text-green-500">
                        <WifiOff className="h-3 w-3" />
                        本地
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-500">
                        <Wifi className="h-3 w-3" />
                        API
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveModel(model.id)}
                  className="h-7 px-3 text-xs"
                >
                  {isActive ? "使用中" : "选择"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(model.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
