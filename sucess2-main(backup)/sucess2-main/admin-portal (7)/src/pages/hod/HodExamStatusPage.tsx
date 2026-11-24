import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { resultsService } from '../../services/resultsService';
import { ExamLifecycleStatus, ExaminationRecord } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { MASTER_SEMESTER_OPTIONS } from '../../utils/semesterOptions';

export const HodExamStatusPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [examinations, setExaminations] = useState<ExaminationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialSemParam = searchParams.get('semester');
  const initialStatusParam = searchParams.get('status') as ExamLifecycleStatus | null;

  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<number | 'ALL'>(
    initialSemParam && Number(initialSemParam) >= 1 && Number(initialSemParam) <= 8
      ? Number(initialSemParam)
      : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<ExamLifecycleStatus | 'ALL'>(
    initialStatusParam &&
      ['Scheduled', 'In Progress', 'Exam Completed', 'Cancelled'].includes(initialStatusParam)
      ? initialStatusParam
      : 'ALL'
  );
  const [expandedExamIds, setExpandedExamIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const semParam = searchParams.get('semester');
    const stParam = searchParams.get('status') as ExamLifecycleStatus | null;
    if (semParam && Number(semParam) >= 1 && Number(semParam) <= 8) {
      setSemesterFilter(Number(semParam));
    }
    if (
      stParam &&
      ['Scheduled', 'In Progress', 'Exam Completed', 'Cancelled'].includes(stParam)
    ) {
      setStatusFilter(stParam);
    }
  }, [searchParams]);

  const loadExaminations = useCallback(async () => {
    if (!user?.departmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await resultsService.getDepartmentExaminations(user.departmentId);
      setExaminations(res);
    } catch (err) {
      setExaminations([]);
      setError(err instanceof Error ? err.message : 'Unable to load examination status.');
    } finally {
      setLoading(false);
    }
  }, [user?.departmentId]);

  useEffect(() => {
    void loadExaminations();
  }, [loadExaminations]);

  useEffect(() => {
    const handleSse = () => {
      void loadExaminations();
    };
    window.addEventListener('campus-exam-event', handleSse);
    return () => window.removeEventListener('campus-exam-event', handleSse);
  }, [loadExaminations]);

  // Always display Semesters 1–8 in ascending numeric order via MASTER_SEMESTER_OPTIONS

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return examinations.filter((e) => {
      if (semesterFilter !== 'ALL' && e.semesterNumber !== semesterFilter) return false;
      if (statusFilter !== 'ALL' && e.examStatus !== statusFilter) return false;
      if (
        q &&
        !(e.subjectCode || '').toLowerCase().includes(q) &&
        !(e.subjectName || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [examinations, search, semesterFilter, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedExamIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            Examination Status ({user?.departmentCode})
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Read-only monitoring of scheduled examinations grouped per subject with participating sections combined and expandable sitting details.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400 shrink-0 self-start sm:self-auto">
          <Lock className="w-3.5 h-3.5 text-[#6D5CE8]" />
          <span>Scheduled & Managed by COE</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject code or name..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>

        <select
          value={semesterFilter}
          onChange={(e) =>
            setSemesterFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
          }
          className="px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="ALL">All Semesters</option>
          {MASTER_SEMESTER_OPTIONS.map((sem) => (
            <option key={sem.number} value={sem.number}>
              {sem.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExamLifecycleStatus | 'ALL')}
          className="px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="ALL">All Examination Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="In Progress">In Progress</option>
          <option value="Exam Completed">Exam Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Grouped Examination List */}
      {loading ? (
        <div className="p-8 text-center text-sm text-[#64748B]">Loading examinations...</div>
      ) : error ? (
        <div className="p-5 rounded-xl bg-[#B42318]/10 border border-[#B42318]/30 text-sm text-[#B42318] dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadExaminations()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B42318]/40 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-10 text-center text-sm text-[#64748B]">
          No examinations match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((exam) => {
            const expanded = Boolean(expandedExamIds[exam.id]);
            return (
              <div
                key={exam.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-[#17243A] dark:text-white">
                        {exam.subjectCode} — {exam.subjectName}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 text-[#64748B] dark:text-slate-300">
                        Semester {exam.semesterNumber}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Participating Sections:{' '}
                        <strong className="text-[#1F2937] dark:text-slate-200">
                          {(exam.participatingSections || []).join(', ') || 'A, B'}
                        </strong>
                      </span>
                      <span>
                        Examination Date:{' '}
                        <strong className="font-mono text-[#1F2937] dark:text-slate-200">
                          {exam.examDate}
                        </strong>
                      </span>
                      <span>
                        Sittings:{' '}
                        <strong className="text-[#1F2937] dark:text-slate-200">
                          {(exam.sittings || []).length}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-[#64748B] mb-1">
                        Exam Status
                      </div>
                      <StatusBadge status={exam.examStatus || (exam as any).status || 'Scheduled'} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-[#64748B] mb-1">
                        Lab Readiness
                      </div>
                      <StatusBadge status={exam.labReadiness || 'Verified'} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-[#64748B] mb-1">
                        Result Status
                      </div>
                      <StatusBadge status={exam.resultStatus || 'Not Imported'} />
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(exam.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold text-[#17243A] dark:text-slate-200 hover:bg-[#F5F7FB] dark:hover:bg-slate-800 ml-auto lg:ml-2"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Sitting Details</span>
                      {expanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-800/40 px-5 py-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-3">
                      Allocated Sitting Details (Read-Only)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {exam.sittings.map((sit) => (
                        <div
                          key={sit.id}
                          className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="font-bold text-[#17243A] dark:text-white">
                              {sit.sittingLabel} Sitting · {sit.assignedLab}
                            </div>
                            <div className="text-[#64748B] dark:text-slate-400 font-mono">
                              {sit.date} · {sit.timeRange}
                            </div>
                            <div className="text-[#1F2937] dark:text-slate-300">
                              Assigned Students:{' '}
                              <strong className="tabular-nums">{sit.assignedStudentCount}</strong>
                            </div>
                          </div>
                          <StatusBadge status={sit.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
