import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ExaminationInstructions,
  ExaminationSessionInfo,
  ExamSubmissionReceipt,
  LabConnectionState,
  OptionKey,
  QuestionPaletteSummary,
  SaveAckStatus,
  SaveAnswerRequest,
  ServerAnswerRecord,
  StudentIdentity,
  StudentLoginRequest,
  StudentQuestion,
} from '../types/examination';
import { studentAuthService } from '../services/studentAuthService';
import { examinationSessionService } from '../services/examinationSessionService';
import { instructionService } from '../services/instructionService';
import { questionService } from '../services/questionService';
import { answerService } from '../services/answerService';
import { timerService } from '../services/timerService';
import { submissionService } from '../services/submissionService';
import { labConnectionService } from '../services/labConnectionService';
import { LabServerApiError } from '../services/apiConfig';
import { computePaletteSummary } from '../utils/examFormatters';
import { emergencyRecoveryService } from '../services/emergencyRecoveryService';

interface ExamSessionContextValue {
  isInitializing: boolean;
  student: StudentIdentity | null;
  examSession: ExaminationSessionInfo | null;
  instructions: ExaminationInstructions | null;
  questions: StudentQuestion[];
  currentQuestionIndex: number;
  currentQuestion: StudentQuestion | null;
  responses: Record<string, ServerAnswerRecord>;
  pendingQuestionIds: string[];
  saveAckStatus: SaveAckStatus;
  saveErrorMessage: string | null;
  lastSavedAt: string | null;
  labConnectionState: LabConnectionState;
  remainingSeconds: number;
  examStarted: boolean;
  instructionsConfirmed: boolean;
  submitted: boolean;
  isSubmitting: boolean;
  submissionReceipt: ExamSubmissionReceipt | null;
  paletteSummary: QuestionPaletteSummary;
  loginStudent: (credentials: StudentLoginRequest) => Promise<void>;
  logoutStudent: () => void;
  loadInstructions: () => Promise<void>;
  confirmAndStartExam: () => Promise<void>;
  selectOptionForCurrent: (option: OptionKey) => Promise<void>;
  clearCurrentResponse: () => Promise<void>;
  toggleMarkForReviewCurrent: () => Promise<void>;
  saveAndNextQuestion: () => Promise<void>;
  goToPreviousQuestion: () => Promise<void>;
  jumpToQuestionIndex: (index: number) => Promise<void>;
  submitFinalExamination: (
    trigger?: 'MANUAL' | 'AUTO_TIMER_EXPIRED'
  ) => Promise<boolean>;
  retrySyncPendingAnswers: () => Promise<void>;
}

const ExamSessionContext = createContext<ExamSessionContextValue | undefined>(
  undefined
);

export const ExamSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const [examSession, setExamSession] = useState<ExaminationSessionInfo | null>(
    null
  );
  const [instructions, setInstructions] =
    useState<ExaminationInstructions | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, ServerAnswerRecord>>(
    {}
  );
  const [pendingQuestionIds, setPendingQuestionIds] = useState<string[]>([]);
  const [saveAckStatus, setSaveAckStatus] = useState<SaveAckStatus>('IDLE');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [labConnectionState, setLabConnectionState] =
    useState<LabConnectionState>('CONNECTED');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(2700);
  const [examStarted, setExamStarted] = useState<boolean>(false);
  const [instructionsConfirmed, setInstructionsConfirmed] =
    useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionReceipt, setSubmissionReceipt] =
    useState<ExamSubmissionReceipt | null>(null);

  const sequenceCounterRef = useRef<number>(1);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
  const syncingRef = useRef<boolean>(false);

  // Recover existing authorized session from Lab Server on browser refresh
  useEffect(() => {
    let mounted = true;
    async function recoverSession() {
      const token = studentAuthService.getActiveSessionToken();
      if (!token) {
        if (mounted) setIsInitializing(false);
        return;
      }

      try {
        const sessionData = await examinationSessionService.fetchCurrentSession();
        if (!mounted) return;

        setStudent(sessionData.student);
        setExamSession(sessionData.examSession);
        setExamStarted(sessionData.examStarted);
        setInstructionsConfirmed(sessionData.instructionsConfirmed);
        setSubmitted(sessionData.submitted);
        if (sessionData.submissionReceipt) {
          setSubmissionReceipt(sessionData.submissionReceipt);
        }

        if (sessionData.examSession.availabilityState === 'ACTIVE' || sessionData.examSession.availabilityState === 'SCHEDULED_WAITING') {
          const instr = await instructionService.fetchInstructions();
          if (mounted) setInstructions(instr);

          if (sessionData.examStarted && !sessionData.submitted) {
            const [paper, runtimeState] = await Promise.all([
              questionService.fetchAssignedQuestionPaper(),
              timerService.fetchAuthoritativeState(),
            ]);
            if (!mounted) return;
            setQuestions(paper.questions);
            setResponses(runtimeState.responses);
            setRemainingSeconds(runtimeState.remainingSeconds);

            // Resume from the exact last saved question
            let lastVisited = 0;
            paper.questions.forEach((q, idx) => {
              if (runtimeState.responses[q.questionId]?.visited) {
                lastVisited = idx;
              }
            });
            setCurrentQuestionIndex(lastVisited);

            const pending = labConnectionService.loadPendingBuffer(
              sessionData.student.usn,
              sessionData.examSession.sessionId
            );
            setPendingQuestionIds(Object.keys(pending));
            if (Object.keys(runtimeState.responses).length > 0) {
              setSaveAckStatus('SAVED');
            }
          } else {
            const durationMins = sessionData.examSession.durationMinutes || 120;
            setRemainingSeconds(durationMins * 60);
          }
        }
      } catch {
        // Session expired or invalid token on Lab Server
        studentAuthService.logout();
      } finally {
        if (mounted) setIsInitializing(false);
      }
    }

    recoverSession();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle real browser online / offline network state changes
  useEffect(() => {
    const handleOnline = () => {
      setLabConnectionState('RECONNECTING');
    };
    const handleOffline = () => {
      setLabConnectionState('TEMPORARILY_DISCONNECTED');
      setSaveAckStatus((prev) =>
        prev === 'SAVING' ? 'CONNECTION_INTERRUPTED' : prev
      );
    };

    const handleUnauthorized = () => {
      logoutStudent();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('mitm:auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('mitm:auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const persistQuestionState = useCallback(
    async (
      questionId: string,
      selectedOption: OptionKey | null,
      markedForReview: boolean,
      visited = true
    ): Promise<boolean> => {
      if (!student || !examSession || submitted) return false;

      const seq = ++sequenceCounterRef.current;

      // Update local UI view of current selection immediately, while explicitly marking saveAckStatus as SAVING
      // (Never falsely display "Saved" before the Lab Server acknowledges)
      setResponses((prev) => ({
        ...prev,
        [questionId]: {
          questionId,
          selectedOption,
          markedForReview,
          visited,
          updatedAt: new Date().toISOString(),
        },
      }));

      const payload: SaveAnswerRequest = {
        examinationId: examSession.examinationId,
        sessionId: examSession.sessionId,
        studentUsn: student.usn,
        questionId,
        selectedOption,
        markedForReview,
        visited,
        assignedVersion: student.assignedVersion,
        clientSequence: seq,
      };

      setSaveAckStatus('SAVING');
      setSaveErrorMessage(null);

      try {
        const ack = await answerService.saveStudentAnswer(payload);
        labConnectionService.removePendingAnswer(
          student.usn,
          examSession.sessionId,
          questionId
        );
        const remainingPending = labConnectionService.loadPendingBuffer(
          student.usn,
          examSession.sessionId
        );
        setPendingQuestionIds(Object.keys(remainingPending));

        setResponses((prev) => ({
          ...prev,
          [questionId]: {
            questionId: ack.questionId,
            selectedOption: ack.selectedOption,
            markedForReview: ack.markedForReview,
            visited: ack.visited,
            updatedAt: ack.savedAt,
          },
        }));
        setRemainingSeconds(ack.remainingSeconds);
        setLastSavedAt(
          new Date(ack.savedAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        setSaveAckStatus('SAVED');
        setLabConnectionState('CONNECTED');
        return true;
      } catch (err) {
        // Buffer unsynchronized answer locally for automatic recovery upon LAN reconnection
        labConnectionService.enqueuePendingAnswer(payload);
        const pending = labConnectionService.loadPendingBuffer(
          student.usn,
          examSession.sessionId
        );
        setPendingQuestionIds(Object.keys(pending));

        if (err instanceof LabServerApiError && err.isNetworkError) {
          setLabConnectionState('TEMPORARILY_DISCONNECTED');
          setSaveAckStatus('CONNECTION_INTERRUPTED');
          setSaveErrorMessage(
            'LAN connection to Lab Server interrupted. Response buffered locally and will synchronize automatically upon reconnection.'
          );
        } else {
          setSaveAckStatus('SAVE_FAILED');
          setSaveErrorMessage(
            err instanceof Error
              ? err.message
              : 'Failed to record response on Lab Server.'
          );
        }
        return false;
      }
    },
    [student, examSession, submitted]
  );

  // Synchronize pending buffered answers safely upon LAN reconnection
  const retrySyncPendingAnswers = useCallback(async () => {
    if (!student || !examSession || submitted || syncingRef.current) return;
    const buffer = labConnectionService.loadPendingBuffer(
      student.usn,
      examSession.sessionId
    );
    const pendingList = Object.values(buffer);

    if (pendingList.length === 0) {
      try {
        const state = await timerService.fetchAuthoritativeState();
        setRemainingSeconds(state.remainingSeconds);
        setLabConnectionState('CONNECTED');
        if (saveAckStatus === 'CONNECTION_INTERRUPTED' || saveAckStatus === 'RECONNECTING') {
          setSaveAckStatus('SAVED');
          setSaveErrorMessage(null);
        }
      } catch {
        setLabConnectionState('TEMPORARILY_DISCONNECTED');
      }
      return;
    }

    syncingRef.current = true;
    setLabConnectionState('SYNCHRONIZING');
    setSaveAckStatus('RECONNECTING');

    let allSucceeded = true;
    for (const item of pendingList) {
      try {
        const ack = await answerService.saveStudentAnswer(item);
        labConnectionService.removePendingAnswer(
          student.usn,
          examSession.sessionId,
          item.questionId
        );
        setResponses((prev) => ({
          ...prev,
          [item.questionId]: {
            questionId: ack.questionId,
            selectedOption: ack.selectedOption,
            markedForReview: ack.markedForReview,
            visited: ack.visited,
            updatedAt: ack.savedAt,
          },
        }));
        setRemainingSeconds(ack.remainingSeconds);
        setLastSavedAt(
          new Date(ack.savedAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch {
        allSucceeded = false;
        break;
      }
    }

    const updatedPending = labConnectionService.loadPendingBuffer(
      student.usn,
      examSession.sessionId
    );
    setPendingQuestionIds(Object.keys(updatedPending));
    syncingRef.current = false;

    if (allSucceeded) {
      setLabConnectionState('CONNECTED');
      setSaveAckStatus('SAVED');
      setSaveErrorMessage(null);
    } else {
      setLabConnectionState('TEMPORARILY_DISCONNECTED');
      setSaveAckStatus('CONNECTION_INTERRUPTED');
    }
  }, [student, examSession, submitted, saveAckStatus]);

  // Trigger automatic sync when LAN recovers or periodically every 5 seconds
  useEffect(() => {
    if (!examStarted || submitted || !student || !examSession) return;

    if (labConnectionState === 'RECONNECTING') {
      retrySyncPendingAnswers();
    }

    const syncInterval = setInterval(async () => {
      const pending = labConnectionService.loadPendingBuffer(
        student.usn,
        examSession.sessionId
      );
      if (Object.keys(pending).length > 0) {
        await retrySyncPendingAnswers();
      } else {
        try {
          const state = await timerService.fetchAuthoritativeState();
          setRemainingSeconds(state.remainingSeconds);
          setLabConnectionState('CONNECTED');
        } catch {
          setLabConnectionState('TEMPORARILY_DISCONNECTED');
        }
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [
    examStarted,
    submitted,
    student,
    examSession,
    labConnectionState,
    retrySyncPendingAnswers,
  ]);

  const submitFinalExamination = useCallback(
    async (
      trigger: 'MANUAL' | 'AUTO_TIMER_EXPIRED' = 'MANUAL'
    ): Promise<boolean> => {
      if (!student || !examSession || isSubmitting || submitted) {
        return false;
      }

      setIsSubmitting(true);
      setLabConnectionState('SUBMISSION_PENDING');

      try {
        // First flush any unsynchronized responses if LAN is reachable
        const buffer = labConnectionService.loadPendingBuffer(
          student.usn,
          examSession.sessionId
        );
        for (const item of Object.values(buffer)) {
          await answerService.saveStudentAnswer(item);
          labConnectionService.removePendingAnswer(
            student.usn,
            examSession.sessionId,
            item.questionId
          );
        }
        setPendingQuestionIds([]);

        const result = await submissionService.submitExamination({
          examinationId: examSession.examinationId,
          sessionId: examSession.sessionId,
          studentUsn: student.usn,
          assignedVersion: student.assignedVersion,
          submissionTrigger: trigger,
        });

        setSubmitted(true);
        setSubmissionReceipt(result.receipt);
        setExamSession((prev) =>
          prev
            ? {
                ...prev,
                availabilityState: 'COMPLETED',
              }
            : null
        );
        setLabConnectionState('CONNECTED');
        setIsSubmitting(false);
        return true;
      } catch (err) {
        setIsSubmitting(false);
        setLabConnectionState('TEMPORARILY_DISCONNECTED');
        setSaveErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to reach Lab Server for final submission. Keep this window open while connection recovers.'
        );
        return false;
      }
    },
    [student, examSession, isSubmitting, submitted]
  );

  // 1-second local countdown tick synchronized with authoritative Lab Server time
  useEffect(() => {
    if (!examStarted || submitted) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (!autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            submitFinalExamination('AUTO_TIMER_EXPIRED');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, submitted, submitFinalExamination]);

  const loginStudent = useCallback(async (credentials: StudentLoginRequest) => {
    const res = await studentAuthService.login(credentials);
    setStudent(res.student);
    setExamSession(res.examSession);

    const sessionState = await examinationSessionService.fetchCurrentSession();
    setExamStarted(sessionState.examStarted);
    setInstructionsConfirmed(sessionState.instructionsConfirmed);
    setSubmitted(sessionState.submitted);
    setSubmissionReceipt(sessionState.submissionReceipt || null);

    if (res.examSession.availabilityState === 'ACTIVE' || res.examSession.availabilityState === 'SCHEDULED_WAITING') {
      const instr = await instructionService.fetchInstructions();
      setInstructions(instr);

      if (sessionState.examStarted && !sessionState.submitted) {
        const [paper, runtime] = await Promise.all([
          questionService.fetchAssignedQuestionPaper(),
          timerService.fetchAuthoritativeState(),
        ]);
        setQuestions(paper.questions);
        setResponses(runtime.responses);
        setRemainingSeconds(runtime.remainingSeconds);

        // Resume from the exact last saved question
        let lastVisited = 0;
        paper.questions.forEach((q, idx) => {
          if (runtime.responses[q.questionId]?.visited) {
            lastVisited = idx;
          }
        });
        setCurrentQuestionIndex(lastVisited);
      } else {
        const durationMins = res.examSession.durationMinutes || 120;
        setRemainingSeconds(durationMins * 60);
      }
    }
  }, []);

  const logoutStudent = useCallback(() => {
    if (student) {
      emergencyRecoveryService.recordStudentExit(student.usn);
    }
    studentAuthService.logout();
    setStudent(null);
    setExamSession(null);
    setInstructions(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setResponses({});
    setPendingQuestionIds([]);
    setSaveAckStatus('IDLE');
    setSaveErrorMessage(null);
    setExamStarted(false);
    setInstructionsConfirmed(false);
    setSubmitted(false);
    setSubmissionReceipt(null);
    autoSubmitTriggeredRef.current = false;
  }, [student]);

  const loadInstructions = useCallback(async () => {
    const instr = await instructionService.fetchInstructions();
    setInstructions(instr);
  }, []);

  const confirmAndStartExam = useCallback(async () => {
    if (!student || !examSession) return;
    const runtimeState = await timerService.startExamination({
      examinationId: examSession.examinationId,
      sessionId: examSession.sessionId,
      studentUsn: student.usn,
      instructionsConfirmed: true,
    });
    const paper = await questionService.fetchAssignedQuestionPaper();

    setInstructionsConfirmed(true);
    setExamStarted(true);
    setQuestions(paper.questions);
    setResponses(runtimeState.responses);
    setRemainingSeconds(runtimeState.remainingSeconds);
    setCurrentQuestionIndex(0);
    setSaveAckStatus('SAVED');
    autoSubmitTriggeredRef.current = false;
  }, [student, examSession]);

  const currentQuestion = useMemo(
    () => questions[currentQuestionIndex] || null,
    [questions, currentQuestionIndex]
  );

  const selectOptionForCurrent = useCallback(
    async (option: OptionKey) => {
      if (!currentQuestion) return;
      const existing = responses[currentQuestion.questionId];
      await persistQuestionState(
        currentQuestion.questionId,
        option,
        existing?.markedForReview ?? false,
        true
      );
    },
    [currentQuestion, responses, persistQuestionState]
  );

  const clearCurrentResponse = useCallback(async () => {
    if (!currentQuestion) return;
    await persistQuestionState(
      currentQuestion.questionId,
      null,
      false,
      true
    );
  }, [currentQuestion, persistQuestionState]);

  const toggleMarkForReviewCurrent = useCallback(async () => {
    if (!currentQuestion) return;
    const existing = responses[currentQuestion.questionId];
    const nextReview = !(existing?.markedForReview ?? false);
    await persistQuestionState(
      currentQuestion.questionId,
      existing?.selectedOption ?? null,
      nextReview,
      true
    );
  }, [currentQuestion, responses, persistQuestionState]);

  const markQuestionVisitedIfNeeded = useCallback(
    async (targetIndex: number) => {
      const targetQ = questions[targetIndex];
      if (!targetQ) return;
      const existing = responses[targetQ.questionId];
      if (!existing || !existing.visited) {
        await persistQuestionState(
          targetQ.questionId,
          existing?.selectedOption ?? null,
          existing?.markedForReview ?? false,
          true
        );
      }
    },
    [questions, responses, persistQuestionState]
  );

  const saveAndNextQuestion = useCallback(async () => {
    if (!currentQuestion) return;
    const existing = responses[currentQuestion.questionId];
    await persistQuestionState(
      currentQuestion.questionId,
      existing?.selectedOption ?? null,
      existing?.markedForReview ?? false,
      true
    );
    const nextIdx =
      currentQuestionIndex < questions.length - 1
        ? currentQuestionIndex + 1
        : 0;
    setCurrentQuestionIndex(nextIdx);
    await markQuestionVisitedIfNeeded(nextIdx);
  }, [
    currentQuestion,
    responses,
    persistQuestionState,
    currentQuestionIndex,
    questions.length,
    markQuestionVisitedIfNeeded,
  ]);

  const goToPreviousQuestion = useCallback(async () => {
    if (currentQuestionIndex <= 0) return;
    const prevIdx = currentQuestionIndex - 1;
    setCurrentQuestionIndex(prevIdx);
    await markQuestionVisitedIfNeeded(prevIdx);
  }, [currentQuestionIndex, markQuestionVisitedIfNeeded]);

  const jumpToQuestionIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= questions.length) return;
      setCurrentQuestionIndex(index);
      await markQuestionVisitedIfNeeded(index);
    },
    [questions.length, markQuestionVisitedIfNeeded]
  );

  const paletteSummary = useMemo(
    () => computePaletteSummary(questions, responses),
    [questions, responses]
  );

  const value = useMemo<ExamSessionContextValue>(
    () => ({
      isInitializing,
      student,
      examSession,
      instructions,
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
      instructionsConfirmed,
      submitted,
      isSubmitting,
      submissionReceipt,
      paletteSummary,
      loginStudent,
      logoutStudent,
      loadInstructions,
      confirmAndStartExam,
      selectOptionForCurrent,
      clearCurrentResponse,
      toggleMarkForReviewCurrent,
      saveAndNextQuestion,
      goToPreviousQuestion,
      jumpToQuestionIndex,
      submitFinalExamination,
      retrySyncPendingAnswers,
    }),
    [
      isInitializing,
      student,
      examSession,
      instructions,
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
      instructionsConfirmed,
      submitted,
      isSubmitting,
      submissionReceipt,
      paletteSummary,
      loginStudent,
      logoutStudent,
      loadInstructions,
      confirmAndStartExam,
      selectOptionForCurrent,
      clearCurrentResponse,
      toggleMarkForReviewCurrent,
      saveAndNextQuestion,
      goToPreviousQuestion,
      jumpToQuestionIndex,
      submitFinalExamination,
      retrySyncPendingAnswers,
    ]
  );

  return (
    <ExamSessionContext.Provider value={value}>
      {children}
    </ExamSessionContext.Provider>
  );
};

export function useExamSession(): ExamSessionContextValue {
  const ctx = useContext(ExamSessionContext);
  if (!ctx) {
    throw new Error('useExamSession must be used within an ExamSessionProvider');
  }
  return ctx;
}
