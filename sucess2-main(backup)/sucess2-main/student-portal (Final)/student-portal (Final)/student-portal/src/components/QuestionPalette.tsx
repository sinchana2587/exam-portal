import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  QuestionPaletteSummary,
  QuestionStatus,
  ServerAnswerRecord,
  StudentQuestion,
} from '../types/examination';
import {
  deriveQuestionStatus,
  formatDisplayNumber,
} from '../utils/examFormatters';

interface QuestionPaletteProps {
  questions: StudentQuestion[];
  responses: Record<string, ServerAnswerRecord>;
  pendingQuestionIds: string[];
  currentIndex: number;
  summary: QuestionPaletteSummary;
  onSelectQuestion: (index: number) => void;
  onOpenSubmitModal?: () => void;
}

function getStatusTileStyles(
  status: QuestionStatus,
  isCurrent: boolean
): string {
  const activeRing = isCurrent
    ? 'ring-2 ring-[#2463B5] ring-offset-2 ring-offset-white border-[#2463B5] font-bold shadow-xs'
    : '';

  switch (status) {
    case 'ANSWERED':
      return `bg-[#16834A] text-white border-[#16834A] font-semibold ${activeRing}`;
    case 'NOT_ANSWERED':
      return `bg-[#E0E0E0] text-[#1F2937] border-[#9CA3AF] font-semibold ${activeRing}`;
    case 'MARKED_FOR_REVIEW':
      return `bg-[#6D5CE8] text-white border-[#6D5CE8] font-semibold ${activeRing}`;
    case 'ANSWERED_AND_MARKED_FOR_REVIEW':
      return `bg-[#6D5CE8] text-white border-[#16834A] border-2 font-semibold ${activeRing}`;
    case 'NOT_VISITED':
    default:
      return `bg-[#FFFFFF] text-[#1F2937] border-[#D1D5DB] hover:border-[#9CA3AF] font-medium ${activeRing}`;
  }
}

function getStatusAccessibleLabel(status: QuestionStatus): string {
  switch (status) {
    case 'ANSWERED':
      return 'Answered';
    case 'NOT_ANSWERED':
      return 'Not Answered';
    case 'MARKED_FOR_REVIEW':
      return 'Marked for Review (Unanswered)';
    case 'ANSWERED_AND_MARKED_FOR_REVIEW':
      return 'Answered and Marked for Review';
    case 'NOT_VISITED':
    default:
      return 'Not Visited';
  }
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  questions,
  responses,
  pendingQuestionIds,
  currentIndex,
  summary,
  onSelectQuestion,
  onOpenSubmitModal,
}) => {
  return (
    <div
      aria-label="Question Navigation Palette"
      className="w-full h-full bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow flex flex-col min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-[#DCE3EC] custom-scrollbar"
    >
      {/* SECTION 1: HEADER & SUMMARY COUNTERS */}
      <div className="p-2 sm:p-2.5 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-[#102A43]">
            Question Navigation Palette
          </h2>
          <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-[#64748B] font-semibold bg-[#F7F9FC] px-1.5 py-0.5 rounded-[4px] border border-[#DCE3EC]">
            Total: {summary.total}
          </span>
        </div>

        {/* Numeric Summary 2x2 Grid */}
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <div className="flex items-center justify-between px-2 py-0.5 rounded-[4px] bg-[#F7F9FC] border border-[#DCE3EC]">
            <span className="text-[#1F2937] font-medium text-[10px] sm:text-[11px]">Answered</span>
            <span className="font-mono tabular-nums font-bold text-[#16834A] text-[11px]">
              {formatDisplayNumber(summary.answered)}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-0.5 rounded-[4px] bg-[#F7F9FC] border border-[#DCE3EC]">
            <span className="text-[#1F2937] font-medium text-[10px] sm:text-[11px]">Not Answered</span>
            <span className="font-mono tabular-nums font-bold text-[#4B5563] text-[11px]">
              {formatDisplayNumber(summary.notAnswered)}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-0.5 rounded-[4px] bg-[#F7F9FC] border border-[#DCE3EC]">
            <span className="text-[#1F2937] font-medium text-[10px] sm:text-[11px]">Marked Review</span>
            <span className="font-mono tabular-nums font-bold text-[#6D5CE8] text-[11px]">
              {formatDisplayNumber(summary.reviewTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-0.5 rounded-[4px] bg-[#F7F9FC] border border-[#DCE3EC]">
            <span className="text-[#1F2937] font-medium text-[10px] sm:text-[11px]">Not Visited</span>
            <span className="font-mono tabular-nums font-bold text-[#64748B] text-[11px]">
              {formatDisplayNumber(summary.notVisited)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: 30-QUESTION NUMBER GRID */}
      <div className="p-2 sm:p-2.5 shrink-0 space-y-1.5">
        <div className="text-[10px] sm:text-[11px] font-medium text-[#64748B]">
          Click a question number to jump directly:
        </div>

        {/* 5-Column Grid with Equal Sizing */}
        <div className="grid grid-cols-5 gap-1 w-full">
          {questions.map((q, idx) => {
            const status = deriveQuestionStatus(responses[q.questionId]);
            const isCurrent = idx === currentIndex;
            const tileStyle = getStatusTileStyles(status, isCurrent);

            return (
              <button
                key={q.questionId}
                type="button"
                onClick={() => onSelectQuestion(idx)}
                aria-label={`Question ${q.displayNumber}: ${getStatusAccessibleLabel(
                  status
                )}${isCurrent ? ' (Current Question)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative h-[26px] sm:h-7 w-full rounded-[4px] border text-xs font-mono tabular-nums flex items-center justify-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2463B5] cursor-pointer ${tileStyle}`}
              >
                <span>{formatDisplayNumber(q.displayNumber)}</span>
                {status === 'ANSWERED_AND_MARKED_FOR_REVIEW' && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#16834A] border border-white text-[8px] text-white flex items-center justify-center font-bold"
                    title="Answered and Marked for Review"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: QUESTION STATUS LEGEND (Strictly below question grid) */}
      <div className="p-2 sm:p-2.5 shrink-0 space-y-1">
        <h3 className="text-[11px] sm:text-xs font-bold text-[#102A43] mb-1">
          Question Status
        </h3>
        <div className="space-y-1 text-[11px] text-[#1F2937]">
          {/* 01 Answered */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-[3px] bg-[#16834A] text-white font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                01
              </span>
              <span>Answered</span>
            </div>
            <span className="font-mono tabular-nums text-[#64748B] font-semibold text-[10px]">
              {summary.answered - summary.answeredAndMarkedForReview}
            </span>
          </div>

          {/* 02 Not Answered */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-[3px] bg-[#E0E0E0] border border-[#9CA3AF] text-[#1F2937] font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                02
              </span>
              <span>Not Answered</span>
            </div>
            <span className="font-mono tabular-nums text-[#64748B] font-semibold text-[10px]">
              {summary.notAnswered}
            </span>
          </div>

          {/* 03 Not Visited */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-[3px] bg-[#FFFFFF] border border-[#D1D5DB] text-[#1F2937] font-mono text-[9px] font-medium flex items-center justify-center shrink-0">
                03
              </span>
              <span>Not Visited</span>
            </div>
            <span className="font-mono tabular-nums text-[#64748B] font-semibold text-[10px]">
              {summary.notVisited}
            </span>
          </div>

          {/* 04 Marked for Review */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-[3px] bg-[#6D5CE8] text-white font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                04
              </span>
              <span>Marked for Review</span>
            </div>
            <span className="font-mono tabular-nums text-[#64748B] font-semibold text-[10px]">
              {summary.markedForReview}
            </span>
          </div>

          {/* 05 Answered & Marked for Review */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative w-4 h-4 rounded-[3px] bg-[#6D5CE8] border border-[#16834A] text-white font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                05
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#16834A] text-[6px] text-white flex items-center justify-center">
                  ✓
                </span>
              </span>
              <span>Answered &amp; Marked for Review</span>
            </div>
            <span className="font-mono tabular-nums text-[#64748B] font-semibold text-[10px]">
              {summary.answeredAndMarkedForReview}
            </span>
          </div>
        </div>
      </div>

      {/* Optional Examination Submission CTA */}
      {onOpenSubmitModal && (
        <div className="p-2.5 sm:p-3 bg-[#F7F9FC] shrink-0">
          <button
            type="button"
            onClick={onOpenSubmitModal}
            className="w-full h-[38px] rounded-[6px] bg-[#16834A] hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#16834A] cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Examination</span>
          </button>
        </div>
      )}
    </div>
  );
};
