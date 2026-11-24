import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Award,
  BookOpenCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { InstitutionLogo } from '../components/InstitutionLogo';
import { AccountMenu } from '../components/AccountMenu';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { HodSemesterProvider, useHodSemester } from '../hooks/useHodSemester';
import { useAuth } from '../hooks/useAuth';
import { realtimeService } from '../services/realtimeService';
import { getAuthToken } from '../services/apiClient';

const HOD_NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin/hod/dashboard', icon: LayoutDashboard, syncSemester: false },
  { label: 'Setup Class', to: '/admin/hod/setup-class', icon: BookOpenCheck, syncSemester: true },
  { label: 'Questions', to: '/admin/hod/questions', icon: FileQuestion, syncSemester: true },
  { label: 'Converter', to: '/admin/hod/converter', icon: FileSpreadsheet, syncSemester: true },
  { label: 'Examination Status', to: '/admin/hod/exam-status', icon: CalendarClock, syncSemester: false },
  {
    label: 'Department Results & Performance Analytics',
    to: '/admin/hod/results',
    icon: Award,
    syncSemester: false,
  },
  { label: 'Audit Logs', to: '/admin/hod/audit-logs', icon: ClipboardList, syncSemester: false },
  { label: 'Settings', to: '/admin/hod/profile-settings', icon: Settings, syncSemester: false },
];

const HodLayoutShell: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { selectedSemester } = useHodSemester();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = getAuthToken() || undefined;
    realtimeService.connect(token);
    return () => realtimeService.disconnect();
  }, []);

  const isNavActive = (to: string) => location.pathname === to;
  const resolveNavTarget = (item: (typeof HOD_NAV_ITEMS)[number]) =>
    item.syncSemester ? `${item.to}?semester=${selectedSemester}` : item.to;

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-[#F5F7FB] dark:bg-slate-950 text-[#1F2937] dark:text-slate-100 transition-colors">
      {/* Mobile Header Bar */}
      <header className="lg:hidden shrink-0 sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#17243A] text-white border-b border-slate-800">
        <InstitutionLogo variant="mobile-bar" subtitle="HOD Portal" />
        <div className="flex items-center gap-2">
          <AccountMenu profileSettingsPath="/admin/hod/profile-settings" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md text-slate-200 hover:bg-white/10"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[#17243A] text-white flex flex-col h-full z-10 overflow-y-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <InstitutionLogo variant="sidebar-expanded" subtitle="HOD Portal" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1.5">
              {HOD_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={resolveNavTarget(item)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#17243A] text-white border-r border-slate-800 h-full transition-all duration-150 ${
          collapsed ? 'w-20' : 'w-68'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
          {collapsed ? (
            <InstitutionLogo variant="sidebar-collapsed" />
          ) : (
            <InstitutionLogo variant="sidebar-expanded" subtitle="HOD Portal" />
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5">
          {!collapsed && (
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Navigation
            </div>
          )}
          {HOD_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.to);
            return (
              <Link
                key={item.to}
                to={resolveNavTarget(item)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] font-medium transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="leading-snug">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Authenticated HOD Area & Logout */}
        <div className="p-3.5 border-t border-white/10 bg-[#131E31] space-y-2">
          {!collapsed && user && (
            <div className="px-2 py-1">
              <div className="text-xs font-semibold text-white truncate">{user.fullName}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {user.departmentName || user.departmentCode}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => logout()}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="hidden lg:flex shrink-0 bg-white dark:bg-slate-900 border-b border-[#D9E2EF] dark:border-slate-800 px-6 py-3 items-center justify-end gap-6">
          <AccountMenu profileSettingsPath="/admin/hod/profile-settings" />
        </header>

        <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 w-full">
          <div className="max-w-[1440px] mx-auto w-full">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export const HodLayout: React.FC = () => (
  <HodSemesterProvider>
    <HodLayoutShell />
  </HodSemesterProvider>
);
