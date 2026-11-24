import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  KeyRound,
  Send,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { StatusIndicator } from '../components/StatusIndicator';
import {
  getExaminationStatusSummary,
  getSittingPackageReadinessStatus,
} from '../utils/examinationStatus';

function getTodayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    loading,
    error,
    datasetStatus,
    examinations,
    monitors,
    results,
    correctionRequests,
    setActiveExaminationId,
    setActiveSessionId,
  } = useExaminationStore();

  const todayIso = getTodayLocalIso();

  // 1. Upcoming Examinations (future scheduled sittings, excluding Exam Completed and Cancelled)
  const upcomingExams = (examinations || []).filter((e) => {
    const summary = getExaminationStatusSummary(
      e,
      monitors,
      results,
      correctionRequests
    );
    return (
      summary.lifecycleStatus !== 'Exam Completed' &&
      summary.lifecycleStatus !== 'Cancelled' &&
      (e.examDate > todayIso || (e.sittings || []).some((s) => s.examDate > todayIso))
    );
  });

  // 2. Examination Sessions In Progress (strictly running Active sessions)
  const activeSessions = (monitors || []).filter((m) => m?.sessionStatus === 'Active');

  // 3. Examination Packages Pending Transfer (exclude Exam Completed / Cancelled exams)
  const pendingTransferPackages = (examinations || [])
    .filter((exam) => {
      const summary = getExaminationStatusSummary(
        exam,
        monitors,
        results,
        correctionRequests
      );
      return (
        summary.lifecycleStatus !== 'Exam Completed' &&
        summary.lifecycleStatus !== 'Cancelled'
      );
    })
    .flatMap((exam) =>
      (exam?.sittings || [])
        .filter(
          (s) =>
            getSittingPackageReadinessStatus(s?.packageInfo) !==
            'Ready for Examination'
        )
        .map((sitting) => ({
          exam,
          sitting,
        }))
    );

  // 4. Results Awaiting Approval
  const pendingResults = results.filter(
    (r) => r.approvalStatus === 'Pending Approval'
  );

  // 5. Answer-Key Correction Requests Pending Review
  const pendingCorrections = correctionRequests.filter(
    (c) => c.status === 'Pending Review'
  );

  // Today's Examination Sessions (strictly today's examDate)
  const todaysSessions = monitors.filter((m) => m.examDate === todayIso);

  const summaryCards = [
    {
      id: 'upcoming-exams',
      label: 'Upcoming Examinations',
      value: upcomingExams.length,
      available: datasetStatus.examinationsLoaded,
      subtitle: 'Scheduled by Department, Semester & Subject',
      icon: CalendarClock,
      accentColor: 'text-[#2563EB] dark:text-blue-400',
      borderAccent: 'border-l-4 border-l-[#2563EB]',
      onClick: () => navigate('/schedule?section=examination-details'),
    },
    {
      id: 'active-sessions',
      label: 'Examination Sessions In Progress',
      value: activeSessions.length,
      available: datasetStatus.monitorsLoaded,
      subtitle: 'Live laboratory sessions running now',
      icon: Activity,
      accentColor: 'text-[#16834A] dark:text-emerald-400',
      borderAccent: 'border-l-4 border-l-[#16834A]',
      onClick: () => navigate('/monitoring?section=overall-monitoring'),
    },
    {
      id: 'packages-pending',
      label: 'Examination Packages Pending Transfer',
      value: pendingTransferPackages.length,
      available: datasetStatus.examinationsLoaded,
      subtitle: 'Awaiting preparation or Lab Server transfer',
      icon: Send,
      accentColor: 'text-[#6D5CE8] dark:text-violet-400',
      borderAccent: 'border-l-4 border-l-[#6D5CE8]',
      onClick: () => {
        if (pendingTransferPackages[0]) {
          setActiveExaminationId(pendingTransferPackages[0].exam.id);
        }
        navigate('/schedule?section=package-transfer');
      },
    },
    {
      id: 'results-pending',
      label: 'Results Pending Approval',
      value: pendingResults.length,
      available: datasetStatus.resultsLoaded,
      subtitle: 'Awaiting COE verification & release',
      icon: ClipboardCheck,
      accentColor: 'text-[#B7791F] dark:text-amber-400',
      borderAccent: 'border-l-4 border-l-[#B7791F]',
      onClick: () => {
        if (pendingResults[0]) {
          setActiveExaminationId(pendingResults[0].examinationId);
        }
        navigate('/results/approval?section=result-overview');
      },
    },
    {
      id: 'corrections-pending',
      label: 'Answer-Key Correction Requests Pending Review',
      value: pendingCorrections.length,
      available: datasetStatus.correctionsLoaded,
      subtitle: 'Submitted by HODs before result release',
      icon: KeyRound,
      accentColor: 'text-[#B42318] dark:text-red-400',
      borderAccent: 'border-l-4 border-l-[#B42318]',
      onClick: () => {
        if (pendingCorrections[0]) {
          setActiveExaminationId(pendingCorrections[0].examinationId);
        }
        navigate('/results/approval?section=answer-key-corrections');
      },
    },
  ];

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Ready':
        return 'info';
      case 'Completed':
        return 'neutral';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-8">
      {/* Main Page Header (26–28px Heading) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs">
        <div>
          <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
            COE Operational Overview
          </h1>
          <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5 leading-relaxed">
            Immediate examination status, today&apos;s sitting schedules, and pending Controller of Examinations actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/schedule?section=examination-details')}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
          >
            Schedule Examination
          </button>
          <button
            type="button"
            onClick={() => navigate('/monitoring?section=overall-monitoring')}
            className="px-4 py-2.5 text-sm font-semibold text-[#1F2937] dark:text-slate-200 bg-[#F5F7FB] dark:bg-[#0F172A] hover:bg-slate-200 dark:hover:bg-slate-800 border border-[#D9E2EF] dark:border-[#334155] rounded-lg transition-colors cursor-pointer"
          >
            Monitor Sessions
          </button>
        </div>
      </div>

      {/* 5 Summary Cards ONLY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              className={`text-left bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] ${card.borderAccent} rounded-xl p-5 shadow-xs hover:shadow-md hover:border-[#2563EB]/50 transition-all cursor-pointer group flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-[#1F2937] dark:text-slate-200 leading-snug">
                    {card.label}
                  </span>
                  <Icon className={`w-5 h-5 shrink-0 ${card.accentColor}`} />
                </div>
                <div className="mt-4 text-3xl font-bold text-[#1F2937] dark:text-white font-mono">
                  {card.available ? card.value : '—'}
                </div>
                {!card.available && (
                  <div className="mt-1 text-xs font-medium text-[#B42318] dark:text-red-300">
                    {loading
                      ? 'Loading from backend...'
                      : error
                        ? 'Backend data unavailable'
                        : 'Awaiting backend response'}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-[#D9E2EF]/60 dark:border-[#334155] flex items-center justify-between text-[13px] text-[#64748B] dark:text-slate-400">
                <span className="leading-snug">{card.subtitle}</span>
                <ArrowRight className="w-4 h-4 shrink-0 ml-2 text-[#2563EB] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Today's Examination Sessions (Full Spacious Section) */}
      <section className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-[#D9E2EF] dark:border-[#334155] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100 leading-snug">
              Today&apos;s Examination Sessions
            </h2>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
              Click any session row to open live session monitoring or sitting details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/monitoring?section=overall-monitoring')}
            className="text-sm font-semibold text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            Open Session Monitoring
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F7FB] dark:bg-[#0F172A]/60 border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-5">Department &amp; Sem</th>
                <th className="py-4 px-5">Subject</th>
                <th className="py-4 px-5">Sitting</th>
                <th className="py-4 px-5">Start Time</th>
                <th className="py-4 px-5">Duration</th>
                <th className="py-4 px-5">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155] text-sm">
              {todaysSessions.map((session) => (
                <tr
                  key={session.sessionId}
                  onClick={() => {
                    setActiveSessionId(session.sessionId);
                    setActiveExaminationId(session.examinationId);
                    navigate('/monitoring?section=overall-monitoring');
                  }}
                  className="hover:bg-[#F5F7FB] dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <td className="py-4 px-5 font-semibold text-[#1F2937] dark:text-slate-200 whitespace-nowrap">
                    {session.department} &middot; Semester {session.semester}
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-bold text-[#1F2937] dark:text-slate-100">
                      {session.subjectName}
                    </div>
                    <div className="text-[13px] text-[#64748B] dark:text-slate-400 font-mono mt-0.5">
                      {session.subjectCode} &middot; {session.labName}
                    </div>
                  </td>
                  <td className="py-4 px-5 font-medium text-[#1F2937] dark:text-slate-200 whitespace-nowrap">
                    {session.sittingName}
                  </td>
                  <td className="py-4 px-5 font-mono text-[#1F2937] dark:text-slate-200 whitespace-nowrap">
                    {session.startTime}
                  </td>
                  <td className="py-4 px-5 font-mono text-[#64748B] dark:text-slate-300 whitespace-nowrap">
                    {session.durationMinutes} mins
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap">
                    <StatusIndicator
                      tone={getStatusTone(session.sessionStatus)}
                      label={
                        session.sessionStatus === 'Active'
                          ? 'In Progress'
                          : session.sessionStatus === 'Completed'
                            ? 'Exam Completed'
                            : 'Scheduled'
                      }
                    />
                  </td>
                </tr>
              ))}
              {todaysSessions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-[#64748B] dark:text-slate-400"
                  >
                    {!datasetStatus.monitorsLoaded
                      ? loading
                        ? "Loading today's examination sessions from backend..."
                        : "Unable to load today's examination sessions because the Lab Server / monitoring backend did not respond."
                      : 'No examination sessions are scheduled for today.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending COE Actions (Spacious Section) */}
      <section className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-[#D9E2EF] dark:border-[#334155]">
          <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100 leading-snug">
            Pending COE Actions
          </h2>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Immediate tasks requiring Controller of Examinations action or approval.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* 1. Packages waiting to be sent to Lab Server */}
          {pendingTransferPackages.map(({ exam, sitting }) => (
            <button
              key={`${exam.id}-${sitting.sittingId}`}
              type="button"
              onClick={() => {
                setActiveExaminationId(exam.id);
                navigate('/schedule?section=package-transfer');
              }}
              className="w-full text-left p-5 rounded-xl border border-[#D9E2EF] dark:border-[#334155] hover:border-[#2563EB] dark:hover:border-blue-400 bg-[#F5F7FB]/60 dark:bg-[#0F172A]/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <Send className="w-5 h-5 text-[#6D5CE8] dark:text-violet-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    Package Pending Lab Transfer: {exam.subjectCode} ({sitting.sittingName})
                  </div>
                  <div className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                    {exam.subjectName} &middot; {exam.department} Semester {exam.semester} &middot;{' '}
                    {sitting.labName} ({sitting.studentCount} students)
                  </div>
                  <div className="text-[13px] font-semibold text-[#6D5CE8] dark:text-violet-400 mt-1.5">
                    Package: {sitting.packageInfo?.preparationStatus || 'Not Prepared'} · Transfer:{' '}
                    {sitting.packageInfo?.transferStatus || 'Not Sent'} · Readiness:{' '}
                    {sitting.packageInfo?.verificationReadinessStatus || 'Pending'}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#64748B] dark:text-slate-400 shrink-0 mt-1" />
            </button>
          ))}

          {/* 2. Answer-key correction requests requiring COE review */}
          {pendingCorrections.map((req) => (
            <button
              key={req.id}
              type="button"
              onClick={() => {
                setActiveExaminationId(req.examinationId);
                navigate('/results/approval?section=answer-key-corrections');
              }}
              className="w-full text-left p-5 rounded-xl border border-[#B42318]/30 dark:border-red-500/30 hover:border-[#B42318] bg-red-50/40 dark:bg-red-950/20 transition-all cursor-pointer flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <AlertTriangle className="w-5 h-5 text-[#B42318] dark:text-red-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    Answer-Key Correction Request: {req.questionId} ({req.subjectCode})
                  </div>
                  <div className="text-sm text-[#64748B] dark:text-slate-300 mt-1">
                    {req.existingAnswer} &rarr; {req.proposedAnswer} &middot; Submitted by{' '}
                    {req.submittedByHod}
                  </div>
                  <div className="text-[13px] font-semibold text-[#B42318] dark:text-red-400 mt-1.5">
                    Blocks result release until reviewed ({(req.affectedStudentUsns || []).length} present students affected)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#B42318] dark:text-red-400 shrink-0 mt-1" />
            </button>
          ))}

          {/* 3. Imported results waiting for COE approval */}
          {pendingResults.map((res) => (
            <button
              key={res.id}
              type="button"
              onClick={() => {
                setActiveExaminationId(res.examinationId);
                navigate('/results/approval?section=result-overview');
              }}
              className="w-full text-left p-5 rounded-xl border border-[#B7791F]/30 dark:border-amber-500/30 hover:border-[#B7791F] bg-amber-50/40 dark:bg-amber-950/20 transition-all cursor-pointer flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <Clock className="w-5 h-5 text-[#B7791F] dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    Results Awaiting COE Approval: {res.subjectCode} ({res.subjectName})
                  </div>
                  <div className="text-sm text-[#64748B] dark:text-slate-300 mt-1">
                    {res.department} Semester {res.semester} &middot; Present: {res.studentsPresent},
                    Absent: {res.studentsAbsent} of {res.totalEligibleStudents} Eligible
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#B7791F] dark:text-amber-400 shrink-0 mt-1" />
            </button>
          ))}

          {pendingTransferPackages.length === 0 &&
            pendingCorrections.length === 0 &&
            pendingResults.length === 0 &&
            (!datasetStatus.examinationsLoaded ||
            !datasetStatus.resultsLoaded ||
            !datasetStatus.correctionsLoaded ? (
              <div className="py-10 text-center flex flex-col items-center gap-2.5 text-sm text-[#B42318] dark:text-red-300">
                <AlertTriangle className="w-7 h-7" />
                <span>
                  {loading
                    ? 'Loading pending COE actions from backend...'
                    : 'Pending COE actions could not be verified because one or more backend services did not return valid data.'}
                </span>
              </div>
            ) : (
              <div className="py-10 text-center flex flex-col items-center gap-2.5 text-sm text-[#64748B] dark:text-slate-400">
                <CheckCircle2 className="w-7 h-7 text-[#16834A]" />
                <span>All examination packages, corrections, and results are up to date.</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};
