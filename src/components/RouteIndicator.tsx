import { useSettingsStore } from "@/stores/settings-store";
import { Lightbulb, Zap, Cloud, WifiOff } from "lucide-react";
import type { RouteStrategy } from "@/stores/persistence";

const STRATEGY_LABELS: Record<RouteStrategy, string> = {
  "local-first": "本地优先",
  "quality-first": "质量优先",
  manual: "智能路由",
};

const STRATEGY_DESCRIPTIONS: Record<RouteStrategy, string> = {
  "local-first": "尽可能使用本地免费模型",
  "quality-first": "优先使用云端 API 模型",
  manual: "简单任务 → 本地，复杂任务 → API",
};

export function RouteIndicator() {
  const {
    routeStrategy,
    setRouteStrategy,
    routeReason,
    models,
  } = useSettingsStore();

  const hasLocalModels = models.some((m) => m.provider === "ollama");
  const hasApiModels = models.some((m) => m.provider !== "ollama");

  return (
    <div className="group relative">
      <button
        onClick={() => {
          const next: RouteStrategy =
            routeStrategy === "manual"
              ? "local-first"
              : routeStrategy === "local-first"
                ? "quality-first"
                : "manual";
          setRouteStrategy(next);
        }}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted"
        title={`路由策略: ${STRATEGY_LABELS[routeStrategy]}`}
      >
        {routeStrategy === "local-first" ? (
          <WifiOff className="h-3 w-3 text-green-500" />
        ) : routeStrategy === "quality-first" ? (
          <Cloud className="h-3 w-3 text-blue-500" />
        ) : (
          <Zap className="h-3 w-3 text-amber-500" />
        )}
        <span className="text-muted-foreground">
          {STRATEGY_LABELS[routeStrategy]}
        </span>
      </button>

      {/* Tooltip — 悬停显示 */}
      <div className="absolute bottom-full left-0 z-50 mb-1 hidden w-56 rounded-md border bg-popover p-2 text-xs shadow-md group-hover:block">
        <div className="mb-1 font-medium">{STRATEGY_LABELS[routeStrategy]}</div>
        <p className="mb-1 text-muted-foreground">
          {STRATEGY_DESCRIPTIONS[routeStrategy]}
        </p>
        {routeReason && (
          <div className="mt-1 flex items-start gap-1 rounded bg-muted p-1">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            <span className="text-muted-foreground">{routeReason}</span>
          </div>
        )}
        <div className="mt-1.5 flex gap-2 text-muted-foreground">
          {hasLocalModels && (
            <span className="flex items-center gap-0.5">
              <WifiOff className="h-2.5 w-2.5 text-green-500" />
              本地
            </span>
          )}
          {hasApiModels && (
            <span className="flex items-center gap-0.5">
              <Cloud className="h-2.5 w-2.5 text-blue-500" />
              API
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          点击切换路由策略
        </p>
      </div>
    </div>
  );
}
