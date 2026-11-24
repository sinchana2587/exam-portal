import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-[#1E293B] border border-[#FECDD3] dark:border-red-900/50 rounded-xl p-8 sm:p-10 shadow-xs space-y-5 my-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FEF2F2] dark:bg-red-950/50 border border-[#FEE2E2] dark:border-red-900/60 rounded-xl text-[#B42318] dark:text-red-400 shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="text-xl font-bold text-[#1F2937] dark:text-slate-100">
                {this.props.fallbackTitle || 'Unable to display this monitoring view'}
              </h2>
              <p className="text-sm text-[#64748B] dark:text-slate-400">
                A component rendering error was safely intercepted. You can retry loading this section or navigate to another view without losing portal state.
              </p>
              {this.state.error && (
                <div className="mt-3 p-3 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-lg font-mono text-xs text-[#B42318] dark:text-red-400 overflow-x-auto">
                  {this.state.error.name}: {this.state.error.message}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155]">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Retry View
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.search = '?section=overall-monitoring';
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#334155] dark:hover:bg-[#475569] text-[#1F2937] dark:text-slate-200 text-sm font-semibold rounded-lg cursor-pointer transition-colors"
            >
              <Home className="w-4 h-4" />
              Return to Overall Monitoring
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
