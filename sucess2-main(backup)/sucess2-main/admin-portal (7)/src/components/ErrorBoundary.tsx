import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { OFFICIAL_MIT_LOGO_PATH } from './InstitutionLogo';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MITM-EMS Portal Error]', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F1B33] text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 text-[#17243A] dark:text-white rounded-2xl border border-[#D9E2EF] dark:border-slate-800 p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4 border-b border-[#D9E2EF] dark:border-slate-800 pb-5">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-[#262F87] shrink-0 flex items-center justify-center">
                <img
                  src={OFFICIAL_MIT_LOGO_PATH}
                  alt="MIT Mysore Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#17243A] dark:text-white leading-tight">
                  Maharaja Institute of Technology Mysore
                </h1>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  Examination Management System — Admin Portal
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-800 dark:text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold">
                  {this.props.fallbackTitle || 'Portal View Temporarily Unavailable'}
                </h2>
                <p className="text-xs mt-1 leading-relaxed opacity-90">
                  {this.state.error?.message ||
                    'An unexpected client-side rendering error occurred in this portal module.'}
                </p>
              </div>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details className="text-[11px] font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 max-h-40 overflow-y-auto">
                <summary className="cursor-pointer font-bold text-[#64748B]">Technical Stack Trace</summary>
                <pre className="mt-2 text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/admin/login';
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
