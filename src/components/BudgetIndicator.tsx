import { useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BudgetIndicator() {
  const {
    monthlyBudgetLimit,
    currentMonthSpending,
    setMonthlyBudgetLimit,
  } = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);
  const [editValue, setEditValue] = useState(String(monthlyBudgetLimit));

  const hasLimit = monthlyBudgetLimit > 0;
  const ratio = hasLimit ? currentMonthSpending / monthlyBudgetLimit : 0;
  const isWarning = ratio >= 0.8;
  const isExceeded = ratio >= 1;

  const barColor = isExceeded
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-green-500";

  return (
    <div className="group relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted"
        title={`本月已花费 ¥${currentMonthSpending.toFixed(2)} / ${hasLimit ? `¥${monthlyBudgetLimit.toFixed(2)}` : "无限制"}`}
      >
        <DollarSign className={`h-3 w-3 ${isExceeded ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground"}`} />
        <span className="text-muted-foreground">
          ¥{currentMonthSpending.toFixed(1)}
          {hasLimit && `/¥${monthlyBudgetLimit.toFixed(0)}`}
        </span>
      </button>

      {/* 设置面板 */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute bottom-full right-0 z-50 mb-1 w-56 rounded-md border bg-popover p-3 text-xs shadow-md">
            <div className="mb-2 font-medium">月度预算设置</div>

            {/* 进度条 */}
            {hasLimit && (
              <div className="mb-2">
                <div className="mb-1 flex justify-between text-muted-foreground">
                  <span>已使用</span>
                  <span>
                    ¥{currentMonthSpending.toFixed(2)} / ¥
                    {monthlyBudgetLimit.toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{
                      width: `${Math.min(ratio * 100, 100)}%`,
                    }}
                  />
                </div>
                {isExceeded && (
                  <p className="mt-1 text-red-500">
                    月度预算已用完，将自动切换到本地免费模型
                  </p>
                )}
                {isWarning && !isExceeded && (
                  <p className="mt-1 text-amber-500">
                    预算即将用完
                  </p>
                )}
              </div>
            )}

            {/* 设置预算 */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">月度上限 ¥</span>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
                min="0"
                step="5"
              />
              <Button
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  const val = parseFloat(editValue);
                  if (!isNaN(val) && val >= 0) {
                    setMonthlyBudgetLimit(val);
                    setShowSettings(false);
                  }
                }}
              >
                设置
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              设为 0 可取消预算限制
            </p>
          </div>
        </>
      )}
    </div>
  );
}
