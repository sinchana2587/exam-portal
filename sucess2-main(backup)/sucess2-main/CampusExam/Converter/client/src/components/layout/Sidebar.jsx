import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Database,
  History,
  FlaskConical,
  Lock,
  ChevronRight
} from 'lucide-react';

export function Sidebar({ currentTab, onSelectTab, counts = {} }) {
  const { isCOE, department } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Admin / COE Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'question-paper',
      label: 'Question Paper Converter',
      icon: FileText,
      badge: counts.awaitingQuestions > 0 ? `${counts.awaitingQuestions}` : null,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'student-list',
      label: 'Student List Converter',
      icon: Users,
      badge: counts.awaitingStudents > 0 ? `${counts.awaitingStudents}` : null,
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    {
      id: 'templates',
      label: 'Reference Templates',
      icon: Settings,
      badge: isCOE ? 'COE' : 'Locked',
      badgeColor: isCOE ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600',
      locked: !isCOE
    },
    {
      id: 'central-database',
      label: 'Central Student Database',
      icon: Database,
      badge: counts.centralCount ? `${counts.centralCount}` : null,
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'history',
      label: 'Conversion History',
      icon: History,
      badge: counts.totalHistory ? `${counts.totalHistory}` : null,
      badgeColor: 'bg-slate-100 text-slate-600'
    },
    {
      id: 'sample-tests',
      label: 'Automated Test Suite',
      icon: FlaskConical,
      badge: '10 Tests',
      badgeColor: 'bg-purple-100 text-purple-800'
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between shrink-0 h-[calc(100vh-64px)] select-none">
      <div className="py-4">
        <div className="px-4 mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Converter Modules
          </div>
          <div className="text-xs text-slate-600 font-medium">
            {isCOE ? 'COE Master Authority View' : `Scope: Department of ${department}`}
          </div>
        </div>

        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-[#1A237E] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.locked && (
                    <Lock className="w-3 h-3 text-slate-400" />
                  )}
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-white/70" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer institutional branding */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 space-y-1">
        <div className="font-semibold text-slate-700">ProTick Offline Engine</div>
        <div className="text-[10px] text-slate-400">Zero CDN Dependencies &bull; 100% Local LAN</div>
        <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 pt-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Converter Engine Active
        </div>
      </div>
    </aside>
  );
}

