import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PlayCircle,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { principalService, PrincipalDashboardData } from '../../services/principalService';
import { StatusBadge } from '../../components/StatusBadge';

export const PrincipalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await principalService.getDashboardOverview();
      setData(res);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load dashboard overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 w-72 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800" />
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
          <span>{error || 'Dashboard data unavailable.'}</span>
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

  const statCards = [
    {
      label: 'Total Departments',
      value: data?.summary?.totalDepartments ?? 0,
      sub: 'Configured academic departments',
      icon: Building2,
      accent: 'text-[#2563EB] dark:text-blue-400 bg-[#2563EB]/10',
    },
    {
      label: 'Total HOD Accounts',
      value: data?.summary?.totalHodAccounts ?? 0,
      sub: `${data?.summary?.activeHodAccounts ?? 0} currently active`,
      icon: UserCheck,
      accent: 'text-[#6D5CE8] dark:text-violet-400 bg-[#6D5CE8]/10',
    },
    {
      label: 'Total Registered Students',
      value: data?.summary?.totalRegisteredStudents ?? 0,
      sub: 'Unique eligible USNs across departments',
      icon: Users,
      accent: 'text-[#16834A] dark:text-emerald-400 bg-[#16834A]/10',
    },
    {
      label: 'Upcoming Examinations',
      value: data?.summary?.upcomingExaminations ?? 0,
      sub: 'Scheduled across departments',
      icon: CalendarClock,
      accent: 'text-[#2563EB] dark:text-blue-400 bg-[#2563EB]/10',
    },
    {
      label: 'Examinations In Progress',
      value: data?.summary?.examinationsInProgress ?? 0,
      sub: 'Active examination sittings',
      icon: PlayCircle,
      accent: 'text-[#B7791F] dark:text-amber-400 bg-[#B7791F]/10',
    },
    {
      label: 'Completed Examinations',
      value: data?.summary?.completedExaminations ?? 0,
      sub: 'Conducted and evaluated/awaiting release',
      icon: CheckCircle2,
      accent: 'text-[#16834A] dark:text-emerald-400 bg-[#16834A]/10',
    },
  ];

  return (
    <div className="space-y-7">
      {/* Header + Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            Principal Institutional Dashboard
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Institution-wide overview of departments, HOD governance, and examination operations at MIT Mysore.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/admin/principal/hod-management?action=create')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create HOD & Department</span>
        </button>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-5 shadow-xs flex items-start justify-between gap-4"
            >
              <div>
                <div className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">
                  {card.label}
                </div>
                <div className="mt-2 text-3xl font-bold text-[#17243A] dark:text-white tabular-nums">
                  {card.value}
                </div>
                <div className="mt-1 text-xs text-[#64748B] dark:text-slate-400">{card.sub}</div>
              </div>
              <div className={`p-2.5 rounded-lg shrink-0 ${card.accent}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Institutional Examination Activity */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Institutional Examination Activity
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/principal/reports')}
            className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            View Reports & Analytics
          </button>
        </div>

        {(!data?.examinationActivity || data.examinationActivity.length === 0) ? (
          <div className="p-8 text-center text-sm text-[#64748B] dark:text-slate-400">
            No examinations are currently scheduled or recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                  <th className="py-3 px-5">Department</th>
                  <th className="py-3 px-4">Sem</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Sections</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Exam Status</th>
                  <th className="py-3 px-4">Result Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm">
                {(data?.examinationActivity || []).map((exam) => (
                  <tr
                    key={exam.id}
                    className="hover:bg-[#F5F7FB]/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-5 font-semibold text-[#17243A] dark:text-white">
                      {exam.departmentCode}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-[#1F2937] dark:text-slate-300">
                      Sem {exam.semesterNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#17243A] dark:text-slate-100">
                        {exam.subjectCode}
                      </div>
                      <div className="text-xs text-[#64748B] dark:text-slate-400">
                        {exam.subjectName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#1F2937] dark:text-slate-300">
                      {(exam.participatingSections || []).join(', ') || 'A, B'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-[#1F2937] dark:text-slate-300">
                      {exam.examDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={exam.examStatus || (exam as any).status || 'Scheduled'} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={exam.resultStatus || 'Not Imported'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Administrative Activities */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-[#6D5CE8] dark:text-violet-400" />
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Recent Administrative Activities
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/principal/audit-logs')}
            className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Open Audit Logs
          </button>
        </div>

        <div className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
          {(data.recentAdministrativeActivities || []).map((log) => (
            <div
              key={log.id}
              className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-[#1F2937] dark:text-slate-200 font-medium">
                  {log.activityDescription || (log as any).activity || 'Administrative event'}
                </p>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  {log.actorName || (log as any).userName || 'System'} ({log.actorRole || (log as any).userRole || 'Principal'}) · {log.departmentCode || (log as any).examinationRef || 'CS'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs text-[#64748B] dark:text-slate-400 tabular-nums">
                  {log.timestamp}
                </span>
                <StatusBadge status={log.status || (log as any).actionStatus || 'Completed'} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
