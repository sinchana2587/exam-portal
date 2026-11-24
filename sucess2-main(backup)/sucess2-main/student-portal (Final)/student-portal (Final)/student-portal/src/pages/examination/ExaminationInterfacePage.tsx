import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Eraser,
  FlaskConical,
  RotateCcw,
  Shield,
  ShieldAlert,
  User,
  Wifi,
  WifiOff,
  X,
  ZapOff,
} from 'lucide-react';
import { emergencyRecoveryService } from '../../services/emergencyRecoveryService';
import { INSTITUTION_NAME } from '../../assets/brandAssets';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import { EmptyState } from '../../components/common/EmptyState';
import {
  AnswerSaveStatusBar,
  LabConnectionIndicator,
} from '../../components/ConnectionStatusBadge';
import { CountdownTimer } from '../../components/CountdownTimer';
import { QuestionPalette } from '../../components/QuestionPalette';
import { SubmissionModal } from '../../components/SubmissionModal';
import { FullScreenSecurityLockScreen } from '../../components/security/FullScreenSecurityLockScreen';
import { useExamSession } from '../../hooks/useExamSession';
import { useExaminationSecurity } from '../../hooks/useExaminationSecurity';
import {
  deriveQuestionStatus,
  formatDisplayNumber,
} from '../../utils/examFormatters';
import { API_MODE } from '../../services/apiConfig';
import { OptionKey } from '../../types/examination';

export const ExaminationInterfacePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    student,
    examSession,
    questions,
    currentQuestionIndex,
    currentQuestion,
    responses,
    pendingQuestionIds,
    saveAckStatus,
    saveErrorMessage,
    lastSavedAt,
    labConnectionState,
    remainingSeconds,
    examStarted,
    submitted,
    isSubmitting,
    paletteSummary,
    selectOptionForCurrent,
    clearCurrentResponse,
    toggleMarkForReviewCurrent,
    saveAndNextQuestion,
    goToPreviousQuestion,
    jumpToQuestionIndex,
    submitFinalExamination,
    retrySyncPendingAnswers,
    logoutStudent,
  } = useExamSession();

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  const {
    lockState,
    isLocked,
    isVerifying,
    verificationError,
    resumptionMessage,
    triggerViolation,
    verifyPassword,
    dismissResumptionMessage,
  } = useExaminationSecurity({
    enabled: Boolean(examStarted && !submitted && student && examSession),
    student,
    examSession,
    currentQuestionIndex,
    remainingSeconds,
    responses,
    jumpToQuestionIndex,
  });

  if (!student || !examSession) {
    return <Navigate to="/student/login" replace />;
  }

  if (submitted || examSession.availabilityState === 'COMPLETED') {
    return <Navigate to="/student/completion" replace />;
  }

  if (!examStarted) {
    return <Navigate to="/student/instructions" replace />;
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-[100dvh] bg-[#F7F9FC] flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-6 text-sm text-[#243247] institutional-card-shadow">
          Retrieving assigned question set from Lab Server...
        </div>
      </div>
    );
  }

  const currentRecord = responses[currentQuestion.questionId];
  const selectedOption = currentRecord?.selectedOption || null;
  const isMarkedForReview = Boolean(currentRecord?.markedForReview);

  const handleConfirmFinalSubmit = async () => {
    const ok = await submitFinalExamination('MANUAL');
    if (ok) {
      setIsSubmitModalOpen(false);
      navigate('/student/completion', { replace: true });
    }
  };

  // Strict Full-Screen Anti-Malpractice Security Lockdown Mode
  if (isLocked) {
    return (
      <FullScreenSecurityLockScreen
        lockState={lockState}
        studentName={student.fullName}
        studentUsn={student.usn}
        isVerifying={isVerifying}
        verificationError={verificationError}
        onVerifyPassword={verifyPassword}
      />
    );
  }

  return (
    <div className="min-h-screen lg:h-[100dvh] lg:max-h-[100dvh] bg-[#F7F9FC] flex flex-col justify-between relative overflow-x-hidden select-none font-sans text-[#243247]">
      {/* Resumption Confirmation Toast */}
      {resumptionMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 p-4 rounded-[6px] bg-[#102A43] border border-[#16865B] text-white shadow-lg flex items-center gap-3 animate-in fade-in max-w-md"
        >
          <CheckCircle2 className="w-5 h-5 text-[#16865B] shrink-0" />
          <div className="text-xs font-medium leading-relaxed flex-1">
            {resumptionMessage}
          </div>
          <button
            type="button"
            onClick={dismissResumptionMessage}
            className="text-slate-300 hover:text-white p-1 cursor-pointer transition-colors duration-150"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* AREA A: STANDARDIZED SHARED INSTITUTIONAL HEADER */}
      <InstitutionHeader
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-[#2463B5] text-white font-mono font-bold px-2 py-0.5 rounded text-xs sm:text-[13px] border border-blue-400/40">
              {examSession.subjectCode}
            </span>
            <span className="text-white font-semibold text-sm sm:text-base">
              {examSession.subjectName}
            </span>
            <span className="text-blue-300 hidden sm:inline">·</span>
            <span className="text-blue-200 text-xs sm:text-sm hidden sm:inline">
              {examSession.examinationType}
            </span>
          </div>
        }
        rightSlot={
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <LabConnectionIndicator
              connectionState={labConnectionState}
              pendingCount={pendingQuestionIds.length}
              onRetrySync={retrySyncPendingAnswers}
            />
            <CountdownTimer remainingSeconds={remainingSeconds} />

            {/* Candidate Identity: Student Name and USN next to the Countdown Timer */}
            <div
              className="flex items-center gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] bg-white border border-[#CBD5E1] shadow-xs text-xs sm:text-sm select-none"
              title={`Candidate: ${student.fullName} (${student.usn})`}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[8px] bg-[#102A43] text-white flex items-center justify-center font-bold text-sm uppercase shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="font-bold text-[#102A43] text-sm sm:text-[15px] truncate max-w-[150px] sm:max-w-[210px]">
                  {student.fullName}
                </span>
                <span className="font-mono text-xs sm:text-[13px] font-semibold text-[#2463B5] mt-0.5">
                  {student.usn}
                </span>
              </div>
            </div>
          </div>
        }
      />

      {/* Low-Time / Offline Warning Banner when applicable */}
      {(remainingSeconds <= 180 ||
        labConnectionState === 'TEMPORARILY_DISCONNECTED') && (
        <div className="bg-[#FEF3C7] border-b border-[#B54708]/30 px-6 py-2 shrink-0">
          <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-[#B54708] font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#B54708]" />
              {labConnectionState === 'TEMPORARILY_DISCONNECTED' ? (
                <span>
                  Local LAN connection to the Lab Server is temporarily
                  interrupted. Your answers are preserved in the recovery buffer
                  and will synchronize automatically when connection resumes.
                </span>
              ) : (
                <span>
                  Final Time Warning: Less than 3 minutes remaining. The Lab
                  Server will automatically lock and submit your acknowledged
                  responses when the timer reaches 00:00:00.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE: AREA B (Question Workspace) + AREA C (Question Navigation Panel) */}
      {!currentQuestion || questions.length === 0 ? (
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-10 flex items-center justify-center">
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-8 max-w-lg w-full institutional-card-shadow">
            <EmptyState
              title="No Examination Questions Available"
              description="No question paper has been allocated or loaded from the Lab Server yet for this workstation session."
            />
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col lg:flex-row gap-3 sm:gap-3.5 items-stretch min-h-0 overflow-y-auto">
        {/* AREA B: QUESTION WORKSPACE */}
        <section
          aria-label="Examination Question Workspace"
          className="flex-1 flex flex-col justify-between bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow min-h-0 overflow-hidden"
        >
          {/* Question Metadata Header */}
          <div className="px-4 py-2 border-b border-[#DCE3EC] bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-[#102A43] text-[16px]">
                Question {formatDisplayNumber(currentQuestion.displayNumber)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-[4px] bg-blue-50 border border-blue-200 font-mono font-bold text-[#2463B5]">
                {examSession.subjectCode}
              </span>
              <span className="text-xs font-semibold text-[#102A43] hidden sm:inline">
                {examSession.subjectName}
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-mono">
              <span className="text-[#243247] bg-[#F7F9FC] px-2 py-0.5 rounded-[6px] border border-[#DCE3EC]">
                +1 mark
              </span>
              {examSession.negativeMarkingPerWrong > 0 ? (
                <span className="text-[#B42318] bg-red-50 px-2 py-0.5 rounded-[6px] border border-red-200">
                  -{examSession.negativeMarkingPerWrong} Wrong
                </span>
              ) : (
                <span className="text-[#64748B] bg-[#F7F9FC] px-2 py-0.5 rounded-[6px] border border-[#DCE3EC]">
                  No Negative Marking
                </span>
              )}
            </div>
          </div>

          {/* Question Stem and Options Area */}
          <div className="p-4 sm:p-5 flex-1 space-y-3.5 overflow-y-auto min-h-0">
            {/* Question Text */}
            <div className="text-[15px] sm:text-[16px] leading-[1.6] font-medium text-[#243247] select-none">
              {currentQuestion.questionText}
            </div>

            {/* Optional Code Snippet */}
            {currentQuestion.codeSnippet && (
              <pre className="p-3 bg-[#102A43] text-white rounded-[6px] text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{currentQuestion.codeSnippet}</code>
              </pre>
            )}

            {/* Answer Options */}
            <div
              role="radiogroup"
              aria-label={`Options for Question ${currentQuestion.displayNumber}`}
              className="space-y-2 pt-1"
            >
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOption === option.optionKey;

                return (
                  <button
                    key={option.optionKey}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectOptionForCurrent(option.optionKey as OptionKey)}
                    className={`w-full text-left p-3 rounded-[6px] border transition-colors duration-150 flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-[#2463B5] bg-blue-50/50 ring-1 ring-[#2463B5]'
                        : 'border-[#DCE3EC] bg-white hover:bg-slate-50 hover:border-[#CBD5E1]'
                    }`}
                  >
                    <span
                      className={`shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center font-bold text-xs transition-colors duration-150 ${
                        isSelected
                          ? 'bg-[#2463B5] text-white'
                          : 'bg-[#F7F9FC] text-[#102A43] border border-[#DCE3EC]'
                      }`}
                    >
                      {option.optionKey}
                    </span>
                    <span className="text-[14px] sm:text-[15px] text-[#243247] pt-0.5 leading-snug">
                      {option.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Ribbon: Clear, Mark for Review, Prev, Save & Next */}
          <div className="h-[54px] px-4 border-t border-[#DCE3EC] bg-[#F7F9FC] flex items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCurrentResponse}
                disabled={!selectedOption}
                className="h-[38px] inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#CBD5E1] bg-white hover:bg-slate-50 text-xs font-semibold text-[#243247] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear Response</span>
              </button>

              <button
                type="button"
                onClick={toggleMarkForReviewCurrent}
                className={`h-[38px] inline-flex items-center gap-1.5 px-3 rounded-[6px] border text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  isMarkedForReview
                    ? 'border-[#6D5CE8] bg-[#6D5CE8] text-white'
                    : 'border-[#6D5CE8] bg-purple-50 text-[#6D5CE8] hover:bg-purple-100'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>
                  {isMarkedForReview
                    ? 'Marked for Review'
                    : 'Mark for Review'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="h-[38px] inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#CBD5E1] bg-white hover:bg-slate-50 text-xs font-semibold text-[#243247] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={saveAndNextQuestion}
                className="h-[38px] inline-flex items-center gap-1.5 px-4 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white text-xs font-bold transition-colors duration-150 cursor-pointer"
              >
                <span>
                  {currentQuestionIndex === questions.length - 1
                    ? 'Save & Finish'
                    : 'Save & Next'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* AREA C: QUESTION PALETTE & CANDIDATE SUMMARY SIDEBAR */}
        <aside
          aria-label="Question Navigation and Summary"
          className="w-full lg:w-[316px] xl:w-[328px] shrink-0 flex flex-col gap-2 min-h-0"
        >
          {/* Candidate ID & Version Card */}
          <div className="bg-white border border-[#DCE3EC] rounded-[8px] px-3 py-1.5 institutional-card-shadow shrink-0">
            <div className="flex items-center justify-between pb-1 border-b border-[#DCE3EC]">
              <div>
                <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Authenticated USN</div>
                <div className="font-mono font-bold text-xs sm:text-sm text-[#102A43]">
                  {student.usn}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Candidate Name</div>
                <div className="font-bold text-xs text-[#102A43] truncate max-w-[130px]">
                  {student.fullName}
                </div>
              </div>
            </div>

            <div className="pt-0.5 flex items-center justify-between text-[10px] text-[#64748B]">
              <span>Paper Version:</span>
              <span className="font-semibold text-[#102A43]">
                Version {student.assignedVersion}
              </span>
            </div>
          </div>

          {/* Interactive Question Palette Component */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <QuestionPalette
              questions={questions}
              currentIndex={currentQuestionIndex}
              responses={responses}
              pendingQuestionIds={pendingQuestionIds}
              summary={paletteSummary}
              onSelectQuestion={jumpToQuestionIndex}
            />
          </div>

          {/* Bottom Action: Submit Examination Button, aligned horizontally with Area B's bottom action ribbon */}
          <div className="h-[54px] flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="w-full h-[38px] rounded-[6px] bg-[#16834A] hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#16834A] cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              title="Submit Final Examination"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Examination</span>
            </button>
          </div>
        </aside>
      </main>
      )}

      {/* FOOTER: REAL-TIME ANSWER SAVE STATUS AND SIMULATION CONTROLS */}
      <footer className="bg-white border-t border-[#DCE3EC] px-6 py-2 shrink-0 z-20">
        <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <AnswerSaveStatusBar
            saveStatus={saveAckStatus}
            errorMessage={saveErrorMessage}
            pendingCount={pendingQuestionIds.length}
            lastSavedAt={lastSavedAt}
            onRetry={retrySyncPendingAnswers}
          />

          <div className="flex items-center gap-3 text-[#64748B]">
            <span>Maharaja Institute of Technology Mysore</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">
              ·
            </span>
            <span className="font-mono text-[11px]">
              Session: {examSession.sessionId}
            </span>
          </div>
        </div>
      </footer>

      {/* Submission Confirmation Modal */}
      <SubmissionModal
        isOpen={isSubmitModalOpen}
        summary={paletteSummary}
        pendingSyncCount={pendingQuestionIds.length}
        isSubmitting={isSubmitting}
        errorMessage={saveErrorMessage}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirmSubmit={handleConfirmFinalSubmit}
      />
    </div>
  );
};
