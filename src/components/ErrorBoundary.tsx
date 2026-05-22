/**
 * ErrorBoundary — React 错误边界
 *
 * 捕获子组件中的渲染错误，显示友好的降级 UI，
 * 防止单个组件崩溃导致整个应用白屏。
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** 组件名称（用于错误日志标识） */
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const name = this.props.componentName || "未知组件";
    console.error(`[ErrorBoundary] ${name} 渲染错误:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              组件渲染异常
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.props.componentName && `${this.props.componentName}: `}
              {this.state.error?.message || "未知错误"}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-3 w-3" />
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
