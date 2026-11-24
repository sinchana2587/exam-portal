/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, WifiOff, LucideIcon } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  icon?: LucideIcon;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to Load Data',
  message,
  onRetry,
  isRetrying = false,
  icon: Icon = AlertCircle,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`w-full py-10 px-6 flex flex-col items-center justify-center text-center space-y-4 bg-white border border-red-200 rounded-[10px] institutional-card-shadow ${className}`}
    >
      <div className="w-12 h-12 rounded-[10px] bg-red-50 border border-red-200 text-[#B42318] flex items-center justify-center">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="text-base font-bold text-[#102A43]">{title}</h3>
        <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
          {message}
        </p>
      </div>

      {onRetry && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-[38px] inline-flex items-center gap-2 px-4 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white text-xs sm:text-sm font-semibold transition-colors duration-150 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
