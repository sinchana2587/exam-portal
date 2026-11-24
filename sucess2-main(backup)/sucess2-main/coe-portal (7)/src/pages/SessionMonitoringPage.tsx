import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock,
  Filter,
  Laptop,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { StatusIndicator } from '../components/StatusIndicator';
import { SessionUnlockCredentialPanel } from '../components/SessionUnlockCredentialPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatSemesterLabel } from '../utils/academicSemesters';
import { getApiConfig } from '../services/apiClient';

export type MonitoringSectionId =
  | 'overall-monitoring'
  | 'student-monitoring'
  | 'suspicious-activity'
  | 'pc-recovery';

export const SessionMonitoringPage: React.FC = () => {
  const {
    examinations,
    semesters,
    labServers,
    monitors,
    sessionUnlockCredentials,
    activeSessionId,
    setActiveSessionId,
    setActiveExaminationId,
    refreshAll,
    refreshSessionMonitor,
    notify,
  } = useExaminationStore();

  const [searchParams] = useSearchParams();
  const rawSection = (searchParams.get('section') || '').trim();
  const activeSection = useMemo<MonitoringSectionId>(() => {
    if (rawSection === 'unlocks' || rawSection === 'suspicious-activity') {
      return 'suspicious-activity';
    }
    if (rawSection === 'student-monitoring' || rawSection === 'students') {
      return 'student-monitoring';
    }
    if (rawSection === 'pc-recovery' || rawSection === 'recovery') {
      return 'pc-recovery';
    }
    return 'overall-monitoring';
  }, [rawSection]);

  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');

  const filteredMonitors = useMemo(() => {
    if (semesterFilter === 'ALL') return monitors;
    const semNum = Number(semesterFilter);
    return monitors.filter((m) => m.semester === semNum);
  }, [monitors, semesterFilter]);

  const activeSession = useMemo(() => {
    if (activeSessionId) {
      const match = monitors.find((m) => m.sessionId === activeSessionId);
      if (match) return match;
    }
    return monitors[0] || null;
  }, [monitors, activeSessionId]);

  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [connectionFilter, setConnectionFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const activeSessionContext = useMemo(() => {
    if (!activeSession) return null;
    const exam =
      examinations.find((e) => e.id === activeSession.examinationId) || null;
    const sitting =
      exam?.sittings.find((s) => s.sittingId === activeSession.sessionId) || null;
    const labId = sitting?.labId || activeSession.labId;
    const credential = sitting
      ? sessionUnlockCredentials.find(
          (c) =>
            (String(c.examinationId) === String(activeSession.examinationId) || String((c as any).examination_id) === String(activeSession.examinationId)) &&
            (c.sittingId === sitting.sittingId ||
             c.sittingId === sitting.sittingName ||
             c.sittingName === sitting.sittingName ||
             (c as any).sitting_name === sitting.sittingName ||
             (sitting.sittingName && c.sittingName?.toLowerCase() === sitting.sittingName.toLowerCase()))
        )
      : undefined;
    const labServer =
      (labId ? labServers.find((l) => l.id === labId) : undefined) ||
      labServers.find((l) => l.labName === activeSession.labName);
    return {
      exam,
      sitting,
      credential,
      isLabConnected:
        labServer?.connectionStatus === 'Connected' &&
        activeSession.labServerStatus === 'Connected',
    };
  }, [
    activeSession,
    examinations,
    sessionUnlockCredentials,
    labServers,
  ]);

  const filteredStudents = useMemo(() => {
    if (!activeSession) return [];
    const studentsList = Array.isArray(activeSession.students) ? activeSession.students : [];
    return studentsList.filter((st) => {
      const q = studentSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (st.usn || '').toLowerCase().includes(q) ||
        (st.studentName || '').toLowerCase().includes(q) ||
        (st.currentPcNumber || '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'ALL' || (st.examinationStatus && st.examinationStatus === statusFilter);
      const matchesConnection =
        connectionFilter === 'ALL' || (st.connectionStatus && st.connectionStatus === connectionFilter);
      return matchesQuery && matchesStatus && matchesConnection;
    });
  }, [activeSession, studentSearch, statusFilter, connectionFilter]);

  const normalizedSuspiciousEvents = useMemo(() => {
    if (!activeSession) return [];
    const rawList = Array.isArray(activeSession.suspiciousEvents)
      ? activeSession.suspiciousEvents
      : [];
    return rawList.map((ev: any, idx: number) => {
      const id = String(ev.id || ev.eventId || `sec-evt-${idx}`);
      const usn = String(ev.usn || ev.studentUsn || 'Unknown USN');
      const studentName = String(
        ev.studentName ||
        (Array.isArray(activeSession.students) ? activeSession.students : []).find(
          (s) => s.usn === usn
        )?.studentName ||
        usn
      );
      const pcNumber = String(ev.pcNumber || ev.workstationId || 'PC-01');
      const eventType = String(ev.eventType || 'Security Event');
      const timestamp = String(ev.timestamp || ev.recordedAt || '—');
      const examinationCode = String(
        ev.examinationCode || activeSession.examinationCode || 'EXAM'
      );

      let lockStatusStr = '';
      if (typeof ev.lockStatus === 'string' && ev.lockStatus.trim().length > 0) {
        lockStatusStr = ev.lockStatus;
      } else if (
        ev.resolved === true ||
        (typeof ev.status === 'string' && ev.status.toLowerCase().includes('unlock'))
      ) {
        lockStatusStr = 'Unlocked by Authorised Invigilator';
      } else {
        lockStatusStr = 'Locked - Awaiting Invigilator';
      }

      const isLocked =
        lockStatusStr.toLowerCase().includes('lock') &&
        !lockStatusStr.toLowerCase().includes('unlock');

      return {
        id,
        usn,
        studentName,
        pcNumber,
        eventType,
        timestamp,
        examinationCode,
        lockStatus: lockStatusStr,
        isLocked,
        invigilatorIdentity:
          ev.invigilatorIdentity || (ev.resolved ? 'Authorized Invigilator' : undefined),
        unlockTime: ev.unlockTime || ev.resolvedAt,
        unlockCredentialId: ev.unlockCredentialId,
        unlockCredentialRevision: ev.unlockCredentialRevision,
        unlockReason:
          ev.unlockReason || (ev.resolved ? 'Workstation unlocked by invigilator' : undefined),
      };
    });
  }, [activeSession]);

  const normalizedPcRecoveryEvents = useMemo(() => {
    if (!activeSession) return [];
    const rawList = Array.isArray(activeSession.pcRecoveryEvents)
      ? activeSession.pcRecoveryEvents
      : [];
    return rawList.map((rec: any, idx: number) => ({
      id: String(rec.id || rec.recoveryId || `rec-${idx}`),
      usn: String(rec.usn || rec.studentUsn || 'Unknown USN'),
      studentName: String(rec.studentName || rec.usn || 'Candidate'),
      examinationCode: String(rec.examinationCode || activeSession.examinationCode || 'EXAM'),
      sittingName: String(rec.sittingName || activeSession.sittingName || 'Morning Sitting'),
      oldPcNumber: String(rec.oldPcNumber || rec.sourcePcNumber || 'PC-OLD'),
      newPcNumber: String(rec.newPcNumber || rec.targetPcNumber || 'PC-NEW'),
      labId: rec.labId || activeSession.labId || 'LAB-CSE-01',
      invigilatorIdentity: String(rec.invigilatorIdentity || rec.operatorIdentity || 'Authorized Invigilator'),
      recoveryTokenId: rec.recoveryTokenId,
      timestamp: String(rec.timestamp || rec.recordedAt || '—'),
      reason: String(rec.reason || 'Hardware / OS recovery'),
      previousPcRevoked: rec.previousPcRevoked !== false,
      savedAnswersPreserved: rec.savedAnswersPreserved !== false,
      originalTimerPreserved: rec.originalTimerPreserved !== false,
    }));
  }, [activeSession]);

  const handleRefreshTelemetry = async () => {
    if (!activeSession) return;
    setRefreshing(true);
    try {
      const updated = await refreshSessionMonitor(activeSession.sessionId);
      notify(
        'info',
        'Session Telemetry Refreshed',
        `Synchronized read-only status for ${updated.sessionId} (${updated.lastSyncedAt}).`
      );
    } catch (err) {
      notify(
        'error',
        'Refresh Failed',
        err instanceof Error ? err.message : 'Unable to refresh session telemetry.'
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!activeSession?.sessionId) return;
    const config = getApiConfig();
    const sseUrl = `${config.labApiBaseUrl}/monitoring/stream?sessionId=${encodeURIComponent(activeSession.sessionId)}`;
    let es: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSse = () => {
      try {
        es = new EventSource(sseUrl);
        es.onopen = () => {
          setSseConnected(true);
        };
        es.onerror = () => {
          setSseConnected(false);
          es?.close();
          reconnectTimeout = setTimeout(connectSse, 5000);
        };
        const onEvent = () => {
          refreshSessionMonitor(activeSession.sessionId).catch(() => {});
        };
        es.addEventListener('student_connected', onEvent);
        es.addEventListener('exam_started', onEvent);
        es.addEventListener('student_locked', onEvent);
        es.addEventListener('student_unlocked', onEvent);
        es.addEventListener('pc_recovery', onEvent);
        es.addEventListener('student_submitted', onEvent);
        es.addEventListener('telemetry_update', onEvent);
      } catch {
        setSseConnected(false);
      }
    };

    connectSse();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (es) {
        es.close();
      }
      setSseConnected(false);
    };
  }, [activeSession?.sessionId, refreshSessionMonitor]);

  if (!activeSession) {
    return (
      <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-10 text-center text-sm text-[#64748B] dark:text-slate-400">
        No examination sessions are currently available for monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Persistent Active Session Context Banner */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-mono font-bold text-[#2563EB] dark:text-blue-400">
              {activeSession.sessionId}
            </span>
            <span className="text-lg font-bold text-[#1F2937] dark:text-white">
              {activeSession.subjectCode}: {activeSession.subjectName} (
              {activeSession.sittingName})
            </span>
            <StatusIndicator
              tone={
                activeSession.sessionStatus === 'Active'
                  ? 'success'
                  : activeSession.sessionStatus === 'Ready'
                    ? 'info'
                    : 'neutral'
              }
              label={activeSession.sessionStatus}
            />
          </div>
          <p className="text-sm text-[#64748B] dark:text-slate-400">
            {activeSession.department} &middot; {formatSemesterLabel(activeSession.semester)} &middot; Lab:{' '}
            <strong className="text-[#1F2937] dark:text-slate-200">
              {activeSession.labName}
            </strong>{' '}
            &middot; Date: <span className="font-mono">{activeSession.examDate}</span> &middot;
            Start: <span className="font-mono">{activeSession.startTime}</span> (
            {activeSession.durationMinutes} mins) &middot; Last Synchronized:{' '}
            <span className="font-mono text-[#1F2937] dark:text-slate-200">
              {activeSession.lastSyncedAt}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155] text-sm">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span className="text-[#64748B] dark:text-slate-400">Remaining:</span>
            <strong className="font-mono text-[#1F2937] dark:text-white">
              {activeSession.remainingTime}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleRefreshTelemetry}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ========================================================================
          SECTION 1: OVERALL EXAMINATION MONITORING
         ======================================================================== */}
      {activeSection === 'overall-monitoring' && (
        <ErrorBoundary fallbackTitle="Unable to display Overall Examination Monitoring view">
        <div className="space-y-7">
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
            <div>
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
                Overall Examination Monitoring
              </h1>
              <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5">
                {activeSession.subjectCode} — {activeSession.sittingName} ({activeSession.sessionId})
              </p>
            </div>

            {/* Primary 5 Key Operational Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Students Logged In
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#2563EB] dark:text-blue-400">
                  {activeSession.studentsLoggedIn}
                  <span className="text-base font-normal text-[#64748B] dark:text-slate-400">
                    /{activeSession.totalEligibleStudents}
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Submitted Examination
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#16834A] dark:text-emerald-400">
                  {activeSession.studentsSubmitted}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Not Yet Started
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#B7791F] dark:text-amber-400">
                  {activeSession.studentsNotStarted}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Disconnected Students
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#B42318] dark:text-red-400">
                  {activeSession.disconnectedStudents}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Suspicious / Locked
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#B42318] dark:text-red-400">
                  {activeSession.totalSuspiciousEvents}
                  <span className="text-sm font-normal text-[#64748B] dark:text-slate-400 ml-1.5">
                    ({activeSession.lockedStudentsCount} locked)
                  </span>
                </div>
              </div>
            </div>

            {/* Secondary Lab Connectivity & Recovery Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4 rounded-xl bg-[#F5F7FB]/70 dark:bg-[#0F172A]/40 border border-[#D9E2EF] dark:border-[#334155] text-sm">
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Total Eligible</div>
                <div className="font-mono font-bold text-[#1F2937] dark:text-white mt-0.5">
                  {activeSession.totalEligibleStudents}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Started Exam</div>
                <div className="font-mono font-bold text-[#1F2937] dark:text-white mt-0.5">
                  {activeSession.studentsStarted}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Connected</div>
                <div className="font-mono font-bold text-[#16834A] dark:text-emerald-400 mt-0.5">
                  {activeSession.connectedStudents}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Interrupted</div>
                <div className="font-mono font-bold text-[#B7791F] dark:text-amber-400 mt-0.5">
                  {activeSession.interruptedStudentsCount ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Pending Recovery</div>
                <div className="font-mono font-bold text-[#B42318] dark:text-red-400 mt-0.5">
                  {activeSession.pendingRecoveryCount ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Active Lab PCs</div>
                <div className="font-mono font-bold text-[#1F2937] dark:text-white mt-0.5">
                  {activeSession.activeLabComputers}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Invigilator Unlocks</div>
                <div className="font-mono font-bold text-[#2563EB] dark:text-blue-400 mt-0.5">
                  {activeSession.invigilatorUnlockCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">PC Recoveries</div>
                <div className="font-mono font-bold text-[#6D5CE8] dark:text-violet-400 mt-0.5">
                  {activeSession.pcRecoveryCount}
                </div>
              </div>
            </div>

            {/* Session Switcher Cards with 1st-8th Semester Filter */}
            <div className="pt-5 border-t border-[#D9E2EF] dark:border-[#334155]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                  Examination Sessions ({filteredMonitors.length}
                  {semesterFilter !== 'ALL' ? ` of ${monitors.length}` : ''})
                </h2>

                <div className="flex items-center gap-2.5">
                  <Filter className="w-4 h-4 text-[#64748B] shrink-0" />
                  <select
                    aria-label="Filter monitored examination sessions by semester"
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="px-3.5 py-2 text-sm font-medium rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  >
                    <option value="ALL">All Semesters (1st–8th)</option>
                    {semesters.map((sem) => (
                      <option key={sem.semesterNumber} value={String(sem.semesterNumber)}>
                        {sem.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredMonitors.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 text-center space-y-2.5">
                  <p className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    No monitored sessions found for this semester.
                  </p>
                  <p className="text-sm text-[#64748B] dark:text-slate-400">
                    There are currently no monitored sessions for{' '}
                    {formatSemesterLabel(Number(semesterFilter))}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSemesterFilter('ALL')}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-blue-400 hover:bg-blue-50/40 cursor-pointer"
                  >
                    Show All Semesters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredMonitors.map((session) => {
                    const isSelected = session.sessionId === activeSession.sessionId;
                    return (
                      <button
                        key={session.sessionId}
                        type="button"
                        onClick={() => {
                          setActiveSessionId(session.sessionId);
                          setActiveExaminationId(session.examinationId);
                        }}
                        className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#2563EB]'
                            : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-mono font-bold text-[#2563EB] dark:text-blue-400">
                            {session.sessionId}
                          </span>
                          <StatusIndicator
                            tone={
                              session.sessionStatus === 'Active'
                                ? 'success'
                                : session.sessionStatus === 'Ready'
                                  ? 'info'
                                  : 'neutral'
                            }
                            label={session.sessionStatus}
                          />
                        </div>
                        <div className="text-[17px] font-bold text-[#1F2937] dark:text-slate-100 mt-2">
                          {session.subjectCode} — {session.subjectName}
                        </div>
                        <div className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                          {session.department} &middot;{' '}
                          {formatSemesterLabel(session.semester)} &middot;{' '}
                          {session.sittingName} ({session.startTime})
                        </div>
                        <div className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1">
                          {session.labName} &middot; {session.examDate}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Embedded Invigilator Session Unlock Password Card */}
          {activeSessionContext?.exam && activeSessionContext.sitting && (
            <SessionUnlockCredentialPanel
              examination={activeSessionContext.exam}
              sitting={activeSessionContext.sitting}
              credential={activeSessionContext.credential}
              isLabConnected={activeSessionContext.isLabConnected}
              sessionStatus={activeSession.sessionStatus}
              onRefresh={refreshAll}
              onNotify={notify}
            />
          )}
        </div>
        </ErrorBoundary>
      )}

      {/* ========================================================================
          SECTION 2: INDIVIDUAL STUDENT MONITORING
         ======================================================================== */}
      {activeSection === 'student-monitoring' && (
        <ErrorBoundary fallbackTitle="Unable to display Individual Student Monitoring view">
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
              Individual Student Monitoring ({filteredStudents.length} of{' '}
              {Array.isArray(activeSession.students) ? activeSession.students.length : 0})
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#F5F7FB] dark:bg-[#0F172A]/60 p-4 rounded-xl border border-[#D9E2EF] dark:border-[#334155]">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by Student Name, USN, or Current PC..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100"
              >
                <option value="ALL">All Examination Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Submitted">Submitted</option>
                <option value="Locked (Suspicious Event)">Locked (Suspicious Event)</option>
                <option value="Not Started">Not Started</option>
              </select>
            </div>
            <div>
              <select
                value={connectionFilter}
                onChange={(e) => setConnectionFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100"
              >
                <option value="ALL">All Connection States</option>
                <option value="Connected">Connected</option>
                <option value="Disconnected">Disconnected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F5F7FB] dark:bg-[#0F172A] border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-4">Student Name</th>
                  <th className="py-4 px-4">USN</th>
                  <th className="py-4 px-4">Original Section</th>
                  <th className="py-4 px-4">Current PC</th>
                  <th className="py-4 px-4">Login Status</th>
                  <th className="py-4 px-4">Exam Status</th>
                  <th className="py-4 px-4">Submission</th>
                  <th className="py-4 px-4">Connection</th>
                  <th className="py-4 px-4">Suspicious Events</th>
                  <th className="py-4 px-4">Invigilator Unlock History</th>
                  <th className="py-4 px-4">PC Recovery History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155] text-sm">
                {filteredStudents.map((st) => (
                  <tr
                    key={st.usn}
                    className="hover:bg-[#F5F7FB]/60 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3.5 px-4 font-bold text-[#1F2937] dark:text-slate-100 whitespace-nowrap">
                      {st.studentName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#1F2937] dark:text-slate-200 whitespace-nowrap">
                      {st.usn}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-[#1F2937] dark:text-slate-200">
                        Section {st.originalSection}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {st.currentPcNumber === 'Not Assigned' ||
                      st.workstationBindingStatus === 'Unbound' ? (
                        <span className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                          Not Assigned
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#2563EB] dark:text-blue-400">
                            {st.currentPcNumber}
                          </span>
                          {st.workstationBindingStatus === 'Interrupted' && (
                            <span className="text-[11px] font-semibold text-[#B7791F] dark:text-amber-400">
                              Interrupted
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusIndicator
                        tone={st.loginStatus === 'Logged In' ? 'success' : 'neutral'}
                        label={st.loginStatus}
                      />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusIndicator
                        tone={
                          (st.examinationStatus || '').includes('Progress')
                            ? 'info'
                            : (st.examinationStatus || '').includes('Submit')
                              ? 'success'
                              : (st.examinationStatus || '').includes('Lock')
                                ? 'danger'
                                : 'warning'
                        }
                        label={st.examinationStatus || 'Not Started'}
                      />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusIndicator
                        tone={st.submissionStatus === 'Submitted' ? 'success' : 'neutral'}
                        label={st.submissionStatus}
                      />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusIndicator
                        tone={st.connectionStatus === 'Connected' ? 'success' : 'danger'}
                        label={st.connectionStatus}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center">
                      <span
                        className={
                          st.suspiciousActivityCount > 0
                            ? 'text-[#B42318] dark:text-red-400'
                            : 'text-[#64748B]'
                        }
                      >
                        {st.suspiciousActivityCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[13px] text-[#64748B] dark:text-slate-300 max-w-xs">
                      {Array.isArray(st.invigilatorUnlockHistory) && st.invigilatorUnlockHistory.length > 0
                        ? st.invigilatorUnlockHistory.join('; ')
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-[13px] text-[#64748B] dark:text-slate-300 max-w-xs">
                      {Array.isArray(st.pcRecoveryHistory) && st.pcRecoveryHistory.length > 0
                        ? st.pcRecoveryHistory.join('; ')
                        : '—'}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-10 text-center text-sm text-[#64748B] dark:text-slate-400"
                    >
                      No student records found matching the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </ErrorBoundary>
      )}

      {/* ========================================================================
          SECTION 3: SUSPICIOUS ACTIVITY & INVIGILATOR UNLOCKS
         ======================================================================== */}
      {activeSection === 'suspicious-activity' && (
        <ErrorBoundary fallbackTitle="Unable to display Suspicious Activity & Unlocks view">
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight flex items-center gap-3">
                <ShieldAlert className="w-7 h-7 text-[#B42318]" />
                Suspicious Activity &amp; Invigilator Unlock Log
              </h1>
            </div>

            <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F5F7FB] dark:bg-[#0F172A]/60 border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">Student USN &amp; PC</th>
                    <th className="py-4 px-5">Event Type &amp; Timestamp</th>
                    <th className="py-4 px-5">Lock Status</th>
                    <th className="py-4 px-5">Invigilator Unlock Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155]">
                  {normalizedSuspiciousEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-4 px-5">
                        <div className="font-mono font-bold text-[#1F2937] dark:text-slate-100">
                          {ev.usn}
                        </div>
                        <div className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
                          {ev.studentName} &middot; PC: <strong>{ev.pcNumber}</strong>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-[#B42318] dark:text-red-400">
                          {ev.eventType}
                        </div>
                        <div className="text-[13px] font-mono text-[#64748B] dark:text-slate-400 mt-0.5">
                          {ev.timestamp} ({ev.examinationCode})
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <StatusIndicator
                          tone={ev.isLocked ? 'danger' : 'info'}
                          label={ev.lockStatus}
                        />
                      </td>
                      <td className="py-4 px-5 text-sm text-[#64748B] dark:text-slate-300">
                        {ev.invigilatorIdentity ? (
                          <div>
                            <div className="font-bold text-[#1F2937] dark:text-slate-200">
                              {ev.invigilatorIdentity} {ev.unlockTime ? `(${ev.unlockTime})` : ''}
                            </div>
                            {ev.unlockCredentialId && (
                              <div className="text-xs font-mono text-[#2563EB] dark:text-blue-400 mt-0.5">
                                Credential Ref: {ev.unlockCredentialId}
                                {ev.unlockCredentialRevision
                                  ? ` (Rev ${ev.unlockCredentialRevision})`
                                  : ''}
                              </div>
                            )}
                            {ev.unlockReason && (
                              <div className="text-[13px] mt-0.5">
                                Reason: {ev.unlockReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#B42318] dark:text-red-400 font-semibold">
                            Screen Locked — Awaiting Invigilator
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {normalizedSuspiciousEvents.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-sm text-[#64748B] dark:text-slate-400"
                      >
                        No suspicious activity events recorded for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* ========================================================================
          SECTION 4: INVIGILATOR-ASSISTED PC RECOVERY LOGS
         ======================================================================== */}
      {activeSection === 'pc-recovery' && (
        <ErrorBoundary fallbackTitle="Unable to display PC Recovery Logs view">
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight flex items-center gap-3">
                <Laptop className="w-7 h-7 text-[#6D5CE8]" />
                Invigilator-Assisted PC Recovery Log
              </h1>
            </div>

            <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F5F7FB] dark:bg-[#0F172A]/60 border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">Student &amp; Sitting</th>
                    <th className="py-4 px-5">Original PC &rarr; Replacement PC</th>
                    <th className="py-4 px-5">Authorised Operator &amp; Time</th>
                    <th className="py-4 px-5">Recovery Status, Reason &amp; Preserved State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155]">
                  {normalizedPcRecoveryEvents.map((rec) => (
                    <tr key={rec.id}>
                      <td className="py-4 px-5">
                        <div className="font-bold text-[#1F2937] dark:text-slate-100">
                          {rec.studentName}
                        </div>
                        <div className="font-mono text-xs font-semibold text-[#1F2937] dark:text-slate-200 mt-0.5">
                          {rec.usn}
                        </div>
                        <div className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                          {rec.examinationCode} &middot; {rec.sittingName}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-mono text-base">
                          <span className="line-through text-[#B42318] dark:text-red-400">
                            {rec.oldPcNumber}
                          </span>{' '}
                          &rarr;{' '}
                          <span className="font-bold text-[#16834A] dark:text-emerald-400">
                            {rec.newPcNumber}
                          </span>
                        </div>
                        {rec.labId && (
                          <div className="text-xs font-mono text-[#64748B] dark:text-slate-400 mt-1">
                            Lab: {rec.labId}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-[#1F2937] dark:text-slate-200">
                          {rec.invigilatorIdentity}
                        </div>
                        {rec.recoveryTokenId && (
                          <div className="text-xs font-mono text-[#6D5CE8] dark:text-violet-400 mt-0.5">
                            Recovery Ref: {rec.recoveryTokenId}
                          </div>
                        )}
                        <div className="text-[13px] font-mono text-[#64748B] dark:text-slate-400 mt-0.5">
                          {rec.timestamp}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-sm text-[#64748B] dark:text-slate-300">
                        <div className="mb-1.5">
                          <StatusIndicator
                            tone="success"
                            label="Recovered — Old PC Revoked"
                          />
                        </div>
                        <div className="font-medium text-[#1F2937] dark:text-slate-200">
                          {rec.reason}
                        </div>
                        <div className="text-[13px] text-[#16834A] dark:text-emerald-400 font-semibold mt-1">
                          Saved Answers, Assigned Version &amp; Timer Preserved
                        </div>
                      </td>
                    </tr>
                  ))}
                  {normalizedPcRecoveryEvents.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-sm text-[#64748B] dark:text-slate-400"
                      >
                        No PC recovery events recorded for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
};
