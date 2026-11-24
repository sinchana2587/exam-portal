import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Loader2,
  Monitor,
  ShieldCheck,
  ZapOff,
} from 'lucide-react';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import { LabConnectionIndicator } from '../../components/ConnectionStatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useExamSession } from '../../hooks/useExamSession';
import { emergencyRecoveryService } from '../../services/emergencyRecoveryService';
import { API_MODE } from '../../services/apiConfig';
import { AttemptScope, securityService } from '../../services/securityService';
import { SecurityLockState, SecurityViolationType } from '../../types/security';
import { FullScreenSecurityLockScreen } from '../../components/security/FullScreenSecurityLockScreen';

export const ExamInstructionsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    student,
    examSession,
    instructions,
    examStarted,
    submitted,
    labConnectionState,
    loadInstructions,
    confirmAndStartExam,
    logoutStudent,
  } = useExamSession();

  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const attemptScope: AttemptScope = useMemo(
    () => ({
      studentUsn: student?.usn,
      examinationId: examSession?.examinationId,
      sittingName: examSession?.sessionSlot || examSession?.sittingName,
    }),
    [student?.usn, examSession?.examinationId, examSession?.sessionSlot, examSession?.sittingName]
  );

  // Full Screen Security Lockdown State scoped to current examination attempt
  const [lockState, setLockState] = useState<SecurityLockState>(() =>
    securityService.getLockState(attemptScope)
  );
  const [isVerifyingLock, setIsVerifyingLock] = useState<boolean>(false);
  const [lockVerificationError, setLockVerificationError] = useState<string | null>(null);

  useEffect(() => {
    if (student?.usn && examSession?.examinationId) {
      setLockState(securityService.getLockState(attemptScope));
    }
  }, [attemptScope, student?.usn, examSession?.examinationId]);

  // Attempt to enter fullscreen upon mounting instructions page if not already in fullscreen
  useEffect(() => {
    if (
      typeof document !== 'undefined' &&
      !document.fullscreenElement &&
      document.documentElement?.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(() => {
        // User gesture may be required; handled when user clicks start or interacts
      });
    }
  }, []);

  // Monitor Fullscreen Exit and Prohibited Shortcuts on Instructions Page
  useEffect(() => {
    if (!student || !examSession) return;

    const triggerInstructionLock = (
      violationType: SecurityViolationType,
      label: string,
      description: string
    ) => {
      const updated = securityService.triggerLockdown({
        violationType,
        label,
        description,
        studentUsn: student.usn,
        studentName: student.fullName,
        examinationId: examSession.examinationId,
        sittingName: examSession.sessionSlot || examSession.sittingName,
        currentQuestionIndex: 0,
        remainingSeconds: (examSession.durationMinutes || 120) * 60,
        answeredCount: 0,
      });
      setLockState(updated);
      setLockVerificationError(null);
    };

    // 1. Detect Fullscreen Exit
    const handleFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        triggerInstructionLock(
          'FULLSCREEN_EXIT',
          'Fullscreen Mode Exited',
          'Candidate exited the mandatory full screen examination environment on instructions page.'
        );
      }
    };

    // 2. Detect Tab Switch / Hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerInstructionLock(
          'TAB_SWITCH',
          'Browser Tab Switch',
          'Candidate navigated away from the instructions window.'
        );
      }
    };

    // 3. Prohibited key shortcuts (Escape, F11, Alt+Tab, Meta, Ctrl+Escape, Devtools, Clipboard)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Fullscreen exit & Window manipulation
      if (
        e.key === 'Escape' ||
        e.key === 'F11' ||
        (e.altKey && (e.key === 'Tab' || e.key === 'F4')) ||
        e.key === 'Meta' ||
        (e.ctrlKey && e.key === 'Escape')
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerInstructionLock(
          'FULLSCREEN_EXIT',
          'Fullscreen Exit / Prohibited Key Shortcut',
          `Candidate pressed prohibited key (${e.key}) to exit full screen mode.`
        );
        return;
      }

      // DevTools & Page Inspection
      if (
        e.key === 'F12' ||
        (e.ctrlKey &&
          e.shiftKey &&
          ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerInstructionLock(
          'DEVTOOLS_ATTEMPT',
          'Developer Tools Inspection',
          'Candidate pressed prohibited developer inspection shortcut.'
        );
        return;
      }

      // Prohibited clipboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A)
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'C', 'v', 'V', 'x', 'X', 'a', 'A'].includes(e.key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerInstructionLock(
          'CLIPBOARD_ACTION',
          `Prohibited Clipboard Shortcut (Ctrl+${e.key.toUpperCase()})`,
          `Candidate attempted prohibited clipboard operation (Ctrl+${e.key.toUpperCase()}). Examination session locked.`
        );
        return;
      }
    };

    // 4. Context menu (Right-click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerInstructionLock(
        'CONTEXT_MENU',
        'Right-Click Context Menu Prohibited',
        'Candidate attempted to open the browser context menu.'
      );
    };

    // 5. Prohibited copy / paste / cut actions
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerInstructionLock(
        'CLIPBOARD_ACTION',
        'Prohibited Copy Action',
        'Candidate attempted to copy content from the instructions screen.'
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerInstructionLock(
        'CLIPBOARD_ACTION',
        'Prohibited Paste Action',
        'Candidate attempted to paste content into the instructions interface.'
      );
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerInstructionLock(
        'CLIPBOARD_ACTION',
        'Prohibited Cut Action',
        'Candidate attempted to cut content from the instructions screen.'
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
    };
  }, [student, examSession]);

  // If tab is closed or navigated away before exam is started, trigger crash interruption
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (student && !examStarted) {
        emergencyRecoveryService.simulateCrash(student.usn);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [student, examStarted]);

  useEffect(() => {
    if (
      student &&
      (examSession?.availabilityState === 'ACTIVE' || examSession?.availabilityState === 'SCHEDULED_WAITING') &&
      !instructions
    ) {
      loadInstructions().catch((err) => {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Unable to load examination instructions from Lab Server.'
        );
      });
    }
  }, [student, examSession, instructions, loadInstructions]);

  if (!student || !examSession) {
    return <Navigate to="/student/login" replace />;
  }

  if (submitted || examSession.availabilityState === 'COMPLETED') {
    return <Navigate to="/student/completion" replace />;
  }

  if (examSession.availabilityState !== 'ACTIVE' && examSession.availabilityState !== 'SCHEDULED_WAITING') {
    return <Navigate to="/student/login" replace />;
  }

  if (examStarted) {
    return <Navigate to="/student/examination" replace />;
  }

  // Strict Full-Screen Lockdown on Instructions Page
  if (lockState.isLocked) {
    return (
      <FullScreenSecurityLockScreen
        lockState={lockState}
        studentName={student.fullName}
        studentUsn={student.usn}
        isVerifying={isVerifyingLock}
        verificationError={lockVerificationError}
        onVerifyPassword={async (pwd) => {
          setIsVerifyingLock(true);
          setLockVerificationError(null);
          try {
            const res = await securityService.verifyInvigilatorPassword({
              enteredPassword: pwd,
              studentUsn: student.usn,
              studentName: student.fullName,
              examinationId: examSession.examinationId,
              sittingName: examSession.sessionSlot || examSession.sittingName,
            });
            setIsVerifyingLock(false);
            if (!res.success) {
              setLockVerificationError(res.message);
              return false;
            }
            // Unlock and re-enter fullscreen
            if (
              typeof document !== 'undefined' &&
              !document.fullscreenElement &&
              document.documentElement?.requestFullscreen
            ) {
              try {
                await document.documentElement.requestFullscreen();
              } catch {
                // Ignore
              }
            }
            setLockState(securityService.getLockState(attemptScope));
            return true;
          } catch (err) {
            setIsVerifyingLock(false);
            setLockVerificationError(
              err instanceof Error ? err.message : 'Invalid invigilator authorization.'
            );
            return false;
          }
        }}
      />
    );
  }

  const handleStartExam = async () => {
    if (!acknowledged) {
      setErrorMsg(
        'Please confirm that you have read and understood the examination instructions before starting.'
      );
      return;
    }

    // Request full-screen mode immediately on user click gesture (non-blocking)
    if (
      typeof document !== 'undefined' &&
      !document.fullscreenElement &&
      document.documentElement?.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    setErrorMsg(null);
    setIsStarting(true);
    try {
      await confirmAndStartExam();
      navigate('/student/examination', { replace: true });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to start examination session on Lab Server.'
      );
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-[#F7F9FC] overflow-y-auto select-none">
      {/* Standard Shared Institutional Header */}
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
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <div className="text-[#243247] bg-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] border border-[#CBD5E1] shadow-xs hidden sm:flex items-center gap-2.5">
              <span className="text-[#64748B] font-semibold text-xs sm:text-sm">Candidate:</span>{' '}
              <span className="font-bold text-[#102A43] text-sm sm:text-[15px]">
                {student.fullName}
              </span>{' '}
              <span className="font-mono font-bold text-xs sm:text-[13px] text-[#2463B5]">({student.usn})</span>
            </div>
            <LabConnectionIndicator connectionState={labConnectionState} />
          </div>
        }
      />

      {/* Main Instructions Content - Fully Responsive & Scrollable on Any Screen */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-4 flex flex-col justify-center space-y-4">
        {/* Detailed Instruction Sections */}
        {errorMsg && !instructions ? (
          <ErrorState
            title="Failed to Load Instructions"
            message={errorMsg}
            onRetry={() => {
              setErrorMsg(null);
              loadInstructions().catch((err) => {
                setErrorMsg(
                  err instanceof Error
                    ? err.message
                    : 'Unable to load examination instructions from Lab Server.'
                );
              });
            }}
          />
        ) : !instructions ? (
          <LoadingState
            message="Fetching Examination Rules &amp; Instructions..."
            subMessage="Connecting to Maharaja Institute of Technology Mysore Lab Server"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. General Rules & Security */}
            <section className="bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#102A43] font-bold text-[16px] border-b border-[#DCE3EC] pb-2">
                <BookOpen className="w-4 h-4 text-[#2463B5]" />
                <h2>General Rules &amp; Security</h2>
              </div>
              <ul className="space-y-2 text-xs sm:text-[13px] text-[#243247] leading-relaxed list-disc pl-4 text-left">
                <li>The exam consists of {examSession.totalQuestions} Multiple Choice Questions.</li>
                <li>
                  <strong className="text-[#B42318] font-bold bg-red-50 px-1 py-0.5 rounded-[4px] border border-red-200">
                    Strict Monitoring:
                  </strong>{' '}
                  Do not switch browser tabs, minimize the window, or open other applications. The system logs navigation away from the exam screen and may issue an automatic warning or lock your session.
                </li>
                <li>Do not disconnect network cables during the active examination.</li>
              </ul>
            </section>

            {/* 2. Question Navigation */}
            <section className="bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#102A43] font-bold text-[16px] border-b border-[#DCE3EC] pb-2">
                <Monitor className="w-4 h-4 text-[#2463B5]" />
                <h2>Question Navigation</h2>
              </div>
              <ul className="space-y-2 text-xs sm:text-[13px] text-[#243247] leading-relaxed list-disc pl-4 text-left">
                <li>Use &quot;Previous&quot; and &quot;Save &amp; Next&quot; to move sequentially between questions.</li>
                <li>Click any number on the right-side Question Palette to jump directly to that specific question.</li>
              </ul>
            </section>

            {/* 3. Answering & Reviewing */}
            <section className="bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#102A43] font-bold text-[16px] border-b border-[#DCE3EC] pb-2">
                <FileText className="w-4 h-4 text-[#2463B5]" />
                <h2>Answering &amp; Reviewing</h2>
              </div>
              <ul className="space-y-2 text-xs sm:text-[13px] text-[#243247] leading-relaxed list-disc pl-4 text-left">
                <li>Click an option card to select your response.</li>
                <li>Use &quot;Clear Response&quot; to remove your answer entirely.</li>
                <li>
                  <strong className="text-[#B54708] font-bold bg-amber-50 px-1 py-0.5 rounded-[4px] border border-amber-200">
                    Note:
                  </strong>{' '}
                  Questions marked as &quot;Answered &amp; Marked for Review&quot; <strong className="font-semibold text-[#102A43]">WILL be evaluated and graded</strong> upon final submission.
                </li>
              </ul>
            </section>

            {/* 4. Submission & Timer */}
            <section className="bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#102A43] font-bold text-[16px] border-b border-[#DCE3EC] pb-2">
                <Clock className="w-4 h-4 text-[#2463B5]" />
                <h2>Submission &amp; Timer</h2>
              </div>
              <ul className="space-y-2 text-xs sm:text-[13px] text-[#243247] leading-relaxed list-disc pl-4 text-left">
                <li>
                  The exam will <strong className="font-semibold text-[#102A43]">automatically lock and submit</strong> when the top countdown timer reaches <span className="font-mono font-bold text-[#B42318] bg-red-50 px-1 py-0.5 rounded-[4px] border border-red-200">00:00:00</span>.
                </li>
                <li>
                  To finish early, click &quot;Submit Examination&quot; in the Question Palette and <strong className="font-semibold text-[#102A43]">confirm your final submission</strong> on the summary screen.
                </li>
              </ul>
            </section>
          </div>
        )}

        {/* Candidate Confirmation & Start Examination Card */}
        <div className="bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow p-4 sm:p-5">
          {errorMsg && (
            <div
              className="p-3 mb-3 rounded-[6px] bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-[#B42318]"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
            <label
              htmlFor="confirm-instructions-checkbox"
              className="flex items-start gap-3 p-3.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] cursor-pointer select-none flex-1"
            >
              <input
                id="confirm-instructions-checkbox"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => {
                  setAcknowledged(e.target.checked);
                  if (errorMsg) setErrorMsg(null);
                  if (
                    e.target.checked &&
                    typeof document !== 'undefined' &&
                    !document.fullscreenElement &&
                    document.documentElement?.requestFullscreen
                  ) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded-[4px] border-[#CBD5E1] text-[#2463B5] focus:ring-[#2463B5] cursor-pointer"
              />
              <div className="text-xs sm:text-sm text-[#243247]">
                <span className="font-semibold text-[#102A43]">
                  I have read and understood the examination instructions.
                </span>
                <p className="text-xs text-[#64748B] mt-0.5">
                  I confirm that I am the authenticated candidate ({student.usn} –{' '}
                  {student.fullName}) and I agree to abide by the MIT
                  Mysore examination regulations.
                </p>
              </div>
            </label>

            <button
              type="button"
              onClick={handleStartExam}
              disabled={!acknowledged || isStarting}
              className="h-[44px] inline-flex items-center justify-center gap-2 px-6 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white text-[14px] font-bold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initializing Workstation Session...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Start Examination</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-[#DCE3EC] py-2.5 text-xs text-[#64748B]">
        <div className="max-w-[1240px] w-full mx-auto px-6 flex flex-wrap items-center justify-between gap-2">
          <span>Maharaja Institute of Technology Mysore</span>
          <span>
            Session ID: {examSession.sessionId} · Assigned Paper:{' '}
            {examSession.selectedPaperLabel} (Version {student.assignedVersion})
          </span>
        </div>
      </footer>
    </div>
  );
};
