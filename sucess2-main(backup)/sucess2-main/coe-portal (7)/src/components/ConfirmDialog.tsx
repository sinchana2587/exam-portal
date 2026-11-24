import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  consequenceNote?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'primary' | 'destructive' | 'violet';
  tone?: 'primary' | 'danger' | 'destructive' | 'violet';
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  consequenceNote,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant,
  tone,
  loading = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const effectiveVariant =
    variant || (tone === 'danger' || tone === 'destructive' ? 'destructive' : 'primary');

  const buttonClass =
    effectiveVariant === 'destructive'
      ? 'bg-[#B42318] hover:bg-[#911B13] text-white'
      : effectiveVariant === 'violet'
        ? 'bg-[#6D5CE8] hover:bg-[#5847D6] text-white'
        : 'bg-[#242468] hover:bg-[#1B1B52] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {effectiveVariant === 'destructive' ? (
              <AlertTriangle className="w-5 h-5 text-[#B42318] dark:text-red-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#2563EB] dark:text-blue-400 shrink-0" />
            )}
            <h3
              id="confirm-dialog-title"
              className="text-lg font-bold text-[#1F2937] dark:text-slate-100"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="text-[#64748B] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-100 p-1 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-[15px] text-[#1F2937] dark:text-slate-200 leading-relaxed">
          {description}
        </p>

        {children && <div className="mt-4">{children}</div>}

        {consequenceNote && (
          <div className="mt-4 p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 text-[13px] text-[#64748B] dark:text-slate-300 leading-relaxed">
            <strong className="text-[#1F2937] dark:text-slate-100 font-semibold">
              Operational Consequence:{' '}
            </strong>
            {consequenceNote}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-semibold text-[#1F2937] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 rounded-lg hover:bg-[#F5F7FB] dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading || confirmDisabled}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer ${buttonClass}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
