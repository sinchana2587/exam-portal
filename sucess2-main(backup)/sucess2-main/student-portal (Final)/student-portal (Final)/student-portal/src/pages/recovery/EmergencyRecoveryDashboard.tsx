/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  History,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Maximize2,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import {
  emergencyRecoveryService,
  FIXED_RECOVERY_CREDENTIALS,
} from '../../services/emergencyRecoveryService';
import {
  EmergencyRecoveryConfig,
  RecoveryAuditLog,
  SessionTransferRecord,
  StudentRecoveryOverview,
} from '../../types/recovery';

export interface EmergencyRecoveryDashboardProps {
  onClose?: () => void;
}

export const EmergencyRecoveryDashboard: React.FC<EmergencyRecoveryDashboardProps> = ({
  onClose,
}) => {
  const navigate = useNavigate();

  // Authentication check
  useEffect(() => {
    if (!emergencyRecoveryService.isInstructorAuthenticated()) {
      if (onClose) {
        onClose();
      } else {
        navigate('/instructor/login', { replace: true });
      }
    }
  }, [navigate, onClose]);

  // Tab management: 'relogin' (default per requirement) | 'overview' | 'transfers' | 'audit' | 'coe'
  const [activeTab, setActiveTab] = useState<'relogin' | 'overview' | 'transfers' | 'audit' | 'coe'>('relogin');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedLab, setSelectedLab] = useState('ALL');

  // Records state
  const [reloginRecords, setReloginRecords] = useState<Awaited<ReturnType<typeof emergencyRecoveryService.getStudentReLoginAuthorisationList>>>([]);
  const [records, setRecords] = useState<StudentRecoveryOverview[]>([]);
  const [transfers, setTransfers] = useState<SessionTransferRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<RecoveryAuditLog[]>([]);
  const [coeConfig, setCoeConfig] = useState<EmergencyRecoveryConfig>({
    enabled: true,
    recoveryId: FIXED_RECOVERY_CREDENTIALS.recoveryId,
    recoveryKey: FIXED_RECOVERY_CREDENTIALS.recoveryKey,
  });
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal & Action states
  const [approveModalStudent, setApproveModalStudent] = useState<{
    usn: string;
    name: string;
    systemId: string;
  } | null>(null);
  const [approvalReason, setApprovalReason] = useState('Terminal Hardware Crash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const loadAllData = async () => {
    setIsLoadingData(true);
    setLoadError(null);
    try {
      const [rel, rec, trf, aud, cfg] = await Promise.all([
        emergencyRecoveryService.getStudentReLoginAuthorisationList(),
        emergencyRecoveryService.getAllStudentRecoveryRecords(),
        emergencyRecoveryService.getTransferHistory(),
        emergencyRecoveryService.getAuditLogs(),
        emergencyRecoveryService.getCoeConfig(),
      ]);
      setReloginRecords(rel);
      setRecords(rec);
      setTransfers(trf);
      setAuditLogs(aud);
      setCoeConfig(cfg);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve recovery records from Lab Server.'
      );
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // Enforce full-screen mode when logged in to COE Emergency Console
    if (
      typeof document !== 'undefined' &&
      !document.fullscreenElement &&
      document.documentElement?.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleRefreshAuthorisationsFreshStart = async () => {
    setIsProcessing(true);
    try {
      await emergencyRecoveryService.clearAllRecoveryData();
      await loadAllData();
      setSuccessBanner(
        'Fresh Start Initialized: All candidate authorizations, session attempts, saved answers, and locks have been cleared. No saved data remains.'
      );
      setErrorBanner(null);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to clear session recovery data.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    await emergencyRecoveryService.logoutInstructor();
    if (onClose) {
      onClose();
    } else {
      navigate('/instructor/login', { replace: true });
    }
  };

  const handleApproveConfirm = async () => {
    if (!approveModalStudent) return;
    setIsProcessing(true);
    setErrorBanner(null);

    try {
      const token = await emergencyRecoveryService.approveStudentReLogin({
        usn: approveModalStudent.usn,
        reason: approvalReason,
      });

      setSuccessBanner(
        `Re-login approved for ${approveModalStudent.name} (${approveModalStudent.usn}). One-time authorization token generated: [${token.tokenId}]. Valid for 15 minutes. Candidate can now log in on ANY available PC in the lab with their original credentials.`
      );
      setApproveModalStudent(null);
      loadAllData();
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to approve re-login.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCoeStatus = async () => {
    try {
      const updated = await emergencyRecoveryService.updateCoeConfig({
        enabled: !coeConfig.enabled,
      });
      setCoeConfig(updated);
      setSuccessBanner(
        `Emergency Recovery System is now ${updated.enabled ? 'ENABLED' : 'DISABLED'} by COE.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to update COE configuration.'
      );
    }
  };

  // Filter students for general overview
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.usn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      selectedDept === 'ALL' || r.department.toLowerCase().includes(selectedDept.toLowerCase());
    const matchesStatus =
      selectedStatus === 'ALL' || r.status.toUpperCase() === selectedStatus.toUpperCase();
    const matchesLab =
      selectedLab === 'ALL' || r.laboratory.toLowerCase().includes(selectedLab.toLowerCase());

    return matchesSearch && matchesDept && matchesStatus && matchesLab;
  });

  // Filter for Student Re-Login Authorisation tab
  const filteredReloginRecords = reloginRecords.filter((r) => {
    return (
      r.studentUsn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.assignedSystemId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Calculate Metrics
  const activeCount = records.filter((r) => r.status === 'Active').length;
  const interruptedCount = reloginRecords.filter(
    (r) => r.examinationSessionStatus === 'INTERRUPTED' || r.reloginRequestStatus === 'PENDING_APPROVAL'
  ).length;
  const pendingCount = reloginRecords.filter(
    (r) => r.reloginRequestStatus === 'APPROVED'
  ).length;
  const completedCount = transfers.length;

  return (
    <div className="min-h-[100dvh] bg-[#F7F9FC] flex flex-col justify-between font-sans text-[#243247]">
      {/* Standard Shared Institutional Header */}
      <InstitutionHeader
        subtitle="COE Emergency Examination Recovery & Re-Login Console"
        rightSlot={
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs sm:text-sm font-bold text-[#102A43] bg-white border border-[#CBD5E1] shadow-xs px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px]">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#2463B5]" />
              <span>Instructor ID: {FIXED_RECOVERY_CREDENTIALS.recoveryId}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof document !== 'undefined') {
                  if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  } else if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                  }
                }
              }}
              className="h-[42px] inline-flex items-center gap-2 px-3.5 sm:px-4 rounded-[8px] border border-[#CBD5E1] bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-[#102A43] transition-colors duration-150 cursor-pointer"
              title="Toggle Fullscreen Mode"
            >
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#2463B5]" />
              <span className="hidden sm:inline">Full Screen</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="h-[42px] inline-flex items-center gap-2 px-3.5 sm:px-4 rounded-[8px] border border-[#CBD5E1] bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-[#102A43] transition-colors duration-150 cursor-pointer"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-[#64748B]" />
              <span>Exit Console</span>
            </button>
          </div>
        }
      />

      {/* Main Console Workspace */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Success Banner */}
        {successBanner && (
          <div
            role="alert"
            className="p-4 rounded-[6px] bg-emerald-50 border border-emerald-200 text-[#16865B] text-xs sm:text-sm flex items-start gap-3 animate-in fade-in"
          >
            <CheckCircle2 className="w-5 h-5 text-[#16865B] shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{successBanner}</div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-[#16865B] hover:text-emerald-900 p-1 cursor-pointer transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorBanner && (
          <div
            role="alert"
            className="p-4 rounded-[6px] bg-red-50 border border-red-200 text-[#B42318] text-xs sm:text-sm flex items-start gap-3 animate-in fade-in"
          >
            <AlertCircle className="w-5 h-5 text-[#B42318] shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorBanner}</div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-[#B42318] hover:text-red-900 p-1 cursor-pointer transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadError && !records.length && !reloginRecords.length && (
          <ErrorState
            title="Failed to Load Emergency Recovery Console"
            message={loadError}
            onRetry={loadAllData}
            isRetrying={isLoadingData}
          />
        )}

        {isLoadingData && !records.length && !reloginRecords.length && (
          <LoadingState
            message="Loading Emergency Examination Recovery Console..."
            subMessage="Fetching candidate registers, transfer logs, and COE authorizations from the Lab Server"
          />
        )}

        {/* Status / Metric KPI Cards */}
        <section
          aria-label="Examination Session Metrics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Card 1: Active Candidates */}
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-4 sm:p-5 institutional-card-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Active Candidates
              </span>
              <div className="w-8 h-8 rounded-[6px] bg-emerald-50 border border-emerald-200 text-[#16865B] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#102A43] mt-2">
              {activeCount}
            </div>
            <div className="text-xs text-[#64748B] mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16865B]"></span>
              <span>Online in active examination</span>
            </div>
          </div>

          {/* Card 2: Interrupted / Crashed */}
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-4 sm:p-5 institutional-card-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Interrupted Sessions
              </span>
              <div className="w-8 h-8 rounded-[6px] bg-red-50 border border-red-200 text-[#B42318] flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#B42318] mt-2">
              {interruptedCount}
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              <span>Awaiting instructor re-login approval</span>
            </div>
          </div>

          {/* Card 3: Pending Re-Login Tokens */}
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-4 sm:p-5 institutional-card-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Approved Tokens
              </span>
              <div className="w-8 h-8 rounded-[6px] bg-blue-50 border border-blue-200 text-[#2463B5] flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#2463B5] mt-2">
              {pendingCount}
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              <span>Token issued · Ready for re-login</span>
            </div>
          </div>

          {/* Card 4: Migrations Completed */}
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-4 sm:p-5 institutional-card-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Completed Re-Logins
              </span>
              <div className="w-8 h-8 rounded-[6px] bg-blue-50 border border-blue-200 text-[#2463B5] flex items-center justify-center">
                <History className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#102A43] mt-2">
              {completedCount}
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              <span>Transfers committed to database</span>
            </div>
          </div>
        </section>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-2 border-b border-[#DCE3EC] bg-white rounded-t-[10px] px-4 pt-3 overflow-x-auto">
          {/* Dedicated Section 5 Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('relogin')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'relogin'
                ? 'border-[#2463B5] text-[#2463B5]'
                : 'border-transparent text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Student Re-Login Authorisation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'overview'
                ? 'border-[#2463B5] text-[#2463B5]'
                : 'border-transparent text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>All Candidate Sessions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'transfers'
                ? 'border-[#2463B5] text-[#2463B5]'
                : 'border-transparent text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Transfer History ({transfers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'audit'
                ? 'border-[#2463B5] text-[#2463B5]'
                : 'border-transparent text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security Audit Trail</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('coe')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'coe'
                ? 'border-[#2463B5] text-[#2463B5]'
                : 'border-transparent text-[#64748B] hover:text-[#102A43]'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>COE Master Controls</span>
          </button>
        </div>

        {/* DEDICATED SECTION 5: STUDENT RE-LOGIN AUTHORISATION */}
        {activeTab === 'relogin' && (
          <div className="space-y-4">
            {/* Header description and search toolbar */}
            <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-4 institutional-card-shadow flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Student USN, Name, or System ID (e.g. 4MH25CS149)..."
                  className="h-[43px] w-full pl-9 pr-8 rounded-[6px] border border-[#CBD5E1] text-sm text-[#243247] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#243247] p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshAuthorisationsFreshStart}
                  className="h-[43px] inline-flex items-center gap-1.5 px-3.5 rounded-[6px] border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-[#2463B5] transition-colors duration-150 cursor-pointer"
                  title="Wipes previous candidate sessions, saved answers, and locks for a clean evaluation restart"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#2463B5]" />
                  <span>Refresh Authorisations (Fresh Start)</span>
                </button>
              </div>
            </div>

            {/* Dedicated Table with Required Columns */}
            <div className="bg-white border border-[#DCE3EC] rounded-[10px] overflow-hidden institutional-card-shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#DCE3EC] text-[#102A43] font-bold">
                      <th className="py-3 px-4">Student USN</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 font-mono">Logged-In Workstation ID</th>
                      <th className="py-3 px-4 font-mono">Re-Login Workstation ID</th>
                      <th className="py-3 px-4">Examination Session Status</th>
                      <th className="py-3 px-4">Re-login Request Status</th>
                      <th className="py-3 px-4">Instructor Authorisation</th>
                      <th className="py-3 px-4">Date and Time</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EC]">
                    {filteredReloginRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8">
                          <EmptyState
                            title={reloginRecords.length === 0 ? "No Re-Login Authorization Requests" : "No Matching Student Records"}
                            description={reloginRecords.length === 0 ? "No candidate terminals currently require instructor re-login authorization." : "No candidates matched your search criteria."}
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredReloginRecords.map((item) => (
                        <tr
                          key={item.studentUsn}
                          className={`hover:bg-slate-50 transition-colors duration-150 ${
                            item.examinationSessionStatus === 'INTERRUPTED'
                              ? 'bg-red-50/40'
                              : item.reloginRequestStatus === 'APPROVED'
                              ? 'bg-blue-50/30'
                              : ''
                          }`}
                        >
                          {/* 1. Student USN */}
                          <td className="py-3 px-4 font-mono font-bold text-[#2463B5]">
                            {item.studentUsn}
                          </td>

                          {/* 2. Student Name */}
                          <td className="py-3 px-4 font-semibold text-[#102A43]">
                            {item.studentName}
                          </td>

                          {/* 3. Logged-In Workstation ID (workstation student logged in into) */}
                          <td className="py-3 px-4 font-mono">
                            <span className="px-2 py-0.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] text-[#243247] font-bold">
                              {item.assignedSystemId}
                            </span>
                          </td>

                          {/* 4. Re-Login Workstation ID (where student relogged in & continued) */}
                          <td className="py-3 px-4 font-mono">
                            {item.reloginSystemId ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-emerald-50 border border-emerald-300 text-[#16865B] font-bold text-xs w-fit">
                                  <Laptop className="w-3.5 h-3.5" />
                                  <span>{item.reloginSystemId}</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 font-sans font-medium">
                                  Re-logged &amp; Resumed
                                </span>
                              </div>
                            ) : item.reloginRequestStatus === 'APPROVED' ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-amber-50 border border-amber-200 text-[#B54708] text-xs font-semibold w-fit">
                                  <Clock className="w-3 h-3 text-[#B54708]" />
                                  <span>Not Re-Logged In Yet</span>
                                </span>
                                <span className="text-[10px] text-[#64748B] font-sans">
                                  Permission Granted (Any PC)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#64748B] text-xs">—</span>
                            )}
                          </td>

                          {/* 5. Examination Session Status */}
                          <td className="py-3 px-4">
                            {item.examinationSessionStatus === 'INTERRUPTED' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-red-50 border border-red-200 text-[#B42318] text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#B42318]"></span>
                                <span>Session Interrupted</span>
                              </span>
                            )}
                            {item.examinationSessionStatus === 'LOCKED' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-amber-50 border border-amber-200 text-[#B54708] text-xs font-bold">
                                <Lock className="w-3 h-3 text-[#B54708]" />
                                <span>Login Locked (Already Used)</span>
                              </span>
                            )}
                            {item.examinationSessionStatus === 'ACTIVE' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-[#16865B] text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#16865B]"></span>
                                <span>Active Session</span>
                              </span>
                            )}
                            {item.examinationSessionStatus === 'COMPLETED' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] text-[#64748B] text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-[#16865B]" />
                                <span>Submitted</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Re-login Request Status */}
                          <td className="py-3 px-4">
                            {item.reloginRequestStatus === 'PENDING_APPROVAL' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-amber-50 border border-amber-200 text-[#B54708] text-xs font-bold">
                                <Clock className="w-3 h-3 text-[#B54708]" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                            {item.reloginRequestStatus === 'APPROVED' && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-blue-50 border border-blue-200 text-[#2463B5] text-xs font-bold">
                                  <KeyRound className="w-3 h-3 text-[#2463B5]" />
                                  <span>Approved (Token Active)</span>
                                </span>
                                {item.activeTokenId && (
                                  <div className="font-mono text-[10px] text-[#2463B5]">
                                    {item.activeTokenId}
                                  </div>
                                )}
                              </div>
                            )}
                            {item.reloginRequestStatus === 'CONSUMED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-[#16865B] text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-[#16865B]" />
                                <span>Token Consumed</span>
                              </span>
                            )}
                            {item.reloginRequestStatus === 'NONE' && (
                              <span className="text-[#64748B] text-xs">—</span>
                            )}
                          </td>

                          {/* 7. Instructor Authorisation */}
                          <td className="py-3 px-4 text-xs font-mono text-[#243247]">
                            {item.instructorAuthorisation}
                          </td>

                          {/* 8. Date and Time */}
                          <td className="py-3 px-4 text-xs font-mono text-[#64748B] whitespace-nowrap">
                            {item.dateTime}
                          </td>

                          {/* 9. Approve Re-Login Action */}
                          <td className="py-3 px-4 text-right">
                            {item.examinationSessionStatus === 'COMPLETED' ? (
                              <span className="text-[#64748B] text-xs italic">
                                Already Submitted
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setApprovalReason('Candidate Logged Out / Exited Browser');
                                  setApproveModalStudent({
                                    usn: item.studentUsn,
                                    name: item.studentName,
                                    systemId: item.assignedSystemId,
                                  });
                                }}
                                className="h-[36px] inline-flex items-center gap-1.5 px-3 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white font-bold text-xs transition-colors duration-150 cursor-pointer"
                              >
                                <span>
                                  {item.reloginRequestStatus === 'APPROVED'
                                    ? 'Re-Approve / Update'
                                    : 'Approve Re-Login'}
                                </span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OVERVIEW & ACTIVE STUDENT SEARCH / GENERAL TABLE */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-4 institutional-card-shadow flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student USN or Name..."
                  className="h-[43px] w-full pl-9 pr-8 rounded-[6px] border border-[#CBD5E1] text-sm text-[#243247] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-[43px] bg-white border border-[#CBD5E1] rounded-[6px] px-3 text-xs font-semibold text-[#243247] focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Science">Information Science</option>
                  <option value="Artificial Intelligence">AI &amp; ML</option>
                  <option value="Electronics">Electronics</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-[43px] bg-white border border-[#CBD5E1] rounded-[6px] px-3 text-xs font-semibold text-[#243247] focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INTERRUPTED">Interrupted</option>
                  <option value="RECOVERY PENDING">Recovery Pending</option>
                  <option value="SUBMITTED">Submitted</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-[#DCE3EC] rounded-[10px] overflow-hidden institutional-card-shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#DCE3EC] text-[#102A43] font-bold">
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">USN</th>
                      <th className="py-3 px-4 hidden md:table-cell">Department</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Progress</th>
                      <th className="py-3 px-4 hidden lg:table-cell">Last Saved</th>
                      <th className="py-3 px-4 font-mono">Logged-In Workstation ID</th>
                      <th className="py-3 px-4 font-mono">Re-Login Workstation ID</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EC]">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8">
                          <EmptyState
                            title={records.length === 0 ? "No Candidate Sessions Registered" : "No Matching Candidates Found"}
                            description={records.length === 0 ? "No candidate examination sessions are currently recorded on the Lab Server." : "Check your search or department filter."}
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((st) => (
                        <tr key={st.usn} className="hover:bg-slate-50 transition-colors duration-150">
                          <td className="py-3 px-4 font-semibold text-[#102A43]">{st.studentName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#2463B5]">{st.usn}</td>
                          <td className="py-3 px-4 text-[#64748B] hidden md:table-cell">{st.department}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-xs">{st.status}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {st.answeredCount} / {st.totalQuestions}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#64748B] hidden lg:table-cell">
                            {st.lastSaved}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-bold text-[#243247]">
                            <span className="px-2 py-0.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC]">
                              {st.previousSystemId}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {st.reloginSystemId ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-emerald-50 border border-emerald-300 text-[#16865B] font-bold">
                                <Laptop className="w-3 h-3 text-[#16865B]" />
                                <span>{st.reloginSystemId}</span>
                              </span>
                            ) : st.status === 'Recovery Pending' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-amber-50 border border-amber-200 text-[#B54708] text-[11px] font-medium">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Permitted (Any PC)</span>
                              </span>
                            ) : (
                              <span className="text-[#64748B]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('relogin');
                                setSearchQuery(st.usn);
                              }}
                              className="text-xs text-[#2463B5] hover:underline font-semibold cursor-pointer"
                            >
                              Manage Re-Login →
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSFER HISTORY */}
        {activeTab === 'transfers' && (
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] overflow-hidden institutional-card-shadow space-y-4 p-5">
            <div>
              <h2 className="text-base font-bold text-[#102A43]">
                Emergency Session Migration &amp; Transfer History
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Complete audit records of candidate computer migrations and session continuity
              </p>
            </div>

            {transfers.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  title="No Session Transfers Recorded Yet"
                  description="When an approved student logs in on a new computer (e.g. LAB01-PC-07), migration records appear here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#DCE3EC] text-[#102A43] font-bold">
                      <th className="py-3 px-4">Transfer Ref</th>
                      <th className="py-3 px-4">Student Name &amp; USN</th>
                      <th className="py-3 px-4">Previous Terminal</th>
                      <th className="py-3 px-4">New Terminal</th>
                      <th className="py-3 px-4">Answers Preserved</th>
                      <th className="py-3 px-4">Authorized By</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EC]">
                    {transfers.map((tr) => (
                      <tr key={tr.transferId} className="hover:bg-slate-50 transition-colors duration-150">
                        <td className="py-3 px-4 font-mono font-bold text-[#243247]">
                          {tr.transferId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#102A43]">{tr.studentName}</div>
                          <div className="font-mono text-xs text-[#2463B5]">{tr.studentUsn}</div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="bg-red-50 text-[#B42318] px-2 py-0.5 rounded-[6px] border border-red-200 font-bold">
                            {tr.previousSystemId}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="bg-emerald-50 text-[#16865B] px-2 py-0.5 rounded-[6px] border border-emerald-200 font-bold">
                            {tr.newSystemId}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#16865B]">
                          {tr.answersRecoveredCount} Responses (100% Preserved)
                        </td>
                        <td className="py-3 px-4 text-xs text-[#64748B] font-mono">
                          {tr.authorisedBy}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-[#64748B]">
                          {new Date(tr.reloginAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[#16865B] font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-[6px] border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16865B]" />
                            <span>Migrated</span>
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

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] overflow-hidden institutional-card-shadow space-y-4 p-5">
            <div>
              <h2 className="text-base font-bold text-[#102A43]">
                Cryptographic &amp; Institutional Recovery Audit Log
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Immutable security logs recorded by the local Lab Server and COE authority
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  title="No Security Audit Logs Recorded"
                  description="No recovery operations or session transactions have been logged yet."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#DCE3EC] text-[#102A43] font-bold">
                      <th className="py-2.5 px-3">Log ID</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EC] font-mono">
                    {auditLogs.map((lg) => (
                      <tr key={lg.logId} className="hover:bg-slate-50 transition-colors duration-150">
                        <td className="py-2.5 px-3 text-[#64748B]">{lg.logId}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{lg.timestamp}</td>
                        <td className="py-2.5 px-3 font-bold text-[#2463B5]">
                          {lg.action}
                        </td>
                        <td className="py-2.5 px-3 text-[#102A43]">{lg.actor}</td>
                        <td className="py-2.5 px-3 font-sans text-[#243247] leading-snug">
                          {lg.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: COE CONTROLS */}
        {activeTab === 'coe' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-5 institutional-card-shadow space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#DCE3EC]">
                <div className="w-9 h-9 rounded-[6px] bg-blue-50 border border-blue-200 text-[#2463B5] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#102A43]">
                    COE Master Recovery Control
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Office of the Controller of Examinations (COE)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC]">
                  <div>
                    <div className="text-xs font-bold text-[#102A43]">
                      Emergency Recovery System
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-0.5">
                      {coeConfig.enabled
                        ? 'Active across all CBT laboratories'
                        : 'Disabled centrally by Controller of Examinations'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCoeStatus}
                    className={`h-[36px] px-3.5 rounded-[6px] font-bold text-xs transition-colors duration-150 cursor-pointer ${
                      coeConfig.enabled
                        ? 'bg-[#16865B] hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-[#243247]'
                    }`}
                  >
                    {coeConfig.enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Configured Recovery ID:</span>
                    <span className="font-mono font-bold text-[#102A43]">
                      {FIXED_RECOVERY_CREDENTIALS.recoveryId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Configured Recovery Key:</span>
                    <span className="font-mono font-bold text-[#2463B5]">
                      {FIXED_RECOVERY_CREDENTIALS.recoveryKey}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">One-Time Token Window:</span>
                    <span className="font-mono text-[#243247]">15 Minutes per Token</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CONFIRMATION MODAL: APPROVE RE-LOGIN */}
      {approveModalStudent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] max-w-md w-full p-6 space-y-5 institutional-card-shadow animate-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[6px] bg-blue-50 border border-blue-200 text-[#2463B5] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#102A43]">
                  Approve Student Re-Login Authorisation
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Lab Instructor Controlled Session Transfer
                </p>
              </div>
            </div>

            <div className="p-4 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Student Name:</span>
                <span className="font-bold text-[#102A43]">{approveModalStudent.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Student USN:</span>
                <span className="font-mono font-bold text-[#2463B5]">{approveModalStudent.usn}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Logged-In Workstation ID:</span>
                <span className="font-mono font-bold text-[#B42318]">{approveModalStudent.systemId}</span>
              </div>
            </div>

            {/* Reason Selector */}
            <div>
              <label
                htmlFor="approval-reason"
                className="block text-xs font-bold text-[#102A43] uppercase tracking-wider mb-1.5"
              >
                Interruption Reason <span className="text-[#B42318]">*</span>
              </label>
              <select
                id="approval-reason"
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="h-[43px] w-full px-3 rounded-[6px] border border-[#CBD5E1] bg-white text-xs font-semibold text-[#243247] focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
              >
                <option value="Candidate Logged Out / Exited Browser">Candidate Logged Out / Exited Browser</option>
                <option value="Terminal Hardware Crash">Terminal Hardware Crash on {approveModalStudent.systemId}</option>
                <option value="Unexpected Power / OS Shutdown">Unexpected Power / OS Shutdown</option>
                <option value="Browser Window Freeze / Crash">Browser Window Freeze / Crash</option>
                <option value="Network NIC Disconnection">Network NIC Disconnection</option>
                <option value="Peripherals Malfunction (Mouse/Keyboard)">Peripherals Malfunction (Mouse/Keyboard)</option>
                <option value="Instructor Discretion / Approved Resumption">Instructor Discretion / Approved Resumption</option>
              </select>
            </div>

            {/* Workstation Selection Notice */}
            <div className="bg-[#EFF8FF] border border-[#B2DDFF] rounded-[8px] p-3 text-xs text-[#175CD3] flex items-start gap-2.5">
              <Laptop className="w-4 h-4 shrink-0 mt-0.5 text-[#175CD3]" />
              <div className="space-y-1">
                <div className="font-bold text-[#102A43]">Any Available Workstation Permitted</div>
                <div className="text-[11px] leading-relaxed text-[#1D2939]">
                  Instructors do not need to pre-assign a computer. Once authorized, the candidate can go to <strong>any available PC in the lab</strong> and log in with their credentials. The system will automatically detect, record, and display their new workstation ID.
                </div>
              </div>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Authorising re-login will generate a <strong>unique, one-time authorization token</strong> allowing candidate <strong>{approveModalStudent.name}</strong> to resume their examination on any free computer without losing saved answers or timer progress. The token will expire automatically after 15 minutes or upon use.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalStudent(null)}
                disabled={isProcessing}
                className="h-[44px] px-4 rounded-[6px] border border-[#CBD5E1] bg-white hover:bg-slate-50 text-xs font-semibold text-[#243247] transition-colors duration-150 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={isProcessing}
                className="h-[44px] inline-flex items-center gap-2 px-5 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white font-bold text-xs transition-colors duration-150 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <span>Confirm Re-Login Approval</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-[#DCE3EC] bg-white py-3 px-6 text-center text-xs text-[#64748B]">
        <div className="max-w-[1240px] mx-auto">
          <span>Maharaja Institute of Technology Mysore · Office of the Controller of Examinations (COE) · Emergency Recovery Protocol</span>
        </div>
      </footer>
    </div>
  );
};
