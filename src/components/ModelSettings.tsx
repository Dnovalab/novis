import { useState } from "react";
import {
  Cpu, Wifi, WifiOff, Plus, Trash2, Check,
  Monitor, Sliders, DollarSign, Type, Indent,
  WrapText, Maximize2,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/ThemePicker";
import type { ModelInfo } from "@/types/electron";
import type { RouteStrategy } from "@/stores/persistence";

interface ModelSettingsProps {
  gatewayModels: ModelInfo[];
}

export function ModelSettings({ gatewayModels }: ModelSettingsProps) {
  const {
    theme, setTheme,
    permissionMode, setPermissionMode,
    models, activeModelId, addModel, removeModel, setActiveModel,
    routeStrategy, setRouteStrategy,
    monthlyBudgetLimit, setMonthlyBudgetLimit,
    currentMonthSpending,
    editor, setEditorConfig,
    setFontSize, setTabSize, setWordWrap, setMinimapEnabled,
  } = useSettingsStore();

  // 模型管理
  const [showAddForm, setShowAddForm] = useState(false);
  const [modelSectionOpen, setModelSectionOpen] = useState(true);
  const [themeSectionOpen, setThemeSectionOpen] = useState(true);
  const [interactionSectionOpen, setInteractionSectionOpen] = useState(true);
  const [budgetSectionOpen, setBudgetSectionOpen] = useState(true);
  const [editorSectionOpen, setEditorSectionOpen] = useState(true);
  const [formData, setFormData] = useState({
    id: "", name: "", provider: "custom" as string,
    baseUrl: "", apiKey: "", model: "",
  });

  const handleAdd = () => {
    if (!formData.name || !formData.baseUrl || !formData.model) return;
    const id = formData.id || `custom-${Date.now()}`;
    addModel({
      id, name: formData.name, provider: formData.provider,
      baseUrl: formData.baseUrl, apiKey: formData.apiKey, model: formData.model,
    });
    if (window.electronAPI) {
      window.electronAPI.model.addModel({
        id, name: formData.name, provider: formData.provider,
        baseUrl: formData.baseUrl, apiKey: formData.apiKey || undefined, model: formData.model,
      });
    }
    setFormData({ id: "", name: "", provider: "custom", baseUrl: "", apiKey: "", model: "" });
    setShowAddForm(false);
  };

  const handleRemove = (id: string) => {
    removeModel(id);
    if (window.electronAPI) window.electronAPI.model.removeModel(id);
  };

  const providerColors: Record<string, string> = {
    ollama: "text-green-500", deepseek: "text-blue-500",
    qwen: "text-orange-500", glm: "text-purple-500",
    hunyuan: "text-cyan-500", custom: "text-gray-500",
  };
  const providerLabels: Record<string, string> = {
    ollama: "Ollama", deepseek: "DeepSeek",
    qwen: "通义千问", glm: "智谱 GLM",
    hunyuan: "腾讯混元", custom: "自定义",
  };

  /** 选项按钮组（用于主题/权限/路由等三选一） */
  function OptionGroup<T extends string>({
    options, value, onChange, size = "sm",
  }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
    size?: "sm" | "xs";
  }) {
    return (
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-md px-2 py-1 text-${
              size === "xs" ? "[10px]" : "xs"
            } font-medium transition-colors ${
              value === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-input bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  /** 可折叠区块头 */
  function SectionHeader({
    label, open, onToggle, icon: Icon,
  }: {
    label: string;
    open: boolean;
    onToggle: () => void;
    icon: React.ElementType;
  }) {
    return (
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{label}</span>
      </button>
    );
  }

  // 预算百分比
  const budgetPercent = monthlyBudgetLimit > 0
    ? Math.min((currentMonthSpending / monthlyBudgetLimit) * 100, 100)
    : 0;
  const budgetColor = budgetPercent >= 90
    ? "bg-red-500" : budgetPercent >= 70
      ? "bg-amber-500" : "bg-primary";

  return (
    <div className="flex h-full flex-col">
      {/* 面板头部 */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">设置</span>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">

        {/* ===== 模型管理 ===== */}
        <SectionHeader
          label="模型管理"
          open={modelSectionOpen}
          onToggle={() => setModelSectionOpen(!modelSectionOpen)}
          icon={Cpu}
        />
        {modelSectionOpen && (
          <div className="space-y-2 pb-2">
            {/* 添加按钮 */}
            <div className="flex justify-end">
              <Button
                variant="outline" size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="h-6 gap-1 text-[10px]"
              >
                <Plus className="h-2.5 w-2.5" />
                {showAddForm ? "取消" : "添加自定义"}
              </Button>
            </div>

            {/* 添加表单 */}
            {showAddForm && (
              <div className="rounded-md border bg-card p-2.5 space-y-1.5">
                <input
                  placeholder="名称"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
                />
                <input
                  placeholder="模型 ID"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
                />
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
                >
                  <option value="custom">自定义 (OpenAI 兼容)</option>
                  <option value="ollama">Ollama</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问</option>
                  <option value="glm">智谱 GLM</option>
                  <option value="hunyuan">腾讯混元</option>
                </select>
                <input
                  placeholder="API 地址"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
                />
                <input
                  placeholder="API Key"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
                />
                <input
                  placeholder="模型名（如：deepseek-chat）"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
                />
                <Button size="sm" onClick={handleAdd} className="h-7 w-full gap-1 text-[10px]">
                  <Check className="h-2.5 w-2.5" />
                  保存
                </Button>
              </div>
            )}

            {/* 模型列表 */}
            {models.length === 0 && (
              <div className="py-4 text-center text-[10px] text-muted-foreground">
                暂无模型配置
              </div>
            )}
            {models.map((model) => {
              const info = gatewayModels.find((m) => m.id === model.id);
              const isActive = activeModelId === model.id;
              const isLocal = info?.isLocal ?? model.provider === "ollama";
              return (
                <div
                  key={model.id}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-2 transition-colors ${
                    isActive ? "border-primary bg-primary/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Cpu className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium truncate">{model.name}</span>
                        <span className="text-[9px] text-muted-foreground truncate">{model.model}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <span className={providerColors[model.provider] ?? "text-gray-500"}>
                          {providerLabels[model.provider] ?? model.provider}
                        </span>
                        {isLocal ? (
                          <span className="flex items-center gap-0.5 text-green-500">
                            <WifiOff className="h-2.5 w-2.5" />本地
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-blue-500">
                            <Wifi className="h-2.5 w-2.5" />API
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant={isActive ? "default" : "outline"} size="sm"
                      onClick={() => setActiveModel(model.id)}
                      className="h-6 px-2 text-[10px]"
                    >
                      {isActive ? "使用中" : "选择"}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleRemove(model.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-border/40" />

        {/* ===== 主题与显示 ===== */}
        <SectionHeader
          label="主题与显示"
          open={themeSectionOpen}
          onToggle={() => setThemeSectionOpen(!themeSectionOpen)}
          icon={Monitor}
        />
        {themeSectionOpen && (
          <div className="pb-2 space-y-3">
            <OptionGroup
              options={[
                { value: "light", label: "浅色" },
                { value: "dark", label: "深色" },
                { value: "system", label: "跟随系统" },
              ]}
              value={theme}
              onChange={setTheme}
            />
            <div className="border-t border-border/40" />
            <ThemePicker />
          </div>
        )}

        <div className="border-t border-border/40" />

        {/* ===== 交互模式 ===== */}
        <SectionHeader
          label="交互模式"
          open={interactionSectionOpen}
          onToggle={() => setInteractionSectionOpen(!interactionSectionOpen)}
          icon={Cpu}
        />
        {interactionSectionOpen && (
          <div className="pb-2 space-y-1">
            <OptionGroup
              options={[
                { value: "suggest", label: "建议" },
                { value: "auto", label: "自动" },
                { value: "full", label: "完整" },
              ]}
              value={permissionMode}
              onChange={setPermissionMode}
            />
            <p className="text-[9px] text-muted-foreground/60 px-0.5">
              {permissionMode === "suggest" && "AI 执行操作前先给出建议，由你确认"}
              {permissionMode === "auto" && "AI 自动执行低风险操作，高风险操作仍需确认"}
              {permissionMode === "full" && "AI 完全自动执行所有操作"}
            </p>

            {/* 路由策略 */}
            <div className="pt-2">
              <p className="text-[9px] text-muted-foreground/80 mb-1">路由策略</p>
              <OptionGroup
                options={[
                  { value: "local-first", label: "本地优先" },
                  { value: "quality-first", label: "质量优先" },
                  { value: "manual", label: "手动" },
                ]}
                value={routeStrategy}
                onChange={(v) => setRouteStrategy(v as RouteStrategy)}
              />
              <p className="text-[9px] text-muted-foreground/60 px-0.5 mt-1">
                {routeStrategy === "local-first" && "优先使用本地 Ollama 模型节省费用"}
                {routeStrategy === "quality-first" && "优先使用云端最强模型保证质量"}
                {routeStrategy === "manual" && "每次对话手动选择模型"}
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-border/40" />

        {/* ===== 月度预算 ===== */}
        <SectionHeader
          label="月度预算"
          open={budgetSectionOpen}
          onToggle={() => setBudgetSectionOpen(!budgetSectionOpen)}
          icon={DollarSign}
        />
        {budgetSectionOpen && (
          <div className="pb-2 space-y-2">
            {/* 进度条 */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>已用 ¥{currentMonthSpending.toFixed(2)}</span>
                <span>上限 ¥{monthlyBudgetLimit.toFixed(0)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetColor}`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-1">
                {budgetPercent >= 100
                  ? "本月预算已用完"
                  : `已使用 ${budgetPercent.toFixed(0)}%`}
              </p>
            </div>

            {/* 预算滑块 */}
            <div>
              <label className="text-[9px] text-muted-foreground/80 block mb-1">
                月度上限：¥{monthlyBudgetLimit.toFixed(0)}
              </label>
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={monthlyBudgetLimit}
                onChange={(e) => setMonthlyBudgetLimit(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground/40 mt-0.5">
                <span>¥5</span>
                <span>¥500</span>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-border/40" />

        {/* ===== 编辑器配置 ===== */}
        <SectionHeader
          label="编辑器"
          open={editorSectionOpen}
          onToggle={() => setEditorSectionOpen(!editorSectionOpen)}
          icon={Type}
        />
        {editorSectionOpen && (
          <div className="pb-2 space-y-2">
            {/* 字体大小 */}
            <div>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground/80 mb-1">
                <Type className="h-3 w-3" />
                字体大小：{editor.fontSize}px
              </label>
              <input
                type="range"
                min={10}
                max={24}
                step={1}
                value={editor.fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground/40 mt-0.5">
                <span>10</span>
                <span>24</span>
              </div>
            </div>

            {/* 制表符大小 */}
            <div>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground/80 mb-1">
                <Indent className="h-3 w-3" />
                制表符大小
              </label>
              <div className="flex gap-1">
                {[2, 4, 8].map((size) => (
                  <button
                    key={size}
                    onClick={() => setTabSize(size)}
                    className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                      editor.tabSize === size
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* 自动换行 */}
            <div>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground/80 mb-1">
                <WrapText className="h-3 w-3" />
                自动换行
              </label>
              <div className="flex gap-1">
                {[
                  { value: "on" as const, label: "开启" },
                  { value: "off" as const, label: "关闭" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setWordWrap(opt.value)}
                    className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                      editor.wordWrap === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 小地图 */}
            <div>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground/80 mb-1">
                <Maximize2 className="h-3 w-3" />
                小地图
              </label>
              <div className="flex gap-1">
                {[
                  { value: true, label: "显示" },
                  { value: false, label: "隐藏" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setMinimapEnabled(opt.value)}
                    className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                      editor.minimapEnabled === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
