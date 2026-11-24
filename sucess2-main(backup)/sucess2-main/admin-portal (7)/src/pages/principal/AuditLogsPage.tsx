import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ClipboardList, Download, Eye, FilterX, Lock, RefreshCw, Search, X } from 'lucide-react';
import { auditService, AuditFilterParams } from '../../services/auditService';
import { useAuth } from '../../hooks/useAuth';
import { AuditActorRole, AuditCategory, AuditLogEntry, Department } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { exportRowsToCsv } from '../../utils/exportUtils';

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  HOD_DEPARTMENT_CREATED: 'HOD & Dept Creation',
  HOD_UPDATED: 'HOD Profile Updated',
  HOD_STATUS_CHANGED: 'HOD Activation/Deactivation',
  HOD_REPLACED: 'HOD Replaced',
  SUBJECT_CREATED: 'Subject Created',
  SUBJECT_UPDATED: 'Subject Updated',
  SUBJECT_ARCHIVED: 'Subject Archived/Deleted',
  STUDENT_LIST_UPLOADED: 'Student List Uploaded',
  STUDENT_LIST_REPLACED: 'Student List Replaced',
  STUDENT_RECORD_UPDATED: 'Student Record Updated',
  QUESTION_UPLOADED: 'Question Uploaded',
  QUESTION_PUBLISHED: 'Question Sets Published',
  KEY_CORRECTION_REQUESTED: 'Key Correction Requested',
  KEY_CORRECTION_DECIDED: 'Key Correction Decided',
  EXAM_STATUS_UPDATED: 'Exam Status Updated',
  RESULT_IMPORTED_RELEASED: 'Result Imported / Released',
  REPORT_VIEWED_EXPORTED: 'Report Viewed / Exported',
  ACCOUNT_SECURITY_EVENT: 'Account & Security Event',
};

export const AuditLogsPage: React.FC = () => {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const [filters, setFilters] = useState<AuditFilterParams>({
    search: '',
    departmentId: 'ALL',
    actorRole: 'ALL',
    category: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const loadLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await auditService.getAuditLogs(user, filters);
      setLogs(res?.logs || []);
      setDepartments(res?.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleReset = () => {
    setFilters({
      search: '',
      departmentId: 'ALL',
      actorRole: 'ALL',
      category: 'ALL',
      dateFrom: '',
      dateTo: '',
    });
  };

  const handleCsvExport = () => {
    if (!user || logs.length === 0) return;
    const headers = [
      'Timestamp',
      'Actor Name',
      'Employee ID',
      'Role',
      'Department',
      'Category',
      'Subject',
      'Activity Description',
      'Status',
    ];
    const rows = logs.map((l) => [
      l.timestamp,
      l.actorName,
      l.actorEmployeeId,
      l.actorRole,
      l.departmentCode,
      CATEGORY_LABELS[l.actionCategory] || l.actionCategory,
      l.subjectCode || '-',
      l.activityDescription,
      l.status,
    ]);
    exportRowsToCsv(
      `MITM_${isPrincipal ? 'Institution' : user.departmentCode}_Audit_Logs.csv`,
      headers,
      rows
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            {isPrincipal ? 'Institutional Audit Logs' : `Department Audit Logs (${user?.departmentCode})`}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            {isPrincipal
              ? 'Read-only institution-wide activity trail across departments, HOD governance, examinations, and result releases.'
              : `Read-only activity history scoped strictly to ${user?.departmentName} across HOD, Principal, COE, and System actions.`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCsvExport}
          disabled={logs.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#17243A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#2563EB]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div className={isPrincipal ? 'lg:col-span-2' : 'lg:col-span-2'}>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Search Activity, User, Subject, or USN
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search audit entries..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        {isPrincipal && (
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
              Department
            </label>
            <select
              value={filters.departmentId || 'ALL'}
              onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="ALL">All Departments</option>
              <option value="INSTITUTION">Institution Level</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Performed By
          </label>
          <select
            value={filters.actorRole || 'ALL'}
            onChange={(e) =>
              setFilters({ ...filters, actorRole: e.target.value as AuditActorRole | 'ALL' })
            }
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="ALL">All Roles</option>
            <option value="HOD">HOD</option>
            <option value="PRINCIPAL">Principal</option>
            <option value="COE">COE</option>
            <option value="SYSTEM">System</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
            Activity Category
          </label>
          <select
            value={filters.category || 'ALL'}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value as AuditCategory | 'ALL' })
            }
            className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-end col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-2 py-2 text-xs rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-2 py-2 text-xs rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={handleReset}
            title="Reset Filters"
            className="p-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#64748B] hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            <FilterX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Read-Only Notice */}
      <div className="px-4 py-2.5 rounded-lg bg-[#F5F7FB] dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 flex items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
        <Lock className="w-3.5 h-3.5 text-[#6D5CE8] shrink-0" />
        <span>
          Audit records are read-only in this portal. Sensitive credentials, tokens, student DOBs, and answer-key details are excluded from audit descriptions.
        </span>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#64748B]">Loading audit trail...</div>
        ) : error ? (
          <div className="p-6 text-sm text-[#B42318] dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B42318]/40 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#64748B] dark:text-slate-400 flex flex-col items-center gap-2">
            <ClipboardList className="w-6 h-6 text-slate-400" />
            <span>No audit log entries match your current filter criteria.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Activity Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm">
                {logs.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-[#F5F7FB]/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-5 font-mono text-xs text-[#64748B] dark:text-slate-400 whitespace-nowrap tabular-nums">
                      {entry.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#17243A] dark:text-white text-xs">
                        {entry.actorName}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {entry.actorRole} · {entry.actorEmployeeId}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-[#17243A] dark:text-slate-200">
                      {entry.departmentCode}
                      {entry.subjectCode ? ` · ${entry.subjectCode}` : ''}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#64748B] dark:text-slate-300 whitespace-nowrap">
                      {CATEGORY_LABELS[entry.actionCategory] || entry.actionCategory}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#1F2937] dark:text-slate-200 max-w-md">
                      <div className="line-clamp-2" title={entry.activityDescription}>
                        {entry.activityDescription}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(entry)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#2563EB] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold transition-colors"
                        title="View Full Entry Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Log Entry Details Modal */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full border border-[#D9E2EF] dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#17243A] dark:text-white">
                  Audit Log Entry Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-[#D9E2EF] dark:border-slate-700">
                <div>
                  <div className="text-[#64748B] font-medium">Timestamp</div>
                  <div className="font-mono font-semibold text-[#17243A] dark:text-white mt-0.5">{selectedLog.timestamp}</div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Action Status</div>
                  <div className="mt-0.5"><StatusBadge status={selectedLog.status} /></div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Performed By</div>
                  <div className="font-semibold text-[#17243A] dark:text-white mt-0.5">{selectedLog.actorName}</div>
                  <div className="text-[11px] text-[#64748B]">{selectedLog.actorRole} · ID: {selectedLog.actorEmployeeId}</div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Category</div>
                  <div className="font-semibold text-[#17243A] dark:text-white mt-0.5">
                    {CATEGORY_LABELS[selectedLog.actionCategory] || selectedLog.actionCategory}
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Department Scope</div>
                  <div className="font-semibold text-[#17243A] dark:text-white mt-0.5">{selectedLog.departmentCode}</div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Subject Code</div>
                  <div className="font-mono text-[#17243A] dark:text-white mt-0.5">{selectedLog.subjectCode || '—'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-1.5">
                  Full Activity Description
                </div>
                <div className="p-3.5 rounded-lg bg-white dark:bg-slate-950 border border-[#D9E2EF] dark:border-slate-800 font-mono text-xs leading-relaxed text-[#17243A] dark:text-slate-200 whitespace-pre-wrap break-words">
                  {selectedLog.activityDescription}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-[#D9E2EF] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
