import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
  WifiOff,
} from 'lucide-react';
import { LabConnectionState, SaveAckStatus } from '../types/examination';

interface LabConnectionIndicatorProps {
  connectionState: LabConnectionState;
  pendingCount?: number;
  onRetrySync?: () => void;
}

export const LabConnectionIndicator: React.FC<LabConnectionIndicatorProps> = ({
  connectionState,
  pendingCount = 0,
  onRetrySync,
}) => {
  switch (connectionState) {
    case 'CONNECTED':
      return (
        <div
          className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] bg-emerald-50 border border-emerald-200 text-[#16865B] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xs"
          role="status"
          aria-live="polite"
        >
          <Server className="w-4 h-4 sm:w-5 sm:h-5 text-[#16865B] shrink-0" />
          <span>Connected to Lab Server</span>
        </div>
      );

    case 'SYNCHRONIZING':
      return (
        <div
          className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] bg-blue-50 border border-blue-200 text-[#2463B5] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xs"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#2463B5] animate-spin shrink-0" />
          <span>
            Synchronizing{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </span>
        </div>
      );

    case 'RECONNECTING':
      return (
        <div
          className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] bg-amber-50 border border-amber-200 text-[#B54708] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xs"
          role="status"
          aria-live="polite"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-[#B54708] animate-spin shrink-0" />
          <span>Reconnecting to Lab Server</span>
        </div>
      );

    case 'SUBMISSION_PENDING':
      return (
        <div
          className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] bg-blue-50 border border-blue-200 text-[#2463B5] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xs"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#2463B5] animate-spin shrink-0" />
          <span>Submission Pending</span>
        </div>
      );

    case 'TEMPORARILY_DISCONNECTED':
    default:
      return (
        <div
          className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] bg-red-50 border border-red-200 text-[#B42318] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-xs"
          role="alert"
        >
          <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-[#B42318] shrink-0" />
          <span>Temporarily Disconnected</span>
          {onRetrySync && (
            <button
              type="button"
              onClick={onRetrySync}
              className="ml-1 underline hover:text-[#102A43] focus:outline-none focus:ring-1 focus:ring-[#2463B5] rounded px-1.5 py-0.5 text-xs sm:text-sm cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      );
  }
};

interface AnswerSaveStatusBarProps {
  saveStatus: SaveAckStatus;
  lastSavedAt: string | null;
  pendingCount: number;
  errorMessage: string | null;
  onRetry: () => void;
}

export const AnswerSaveStatusBar: React.FC<AnswerSaveStatusBarProps> = ({
  saveStatus,
  lastSavedAt,
  pendingCount,
  errorMessage,
  onRetry,
}) => {
  if (saveStatus === 'SAVING') {
    return (
      <div
        className="flex items-center gap-2 text-xs font-medium text-[#2463B5]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Saving response to Lab Server...</span>
      </div>
    );
  }

  if (saveStatus === 'RECONNECTING') {
    return (
      <div
        className="flex items-center gap-2 text-xs font-medium text-[#B54708]"
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Reconnecting and synchronizing pending answers...</span>
      </div>
    );
  }

  if (saveStatus === 'CONNECTION_INTERRUPTED') {
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#B54708]"
        role="alert"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>
          Connection interrupted — {pendingCount} response(s) buffered for
          Lab Server sync (not yet acknowledged)
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="px-2 py-0.5 rounded-[6px] border border-[#CBD5E1] bg-white text-[#243247] hover:bg-[#F7F9FC] transition-colors cursor-pointer"
        >
          Sync Now
        </button>
      </div>
    );
  }

  if (saveStatus === 'SAVE_FAILED') {
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#B42318]"
        role="alert"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>Save failed: {errorMessage || 'Lab Server did not acknowledge response.'}</span>
        <button
          type="button"
          onClick={onRetry}
          className="px-2 py-0.5 rounded-[6px] border border-red-300 bg-red-50 text-[#B42318] hover:bg-red-100 transition-colors cursor-pointer"
        >
          Retry Save
        </button>
      </div>
    );
  }

  if (saveStatus === 'SAVED') {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-medium text-[#16865B]"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>
          Saved to Lab Server{lastSavedAt ? ` · ${lastSavedAt}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
      <span>Lab Server ready to record responses</span>
    </div>
  );
};
