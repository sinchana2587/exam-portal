import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  FilterX,
  RefreshCw,
} from 'lucide-react';
import {
  InstitutionReportFilters,
  InstitutionReportsData,
  principalService,
} from '../../services/principalService';
import { useAuth } from '../../hooks/useAuth';
import { exportRowsToCsv, exportRowsToExcel, exportTableToPdf } from '../../utils/exportUtils';
import { MASTER_SEMESTER_OPTIONS } from '../../utils/semesterOptions';

export const InstitutionReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const [filters, setFilters] = useState<InstitutionReportFilters>({
    academicYearId: '',
    departmentId: '',
    semesterNumber: 'ALL',
    examinationId: '',
  });
  const [data, setData] = useState<InstitutionReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await principalService.getInstitutionReports(filters);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load institutional reports.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleResetFilters = () => {
    setFilters({
      academicYearId: '',
      departmentId: '',
      semesterNumber: 'ALL',
      examinationId: '',
    });
  };

  const handleExport = (format: 'CSV' | 'XLSX' | 'PDF') => {
    if (!data || !user) return;
    const headers = [
      'Department',
      'Sem',
      'Subject Code',
      'Subject Name',
      'Max Marks',
      'Evaluated',
      'Absent',
      'Pass %',
      'Avg %',
      'Highest %',
      'Lowest %',
    ];
    const rows = data.subjectBreakdown.map((s) => [
      s.departmentCode,
      `Sem ${s.semesterNumber}`,
      s.subjectCode,
      s.subjectName,
      s.maxMarks,
      s.evaluatedCount,
      s.absentCount,
      `${s.passPercentage}%`,
      `${s.averagePercentage}%`,
      `${s.highestPercentage}%`,
      `${s.lowestPercentage}%`,
    ]);

    if (format === 'CSV') {
      exportRowsToCsv('MITM_Institution_Released_Results_Report.csv', headers, rows);
    } else if (format === 'XLSX') {
      exportRowsToExcel(
        'MITM_Institution_Released_Results_Report.xlsx',
        'Released Results',
        headers,
        rows
      );
    } else {
      exportTableToPdf({
        filename: 'MITM_Institution_Released_Results_Report.pdf',
        title: 'Institution Reports & Analytics (COE-Released Results Only)',
        subtitle: `Evaluated Unique Students: ${data.statistics.studentsEvaluated} | Pass %: ${data.statistics.passPercentage}% | Average %: ${data.statistics.averagePercentage}%`,
        headers,
        rows,
      });
    }
  };

  const examOptions = (data?.filterOptions?.examinations || []).filter((ex) => {
    if (filters.departmentId && ex.departmentId !== filters.departmentId) return false;
    if (
      filters.semesterNumber &&
      filters.semesterNumber !== 'ALL' &&
      ex.semesterNumber !== filters.semesterNumber
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            Institution Reports & Analytics
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Official institutional performance compiled strictly from examinations explicitly released by the Controller of Examinations. Comparisons across subjects use normalized percentages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!data || (data.subjectBreakdown || []).length === 0}
            onClick={() => handleExport('PDF')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#17243A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-[#B42318]" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            disabled={!data || (data.subjectBreakdown || []).length === 0}
            onClick={() => handleExport('XLSX')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#17243A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#16834A]" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            disabled={!data || (data.subjectBreakdown || []).length === 0}
            onClick={() => handleExport('CSV')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#17243A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Academic Year
          </label>
          <select
            value={filters.academicYearId}
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
            Department
          </label>
          <select
            value={filters.departmentId}
            onChange={(e) =>
              setFilters({ ...filters, departmentId: e.target.value, examinationId: '' })
            }
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">All Departments</option>
            {(data?.filterOptions?.departments || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Semester
          </label>
          <select
            value={filters.semesterNumber}
            onChange={(e) =>
              setFilters({
                ...filters,
                semesterNumber: e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                examinationId: '',
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
            Subject / Examination
          </label>
          <select
            value={filters.examinationId}
            onChange={(e) => setFilters({ ...filters, examinationId: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">All Released Examinations</option>
            {examOptions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleResetFilters}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold text-[#64748B] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <FilterX className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Internal Tabs */}
      <div className="border-b border-[#D9E2EF] dark:border-slate-800 flex gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
              : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#17243A] dark:hover:text-white'
          }`}
        >
          Results Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'analytics'
              ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
              : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#17243A] dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Performance Analytics</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-[#64748B]">Loading institutional reports...</div>
      ) : error || !data ? (
        <div className="p-5 rounded-xl bg-[#B42318]/10 border border-[#B42318]/30 text-sm text-[#B42318] dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error || 'No report data available.'}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadReports()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B42318]/40 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (data.releasedResults || []).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-10 text-center text-sm text-[#64748B] dark:text-slate-400">
          No COE-released examination results match the selected filters. Unapproved or pending results are excluded.
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Students Evaluated', value: data.statistics.studentsEvaluated, hint: 'Unique present USNs' },
              { label: 'Pass Percentage', value: `${data.statistics.passPercentage}%`, hint: `${data.statistics.passCount} passed` },
              { label: 'Fail Percentage', value: `${data.statistics.failPercentage}%`, hint: `${data.statistics.failCount} failed` },
              { label: 'Highest Percentage', value: `${data.statistics.highestPercentage}%`, hint: 'Top score ratio' },
              { label: 'Average Percentage', value: `${data.statistics.averagePercentage}%`, hint: 'Evaluated mean' },
              { label: 'Lowest Percentage', value: `${data.statistics.lowestPercentage}%`, hint: `${data.statistics.absentCount} absent excluded` },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 shadow-xs"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                  {item.label}
                </div>
                <div className="mt-1.5 text-2xl font-bold text-[#17243A] dark:text-white tabular-nums">
                  {item.value}
                </div>
                <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">{item.hint}</div>
              </div>
            ))}
          </div>

          {/* Department-Wise Table */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Department-Wise Result Summary
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                    <th className="py-3 px-5">Department</th>
                    <th className="py-3 px-4">Unique Evaluated</th>
                    <th className="py-3 px-4">Passed</th>
                    <th className="py-3 px-4">Failed</th>
                    <th className="py-3 px-4">Absent</th>
                    <th className="py-3 px-4">Pass %</th>
                    <th className="py-3 px-4">Average %</th>
                    <th className="py-3 px-4">Highest %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm tabular-nums">
                  {(data.departmentBreakdown || []).map((d) => (
                    <tr key={d.departmentId}>
                      <td className="py-3 px-5">
                        <div className="font-bold text-[#17243A] dark:text-white">{d.departmentCode}</div>
                        <div className="text-xs text-[#64748B] dark:text-slate-400">{d.departmentName}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold">{d.uniqueStudents}</td>
                      <td className="py-3 px-4 text-[#16834A] dark:text-emerald-400 font-semibold">{d.passCount}</td>
                      <td className="py-3 px-4 text-[#B42318] dark:text-red-400 font-semibold">{d.failCount}</td>
                      <td className="py-3 px-4 text-[#64748B]">{d.absentCount}</td>
                      <td className="py-3 px-4 font-bold">{d.passPercentage}%</td>
                      <td className="py-3 px-4">{d.averagePercentage}%</td>
                      <td className="py-3 px-4 font-semibold text-[#2563EB] dark:text-blue-400">{d.highestPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Subject-Wise Table */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Subject-Wise Released Examination Summary (Normalized by Percentage)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                    <th className="py-3 px-5">Subject</th>
                    <th className="py-3 px-4">Dept / Sem</th>
                    <th className="py-3 px-4">Max Marks</th>
                    <th className="py-3 px-4">Evaluated</th>
                    <th className="py-3 px-4">Absent</th>
                    <th className="py-3 px-4">Pass %</th>
                    <th className="py-3 px-4">Average %</th>
                    <th className="py-3 px-4">Highest %</th>
                    <th className="py-3 px-4">Lowest %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm tabular-nums">
                  {(data.subjectBreakdown || []).map((s) => (
                    <tr key={s.examinationId}>
                      <td className="py-3 px-5">
                        <div className="font-bold text-[#17243A] dark:text-white">{s.subjectCode}</div>
                        <div className="text-xs text-[#64748B] dark:text-slate-400">{s.subjectName}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">{s.departmentCode} · Sem {s.semesterNumber}</td>
                      <td className="py-3 px-4">{s.maxMarks}</td>
                      <td className="py-3 px-4 font-semibold">{s.evaluatedCount}</td>
                      <td className="py-3 px-4 text-[#64748B]">{s.absentCount}</td>
                      <td className="py-3 px-4 font-bold text-[#16834A] dark:text-emerald-400">{s.passPercentage}%</td>
                      <td className="py-3 px-4">{s.averagePercentage}%</td>
                      <td className="py-3 px-4 font-semibold">{s.highestPercentage}%</td>
                      <td className="py-3 px-4">{s.lowestPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        /* Performance Analytics Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#17243A] dark:text-white">
              Department-Wise Pass % vs Average %
            </h2>
            <div className="space-y-4">
              {(data.departmentBreakdown || []).map((d) => (
                <div key={d.departmentId} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{d.departmentCode} ({d.uniqueStudents} evaluated)</span>
                    <span className="tabular-nums">
                      Pass {d.passPercentage}% · Avg {d.averagePercentage}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                    <div
                      className="h-full bg-[#2563EB] transition-all"
                      style={{ width: `${Math.min(100, d.passPercentage)}%` }}
                      title={`Pass: ${d.passPercentage}%`}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#6D5CE8] transition-all"
                      style={{ width: `${Math.min(100, d.averagePercentage)}%` }}
                      title={`Average: ${d.averagePercentage}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#64748B] pt-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" /> Pass Percentage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#6D5CE8]" /> Mean Percentage
              </span>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#17243A] dark:text-white">
              Subject Comparison (Percentage Normalized Across Max Marks)
            </h2>
            <div className="space-y-4">
              {(data.subjectBreakdown || []).map((s) => (
                <div key={s.examinationId} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>
                      {s.subjectCode} ({s.departmentCode}, Max {s.maxMarks})
                    </span>
                    <span className="tabular-nums">
                      Avg {s.averagePercentage}% · High {s.highestPercentage}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#16834A] transition-all"
                      style={{ width: `${Math.min(100, s.averagePercentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#17243A] dark:text-white">
              Section-Wise Performance Comparison
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.sectionBreakdown.map((sec) => (
                <div
                  key={sec.key}
                  className="p-4 rounded-lg border border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-800/50 space-y-1"
                >
                  <div className="text-xs font-bold text-[#17243A] dark:text-white">
                    {sec.departmentCode} · Sem {sec.semesterNumber} · {sec.section}
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-slate-400">
                    Evaluated: {sec.evaluatedCount} · Absent: {sec.absentCount}
                  </div>
                  <div className="pt-1 flex justify-between text-xs font-semibold tabular-nums">
                    <span className="text-[#16834A] dark:text-emerald-400">
                      Pass: {sec.passPercentage}%
                    </span>
                    <span className="text-[#2563EB] dark:text-blue-400">
                      Avg: {sec.averagePercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
