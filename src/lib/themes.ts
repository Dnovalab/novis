/**
 * Novis 主题系统
 *
 * 每个主题定义一组 CSS 变量覆盖值，以及对应的 Monaco 编辑器主题。
 * 主题通过设置 CSS 变量 + 切换 .dark class 来生效。
 */

export interface ThemeDef {
  /** 主题唯一 ID */
  id: string;
  /** 显示名称 */
  label: string;
  /** 类型：深色/浅色 */
  type: "dark" | "light";
  /** 描述 */
  description: string;
  /** 主题配色样本色（预览用） */
  accent: string;
  /** Monaco 编辑器主题名 */
  monacoTheme: string;
  /** CSS 变量覆盖（相对于 shadcn/ui 默认值的变化） */
  vars: ThemeVars;
}

export interface ThemeVars {
  /** 是否添加 .dark class */
  dark: boolean;
  /** 主色 */
  primary?: string;
  /** 主色前景 */
  "primary-foreground"?: string;
  /** 背景色 */
  background?: string;
  /** 前景色 */
  foreground?: string;
  /** 卡片背景 */
  card?: string;
  /** 弹出层背景 */
  popover?: string;
  /** 次要色 */
  secondary?: string;
  /** 次要色前景 */
  "secondary-foreground"?: string;
  /** 弱化前景 */
  muted?: string;
  /** 弱化前景文字 */
  "muted-foreground"?: string;
  /** 边框色 */
  border?: string;
  /** 输入框边框 */
  input?: string;
  /** 危险色 */
  destructive?: string;
  /** 侧边栏 */
  sidebar?: string;
  /** 侧边栏前景 */
  "sidebar-foreground"?: string;
  /** 侧边栏边框 */
  "sidebar-border"?: string;
  /** 强调色 */
  accent?: string;
  /** 强调色前景 */
  "accent-foreground"?: string;
  /** 环形色 */
  ring?: string;
  /** 圆角 */
  radius?: string;
}

/** 将主题变量转为 CSS 自定义属性字符串 */
export function themeVarsToCSS(vars: ThemeVars): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (key === "dark" || !value) continue;
    // 转换 camelCase 为 kebab-case
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    entries.push(`  --${cssKey}: ${value};`);
  }
  if (vars.dark) {
    return `.dark {\n${entries.join("\n")}\n}`;
  }
  return `:root {\n${entries.join("\n")}\n}`;
}

// ====== 内置主题定义 ======

export const BUILT_IN_THEMES: ThemeDef[] = [
  // -------- 深色主题 --------
  {
    id: "default-dark",
    label: "默认深色",
    type: "dark",
    description: "Novis 默认深色主题",
    accent: "#6c63ff",
    monacoTheme: "vs-dark",
    vars: {
      dark: true,
      primary: "143 100% 67%",
      "primary-foreground": "0 0% 100%",
      background: "224 71% 4%",
      foreground: "213 31% 91%",
      card: "224 71% 4%",
      popover: "224 71% 4%",
      secondary: "215 27% 16%",
      "secondary-foreground": "210 40% 88%",
      muted: "215 27% 16%",
      "muted-foreground": "215 20% 65%",
      accent: "215 27% 16%",
      "accent-foreground": "210 40% 88%",
      destructive: "0 62% 30%",
      border: "215 27% 16%",
      input: "215 27% 16%",
      ring: "143 100% 67%",
      sidebar: "224 71% 4%",
      "sidebar-foreground": "213 31% 91%",
      "sidebar-border": "215 27% 16%",
      radius: "0.5rem",
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    type: "dark",
    description: "Atom One Dark 配色",
    accent: "#61afef",
    monacoTheme: "vs-dark",
    vars: {
      dark: true,
      primary: "220 89% 66%",
      "primary-foreground": "0 0% 100%",
      background: "220 13% 18%",
      foreground: "220 14% 71%",
      card: "220 13% 18%",
      popover: "220 13% 18%",
      secondary: "220 10% 25%",
      "secondary-foreground": "220 14% 85%",
      muted: "220 10% 25%",
      "muted-foreground": "220 10% 55%",
      accent: "220 10% 25%",
      "accent-foreground": "220 14% 85%",
      destructive: "355 65% 55%",
      border: "220 10% 28%",
      input: "220 10% 28%",
      ring: "220 89% 66%",
      sidebar: "220 13% 18%",
      "sidebar-foreground": "220 14% 71%",
      "sidebar-border": "220 10% 28%",
      radius: "0.5rem",
    },
  },
  {
    id: "nord",
    label: "Nord",
    type: "dark",
    description: "北极蓝调主题",
    accent: "#88c0d0",
    monacoTheme: "vs-dark",
    vars: {
      dark: true,
      primary: "193 43% 67%",
      "primary-foreground": "220 16% 22%",
      background: "220 16% 22%",
      foreground: "222 20% 78%",
      card: "220 16% 22%",
      popover: "220 16% 22%",
      secondary: "221 13% 30%",
      "secondary-foreground": "222 20% 88%",
      muted: "221 13% 30%",
      "muted-foreground": "222 12% 60%",
      accent: "221 13% 30%",
      "accent-foreground": "222 20% 88%",
      destructive: "354 42% 56%",
      border: "221 13% 33%",
      input: "221 13% 33%",
      ring: "193 43% 67%",
      sidebar: "220 16% 22%",
      "sidebar-foreground": "222 20% 78%",
      "sidebar-border": "221 13% 33%",
      radius: "0.5rem",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    type: "dark",
    description: "经典紫色暗色主题",
    accent: "#bd93f9",
    monacoTheme: "vs-dark",
    vars: {
      dark: true,
      primary: "265 89% 78%",
      "primary-foreground": "0 0% 100%",
      background: "231 15% 18%",
      foreground: "60 30% 96%",
      card: "231 15% 18%",
      popover: "231 15% 18%",
      secondary: "232 14% 26%",
      "secondary-foreground": "60 30% 96%",
      muted: "232 14% 26%",
      "muted-foreground": "225 8% 65%",
      accent: "232 14% 26%",
      "accent-foreground": "60 30% 96%",
      destructive: "0 100% 67%",
      border: "232 14% 29%",
      input: "232 14% 29%",
      ring: "265 89% 78%",
      sidebar: "231 15% 18%",
      "sidebar-foreground": "60 30% 96%",
      "sidebar-border": "232 14% 29%",
      radius: "0.5rem",
    },
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    type: "dark",
    description: "GitHub 暗色模式",
    accent: "#58a6ff",
    monacoTheme: "vs-dark",
    vars: {
      dark: true,
      primary: "212 100% 68%",
      "primary-foreground": "0 0% 100%",
      background: "215 14% 10%",
      foreground: "210 12% 88%",
      card: "215 14% 10%",
      popover: "215 14% 10%",
      secondary: "215 14% 18%",
      "secondary-foreground": "210 12% 92%",
      muted: "215 14% 18%",
      "muted-foreground": "215 10% 60%",
      accent: "215 14% 18%",
      "accent-foreground": "210 12% 92%",
      destructive: "0 72% 51%",
      border: "215 14% 22%",
      input: "215 14% 22%",
      ring: "212 100% 68%",
      sidebar: "215 14% 10%",
      "sidebar-foreground": "210 12% 88%",
      "sidebar-border": "215 14% 22%",
      radius: "0.375rem",
    },
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    type: "dark",
    description: "Solarized 暗色主题",
    accent: "#2aa198",
    monacoTheme: "vs-dark",
    vars: {
      dark: true,
      primary: "175 59% 40%",
      "primary-foreground": "0 0% 100%",
      background: "192 23% 18%",
      foreground: "194 17% 75%",
      card: "192 23% 18%",
      popover: "192 23% 18%",
      secondary: "193 18% 25%",
      "secondary-foreground": "194 17% 85%",
      muted: "193 18% 25%",
      "muted-foreground": "194 12% 58%",
      accent: "193 18% 25%",
      "accent-foreground": "194 17% 85%",
      destructive: "1 71% 52%",
      border: "193 18% 28%",
      input: "193 18% 28%",
      ring: "175 59% 40%",
      sidebar: "192 23% 18%",
      "sidebar-foreground": "194 17% 75%",
      "sidebar-border": "193 18% 28%",
      radius: "0.5rem",
    },
  },

  // -------- 浅色主题 --------
  {
    id: "default-light",
    label: "默认浅色",
    type: "light",
    description: "Novis 默认浅色主题",
    accent: "#6c63ff",
    monacoTheme: "vs",
    vars: {
      dark: false,
      primary: "143 100% 67%",
      "primary-foreground": "0 0% 100%",
      background: "0 0% 100%",
      foreground: "224 71% 4%",
      card: "0 0% 100%",
      popover: "0 0% 100%",
      secondary: "220 14% 96%",
      "secondary-foreground": "220 14% 20%",
      muted: "220 14% 96%",
      "muted-foreground": "220 8% 46%",
      accent: "220 14% 96%",
      "accent-foreground": "220 14% 20%",
      destructive: "0 72% 51%",
      border: "220 13% 91%",
      input: "220 13% 91%",
      ring: "143 100% 67%",
      sidebar: "220 14% 96%",
      "sidebar-foreground": "220 14% 20%",
      "sidebar-border": "220 13% 91%",
      radius: "0.5rem",
    },
  },
  {
    id: "github-light",
    label: "GitHub Light",
    type: "light",
    description: "GitHub 浅色模式",
    accent: "#0969da",
    monacoTheme: "vs",
    vars: {
      dark: false,
      primary: "212 92% 45%",
      "primary-foreground": "0 0% 100%",
      background: "0 0% 100%",
      foreground: "215 15% 12%",
      card: "0 0% 100%",
      popover: "0 0% 100%",
      secondary: "210 17% 95%",
      "secondary-foreground": "215 15% 20%",
      muted: "210 17% 95%",
      "muted-foreground": "215 10% 50%",
      accent: "210 17% 95%",
      "accent-foreground": "215 15% 20%",
      destructive: "0 72% 51%",
      border: "216 15% 87%",
      input: "216 15% 87%",
      ring: "212 92% 45%",
      sidebar: "210 17% 95%",
      "sidebar-foreground": "215 15% 20%",
      "sidebar-border": "216 15% 87%",
      radius: "0.375rem",
    },
  },
];

/** 默认深色主题 ID */
export const DEFAULT_THEME_ID = "default-dark";

/** 根据 ID 查找主题 */
export function findTheme(id: string): ThemeDef {
  return BUILT_IN_THEMES.find((t) => t.id === id) ?? BUILT_IN_THEMES[0];
}
