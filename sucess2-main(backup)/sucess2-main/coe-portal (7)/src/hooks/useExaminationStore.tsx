import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AcademicSemester,
  AnswerKeyCorrectionRequest,
  AuditLogEntry,
  AuthResponse,
  DepartmentInfo,
  ExaminationResultRecord,
  LabServerNode,
  ScheduledExamination,
  SessionMonitoringData,
  SessionUnlockCredential,
  SubjectInfo,
} from '../types/examination';
import { ACADEMIC_SEMESTERS } from '../utils/academicSemesters';
import { apiClient, ApiError, ApiErrorKind, getApiConfig } from '../services/apiClient';
import { authenticationService } from '../services/authenticationService';
import { credentialService } from '../services/credentialService';
import { examinationService } from '../services/examinationService';
import { sessionService } from '../services/sessionService';
import { resultService } from '../services/resultService';
import { analyticsService } from '../services/analyticsService';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mitm_coe_theme_preference';

export interface StoreDatasetStatus {
  departmentsLoaded: boolean;
  subjectsLoaded: boolean;
  labServersLoaded: boolean;
  examinationsLoaded: boolean;
  monitorsLoaded: boolean;
  correctionsLoaded: boolean;
  resultsLoaded: boolean;
  auditLogsLoaded: boolean;
  unlockCredentialsLoaded: boolean;
}

const INITIAL_DATASET_STATUS: StoreDatasetStatus = {
  departmentsLoaded: false,
  subjectsLoaded: false,
  labServersLoaded: false,
  examinationsLoaded: false,
  monitorsLoaded: false,
  correctionsLoaded: false,
  resultsLoaded: false,
  auditLogsLoaded: false,
  unlockCredentialsLoaded: false,
};

interface ExaminationContextValue {
  authSession: AuthResponse | null;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  loading: boolean;
  error: string | null;
  errorKind: ApiErrorKind | null;
  datasetStatus: StoreDatasetStatus;
  departments: DepartmentInfo[];
  semesters: AcademicSemester[];
  subjects: SubjectInfo[];
  labServers: LabServerNode[];
  examinations: ScheduledExamination[];
  monitors: SessionMonitoringData[];
  correctionRequests: AnswerKeyCorrectionRequest[];
  results: ExaminationResultRecord[];
  auditLogs: AuditLogEntry[];
  sessionUnlockCredentials: SessionUnlockCredential[];
  activeExaminationId: string | null;
  setActiveExaminationId: (id: string | null) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  toasts: ToastNotification[];
  notify: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
  dismissToast: (id: string) => void;
  refreshAll: () => Promise<void>;
  refreshSessionMonitor: (sessionId: string) => Promise<SessionMonitoringData>;
  setAuthSession: (session: AuthResponse | null) => void;
}

const ExaminationContext = createContext<ExaminationContextValue | undefined>(undefined);

export const ExaminationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authSession, setAuthSession] = useState<AuthResponse | null>(() =>
    authenticationService.getCurrentSession()
  );

  // Persistent Light / Dark Theme
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<StoreDatasetStatus>(
    INITIAL_DATASET_STATUS
  );

  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [semesters, setSemesters] = useState<AcademicSemester[]>(() => [
    ...ACADEMIC_SEMESTERS,
  ]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [labServers, setLabServers] = useState<LabServerNode[]>([]);
  const [examinations, setExaminations] = useState<ScheduledExamination[]>([]);
  const [monitors, setMonitors] = useState<SessionMonitoringData[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<AnswerKeyCorrectionRequest[]>([]);
  const [results, setResults] = useState<ExaminationResultRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [sessionUnlockCredentials, setSessionUnlockCredentials] = useState<
    SessionUnlockCredential[]
  >([]);
  const [activeExaminationId, setActiveExaminationId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const clearProtectedState = useCallback(() => {
    setDepartments([]);
    setSubjects([]);
    setLabServers([]);
    setExaminations([]);
    setMonitors([]);
    setCorrectionRequests([]);
    setResults([]);
    setAuditLogs([]);
    setSessionUnlockCredentials([]);
    setActiveExaminationId(null);
    setActiveSessionId(null);
    setDatasetStatus(INITIAL_DATASET_STATUS);
    setError(null);
    setErrorKind(null);
  }, []);

  useEffect(() => {
    apiClient.setOnUnauthorisedHandler(() => {
      clearProtectedState();
      setAuthSession(null);
    });
    return () => {
      apiClient.setOnUnauthorisedHandler(null);
    };
  }, [clearProtectedState]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: 'success' | 'error' | 'info', title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [{ id, type, title, message }, ...prev.slice(0, 3)]);
      setTimeout(() => {
        dismissToast(id);
      }, 5000);
    },
    [dismissToast]
  );

  const refreshAll = useCallback(async () => {
    const current = authenticationService.getCurrentSession();
    if (!current?.authenticated) {
      clearProtectedState();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorKind(null);

    const settled = await Promise.allSettled([
      examinationService.getDepartments(),
      examinationService.getSubjects(),
      examinationService.getLabServers(),
      examinationService.getScheduledExaminations(),
      sessionService.getSessionMonitors(),
      resultService.getAnswerKeyCorrectionRequests(),
      resultService.getExaminationResults(),
      analyticsService.getAuditLogs(),
      credentialService.getSessionUnlockCredentials(),
    ]);

    // Fetch master 1st-8th semester structure non-destructively (does not fail page load if endpoint is pending)
    examinationService
      .getSemesters()
      .then((normalizedSemesters) => {
        setSemesters(normalizedSemesters);
      })
      .catch(() => {
        setSemesters([...ACADEMIC_SEMESTERS]);
      });

    const [
      deptsRes,
      subjsRes,
      labsRes,
      examsRes,
      monitorsRes,
      correctionsRes,
      resultsRes,
      logsRes,
      unlockCredsRes,
    ] = settled;

    const rejections = settled.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    const unauthorisedErr = rejections.find(
      (r) => r.reason instanceof ApiError && r.reason.kind === 'unauthorised'
    );
    if (unauthorisedErr) {
      clearProtectedState();
      setAuthSession(null);
      setLoading(false);
      return;
    }

    setDatasetStatus({
      departmentsLoaded: deptsRes.status === 'fulfilled',
      subjectsLoaded: subjsRes.status === 'fulfilled',
      labServersLoaded: labsRes.status === 'fulfilled',
      examinationsLoaded: examsRes.status === 'fulfilled',
      monitorsLoaded: monitorsRes.status === 'fulfilled',
      correctionsLoaded: correctionsRes.status === 'fulfilled',
      resultsLoaded: resultsRes.status === 'fulfilled',
      auditLogsLoaded: logsRes.status === 'fulfilled',
      unlockCredentialsLoaded: unlockCredsRes.status === 'fulfilled',
    });

    setDepartments(deptsRes.status === 'fulfilled' ? deptsRes.value : []);
    setSubjects(subjsRes.status === 'fulfilled' ? subjsRes.value : []);
    setLabServers(labsRes.status === 'fulfilled' ? labsRes.value : []);
    setExaminations(examsRes.status === 'fulfilled' ? examsRes.value : []);

    if (monitorsRes.status === 'fulfilled') {
      const monitorsData = monitorsRes.value;
      setMonitors(monitorsData);
      setActiveSessionId((prev) =>
        prev && monitorsData.some((m) => m.sessionId === prev)
          ? prev
          : monitorsData[0]?.sessionId || null
      );
    } else {
      setMonitors([]);
    }

    setCorrectionRequests(
      correctionsRes.status === 'fulfilled' ? correctionsRes.value : []
    );
    setResults(resultsRes.status === 'fulfilled' ? resultsRes.value : []);
    setAuditLogs(logsRes.status === 'fulfilled' ? logsRes.value : []);
    setSessionUnlockCredentials(
      unlockCredsRes.status === 'fulfilled' ? unlockCredsRes.value : []
    );

    if (rejections.length > 0) {
      const firstReason = rejections[0].reason;
      if (firstReason instanceof ApiError) {
        setError(firstReason.message);
        setErrorKind(firstReason.kind);
      } else if (firstReason instanceof Error) {
        setError(firstReason.message);
        setErrorKind('network');
      } else {
        setError('Unable to reach backend examination services.');
        setErrorKind('network');
      }
    }

    setLoading(false);
  }, [clearProtectedState]);

  const refreshSessionMonitor = useCallback(async (sessionId: string) => {
    const updated = await sessionService.refreshSessionTelemetry(sessionId);
    setMonitors((prev) =>
      prev.map((m) => (m.sessionId === updated.sessionId ? updated : m))
    );
    return updated;
  }, []);

  useEffect(() => {
    if (!authSession?.authenticated) {
      clearProtectedState();
      setLoading(false);
      return;
    }

    refreshAll();

    const config = getApiConfig();
    const token = authSession.token || '';
    const sseUrl = `${config.centralApiBaseUrl}/events?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      try {
        es = new EventSource(sseUrl);
        
        const handleRealtimeEvent = (data: any) => {
          const type = data?.type || data?.eventType;
          if (!type || type === 'CONNECTED') return;

          // Trigger lightweight REST refresh of store data
          refreshAll().catch(() => {});

          if (type === 'QUESTION_SET_PUBLISHED') {
            notify('info', 'Question Set Published', `${data.subjectCode || 'A subject'} question sets have been published by HOD.`);
          } else if (type === 'KEY_CORRECTION_SUBMITTED') {
            notify('info', 'Dispute Submitted', `A new answer-key correction request was submitted.`);
          } else if (type === 'CREDENTIAL_SYNCED') {
            notify('success', 'Credentials Synced', `Sitting unlock credential was synced to Lab Server.`);
          } else if (type === 'RESULT_PACKAGE_AVAILABLE' || type === 'RESULTS_IMPORTED') {
            notify('info', 'Results Updated', `Signed examination results are ready for review.`);
          }
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRealtimeEvent(data);
          } catch {
            // ping / keepalive
          }
        };

        [
          'QUESTION_SET_PUBLISHED',
          'EXAMINATION_SCHEDULED',
          'EXAMINATION_SCHEDULE_CONFIRMED',
          'EXAMINATION_SET_SELECTED',
          'EXAMINATION_UPDATED',
          'EXAMINATION_CANCELLED',
          'KEY_CORRECTION_SUBMITTED',
          'KEY_CORRECTION_DECIDED',
          'RESULTS_IMPORTED',
          'RESULTS_APPROVED',
          'RESULTS_RELEASED',
          'UNLOCK_CREDENTIAL_UPDATED',
          'CREDENTIAL_SYNCED',
          'SITTING_FINALIZED',
          'RESULT_PACKAGE_AVAILABLE',
          'STUDENT_LOGIN',
          'STUDENT_SUBMITTED'
        ].forEach((evtName) => {
          es?.addEventListener(evtName, (event: any) => {
            try {
              const data = JSON.parse(event.data);
              handleRealtimeEvent(data);
            } catch {
              refreshAll().catch(() => {});
            }
          });
        });

        es.onerror = () => {
          es?.close();
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        // fail gracefully
      }
    };

    connectSSE();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (es) es.close();
    };
  }, [authSession?.authenticated, authSession?.token, refreshAll, clearProtectedState, notify]);

  return (
    <ExaminationContext.Provider
      value={{
        authSession,
        theme,
        setTheme,
        loading,
        error,
        errorKind,
        datasetStatus,
        departments,
        semesters,
        subjects,
        labServers,
        examinations,
        monitors,
        correctionRequests,
        results,
        auditLogs,
        sessionUnlockCredentials,
        activeExaminationId,
        setActiveExaminationId,
        activeSessionId,
        setActiveSessionId,
        toasts,
        notify,
        dismissToast,
        refreshAll,
        refreshSessionMonitor,
        setAuthSession,
      }}
    >
      {children}
    </ExaminationContext.Provider>
  );
};

export function useExaminationStore(): ExaminationContextValue {
  const ctx = useContext(ExaminationContext);
  if (!ctx) {
    throw new Error('useExaminationStore must be used within an ExaminationProvider');
  }
  return ctx;
}
