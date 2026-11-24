import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  FilterX,
  RefreshCw,
  Search,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  DepartmentResultFilters,
  ReleasedDepartmentResultsResponse,
  resultsService,
} from '../../services/resultsService';
import { analyticsService } from '../../services/analyticsService';
import { StatusBadge } from '../../components/StatusBadge';
import { exportRowsToCsv, exportRowsToExcel, exportTableToPdf } from '../../utils/exportUtils';
import { MASTER_SEMESTER_OPTIONS } from '../../utils/semesterOptions';

export const DepartmentResultsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSemParam = searchParams.get('semester');
  const [activeTab, setActiveTab] = useState<'results' | 'analytics'>('results');
  const [filters, setFilters] = useState<DepartmentResultFilters>({
    academicYearId: '',
    semesterNumber:
      initialSemParam && Number(initialSemParam) >= 1 && Number(initialSemParam) <= 8
        ? Number(initialSemParam)
        : 'ALL',
    examinationId: '',
    section: '',
    search: '',
  });

  useEffect(() => {
    const semParam = searchParams.get('semester');
    if (semParam && Number(semParam) >= 1 && Number(semParam) <= 8) {
      const nextSem = Number(semParam);
      setFilters((prev) =>
        prev.semesterNumber === nextSem ? prev : { ...prev, semesterNumber: nextSem }
      );
    }
  }, [searchParams]);

  const [data, setData] = useState<ReleasedDepartmentResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadResults = useCallback(async () => {
    if (!user?.departmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await resultsService.getReleasedDepartmentResults(user.departmentId, filters);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load department results.');
    } finally {
      setLoading(false);
    }
  }, [user?.departmentId, filters]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    const handleSse = () => {
      loadResults();
    };
    window.addEventListener('campus-exam-event', handleSse);
    return () => window.removeEventListener('campus-exam-event', handleSse);
  }, [loadResults]);

  const analytics = useMemo(
    () => analyticsService.computeDepartmentAnalytics(data?.results || []),
    [data?.results]
  );

  const handleResetFilters = () => {
    setFilters({
      academicYearId: '',
      semesterNumber: 'ALL',
      examinationId: '',
      section: '',
      search: '',
    });
  };

  const handleExport = (format: 'CSV' | 'XLSX' | 'PDF') => {
    if (!data || !user || data.results.length === 0) return;

    const headers = [
      'USN',
      'Student Name',
      'Subject Code',
      'Subject Name',
      'Semester',
      'Section',
      'Marks Obtained',
      'Max Marks',
      'Percentage',
      'Attendance',
      'Result Status',
    ];
    const rows = data.results.map((r) => [
      r.usn,
      r.studentName,
      r.subjectCode,
      r.subjectName,
      `Sem ${r.semesterNumber}`,
      r.originalSection,
      r.attendance === 'Absent' ? 'AB' : r.marksObtained,
      r.maxMarks,
      r.attendance === 'Absent' || r.percentage === null ? '-' : `${r.percentage}%`,
      r.attendance,
      r.resultOutcome,
    ]);

    if (format === 'CSV') {
      exportRowsToCsv(`MITM_${user.departmentCode}_Released_Results.csv`, headers, rows);
    } else if (format === 'XLSX') {
      exportRowsToExcel(
        `MITM_${user.departmentCode}_Released_Results.xlsx`,
        `${user.departmentCode} Results`,
        headers,
        rows
      );
    } else {
      exportTableToPdf({
        filename: `MITM_${user.departmentCode}_Released_Results.pdf`,
        title: `${user.departmentName} (${user.departmentCode}) — Released Examination Results`,
        subtitle: `Evaluated: ${analytics.summary.studentsEvaluated} | Absent: ${analytics.summary.absentStudents} | Pass %: ${analytics.summary.passPercentage}% | Average %: ${analytics.summary.averagePercentage}%`,
        headers,
        rows,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            Department Results & Performance Analytics ({user?.departmentCode})
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Displays only COE-released results for {user?.departmentName}. Absent students are reported distinctly without distorting fail rates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!data || data.results.length === 0}
            onClick={() => handleExport('PDF')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-[#B42318]" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            disabled={!data || data.results.length === 0}
            onClick={() => handleExport('XLSX')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#16834A]" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            disabled={!data || data.results.length === 0}
            onClick={() => handleExport('CSV')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Search Student Name or USN
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by USN or student name..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Academic Year
          </label>
          <select
            value={filters.academicYearId || ''}
            onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">All Academic Years</option>
            {(data?.filterOptions?.academicYears || []).map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Semester
          </label>
          <select
            value={filters.semesterNumber || 'ALL'}
            onChange={(e) =>
              setFilters({
                ...filters,
                semesterNumber: e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="ALL">All Semesters</option>
            {MASTER_SEMESTER_OPTIONS.map((sem) => (
              <option key={sem.number} value={sem.number}>
                {sem.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Examination / Subject
          </label>
          <select
            value={filters.examinationId || ''}
            onChange={(e) => setFilters({ ...filters, examinationId: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">All Released Subjects</option>
            {(data?.filterOptions?.examinations || []).map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
              Original Section
            </label>
            <select
              value={filters.section || ''}
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
              className="w-full px-2.5 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="">All Sections</option>
              {(data?.filterOptions?.sections || []).map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            title="Clear All / Reset Filters"
            className="px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold text-[#64748B] hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FilterX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Internal Tabs */}
      <div className="border-b border-[#D9E2EF] dark:border-slate-800 flex gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'results'
              ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
              : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
          }`}
        >
          Individual Student Results
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'analytics'
              ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
              : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Performance Analytics</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[#64748B]">Loading released results...</div>
      ) : error || !data ? (
        <div className="p-5 rounded-xl bg-[#B42318]/10 border border-[#B42318]/30 text-sm text-[#B42318] dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error || 'Unable to load results.'}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadResults()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B42318]/40 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : data.results.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-10 text-center text-sm text-[#64748B]">
          No COE-released results match your filters. Unreleased or pending examinations remain withheld until COE approval.
        </div>
      ) : activeTab === 'results' ? (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                  <th className="py-3 px-5">USN</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Examination / Subject</th>
                  <th className="py-3 px-4">Sem</th>
                  <th className="py-3 px-4">Original Section</th>
                  <th className="py-3 px-4">Marks</th>
                  <th className="py-3 px-4">Percentage</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm">
                {data.results.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-[#F5F7FB]/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-5 font-mono text-xs font-semibold text-[#17243A] dark:text-white">
                      {r.usn}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1F2937] dark:text-slate-200">
                      {r.studentName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-xs text-[#17243A] dark:text-white">
                        {r.subjectCode}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {r.subjectName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs tabular-nums">Sem {r.semesterNumber}</td>
                    <td className="py-3 px-4 text-xs">{r.originalSection}</td>
                    <td className="py-3 px-4 font-semibold tabular-nums">
                      {r.attendance === 'Absent' ? '—' : `${r.marksObtained} / ${r.maxMarks}`}
                    </td>
                    <td className="py-3 px-4 font-semibold tabular-nums">
                      {r.attendance === 'Absent' || r.percentage === null ? '—' : `${r.percentage}%`}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.attendance} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.resultOutcome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* Tab B — Performance Analytics */
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Students Evaluated', value: analytics.summary.studentsEvaluated },
              { label: 'Pass %', value: `${analytics.summary.passPercentage}%` },
              { label: 'Fail %', value: `${analytics.summary.failPercentage}%` },
              { label: 'Average %', value: `${analytics.summary.averagePercentage}%` },
              { label: 'Highest %', value: `${analytics.summary.highestPercentage}%` },
              { label: 'Lowest %', value: `${analytics.summary.lowestPercentage}%` },
              { label: 'Absent Students', value: analytics.summary.absentStudents },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 shadow-xs"
              >
                <div className="text-[11px] font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  {stat.label}
                </div>
                <div className="mt-1.5 text-xl font-bold text-[#17243A] dark:text-white tabular-nums">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Tied Toppers Handling */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Top-Performing Students (Tied Toppers Included)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.topPerformersByExam.map((grp) => (
                <div
                  key={grp.examinationId}
                  className="p-4 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#17243A] dark:text-white">
                      {grp.subjectCode} — {grp.subjectName}
                    </span>
                    <span className="text-xs font-bold text-[#16834A] dark:text-emerald-400 tabular-nums">
                      Top: {grp.highestPercentage}%
                    </span>
                  </div>
                  {grp.toppers.length > 1 && (
                    <div className="text-[11px] font-semibold text-[#6D5CE8] dark:text-violet-300">
                      Tied First Position ({grp.toppers.length} students tied at {grp.highestPercentage}%)
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {grp.toppers.map((t) => (
                      <div
                        key={t.usn}
                        className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded border border-[#D9E2EF] dark:border-slate-700"
                      >
                        <div>
                          <span className="font-semibold text-[#17243A] dark:text-white">
                            {t.studentName}
                          </span>{' '}
                          <span className="font-mono text-[#64748B]">({t.usn})</span> · {t.section}
                        </div>
                        <span className="font-bold tabular-nums text-[#2563EB] dark:text-blue-400">
                          {t.marksObtained}/{grp.maxMarks} ({t.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject-Wise Percentage Performance */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Subject-Wise Performance (Normalized by Percentage)
              </h2>
              <div className="space-y-4">
                {analytics.subjectPerformance.map((s) => (
                  <div key={s.examinationId} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>
                        {s.subjectCode} (Max {s.maxMarks})
                      </span>
                      <span className="tabular-nums">
                        Pass {s.passPercentage}% · Avg {s.averagePercentage}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB]"
                        style={{ width: `${Math.min(100, s.averagePercentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section-Wise & Semester-Wise Performance */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Section-Wise & Semester-Wise Summary
              </h2>
              <div className="space-y-3">
                {analytics.sectionPerformance.map((sec) => (
                  <div
                    key={sec.section}
                    className="p-3 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/50 border border-[#D9E2EF] dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#17243A] dark:text-white">{sec.section}</div>
                      <div className="text-[#64748B]">
                        Evaluated: {sec.evaluatedCount} · Absent: {sec.absentCount}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="font-bold text-[#16834A] dark:text-emerald-400">
                        {sec.passPercentage}% Pass
                      </div>
                      <div className="text-[#64748B]">Avg {sec.averagePercentage}%</div>
                    </div>
                  </div>
                ))}
              </div>

              {analytics.semesterPerformance.length > 0 && (
                <div className="pt-3 border-t border-[#D9E2EF] dark:border-slate-800 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Semester Breakdown
                  </div>
                  {analytics.semesterPerformance.map((sem) => (
                    <div
                      key={sem.semesterNumber}
                      className="flex justify-between text-xs font-medium"
                    >
                      <span>Semester {sem.semesterNumber} ({sem.evaluatedCount} evaluated)</span>
                      <span className="tabular-nums">
                        Pass {sem.passPercentage}% · Avg {sem.averagePercentage}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
