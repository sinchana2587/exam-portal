import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileWarning,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { ConversionLifecycleStatus } from '../types';

const STATUS_LABELS: Record<ConversionLifecycleStatus, string> = {
  WAITING_FOR_FILE: 'Waiting for file',
  UPLOADING: 'Uploading',
  PROCESSING: 'Processing',
  EXTRACTING_TEXT: 'Extracting text',
  EXTRACTING_TABLES: 'Extracting tables',
  EXTRACTING_IMAGES: 'Extracting images',
  IDENTIFYING_MODULES: 'Identifying modules',
  VALIDATION_PENDING: 'Validation pending',
  VALIDATION_FAILED: 'Validation failed',
  MANUAL_REVIEW_REQUIRED: 'Manual review required',
  READY_FOR_EXCEL_DOWNLOAD: 'Ready for Excel download',
  DOWNLOAD_FAILED: 'Download failed',
  BACKEND_UNAVAILABLE: 'Backend unavailable',
  UNSUPPORTED_FORMAT: 'Unsupported format',
  CORRUPTED_DOCUMENT: 'Corrupted document',
  PROCESSING_TIMEOUT: 'Processing timeout',
  MODULE_MISMATCH: 'Module mismatch',
  DEPARTMENT_MISMATCH: 'Department mismatch',
  SECTION_MISMATCH: 'Section mismatch',
};

export function getConversionStatusLabel(status: ConversionLifecycleStatus): string {
  return STATUS_LABELS[status] || status;
}

interface Props {
  status: ConversionLifecycleStatus;
  message?: string;
  progressPercent?: number;
}

export const ConversionStatusBadge: React.FC<Props> = ({ status, message, progressPercent }) => {
  const label = getConversionStatusLabel(status);
  const isInProgress =
    status === 'UPLOADING' ||
    status === 'PROCESSING' ||
    status === 'EXTRACTING_TEXT' ||
    status === 'EXTRACTING_TABLES' ||
    status === 'EXTRACTING_IMAGES' ||
    status === 'IDENTIFYING_MODULES' ||
    status === 'VALIDATION_PENDING';

  const isSuccess = status === 'READY_FOR_EXCEL_DOWNLOAD';
  const isWarning = status === 'MANUAL_REVIEW_REQUIRED' || status === 'WAITING_FOR_FILE';

  const toneClasses = isSuccess
    ? 'bg-[#16834A]/10 border-[#16834A]/30 text-[#16834A] dark:text-emerald-300'
    : isInProgress
    ? 'bg-[#2563EB]/10 border-[#2563EB]/30 text-[#2563EB] dark:text-blue-300'
    : isWarning
    ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/30 dark:border-amber-700/60 dark:text-amber-200'
    : 'bg-[#B42318]/10 border-[#B42318]/30 text-[#B42318] dark:text-red-300';

  const Icon = isSuccess
    ? CheckCircle2
    : isInProgress
    ? Loader2
    : status === 'PROCESSING_TIMEOUT'
    ? Clock
    : status === 'MODULE_MISMATCH' ||
      status === 'DEPARTMENT_MISMATCH' ||
      status === 'SECTION_MISMATCH'
    ? ShieldAlert
    : status === 'WAITING_FOR_FILE'
    ? FileWarning
    : AlertCircle;

  const clampedPct =
    typeof progressPercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(progressPercent)))
      : null;

  return (
    <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${toneClasses}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isInProgress ? 'animate-spin' : ''}`} />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold uppercase tracking-wide text-[11px]">{label}</div>
          {isInProgress && clampedPct !== null && (
            <span className="font-mono font-bold text-[11px] tabular-nums">{clampedPct}%</span>
          )}
        </div>
        {message && <div className="font-medium leading-relaxed">{message}</div>}
        {isInProgress && clampedPct !== null && (
          <div className="w-full h-1.5 rounded-full bg-current/15 overflow-hidden mt-1">
            <div
              className="h-full bg-current transition-all duration-150"
              style={{ width: `${clampedPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
