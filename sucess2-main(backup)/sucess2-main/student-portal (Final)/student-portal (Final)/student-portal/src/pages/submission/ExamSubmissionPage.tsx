import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LabConnectionIndicator } from '../../components/ConnectionStatusBadge';
import { useExamSession } from '../../hooks/useExamSession';

/**
 * Dedicated /student/submission route page for final review and confirmation.
 */
export const ExamSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    student,
    examSession,
    examStarted,
    submitted,
    isSubmitting,
    paletteSummary,
    pendingQuestionIds,
    remainingSeconds,
    labConnectionState,
    saveErrorMessage,
    submitFinalExamination,
  } = useExamSession();

  if (!student || !examSession) {
    return <Navigate to="/student/login" replace />;
  }

  if (submitted || examSession.availabilityState === 'COMPLETED') {
    return <Navigate to="/student/completion" replace />;
  }

  if (!examStarted) {
    return <Navigate to="/student/instructions" replace />;
  }

  const unansweredWord =
    paletteSummary.unansweredTotal === 1
      ? 'question remains'
      : 'questions remain';

  const handleConfirm = async () => {
    const ok = await submitFinalExamination('MANUAL');
    if (ok) {
      navigate('/student/completion', { replace: true });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F9FC] flex flex-col justify-between font-sans text-[#243247]">
      {/* Standard Shared Institutional Header */}
      <InstitutionHeader
        rightSlot={
          <div className="flex items-center gap-3">
            <LabConnectionIndicator
              connectionState={labConnectionState}
              pendingCount={pendingQuestionIds.length}
            />
            <CountdownTimer remainingSeconds={remainingSeconds} />
          </div>
        }
      />

      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-center">
        <div className="max-w-[580px] w-full bg-white border border-[#DCE3EC] rounded-[10px] overflow-hidden institutional-card-shadow">
          <div className="px-6 py-4 bg-[#102A43] text-white">
            <h1 className="text-lg font-bold text-white">
              Confirm Final Examination Submission
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              {examSession.subjectCode} – {examSession.subjectName} · USN:{' '}
              {student.usn}
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-4 rounded-[6px] bg-[#FEF3C7] border border-[#B54708]/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B54708] shrink-0 mt-0.5" />
              <div className="text-sm text-[#243247] leading-relaxed">
                <p className="font-semibold text-[#102A43]">
                  You have answered {paletteSummary.answered} out of{' '}
                  {paletteSummary.total} questions.{' '}
                  {paletteSummary.unansweredTotal} {unansweredWord} unanswered.
                  Are you sure you want to submit?
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Submitting will permanently lock your examination responses on
                  the local Lab Server.
                </p>
              </div>
            </div>

            <div className="border border-[#DCE3EC] rounded-[6px] divide-y divide-[#DCE3EC] text-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#F7F9FC]">
                <span className="text-[#64748B] font-medium">Total Questions</span>
                <span className="font-mono tabular-nums font-bold text-[#102A43]">
                  {paletteSummary.total}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#243247] font-medium">
                  Answered Questions
                </span>
                <span className="font-mono tabular-nums font-bold text-[#16865B]">
                  {paletteSummary.answered}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#243247] font-medium">
                  Unanswered Questions
                </span>
                <span className="font-mono tabular-nums font-bold text-[#B42318]">
                  {paletteSummary.unansweredTotal}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#243247] font-medium">
                  Questions Marked for Review
                </span>
                <span className="font-mono tabular-nums font-bold text-[#6D5CE8]">
                  {paletteSummary.reviewTotal}
                </span>
              </div>
            </div>

            {saveErrorMessage && (
              <div
                className="p-3 rounded-[6px] bg-red-50 border border-[#B42318]/40 text-xs text-[#B42318]"
                role="alert"
              >
                {saveErrorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => navigate('/student/examination')}
                className="h-[44px] inline-flex items-center gap-2 px-4 rounded-[6px] border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#243247] text-sm font-semibold cursor-pointer transition-colors duration-150"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go Back</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirm}
                className="h-[44px] inline-flex items-center gap-2 px-5 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white text-sm font-bold cursor-pointer transition-colors duration-150"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
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
      </main>

      <footer className="bg-white border-t border-[#DCE3EC] px-6 py-3.5 text-xs text-[#64748B]">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between">
          <span>Maharaja Institute of Technology Mysore</span>
          <span>Offline Local Lab Server Verification</span>
        </div>
      </footer>
    </div>
  );
};
