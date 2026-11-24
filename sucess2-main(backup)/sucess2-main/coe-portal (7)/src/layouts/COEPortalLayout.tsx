import React, { useState } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Activity,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  KeyRound,
  Laptop,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MonitorCheck,
  Palette,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  Sliders,
  Upload,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { OfficialLogo } from '../components/OfficialLogo';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { authenticationService } from '../services/authenticationService';

interface NavItemConfig {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroupConfig {
  groupTitle: string;
  items: NavItemConfig[];
}

export interface SecondaryNavItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    groupTitle: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    groupTitle: 'Examination Management',
    items: [
      { label: 'Schedule Examination', to: '/schedule', icon: CalendarClock },
    ],
  },
  {
    groupTitle: 'Live Operations',
    items: [
      { label: 'Session Monitoring', to: '/monitoring', icon: Activity },
    ],
  },
  {
    groupTitle: 'Result Management',
    items: [
      { label: 'Import Results', to: '/results/import', icon: Upload },
      { label: 'Result Approval', to: '/results/approval', icon: ClipboardCheck },
    ],
  },
  {
    groupTitle: 'Academic Records',
    items: [
      { label: 'Course Outcomes', to: '/course-outcomes', icon: BookOpenCheck },
    ],
  },
  {
    groupTitle: 'System',
    items: [
      { label: 'Audit Logs', to: '/audit-logs', icon: ShieldAlert },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

const ROUTE_TITLES: Record<string, { section: string; title: string }> = {
  '/': { section: 'Overview', title: 'COE Dashboard' },
  '/schedule': {
    section: 'Examination Management',
    title: 'Schedule Examination',
  },
  '/monitoring': {
    section: 'Live Operations',
    title: 'Session Monitoring',
  },
  '/results/import': {
    section: 'Result Management',
    title: 'Import Results',
  },
  '/results/approval': {
    section: 'Result Management',
    title: 'Result Approval',
  },
  '/course-outcomes': {
    section: 'Academic Records',
    title: 'Course Outcomes',
  },
  '/audit-logs': {
    section: 'System',
    title: 'Audit Logs',
  },
  '/settings': {
    section: 'System',
    title: 'Settings',
  },
};

export const COEPortalLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Editable Account Information state
  const [profileFullName, setProfileFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    authSession,
    setAuthSession,
    loading,
    error,
    errorKind,
    refreshAll,
    examinations,
    monitors,
    results,
    correctionRequests,
    activeExaminationId,
    setActiveExaminationId,
    activeSessionId,
    setActiveSessionId,
    toasts,
    dismissToast,
  } = useExaminationStore();

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!authSession || !authSession.authenticated) {
    return <Navigate to="/login" replace />;
  }

  const coeDesignation =
    !authSession.user.designation ||
    authSession.user.designation.toLowerCase().includes('head of department') ||
    authSession.user.designation.toLowerCase().includes('hod')
      ? 'Controller of Examinations'
      : authSession.user.designation;

  React.useEffect(() => {
    if (authSession?.user) {
      setProfileFullName(authSession.user.fullName || '');
      setProfileEmail(authSession.user.email || '');
    }
  }, [authSession?.user, accountModalOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    setProfileSaving(true);
    try {
      if (profileFullName.trim() !== authSession.user.fullName || profileEmail.trim() !== authSession.user.email) {
        const updated = await authenticationService.updateProfile(profileFullName.trim(), profileEmail.trim());
        setAuthSession({ ...authSession, user: { ...authSession.user, ...updated } });
      }
      if (profileNewPassword) {
        await authenticationService.changePassword(profileCurrentPassword, profileNewPassword, profileConfirmPassword);
        setProfileCurrentPassword('');
        setProfileNewPassword('');
        setProfileConfirmPassword('');
      }
      setProfileFeedback({ type: 'success', message: 'Account information updated successfully.' });
    } catch (err) {
      setProfileFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const currentMeta = ROUTE_TITLES[location.pathname] || {
    section: 'COE Portal',
    title: 'Examination Management System',
  };

  // Selected examination for context-aware secondary navigation
  const selectedExam =
    examinations.find((e) => e.id === activeExaminationId) || examinations[0] || null;

  const selectedMonitor =
    monitors.find((m) => m.sessionId === activeSessionId) ||
    monitors[0] ||
    null;

  const selectedResult =
    results.find((r) => r.examinationId === activeExaminationId) ||
    results[0] ||
    null;

  // Build contextual secondary navigation items based on current primary route
  const getSecondaryNavConfig = (): {
    panelTitle: string;
    panelSubtitle: string;
    defaultSection: string;
    items: SecondaryNavItem[];
  } | null => {
    if (location.pathname === '/schedule') {
      const totalStudents = selectedExam ? (selectedExam.students || []).length : 0;
      return {
        panelTitle: 'Schedule Examination',
        panelSubtitle: 'Examination workflow sections',
        defaultSection: 'examination-details',
        items: [
          {
            id: 'examination-details',
            label: 'Examination Details',
            description: 'Department, semester, subject & paper details',
            icon: Sliders,
          },
          {
            id: 'sitting-arrangements',
            label: 'Sitting Arrangements',
            description: 'Read-only sitting & assigned student overview',
            icon: Users,
            badge: selectedExam ? `${totalStudents} Eligible` : undefined,
          },
          {
            id: 'set-selection',
            label: 'Set Selection',
            description: 'Question sets (1–4) & Versions (A–D)',
            icon: Layers,
          },
          {
            id: 'package-transfer',
            label: 'Package Preparation & Transfer',
            description: 'Prepare & send sitting package to Lab Server',
            icon: Send,
          },
        ],
      };
    }

    if (location.pathname === '/monitoring') {
      return {
        panelTitle: 'Session Monitoring',
        panelSubtitle: 'Live laboratory telemetry views',
        defaultSection: 'overall-monitoring',
        items: [
          {
            id: 'overall-monitoring',
            label: 'Overall Monitoring',
            description: 'Session progress & lab server metrics',
            icon: MonitorCheck,
          },
          {
            id: 'student-monitoring',
            label: 'Individual Student Monitoring',
            description: 'Candidate login, status & PC table',
            icon: Users,
            badge: selectedMonitor ? (selectedMonitor.students || []).length : undefined,
          },
          {
            id: 'suspicious-activity',
            label: 'Suspicious Activity & Unlocks',
            description: 'Lockout events & invigilator unlocks',
            icon: ShieldAlert,
            badge: selectedMonitor
              ? (selectedMonitor.suspiciousEvents || []).length
              : undefined,
          },
          {
            id: 'pc-recovery',
            label: 'PC Recovery Logs',
            description: 'Invigilator-assisted PC reassignments',
            icon: Laptop,
            badge: selectedMonitor
              ? (selectedMonitor.pcRecoveryEvents || []).length
              : undefined,
          },
        ],
      };
    }

    if (location.pathname === '/results/approval') {
      const pendingCorrCount = selectedResult
        ? (correctionRequests || []).filter(
            (c) =>
              c.examinationId === selectedResult.examinationId &&
              c.status === 'Pending Review'
          ).length
        : 0;
      return {
        panelTitle: 'Result Approval',
        panelSubtitle: 'Verification, corrections & release',
        defaultSection: 'result-overview',
        items: [
          {
            id: 'result-overview',
            label: 'Result Overview & Release',
            description: 'Attendance summary & final release',
            icon: FileCheck2,
          },
          {
            id: 'student-results',
            label: 'Student-Wise Results',
            description: 'Marks, Topper badge, filters & exports',
            icon: Users,
            badge: selectedResult
              ? (selectedResult.studentResults || []).length
              : undefined,
          },
          {
            id: 'answer-key-corrections',
            label: 'Answer-Key Corrections',
            description: 'HOD requests & mark recalculation',
            icon: KeyRound,
            badge: pendingCorrCount > 0 ? `${pendingCorrCount} Pending` : undefined,
          },
        ],
      };
    }

    if (location.pathname === '/settings') {
      const items: SecondaryNavItem[] = [
        {
          id: 'laboratories',
          label: 'Laboratory Management',
          description: 'Configure labs, capacities & statuses',
          icon: Laptop,
        },
        {
          id: 'change-password',
          label: 'Change Password',
          description: 'Update COE account password',
          icon: KeyRound,
        },
        {
          id: 'appearance',
          label: 'Appearance',
          description: 'Light Mode & Dark Mode theme',
          icon: Palette,
        },
      ];
      return {
        panelTitle: 'Portal Settings',
        panelSubtitle: 'Account security & preferences',
        defaultSection: 'change-password',
        items,
      };
    }

    return null;
  };

  const secondaryNav = getSecondaryNavConfig();
  const rawSectionParam = searchParams.get('section');
  const normalizedSectionParam =
    location.pathname === '/schedule' &&
    (rawSectionParam === 'student-eligibility' ||
      rawSectionParam === 'sitting-allocation')
      ? 'sitting-arrangements'
      : location.pathname === '/monitoring' && rawSectionParam === 'unlocks'
        ? 'suspicious-activity'
        : rawSectionParam;
  const activeSecondarySection = secondaryNav
    ? normalizedSectionParam || secondaryNav.defaultSection
    : null;

  const handleSelectSecondarySection = (sectionId: string) => {
    setSearchParams({ section: sectionId });
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await authenticationService.logout();
      setAuthSession(null);
      setConfirmLogoutOpen(false);
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const renderPrimarySidebarContent = (isMobile = false) => {
    const isCompact = !isMobile && collapsed;

    return (
      <div className="flex flex-col h-full bg-[#17243A] text-white select-none">
        {/* Top-Left Brand Area */}
        <div
          className={`flex items-center justify-between border-b border-white/10 ${
            isCompact ? 'px-3 py-4' : 'px-4 py-4'
          }`}
        >
          <OfficialLogo
            variant={isCompact ? 'sidebar-collapsed' : 'sidebar-expanded'}
          />
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary Navigation Links */}
        <nav
          className="flex-1 overflow-y-auto py-5 px-3 space-y-6"
          aria-label="COE Portal Primary Sidebar"
        >
          {NAVIGATION_GROUPS.map((group) => (
            <div key={group.groupTitle}>
              {!isCompact && (
                <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.groupTitle}
                </div>
              )}
              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMobileMenuOpen(false)}
                        title={isCompact ? item.label : undefined}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          } ${isCompact ? 'justify-center' : ''}`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {!isCompact && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Authenticated COE Account Area & Logout */}
        <div className="border-t border-white/10 p-3.5 space-y-2.5">
          {!isCompact && (
            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              <div className="text-sm font-semibold text-white truncate">
                {authSession.user.fullName}
              </div>
              <div className="text-xs text-slate-300 truncate mt-0.5">
                {coeDesignation} · {authSession.user.username}
              </div>
            </button>
          )}

          <div className={`flex ${isCompact ? 'flex-col items-center' : 'items-center'} gap-1.5`}>
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              title="Sign out of COE Portal"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-[#B42318] hover:text-white transition-colors whitespace-nowrap cursor-pointer ${
                isCompact ? 'w-full justify-center px-0' : 'flex-1'
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              {!isCompact && <span>Logout</span>}
            </button>

            {!isMobile && (
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={`p-2.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0 cursor-pointer ${
                  isCompact ? 'w-full flex items-center justify-center' : ''
                }`}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-[#F5F7FB] dark:bg-slate-950 text-[#1F2937] dark:text-slate-100">
      {/* Mobile Top App Bar */}
      <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#17243A] text-white border-b border-white/10">
        <OfficialLogo variant="mobile-bar" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 rounded-md text-slate-200 hover:bg-white/10 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Primary Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 max-w-[80vw] h-full shadow-xl">
            {renderPrimarySidebarContent(true)}
          </div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* AREA 1: Desktop Primary Sidebar */}
      <aside
        className={`hidden lg:block h-full shrink-0 transition-[width] duration-150 ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        {renderPrimarySidebarContent(false)}
      </aside>

      {/* AREA 2: Contextual Secondary Navigation Panel (Desktop Vertical Panel) */}
      {secondaryNav && (
        <aside
          aria-label="Contextual Page Sections"
          className="hidden lg:flex flex-col h-full w-[276px] shrink-0 bg-white dark:bg-slate-900 border-r border-[#D9E2EF] dark:border-slate-800 select-none"
        >
          {/* Secondary Panel Title */}
          <div className="px-5 py-5 border-b border-[#D9E2EF] dark:border-slate-800">
            <h2 className="text-[17px] font-bold text-[#17243A] dark:text-white leading-snug">
              {secondaryNav.panelTitle}
            </h2>
            <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1">
              {secondaryNav.panelSubtitle}
            </p>

            {/* Context Selector for Selected Examination / Session / Result */}
            {location.pathname === '/schedule' && examinations.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-[#D9E2EF] dark:border-slate-800">
                <label
                  htmlFor="secondary-exam-selector"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-1.5"
                >
                  Examinations
                </label>
                <select
                  id="secondary-exam-selector"
                  value={selectedExam?.id || ''}
                  onChange={(e) => setActiveExaminationId(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] font-semibold rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                >
                  {examinations.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.subjectCode} — {ex.subjectName} ({ex.department} Sem {ex.semester})
                      {ex.status === 'Cancelled' ? ' [Cancelled]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {location.pathname === '/monitoring' && monitors.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-[#D9E2EF] dark:border-slate-800">
                <label
                  htmlFor="secondary-session-selector"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-1.5"
                >
                  Monitored Session
                </label>
                <select
                  id="secondary-session-selector"
                  value={selectedMonitor?.sessionId || ''}
                  onChange={(e) => {
                    const chosenSession = monitors.find(
                      (m) => m.sessionId === e.target.value
                    );
                    setActiveSessionId(e.target.value);
                    if (chosenSession) {
                      setActiveExaminationId(chosenSession.examinationId);
                    }
                  }}
                  className="w-full px-3 py-2 text-[13px] font-semibold rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                >
                  {monitors.map((m) => (
                    <option key={m.sessionId} value={m.sessionId}>
                      {m.subjectCode} ({m.sittingName}) — {m.sessionStatus}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {location.pathname === '/results/approval' && results.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-[#D9E2EF] dark:border-slate-800">
                <label
                  htmlFor="secondary-result-selector"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-1.5"
                >
                  Result Record
                </label>
                <select
                  id="secondary-result-selector"
                  value={selectedResult?.examinationId || ''}
                  onChange={(e) => setActiveExaminationId(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] font-semibold rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                >
                  {results.map((r) => (
                    <option key={r.id} value={r.examinationId}>
                      {r.subjectCode} — {r.subjectName} ({r.department})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Contextual Section List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
            <div className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Page Sections
            </div>
            {secondaryNav.items.map((sec) => {
              const Icon = sec.icon;
              const isSelected = activeSecondarySection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => handleSelectSecondarySection(sec.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-[#2563EB] dark:border-blue-500 text-[#17243A] dark:text-white shadow-xs'
                      : 'bg-transparent border-transparent hover:bg-[#F5F7FB] dark:hover:bg-slate-800/70 text-[#1F2937] dark:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isSelected
                        ? 'text-[#2563EB] dark:text-blue-400'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold leading-snug ${
                          isSelected
                            ? 'text-[#2563EB] dark:text-blue-400'
                            : 'text-[#1F2937] dark:text-slate-100'
                        }`}
                      >
                        {sec.label}
                      </span>
                      {sec.badge !== undefined && (
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-md shrink-0 ${
                            isSelected
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-300'
                          }`}
                        >
                          {sec.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1 leading-snug">
                      {sec.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* AREA 3: Main Working Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Bar with Breadcrumb & Authenticated Account Dropdown */}
        <header className="shrink-0 z-20 bg-white dark:bg-slate-900 border-b border-[#D9E2EF] dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 text-sm text-[#64748B] dark:text-slate-400 min-w-0 overflow-hidden">
            <span className="font-bold text-[#17243A] dark:text-slate-200 whitespace-nowrap">
              COE Portal
            </span>
            <span aria-hidden="true">/</span>
            <span className="whitespace-nowrap">{currentMeta.section}</span>
            <span aria-hidden="true">/</span>
            <span className="font-bold text-[#1F2937] dark:text-white truncate">
              {currentMeta.title}
            </span>
            {secondaryNav && activeSecondarySection && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">
                  /
                </span>
                <span className="hidden sm:inline font-semibold text-[#2563EB] dark:text-blue-400 truncate">
                  {
                    secondaryNav.items.find((i) => i.id === activeSecondarySection)
                      ?.label
                  }
                </span>
              </>
            )}
          </div>

          {/* Account Menu Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-semibold text-[#1F2937] dark:text-slate-100 transition-colors cursor-pointer"
            >
              <UserCircle className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
              <span className="hidden sm:inline">{authSession.user.fullName}</span>
              <span className="text-[#64748B] dark:text-slate-400 hidden md:inline">
                ({coeDesignation})
              </span>
              <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
            </button>

            {accountMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setAccountMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 rounded-xl shadow-lg z-40 py-2 text-sm">
                  <div className="px-4 py-3 border-b border-[#D9E2EF] dark:border-slate-800">
                    <div className="font-bold text-[#17243A] dark:text-white">
                      {authSession.user.fullName}
                    </div>
                    <div className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
                      {coeDesignation}
                    </div>
                    <div className="font-mono text-xs text-[#2563EB] dark:text-blue-400 mt-1">
                      {authSession.user.username}
                    </div>
                  </div>

                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setAccountModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[#1F2937] dark:text-slate-200 hover:bg-[#F5F7FB] dark:hover:bg-slate-800 flex items-center gap-3 cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4 text-[#64748B]" />
                      <span>My Account Information</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full text-left px-4 py-2.5 text-[#1F2937] dark:text-slate-200 hover:bg-[#F5F7FB] dark:hover:bg-slate-800 flex items-center gap-3 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-[#64748B]" />
                      <span>Settings</span>
                    </button>
                  </div>

                  <div className="border-t border-[#D9E2EF] dark:border-slate-800 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setConfirmLogoutOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[#B42318] dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-3 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Mobile/Tablet Secondary Navigation Selector (when on a multi-section page) */}
        {secondaryNav && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-[#D9E2EF] dark:border-slate-800 px-4 py-3 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              {secondaryNav.panelTitle} — Select Section
            </div>
            <div className="flex flex-wrap gap-2">
              {secondaryNav.items.map((sec) => {
                const isSelected = activeSecondarySection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelectSecondarySection(sec.id)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : 'bg-[#F5F7FB] dark:bg-slate-800 text-[#1F2937] dark:text-slate-200 border-[#D9E2EF] dark:border-slate-700'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Main Viewport */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Main Working Area Content */}
          <main className="flex-1 px-5 sm:px-7 lg:px-9 py-7 w-full">
            <div className="max-w-[1440px] mx-auto space-y-6">
              {error && (
                <div
                  role="alert"
                  className="p-4 sm:p-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-[#B42318] dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-[#B42318] dark:text-red-300">
                        {errorKind === 'forbidden'
                          ? 'Authorisation Failure (Access Denied)'
                          : errorKind === 'unauthorised'
                            ? 'Authentication Required'
                            : errorKind === 'server' ||
                                errorKind === 'validation' ||
                                errorKind === 'not_found'
                              ? 'Backend API Request Failed'
                              : 'Backend Service Unavailable'}
                      </div>
                      <div className="text-sm text-[#B42318] dark:text-red-300/90 mt-0.5 leading-relaxed">
                        {error}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => refreshAll()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#B42318] hover:bg-[#911B13] disabled:opacity-50 rounded-lg shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Retrying...' : 'Retry Connection'}
                  </button>
                </div>
              )}

              {loading && examinations.length === 0 && !error ? (
                <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-10 text-center text-sm text-[#64748B] dark:text-slate-400">
                  Loading examination records from backend services...
                </div>
              ) : (
                <Outlet />
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="shrink-0 px-6 sm:px-8 py-4 border-t border-[#D9E2EF] dark:border-slate-800 bg-white dark:bg-slate-900 text-[13px] font-medium text-[#64748B] dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              Maharaja Institute of Technology Mysore · Examination Management System (COE Portal)
            </div>
            <div>Maharaja Institute of Technology Mysore</div>
          </footer>
        </div>
      </div>

      {/* My Account Information Dialog */}
      {accountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-info-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D9E2EF] dark:border-slate-800 pb-3.5">
              <div>
                <h3
                  id="account-info-title"
                  className="text-lg font-bold text-[#17243A] dark:text-white"
                >
                  COE Account Information
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  View and update your display identity and security credentials
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="text-[#64748B] hover:text-[#1F2937] dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileFeedback && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs font-semibold ${
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}
              >
                {profileFeedback.message}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
                    Username
                  </label>
                  <div className="px-3 py-2 text-xs font-mono font-bold bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 rounded-lg text-[#2563EB] dark:text-blue-400">
                    {authSession.user.username}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
                    Designation
                  </label>
                  <div className="px-3 py-2 text-xs font-semibold bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 rounded-lg text-[#1F2937] dark:text-slate-200">
                    {coeDesignation}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  required
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-3 border-t border-[#D9E2EF] dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Change Password (Leave blank to keep current)
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={profileCurrentPassword}
                    onChange={(e) => setProfileCurrentPassword(e.target.value)}
                    placeholder="Enter current password to change"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={profileNewPassword}
                      onChange={(e) => setProfileNewPassword(e.target.value)}
                      placeholder="Min 8 chars, letter + digit"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] dark:text-slate-400 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={profileConfirmPassword}
                      onChange={(e) => setProfileConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-[#D9E2EF] dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#1F2937] dark:text-slate-400 dark:hover:text-white rounded-lg border border-[#D9E2EF] dark:border-slate-700 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Confirm COE Portal Logout"
        description="Are you sure you want to end your authenticated Controller of Examinations session?"
        consequenceNote="Logging out invalidates your active session token and prevents access to protected examination management routes until you sign in again."
        confirmLabel="Logout of COE Portal"
        variant="destructive"
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />

      {/* Toast Feedback Overlay */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 rounded-xl p-4 shadow-lg flex items-start gap-3"
            >
              {t.type === 'error' ? (
                <ShieldAlert className="w-5 h-5 text-[#B42318] dark:text-red-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#16834A] dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                  {t.title}
                </div>
                <div className="text-[13px] text-[#64748B] dark:text-slate-300 mt-1 leading-relaxed">
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="text-[#64748B] hover:text-[#1F2937] dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
