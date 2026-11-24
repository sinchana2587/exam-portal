import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  KeyRound,
  Lock,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { principalService } from '../../services/principalService';
import { useAuth } from '../../hooks/useAuth';
import { Department, HodAccountRecord } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const HodManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [hodAccounts, setHodAccounts] = useState<HodAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');

  // Department Workspace state
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [workspaceSemester, setWorkspaceSemester] = useState<number>(0);
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState<'students' | 'subjects' | 'results' | 'audit'>('students');

  // Create HOD & Department modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    employeeId: '',
    email: '',
    contactNumber: '',
    departmentName: '',
    departmentCode: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // View Details modal
  const [viewingHod, setViewingHod] = useState<HodAccountRecord | null>(null);

  // Edit HOD modal
  const [editingHod, setEditingHod] = useState<HodAccountRecord | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    designation: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Activate / Deactivate confirmation
  const [statusTarget, setStatusTarget] = useState<HodAccountRecord | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Replace HOD modal
  const [replacingHod, setReplacingHod] = useState<HodAccountRecord | null>(null);
  const [replaceForm, setReplaceForm] = useState({
    fullName: '',
    employeeId: '',
    email: '',
    contactNumber: '',
    reason: '',
  });
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);
  const [replaceError, setReplaceError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await principalService.getHodManagementData();
      setDepartments(res?.departments || []);
      setHodAccounts(res?.hodAccounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load HOD records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filteredHods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hodAccounts.filter((h) => {
      if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
      if (!q) return true;
      return (
        h.fullName.toLowerCase().includes(q) ||
        h.employeeId.toLowerCase().includes(q) ||
        h.departmentName.toLowerCase().includes(q) ||
        h.departmentCode.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q)
      );
    });
  }, [hodAccounts, search, statusFilter]);

  const loadWorkspace = useCallback(async (deptId: string, semester: number) => {
    setWorkspaceLoading(true);
    setWorkspaceError('');
    try {
      const data = await principalService.getDepartmentWorkspace(deptId, semester);
      setWorkspaceData(data);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Unable to load department workspace.');
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      loadWorkspace(selectedDeptId, workspaceSemester);
    } else {
      setWorkspaceData(null);
    }
  }, [selectedDeptId, workspaceSemester, loadWorkspace]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateError('');

    if (createForm.password) {
      if (createForm.password.length < 8) {
        setCreateError('Initial Password must be at least 8 characters.');
        return;
      }
      if (!/[A-Za-z]/.test(createForm.password) || !/[0-9]/.test(createForm.password)) {
        setCreateError('Initial Password must contain at least one letter and one number.');
        return;
      }
      if (createForm.password !== createForm.confirmPassword) {
        setCreateError('Password confirmation does not match.');
        return;
      }
    }

    setCreateSubmitting(true);
    try {
      const created = await principalService.createHodAndDepartment(
        {
          fullName: createForm.fullName,
          employeeId: createForm.employeeId,
          email: createForm.email,
          contactNumber: createForm.contactNumber,
          departmentName: createForm.departmentName,
          departmentCode: createForm.departmentCode,
          username: createForm.username.trim() || undefined,
          password: createForm.password || undefined,
        },
        user
      );
      setFeedback({
        type: 'success',
        text: `Created ${created.department.name} (${created.department.code}) and assigned ${created.hodAccount.fullName} as active HOD with secure credentials.`,
      });
      setCreateOpen(false);
      setCreateForm({
        fullName: '',
        employeeId: '',
        email: '',
        contactNumber: '',
        departmentName: '',
        departmentCode: '',
        username: '',
        password: '',
        confirmPassword: '',
      });
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create HOD & Department.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingHod) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      await principalService.updateHodAccount(editingHod.id, editForm, user);
      setFeedback({
        type: 'success',
        text: `Updated HOD details for ${editForm.fullName}.`,
      });
      setEditingHod(null);
      await loadData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update HOD record.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleStatusConfirm = async () => {
    if (!user || !statusTarget) return;
    setStatusSubmitting(true);
    setFeedback(null);
    const nextStatus = statusTarget.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await principalService.toggleHodStatus(statusTarget.id, nextStatus, user);
      setFeedback({
        type: 'success',
        text: `HOD account ${statusTarget.fullName} (${statusTarget.departmentCode}) set to ${nextStatus}.`,
      });
      setStatusTarget(null);
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to change HOD status.',
      });
      setStatusTarget(null);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !replacingHod) return;
    setReplaceError('');
    setReplaceSubmitting(true);
    try {
      const assigned = await principalService.replaceHodForDepartment(
        replacingHod.departmentId,
        replaceForm,
        user
      );
      setFeedback({
        type: 'success',
        text: `Replaced ${replacingHod.departmentCode} HOD atomically. ${replacingHod.fullName} is deactivated (historical records preserved) and ${assigned.fullName} is now the active HOD.`,
      });
      setReplacingHod(null);
      setReplaceForm({ fullName: '', employeeId: '', email: '', contactNumber: '', reason: '' });
      await loadData();
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Failed to replace HOD.');
    } finally {
      setReplaceSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            HOD Management
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Create departments with their active HOD in a single transaction, edit details, activate/deactivate, or safely replace an HOD while preserving historical records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError('');
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create HOD & Department</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-[#16834A]/10 border-[#16834A]/30 text-[#16834A] dark:text-emerald-300'
              : 'bg-[#B42318]/10 border-[#B42318]/30 text-[#B42318] dark:text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {selectedDeptId ? (
        /* ==================== DEPARTMENT WORKSPACE ==================== */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedDeptId(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#17243A] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Departments</span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#17243A] dark:text-white tracking-tight">
                    {workspaceData?.department?.name || departments.find((d) => d.id === selectedDeptId)?.name || 'Department'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
                    {workspaceData?.department?.code || departments.find((d) => d.id === selectedDeptId)?.code}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  ID: <span className="font-mono">{workspaceData?.department?.identificationNumber || departments.find((d) => d.id === selectedDeptId)?.identificationNumber}</span>
                  {workspaceData?.department?.hod && (
                    <> • Active HOD: <strong className="text-slate-700 dark:text-slate-200">{workspaceData.department.hod.fullName}</strong> ({workspaceData.department.hod.email})</>
                  )}
                </p>
              </div>
            </div>

            {/* Semester Filter Dropdown */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <label htmlFor="dept-sem-filter" className="text-xs font-semibold text-[#64748B] dark:text-slate-300 whitespace-nowrap">
                Filter Semester:
              </label>
              <select
                id="dept-sem-filter"
                value={workspaceSemester}
                onChange={(e) => setWorkspaceSemester(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-[#17243A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              >
                <option value={0}>All Semesters (1–8)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          {workspaceLoading ? (
            <div className="p-12 text-center text-sm text-[#64748B] dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800">
              Loading department workspace data...
            </div>
          ) : workspaceError ? (
            <div className="p-6 text-sm text-[#B42318] bg-white dark:bg-slate-900 rounded-xl border border-[#B42318]/30 flex items-center justify-between">
              <span>{workspaceError}</span>
              <button
                type="button"
                onClick={() => selectedDeptId && loadWorkspace(selectedDeptId, workspaceSemester)}
                className="px-3 py-1.5 rounded-md border text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Workspace Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 text-xs font-medium">
                    <span>Enrolled Students</span>
                    <Users className="w-4 h-4 text-[#2563EB]" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-[#17243A] dark:text-white">
                    {workspaceData?.students?.length ?? 0}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748B]">
                    {workspaceSemester ? `In Semester ${workspaceSemester}` : 'Across all semesters'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 text-xs font-medium">
                    <span>Curricular Subjects</span>
                    <BookOpen className="w-4 h-4 text-[#16834A]" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-[#17243A] dark:text-white">
                    {workspaceData?.subjects?.length ?? 0}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748B]">
                    {workspaceSemester ? `Semester ${workspaceSemester} courses` : 'Total department courses'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 text-xs font-medium">
                    <span>Evaluated Exams</span>
                    <BarChart3 className="w-4 h-4 text-[#6D5CE8]" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-[#17243A] dark:text-white">
                    {workspaceData?.results?.length ?? 0}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748B]">
                    Completed sessions recorded
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 text-xs font-medium">
                    <span>Audit Events</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-[#17243A] dark:text-white">
                    {workspaceData?.auditLogs?.length ?? 0}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748B]">
                    Departmental activity entries
                  </div>
                </div>
              </div>

              {/* Workspace Tabs */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="border-b border-[#D9E2EF] dark:border-slate-800 px-4 flex gap-2 overflow-x-auto">
                  {(
                    [
                      { id: 'students', label: 'Student Rosters', count: workspaceData?.students?.length },
                      { id: 'subjects', label: 'Curricular Subjects', count: workspaceData?.subjects?.length },
                      { id: 'results', label: 'Examinations & Performance', count: workspaceData?.results?.length },
                      { id: 'audit', label: 'Department Audit Trail', count: workspaceData?.auditLogs?.length },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setWorkspaceTab(tab.id)}
                      className={`py-3.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                        workspaceTab === tab.id
                          ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
                          : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#17243A] dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {typeof tab.count === 'number' && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-4 sm:p-5">
                  {workspaceTab === 'students' && (
                    <div>
                      {(!workspaceData?.students || workspaceData.students.length === 0) ? (
                        <div className="py-8 text-center text-sm text-[#64748B] dark:text-slate-400">
                          No students found {workspaceSemester ? `for Semester ${workspaceSemester}` : 'in this department'}.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 font-semibold text-[#64748B] dark:text-slate-300">
                                <th className="py-2.5 px-4">USN</th>
                                <th className="py-2.5 px-4">Student Name</th>
                                <th className="py-2.5 px-4">Email</th>
                                <th className="py-2.5 px-3">Semester</th>
                                <th className="py-2.5 px-3">Section</th>
                                <th className="py-2.5 px-4">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                              {workspaceData.students.map((st: any) => (
                                <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-4 font-mono font-semibold text-[#17243A] dark:text-white">{st.usn}</td>
                                  <td className="py-2.5 px-4 font-medium text-[#1F2937] dark:text-slate-200">{st.fullName}</td>
                                  <td className="py-2.5 px-4 text-[#64748B] dark:text-slate-400">{st.email}</td>
                                  <td className="py-2.5 px-3 font-semibold">Sem {st.semester}</td>
                                  <td className="py-2.5 px-3 font-mono">{st.section}</td>
                                  <td className="py-2.5 px-4">
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      {st.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {workspaceTab === 'subjects' && (
                    <div>
                      {(!workspaceData?.subjects || workspaceData.subjects.length === 0) ? (
                        <div className="py-8 text-center text-sm text-[#64748B] dark:text-slate-400">
                          No subjects registered {workspaceSemester ? `for Semester ${workspaceSemester}` : 'in this department'}.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 font-semibold text-[#64748B] dark:text-slate-300">
                                <th className="py-2.5 px-4">Subject Code</th>
                                <th className="py-2.5 px-4">Subject Name</th>
                                <th className="py-2.5 px-3">Semester</th>
                                <th className="py-2.5 px-3">Credits</th>
                                <th className="py-2.5 px-4">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                              {workspaceData.subjects.map((sub: any) => (
                                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-4 font-mono font-bold text-[#17243A] dark:text-white">{sub.code}</td>
                                  <td className="py-2.5 px-4 font-medium text-[#1F2937] dark:text-slate-200">{sub.name}</td>
                                  <td className="py-2.5 px-3 font-semibold">Sem {sub.semester}</td>
                                  <td className="py-2.5 px-3">{sub.credits}</td>
                                  <td className="py-2.5 px-4">
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      {sub.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {workspaceTab === 'results' && (
                    <div>
                      {(!workspaceData?.results || workspaceData.results.length === 0) ? (
                        <div className="py-8 text-center text-sm text-[#64748B] dark:text-slate-400">
                          No examination records or lab results found {workspaceSemester ? `for Semester ${workspaceSemester}` : 'for this department'}.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 font-semibold text-[#64748B] dark:text-slate-300">
                                <th className="py-2.5 px-4">Exam ID</th>
                                <th className="py-2.5 px-4">Subject</th>
                                <th className="py-2.5 px-3">Semester</th>
                                <th className="py-2.5 px-3">Passed</th>
                                <th className="py-2.5 px-3">Failed</th>
                                <th className="py-2.5 px-3">Average Score</th>
                                <th className="py-2.5 px-4">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                              {workspaceData.results.map((r: any) => (
                                <tr key={r.examinationId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-4 font-mono font-semibold">#{r.examinationId}</td>
                                  <td className="py-2.5 px-4">
                                    <div className="font-semibold text-[#17243A] dark:text-white">{r.subjectCode}</div>
                                    <div className="text-[11px] text-[#64748B] dark:text-slate-400">{r.subjectName}</div>
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold">Sem {r.semester}</td>
                                  <td className="py-2.5 px-3 text-emerald-600 font-bold">{r.passedCount}</td>
                                  <td className="py-2.5 px-3 text-rose-600 font-bold">{r.failedCount}</td>
                                  <td className="py-2.5 px-3 font-semibold">{r.averageScore ? `${Number(r.averageScore).toFixed(1)}%` : '—'}</td>
                                  <td className="py-2.5 px-4">
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                                      {r.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {workspaceTab === 'audit' && (
                    <div>
                      {(!workspaceData?.auditLogs || workspaceData.auditLogs.length === 0) ? (
                        <div className="py-8 text-center text-sm text-[#64748B] dark:text-slate-400">
                          No audit trail events logged for this department yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 font-semibold text-[#64748B] dark:text-slate-300">
                                <th className="py-2.5 px-4">Timestamp</th>
                                <th className="py-2.5 px-4">Action</th>
                                <th className="py-2.5 px-4">Actor</th>
                                <th className="py-2.5 px-4">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                              {workspaceData.auditLogs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748B]">
                                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                                  </td>
                                  <td className="py-2.5 px-4 font-semibold text-[#17243A] dark:text-white">
                                    {log.action}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <div className="font-medium text-[#1F2937] dark:text-slate-200">{log.actorName}</div>
                                    <div className="text-[10px] text-[#64748B]">{log.actorRole}</div>
                                  </td>
                                  <td className="py-2.5 px-4 text-[#64748B] dark:text-slate-300 max-w-md truncate">
                                    {log.details}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ==================== NORMAL DIRECTORY VIEW WITH DEPARTMENT CARDS ==================== */
        <>
          {/* Department Overview Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Institutional Departments ({departments.length})
              </h2>
              <span className="text-xs text-[#64748B] dark:text-slate-400">
                Click any department to inspect subjects, rosters, and semester performance
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => {
                const activeHod = hodAccounts.find((h) => h.departmentId === dept.id && h.status === 'Active');
                return (
                  <div
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-5 shadow-xs hover:border-[#2563EB] dark:hover:border-[#2563EB] hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-400 border border-[#2563EB]/20">
                          {dept.code}
                        </span>
                        <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                          {dept.identificationNumber}
                        </span>
                      </div>
                      <h3 className="font-bold text-[#17243A] dark:text-white group-hover:text-[#2563EB] transition-colors">
                        {dept.name}
                      </h3>
                      <div className="mt-3 pt-3 border-t border-[#D9E2EF] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>HOD: <strong className="text-[#1F2937] dark:text-slate-200">{activeHod ? activeHod.fullName : 'Vacant / Unassigned'}</strong></span>
                        </div>
                        {activeHod && (
                          <div className="text-[11px] text-[#64748B] pl-5 truncate">
                            {activeHod.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 flex items-center justify-between text-xs font-semibold text-[#2563EB] dark:text-blue-400 border-t border-slate-100 dark:border-slate-800/80">
                      <span>Open Workspace</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by HOD name, Employee ID, or Department..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div className="flex items-center gap-2">
              {(['ALL', 'Active', 'Inactive'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#17243A] dark:bg-[#2563EB] text-white border-[#17243A] dark:border-[#2563EB]'
                      : 'bg-[#F5F7FB] dark:bg-slate-800 text-[#64748B] dark:text-slate-300 border-[#D9E2EF] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {st === 'ALL' ? `All (${hodAccounts.length})` : st}
                </button>
              ))}
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-[#64748B] dark:text-slate-400">
                Loading departments and HOD directory...
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-[#B42318] dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B42318]/40 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : filteredHods.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#64748B] dark:text-slate-400">
                No matching HOD accounts found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                      <th className="py-3.5 px-5">Department</th>
                      <th className="py-3.5 px-4">HOD Name</th>
                      <th className="py-3.5 px-4">Employee ID</th>
                      <th className="py-3.5 px-4">Official Email & Contact</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm">
                    {filteredHods.map((hod) => {
                      const dept = departments.find((d) => d.id === hod.departmentId);
                      return (
                        <tr
                          key={hod.id}
                          className="hover:bg-[#F5F7FB]/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-[#17243A] dark:text-white">
                              {hod.departmentCode}
                            </div>
                            <div className="text-xs text-[#64748B] dark:text-slate-400">
                              {hod.departmentName}
                            </div>
                            {dept && (
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {dept.identificationNumber}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#17243A] dark:text-slate-100">
                              {hod.fullName}
                            </div>
                            <div className="text-xs text-[#64748B] dark:text-slate-400">
                              Assigned: {hod.assignedAt}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-[#1F2937] dark:text-slate-300">
                            {hod.employeeId}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="text-[#1F2937] dark:text-slate-200">{hod.email}</div>
                            <div className="text-[#64748B] dark:text-slate-400 mt-0.5">
                              {hod.contactNumber}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={hod.status} />
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingHod(hod)}
                                title="View HOD details"
                                className="p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#64748B] dark:text-slate-300 hover:text-[#17243A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditError('');
                                  setEditingHod(hod);
                                  setEditForm({
                                    fullName: hod.fullName,
                                    email: hod.email,
                                    contactNumber: hod.contactNumber,
                                    designation: hod.designation,
                                  });
                                }}
                                title="Edit permitted HOD info"
                                className="p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#2563EB] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setStatusTarget(hod)}
                                title={hod.status === 'Active' ? 'Deactivate HOD' : 'Activate HOD'}
                                className={`p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 ${
                                  hod.status === 'Active'
                                    ? 'text-[#B42318] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                    : 'text-[#16834A] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              {hod.status === 'Active' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplaceError('');
                                    setReplacingHod(hod);
                                    setReplaceForm({
                                      fullName: '',
                                      employeeId: '',
                                      email: '',
                                      contactNumber: '',
                                      reason: '',
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#6D5CE8]/10 hover:bg-[#6D5CE8]/20 text-[#6D5CE8] dark:text-violet-300 border border-[#6D5CE8]/30 text-xs font-semibold whitespace-nowrap"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Replace</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create HOD & Department Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Create HOD & Department (Single Transaction)
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#17243A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="p-3 rounded-md bg-[#B42318]/10 border border-[#B42318]/30 text-xs font-medium text-[#B42318] dark:text-red-300">
                  {createError}
                </div>
              )}

              <div className="text-xs font-bold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                Department Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Department Name</label>
                  <input
                    type="text"
                    required
                    value={createForm.departmentName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, departmentName: e.target.value })
                    }
                    placeholder="Enter department name"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Department Code</label>
                  <input
                    type="text"
                    required
                    value={createForm.departmentCode}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, departmentCode: e.target.value })
                    }
                    placeholder="Enter code (e.g., CSE)"
                    className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 text-xs font-bold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                Active HOD Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="Enter HOD full name"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    value={createForm.employeeId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, employeeId: e.target.value.toUpperCase() })
                    }
                    placeholder="Enter Employee ID"
                    className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="Enter official email"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Contact Number</label>
                  <input
                    type="text"
                    required
                    value={createForm.contactNumber}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, contactNumber: e.target.value })
                    }
                    placeholder="Enter mobile number"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 text-xs font-bold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                Sign-In Credentials
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Username (Optional)</label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="e.g., hod_cse (defaults to email)"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Initial Password</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min 8 chars (letter + number)"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="p-3 rounded-md bg-[#F5F7FB] dark:bg-slate-800 text-xs text-[#64748B] dark:text-slate-300">
                Department and HOD records are created atomically in a single database transaction. Passwords are encrypted with PBKDF2 (600,000 iterations).
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#D9E2EF] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:opacity-60"
                >
                  {createSubmitting ? 'Creating...' : 'Create HOD & Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingHod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                HOD Account Details
              </h2>
              <button
                type="button"
                onClick={() => setViewingHod(null)}
                className="p-1 text-[#64748B] hover:text-[#17243A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-[#64748B]">Full Name</div>
                  <div className="font-semibold">{viewingHod.fullName}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Employee ID</div>
                  <div className="font-mono font-semibold">{viewingHod.employeeId}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Department</div>
                  <div className="font-semibold">
                    {viewingHod.departmentName} ({viewingHod.departmentCode})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Status</div>
                  <div className="mt-1">
                    <StatusBadge status={viewingHod.status} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Official Email</div>
                  <div className="break-all">{viewingHod.email}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Contact Number</div>
                  <div>{viewingHod.contactNumber}</div>
                </div>
              </div>

              {viewingHod.assignmentHistory && viewingHod.assignmentHistory.length > 0 && (
                <div className="pt-3 border-t border-[#D9E2EF] dark:border-slate-800">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                    Assignment History
                  </div>
                  <div className="space-y-2">
                    {viewingHod.assignmentHistory.map((h, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-md bg-[#F5F7FB] dark:bg-slate-800 text-xs flex justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold">{h.departmentCode}</span> · {h.reason || 'Assigned'}
                        </div>
                        <span className="font-mono text-[#64748B] shrink-0">
                          {h.fromDate} → {h.toDate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingHod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Edit HOD Information ({editingHod.employeeId})
              </h2>
              <button
                type="button"
                onClick={() => setEditingHod(null)}
                className="p-1 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-3.5">
              {editError && (
                <div className="p-3 rounded-md bg-[#B42318]/10 text-xs text-[#B42318]">
                  {editError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Contact Number</label>
                <input
                  type="text"
                  required
                  value={editForm.contactNumber}
                  onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingHod(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] text-white"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replace HOD Modal */}
      {replacingHod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                Replace Active HOD — {replacingHod.departmentName} ({replacingHod.departmentCode})
              </h2>
              <button
                type="button"
                onClick={() => setReplacingHod(null)}
                className="p-1 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleReplaceSubmit} className="p-6 space-y-3.5">
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                Single Atomic Transition: Current HOD <strong>{replacingHod.fullName}</strong> ({replacingHod.employeeId}) will be deactivated while preserving all historical records and audit trails.
              </div>
              {replaceError && (
                <div className="p-3 rounded-md bg-[#B42318]/10 text-xs text-[#B42318]">
                  {replaceError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">New HOD Full Name</label>
                  <input
                    type="text"
                    required
                    value={replaceForm.fullName}
                    onChange={(e) => setReplaceForm({ ...replaceForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">New Employee ID</label>
                  <input
                    type="text"
                    required
                    value={replaceForm.employeeId}
                    onChange={(e) =>
                      setReplaceForm({ ...replaceForm, employeeId: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    value={replaceForm.email}
                    onChange={(e) => setReplaceForm({ ...replaceForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Contact Number</label>
                  <input
                    type="text"
                    required
                    value={replaceForm.contactNumber}
                    onChange={(e) =>
                      setReplaceForm({ ...replaceForm, contactNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Transition Reason</label>
                <input
                  type="text"
                  required
                  value={replaceForm.reason}
                  onChange={(e) => setReplaceForm({ ...replaceForm, reason: e.target.value })}
                  placeholder="e.g., Rotational HOD Appointment Order"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setReplacingHod(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replaceSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#6D5CE8] hover:bg-[#5847D6] text-white"
                >
                  {replaceSubmitting ? 'Replacing...' : 'Confirm HOD Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate / Deactivate Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        title={
          statusTarget?.status === 'Active'
            ? `Deactivate HOD (${statusTarget.fullName})?`
            : `Activate HOD (${statusTarget?.fullName})?`
        }
        description={
          statusTarget?.status === 'Active'
            ? `Deactivating ${statusTarget.fullName} revokes portal sign-in for ${statusTarget.departmentCode} while preserving all historical departmental records.`
            : `Activating ${statusTarget?.fullName} is allowed only if ${statusTarget?.departmentCode} has no other active HOD.`
        }
        confirmLabel={statusTarget?.status === 'Active' ? 'Deactivate HOD' : 'Activate HOD'}
        variant={statusTarget?.status === 'Active' ? 'destructive' : 'primary'}
        isLoading={statusSubmitting}
        onConfirm={handleStatusConfirm}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
};
