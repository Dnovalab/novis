/**
 * SplashScreen — 应用启动加载画面
 *
 * 在设置恢复、模型列表加载期间显示品牌画面，
 * 避免白屏或无内容闪烁。
 */

import { Terminal } from "lucide-react";

interface SplashScreenProps {
  message?: string;
}

export function SplashScreen({ message = "正在初始化…" }: SplashScreenProps) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background">
      {/* Logo */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Terminal className="h-8 w-8 text-primary" />
      </div>

      {/* 加载动画 */}
      <div className="mb-4 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </div>

      {/* 提示文字 */}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
