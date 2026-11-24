import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { courseOutcomeService } from '../services/courseOutcomeService';
import {
  CourseOutcomeSubmission,
  DepartmentCode,
} from '../types/examination';
import { formatSemesterLabel } from '../utils/academicSemesters';

const CANONICAL_DEPARTMENTS: DepartmentCode[] = [
  'CSE',
  'ISE',
  'ECE',
  'AIML',
  'ME',
  'CV',
];

export const CourseOutcomesPage: React.FC = () => {
  const { departments, semesters, notify } = useExaminationStore();

  const [submissions, setSubmissions] = useState<CourseOutcomeSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Exact 3 Dropdown Filters
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await courseOutcomeService.getCourseOutcomeSubmissions();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setSubmissions([]);
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Unable to load Course Outcomes submissions from backend.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    CANONICAL_DEPARTMENTS.forEach((code) => map.set(code, code));
    departments.forEach((d) => map.set(d.code, `${d.code} — ${d.name}`));
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [departments]);

  // Dynamic Subject filter options based on department and semester
  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach((s) => {
      if (departmentFilter !== 'ALL' && s.department !== departmentFilter) return;
      if (semesterFilter !== 'ALL' && s.semester !== Number(semesterFilter)) return;
      map.set(s.subjectCode, `${s.subjectCode} — ${s.subjectName}`);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [submissions, departmentFilter, semesterFilter]);

  // Reset subject filter if selected subject is no longer in options
  useEffect(() => {
    if (subjectFilter !== 'ALL' && !subjectOptions.some((s) => s.code === subjectFilter)) {
      setSubjectFilter('ALL');
    }
  }, [subjectOptions, subjectFilter]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      if (departmentFilter !== 'ALL' && item.department !== departmentFilter) {
        return false;
      }
      if (semesterFilter !== 'ALL' && item.semester !== Number(semesterFilter)) {
        return false;
      }
      if (subjectFilter !== 'ALL' && item.subjectCode !== subjectFilter) {
        return false;
      }
      return true;
    });
  }, [submissions, departmentFilter, semesterFilter, subjectFilter]);

  const handleDownloadPdf = async (submission: CourseOutcomeSubmission) => {
    if (!submission.fileName) {
      notify('error', 'No Document', 'No Course Outcomes document has been submitted for this subject.');
      return;
    }
    setDownloadingId(submission.id);
    try {
      const res = await courseOutcomeService.fetchCourseOutcomePdfBlob(
        submission.id,
        submission.currentRevisionNumber || 1,
        'attachment'
      );
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || submission.fileName || `${submission.subjectCode}_Course_Outcomes.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(
        'success',
        'PDF Downloaded',
        `Downloaded original Course Outcomes PDF: ${submission.fileName || submission.subjectCode}`
      );
    } catch (err) {
      notify(
        'error',
        'Download Failed',
        err instanceof Error ? err.message : 'Unable to download Course Outcomes PDF.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] dark:text-slate-100">
            Course Outcomes
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Departmental Course Outcomes documents submitted by Head of Departments
          </p>
        </div>
        <button
          type="button"
          onClick={loadSubmissions}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 3 Dropdown Filters: Department, Semester, Subject */}
      <div className="p-4 rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Department Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1.5">
              Department
            </label>
            <select
              aria-label="Filter course outcomes by department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
            >
              <option value="ALL">All Departments</option>
              {departmentOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1.5">
              Semester
            </label>
            <select
              aria-label="Filter course outcomes by semester"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
            >
              <option value="ALL">All Semesters (1st–8th)</option>
              {semesters.map((sem) => (
                <option key={sem.semesterNumber} value={String(sem.semesterNumber)}>
                  {sem.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1.5">
              Subject
            </label>
            <select
              aria-label="Filter course outcomes by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
            >
              <option value="ALL">All Subjects</option>
              {subjectOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
          {loadError}
        </div>
      )}

      {/* Course Outcomes Table: 4 Columns: Department, Semester, Subject, Action */}
      <div className="overflow-x-auto rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#F8FAFC] dark:bg-[#0F172A] border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Semester</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155]">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-[#64748B] dark:text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2 text-[#2563EB]" />
                  Loading course outcomes...
                </td>
              </tr>
            ) : filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-[#64748B] dark:text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <div className="font-semibold text-sm">No Course Outcomes submitted</div>
                  <div className="text-xs mt-1">
                    No course outcomes document found for the selected department, semester, and subject filters.
                  </div>
                </td>
              </tr>
            ) : (
              filteredSubmissions.map((sub) => {
                const hasDoc = Boolean(sub.fileName && sub.currentRevisionNumber > 0);
                const isDownloading = downloadingId === sub.id;

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-[#1F2937] dark:text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 text-xs font-mono font-bold border border-blue-200 dark:border-blue-800">
                        {sub.department}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#1F2937] dark:text-slate-200">
                      {formatSemesterLabel(sub.semester)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#1F2937] dark:text-slate-100">
                        {sub.subjectCode} — {sub.subjectName}
                      </div>
                      {sub.fileName && (
                        <div className="text-xs text-[#64748B] dark:text-slate-400 font-mono mt-0.5">
                          {sub.fileName}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {hasDoc ? (
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => handleDownloadPdf(sub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          Download PDF
                        </button>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          No Course Outcomes submitted
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
