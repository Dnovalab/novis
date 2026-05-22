import { useCallback } from "react";
import { Palette } from "lucide-react";
import { BUILT_IN_THEMES, type ThemeDef } from "@/lib/themes";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { themeId, setThemeId } = useSettingsStore();

  const darkThemes = BUILT_IN_THEMES.filter((t) => t.type === "dark");
  const lightThemes = BUILT_IN_THEMES.filter((t) => t.type === "light");

  return (
    <div className="space-y-4">
      {/* 深色主题 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">深色主题</p>
        <div className="grid grid-cols-3 gap-2">
          {darkThemes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              selected={themeId === t.id}
              onSelect={setThemeId}
            />
          ))}
        </div>
      </div>

      {/* 浅色主题 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">浅色主题</p>
        <div className="grid grid-cols-3 gap-2">
          {lightThemes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              selected={themeId === t.id}
              onSelect={setThemeId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeDef;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(theme.id);
  }, [onSelect, theme.id]);

  // 生成预览色块
  const previewColors = [
    theme.vars.background ? parseHsl(theme.vars.background) : "#000",
    theme.vars.primary ? parseHsl(theme.vars.primary) : "#6c63ff",
    theme.vars.secondary ? parseHsl(theme.vars.secondary) : "#333",
    theme.vars.accent ? parseHsl(theme.vars.accent) : "#555",
    theme.vars.muted ? parseHsl(theme.vars.muted) : "#444",
    theme.vars["muted-foreground"] ? parseHsl(theme.vars["muted-foreground"]) : "#888",
  ];

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/30",
      )}
    >
      {/* 预览色块条 */}
      <div className="flex h-6 w-full overflow-hidden rounded">
        {previewColors.map((color, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* 主题名称 */}
      <span
        className={cn(
          "text-[10px] leading-tight",
          selected ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {theme.label}
      </span>
    </button>
  );
}

/** 将 HSL 字符串转为 CSS 颜色（用于预览色块） */
function parseHsl(hsl: string): string {
  // 输入格式如 "220 13% 18%" 或 "143 100% 67%"
  const parts = hsl.trim().split(/\s+/);
  if (parts.length >= 3) {
    return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return hsl;
}
