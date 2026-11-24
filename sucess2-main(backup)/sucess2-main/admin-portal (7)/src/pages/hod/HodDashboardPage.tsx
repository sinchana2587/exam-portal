import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarClock,
  Layers,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  HodDashboardData,
  SemesterOverviewRow,
  resultsService,
} from '../../services/resultsService';

export const HodDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const overviewRef = useRef<HTMLElement | null>(null);

  const [data, setData] = useState<HodDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightOverview, setHighlightOverview] = useState(false);
  const [selectedStudentSemester, setSelectedStudentSemester] = useState<SemesterOverviewRow | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user?.departmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await resultsService.getHodDashboardOverview(user.departmentId);
      setData(res);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load department dashboard.');
    } finally {
      setLoading(false);
    }
  }, [user?.departmentId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const handleSse = () => {
      void loadDashboard();
    };
    window.addEventListener('campus-exam-event', handleSse);
    return () => window.removeEventListener('campus-exam-event', handleSse);
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 w-80 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 rounded-xl bg-[#B42318]/10 border border-[#B42318]/30 text-sm text-[#B42318] dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || 'Department dashboard data unavailable.'}</span>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B42318]/40 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const totalStudentsDisplay =
    data?.summary?.totalStudentsAvailable && data?.summary?.totalStudents !== null
      ? data.summary.totalStudents
      : 'Unavailable';

  const totalStudentsSub =
    data?.summary?.totalStudentsAvailable && data?.summary?.totalStudents !== null
      ? 'Unique enrolled USNs across Semesters 1–8 · Click for semester breakdown'
      : data?.summary?.totalStudentsUnavailableReason ||
        'Departmental enrolment source not yet available';

  const handleTotalStudentsCardClick = () => {
    overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightOverview(true);
    window.setTimeout(() => setHighlightOverview(false), 1800);
  };

  const kpiCards = [
    {
      id: 'total-students',
      label: 'Total Students',
      value: totalStudentsDisplay,
      sub: totalStudentsSub,
      isUnavailable: !data?.summary?.totalStudentsAvailable || data?.summary?.totalStudents === null,
      icon: Users,
      accent: 'text-[#2563EB] dark:text-blue-400 bg-[#2563EB]/10',
      onClick: handleTotalStudentsCardClick,
      actionHint: 'View all 8 semesters below',
    },
    {
      id: 'upcoming-exams',
      label: 'Upcoming Examinations',
      value: data?.summary?.upcomingExaminations ?? 0,
      sub: 'Distinct scheduled examinations for future dates',
      isUnavailable: false,
      icon: CalendarClock,
      accent: 'text-[#B7791F] dark:text-amber-400 bg-[#B7791F]/10',
      onClick: () => navigate('/admin/hod/exam-status?status=Scheduled'),
      actionHint: 'Open Scheduled Examinations',
    },
    {
      id: 'released-results',
      label: 'Released Results',
      value: data?.summary?.releasedResultsCount ?? 0,
      sub: 'Distinct examination records released by COE',
      isUnavailable: false,
      icon: Award,
      accent: 'text-[#16834A] dark:text-emerald-400 bg-[#16834A]/10',
      onClick: () => navigate('/admin/hod/results?filter=released'),
      actionHint: 'Open Released Results',
    },
  ];

  const selectedBreakdowns = selectedStudentSemester
    ? data?.semesterSectionBreakdowns?.[selectedStudentSemester.semesterNumber] || []
    : [];

  return (
    <div className="space-y-7">
      {/* Page Title and Department Identification */}
      <div>
        <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
          Department Dashboard — {data.department.code}
        </h1>
        <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
          Departmental overview for {data.department.name}.
        </p>
      </div>

      {/* Exact 3 Clickable Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              className="text-left bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 hover:border-[#2563EB] dark:hover:border-blue-500 p-5 shadow-xs transition-all flex flex-col justify-between gap-3 group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <div className="flex items-start justify-between gap-4 w-full">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">
                    {card.label}
                  </div>
                  <div
                    className={`mt-2 font-bold tabular-nums ${
                      card.isUnavailable
                        ? 'text-lg text-[#B7791F] dark:text-amber-400'
                        : 'text-3xl text-[#17243A] dark:text-white'
                    }`}
                  >
                    {card.value}
                  </div>
                  <div className="mt-1.5 text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
                    {card.sub}
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg shrink-0 ${card.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-[#D9E2EF]/70 dark:border-slate-800 w-full flex items-center justify-between text-xs font-semibold text-[#2563EB] dark:text-blue-400">
                <span>{card.actionHint}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Semester-wise Department Overview (All 8 Semesters in Ascending Order) */}
      <section
        ref={overviewRef}
        id="semester-department-overview"
        className={`bg-white dark:bg-slate-900 rounded-xl border shadow-xs overflow-hidden transition-all ${
          highlightOverview
            ? 'border-[#2563EB] ring-2 ring-[#2563EB]/25'
            : 'border-[#D9E2EF] dark:border-slate-800'
        }`}
      >
        <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Semester-wise Department Overview
            </h2>
          </div>
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Click any metric to inspect semester student distribution, upcoming exams, or released results
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                <th className="py-3 px-6">Semester</th>
                <th className="py-3 px-5 text-right">Total Students</th>
                <th className="py-3 px-5 text-right">Upcoming Examinations</th>
                <th className="py-3 px-6 text-right">Released Results</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm">
              {data.semesterOverview.map((row) => (
                <tr
                  key={row.semesterNumber}
                  className="hover:bg-[#F5F7FB]/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-6 font-semibold text-[#17243A] dark:text-white">
                    {row.label}
                  </td>

                  <td className="py-3.5 px-5 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentSemester(row)}
                      className={`inline-flex items-center justify-end px-2.5 py-1 rounded-md font-bold transition-colors ${
                        row.totalStudentsAvailable && row.totalStudents !== null
                          ? 'text-[#2563EB] dark:text-blue-400 hover:bg-[#2563EB]/10'
                          : 'text-[#B7791F] dark:text-amber-400 hover:bg-[#B7791F]/10 text-xs'
                      }`}
                      title={`Inspect ${row.label} enrolled students`}
                    >
                      {row.totalStudentsAvailable && row.totalStudents !== null
                        ? row.totalStudents
                        : 'Unavailable'}
                    </button>
                  </td>

                  <td className="py-3.5 px-5 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/admin/hod/exam-status?semester=${row.semesterNumber}&status=Scheduled`
                        )
                      }
                      className="inline-flex items-center justify-end px-2.5 py-1 rounded-md font-bold text-[#B7791F] dark:text-amber-400 hover:bg-[#B7791F]/10 transition-colors"
                      title={`View upcoming scheduled examinations for ${row.label}`}
                    >
                      {row.upcomingExaminations}
                    </button>
                  </td>

                  <td className="py-3.5 px-6 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/admin/hod/results?semester=${row.semesterNumber}&filter=released`
                        )
                      }
                      className="inline-flex items-center justify-end px-2.5 py-1 rounded-md font-bold text-[#16834A] dark:text-emerald-400 hover:bg-[#16834A]/10 transition-colors"
                      title={`View COE-released results for ${row.label}`}
                    >
                      {row.releasedResults}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Semester-Specific Enrolled Student Drill-Down Dialog */}
      {selectedStudentSemester && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="semester-student-modal-title"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="semester-student-modal-title"
                  className="text-lg font-bold text-[#17243A] dark:text-white"
                >
                  {selectedStudentSemester.label} — Enrolled Students
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  Department: {data.department.name} ({data.department.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentSemester(null)}
                className="p-1.5 rounded-md text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close semester student detail"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!selectedStudentSemester.totalStudentsAvailable ||
            selectedStudentSemester.totalStudents === null ? (
              <div className="p-4 rounded-lg bg-[#B7791F]/10 border border-[#B7791F]/30 text-xs text-[#92400E] dark:text-amber-300">
                Complete departmental enrolment records for {selectedStudentSemester.label} are
                currently unavailable from the enrolment source.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/60 border border-[#D9E2EF] dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B] dark:text-slate-300 uppercase">
                    Total Unique Enrolled Students
                  </span>
                  <span className="text-2xl font-bold text-[#17243A] dark:text-white tabular-nums">
                    {selectedStudentSemester.totalStudents}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase mb-2">
                    Section-Wise Distribution
                  </div>
                  {selectedBreakdowns.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-[#D9E2EF] dark:border-slate-700 text-xs text-[#64748B] dark:text-slate-400 text-center">
                      No enrolled student records found for {selectedStudentSemester.label}.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#D9E2EF] dark:divide-slate-800 border border-[#D9E2EF] dark:border-slate-800 rounded-lg overflow-hidden">
                      {selectedBreakdowns.map((item) => (
                        <div
                          key={item.section}
                          className="px-4 py-2.5 flex items-center justify-between text-sm bg-white dark:bg-slate-900"
                        >
                          <span className="font-medium text-[#17243A] dark:text-slate-100">
                            {item.section}
                          </span>
                          <span className="font-bold tabular-nums text-[#2563EB] dark:text-blue-400">
                            {item.enrolledCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentSemester(null)}
                className="px-4 py-2 rounded-md bg-[#17243A] dark:bg-[#2563EB] text-white text-xs font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
