import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { QuestionPaletteSummary } from '../types/examination';

interface SubmissionModalProps {
  isOpen: boolean;
  summary: QuestionPaletteSummary;
  pendingSyncCount: number;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirmSubmit: () => void;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  summary,
  pendingSyncCount,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirmSubmit,
}) => {
  if (!isOpen) return null;

  const unansweredQuestionWord =
    summary.unansweredTotal === 1 ? 'question remains' : 'questions remain';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A43]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#102A43] text-white">
          <h2 id="submit-modal-title" className="text-[16px] font-bold text-white">
            Confirm Final Examination Submission
          </h2>
          {!isSubmitting && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close confirmation dialog"
              className="text-slate-300 hover:text-white p-1 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Primary Confirmation Message */}
          <div className="p-4 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B54708] shrink-0 mt-0.5" />
            <div className="text-sm text-[#243247] leading-relaxed">
              <p className="font-semibold text-[#102A43]">
                You have answered {summary.answered} out of {summary.total}{' '}
                questions. {summary.unansweredTotal} {unansweredQuestionWord}{' '}
                unanswered. Are you sure you want to submit?
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Once submitted, your examination responses will be permanently
                locked on the Lab Server and you will not be permitted to modify
                any answers.
              </p>
            </div>
          </div>

          {/* Summary Table */}
          <div className="border border-[#DCE3EC] rounded-[6px] divide-y divide-[#DCE3EC] text-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#F7F9FC]">
              <span className="text-[#64748B] font-medium">Total Questions</span>
              <span className="font-mono tabular-nums font-bold text-[#102A43]">
                {summary.total}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[#243B53] font-medium">
                Answered Questions
              </span>
              <span className="font-mono tabular-nums font-bold text-[#16865B]">
                {summary.answered}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[#243B53] font-medium">
                Unanswered Questions (Not Answered + Not Visited)
              </span>
              <span className="font-mono tabular-nums font-bold text-[#B42318]">
                {summary.unansweredTotal}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[#243B53] font-medium">
                Questions Marked for Review
              </span>
              <span className="font-mono tabular-nums font-bold text-[#6D5CE8]">
                {summary.reviewTotal}
              </span>
            </div>
          </div>

          {pendingSyncCount > 0 && (
            <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-[#B54708]">
              Note: {pendingSyncCount} response(s) are currently buffered locally
              and will be synchronized with the Lab Server prior to locking your
              submission.
            </div>
          )}

          {errorMessage && (
            <div
              className="p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-[#B42318]"
              role="alert"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-[#F7F9FC] border-t border-[#DCE3EC] flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-[44px] px-5 rounded-[6px] border border-[#CBD5E1] bg-white hover:bg-[#F7F9FC] text-[#243247] text-[14px] font-bold transition-colors duration-150 disabled:opacity-50 cursor-pointer"
          >
            Go Back
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirmSubmit}
            className="h-[44px] inline-flex items-center gap-2 px-5 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white text-[14px] font-bold transition-colors duration-150 disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting to Lab Server...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Final Submit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
