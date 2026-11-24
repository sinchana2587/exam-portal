/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExaminationSessionInfo,
  ServerAnswerRecord,
  StudentIdentity,
} from '../types/examination';
import {
  SecurityLockState,
  SecurityViolationType,
} from '../types/security';
import { AttemptScope, securityService } from '../services/securityService';

interface UseExaminationSecurityProps {
  enabled: boolean;
  student: StudentIdentity | null;
  examSession: ExaminationSessionInfo | null;
  currentQuestionIndex: number;
  remainingSeconds: number;
  responses: Record<string, ServerAnswerRecord>;
  jumpToQuestionIndex: (index: number) => Promise<void>;
}

export function useExaminationSecurity({
  enabled,
  student,
  examSession,
  currentQuestionIndex,
  remainingSeconds,
  responses,
  jumpToQuestionIndex,
}: UseExaminationSecurityProps) {
  const attemptScope: AttemptScope = useMemo(
    () => ({
      studentUsn: student?.usn,
      examinationId: examSession?.examinationId,
      sittingName: examSession?.sessionSlot || examSession?.sittingName,
    }),
    [student?.usn, examSession?.examinationId, examSession?.sessionSlot, examSession?.sittingName]
  );

  const [lockState, setLockState] = useState<SecurityLockState>(() =>
    securityService.getLockState(attemptScope)
  );

  useEffect(() => {
    if (student?.usn && examSession?.examinationId) {
      setLockState(securityService.getLockState(attemptScope));
    }
  }, [attemptScope, student?.usn, examSession?.examinationId]);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resumptionMessage, setResumptionMessage] = useState<string | null>(null);

  // Keep references to current state so event listeners always access latest values without stale closures
  const stateRef = useRef({
    student,
    examSession,
    currentQuestionIndex,
    remainingSeconds,
    responses,
    isLocked: lockState.isLocked,
  });

  useEffect(() => {
    stateRef.current = {
      student,
      examSession,
      currentQuestionIndex,
      remainingSeconds,
      responses,
      isLocked: lockState.isLocked,
    };
  }, [
    student,
    examSession,
    currentQuestionIndex,
    remainingSeconds,
    responses,
    lockState.isLocked,
  ]);

  const triggerViolation = useCallback(
    (
      violationType: SecurityViolationType,
      label: string,
      description: string
    ) => {
      const {
        student: curStudent,
        examSession: curSession,
        currentQuestionIndex: curQIndex,
        remainingSeconds: curRemSecs,
        responses: curResponses,
        isLocked,
      } = stateRef.current;

      // Ignore if not enabled or already locked or in automated test inspection
      if (
        !enabled ||
        isLocked ||
        !curStudent ||
        !curSession ||
        (typeof window !== 'undefined' &&
          (window as unknown as { __DISABLE_SECURITY_LOCK__?: boolean })
            .__DISABLE_SECURITY_LOCK__)
      ) {
        return;
      }

      const answeredCount = Object.values(curResponses).filter(
        (r) => r.selectedOption !== null && r.selectedOption !== undefined
      ).length;

      const updated = securityService.triggerLockdown({
        violationType,
        label,
        description,
        studentUsn: curStudent.usn,
        studentName: curStudent.fullName,
        examinationId: curSession.examinationId,
        sittingName: curSession.sessionSlot || curSession.sittingName,
        currentQuestionIndex: curQIndex,
        remainingSeconds: curRemSecs,
        answeredCount,
      });

      setLockState(updated);
      setVerificationError(null);
      setResumptionMessage(null);
    },
    [enabled]
  );

  // Attach browser security event listeners
  useEffect(() => {
    if (!enabled || !student || !examSession) return;

    // 1. Tab switch: document.visibilitychange
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation(
          'TAB_SWITCH',
          'Browser Tab Switch',
          'Candidate navigated away from the active examination browser tab.'
        );
      }
    };

    // 2. Window focus lost / minimized: window.blur
    const handleWindowBlur = () => {
      // Small timeout to allow visibilitychange to take precedence if tab switched
      setTimeout(() => {
        if (!stateRef.current.isLocked) {
          triggerViolation(
            'WINDOW_BLUR',
            'Window Focus Lost / Minimized',
            'Candidate window lost focus or was minimized during examination.'
          );
        }
      }, 50);
    };

    // 3. Fullscreen exit: fullscreenchange
    const handleFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        triggerViolation(
          'FULLSCREEN_EXIT',
          'Fullscreen Mode Exited',
          'Candidate exited the mandatory full screen examination environment.'
        );
      }
    };

    // 4. Prohibited keyboard shortcuts: Escape, F11, Alt+Tab, F12, Ctrl+Tab, Devtools, Refresh
    const handleKeyDown = (e: KeyboardEvent) => {
      // Fullscreen exit shortcuts & Window Manipulation keys
      if (
        e.key === 'Escape' ||
        e.key === 'F11' ||
        (e.altKey && (e.key === 'Tab' || e.key === 'F4')) ||
        e.key === 'Meta' ||
        (e.ctrlKey && e.key === 'Escape')
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation(
          'FULLSCREEN_EXIT',
          'Fullscreen Exit / Prohibited Key Shortcut',
          `Candidate pressed prohibited key shortcut (${e.key}) attempting to exit full screen mode.`
        );
        return;
      }

      // F12 or DevTools shortcuts
      if (
        e.key === 'F12' ||
        (e.ctrlKey &&
          e.shiftKey &&
          ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation(
          'DEVTOOLS_ATTEMPT',
          'Developer Tools Inspection',
          'Candidate pressed prohibited developer inspection shortcut.'
        );
        return;
      }

      // Prohibited Tab cycling shortcuts (Ctrl+Tab, Ctrl+Shift+Tab)
      if (
        e.ctrlKey &&
        (e.key === 'Tab' || e.key === 'PageUp' || e.key === 'PageDown')
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation(
          'KEYBOARD_SHORTCUT',
          'Prohibited Tab Navigation Shortcut',
          'Candidate pressed prohibited tab navigation shortcut.'
        );
        return;
      }

      // Prohibited browser window operations (Ctrl+N, Ctrl+T, Ctrl+W)
      if (e.ctrlKey && ['n', 'N', 't', 'T', 'w', 'W'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation(
          'KEYBOARD_SHORTCUT',
          'Browser Window Modification Shortcut',
          'Candidate attempted prohibited browser window shortcut.'
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
        triggerViolation(
          'CLIPBOARD_ACTION',
          `Prohibited Clipboard Shortcut (Ctrl+${e.key.toUpperCase()})`,
          `Candidate attempted prohibited clipboard operation (Ctrl+${e.key.toUpperCase()}). Examination session locked.`
        );
        return;
      }

      // Prohibited reload shortcuts (F5, Ctrl+R)
      if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation(
          'KEYBOARD_SHORTCUT',
          'Manual Page Reload Shortcut',
          'Candidate pressed prohibited page refresh shortcut.'
        );
        return;
      }
    };

    // 5. Context menu (Right-click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerViolation(
        'CONTEXT_MENU',
        'Right-Click Context Menu Prohibited',
        'Candidate attempted to open the browser context menu.'
      );
    };

    // 6. Prohibited copy / paste / cut actions
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation(
        'CLIPBOARD_ACTION',
        'Prohibited Copy Action',
        'Candidate attempted to copy content from the examination screen.'
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation(
        'CLIPBOARD_ACTION',
        'Prohibited Paste Action',
        'Candidate attempted to paste content into the examination interface.'
      );
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation(
        'CLIPBOARD_ACTION',
        'Prohibited Cut Action',
        'Candidate attempted to cut content from the examination screen.'
      );
    };

    // 7. Prohibited tab closure / Window unload
    const handleBeforeUnload = () => {
      triggerViolation(
        'TAB_SWITCH',
        'Examination Window Closed / Navigated Away',
        'Candidate closed the browser tab or navigated away from the active examination window.'
      );
    };

    const handlePageHide = () => {
      triggerViolation(
        'TAB_SWITCH',
        'Examination Window Closed / Navigated Away',
        'Candidate closed the browser tab or navigated away from the active examination window.'
      );
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [enabled, student, examSession, triggerViolation]);

  const verifyPassword = async (enteredPassword: string): Promise<boolean> => {
    if (!student || !examSession) return false;

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const result = await securityService.verifyInvigilatorPassword({
        enteredPassword,
        studentUsn: student.usn,
        studentName: student.fullName,
        examinationId: examSession.examinationId,
        sittingName: examSession.sessionSlot || examSession.sittingName,
      });

      setLockState(result.state);

      if (!result.success) {
        setVerificationError(result.message);
        setIsVerifying(false);
        return false;
      }

      setResumptionMessage(result.message);

      // Return candidate to exact saved question
      if (result.state.savedQuestionIndex >= 0) {
        jumpToQuestionIndex(result.state.savedQuestionIndex).catch(() => {});
      }

      // Re-enter Fullscreen mode upon successful invigilator unlock
      if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement?.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // ignore
        }
      }

      setIsVerifying(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authorization failed.';
      setVerificationError(msg);
      setLockState(securityService.getLockState(attemptScope));
      setIsVerifying(false);
      return false;
    }
  };

  const dismissResumptionMessage = useCallback(() => {
    setResumptionMessage(null);
  }, []);

  return {
    lockState,
    isLocked: lockState.isLocked,
    isVerifying,
    verificationError,
    resumptionMessage,
    triggerViolation,
    verifyPassword,
    dismissResumptionMessage,
  };
}

