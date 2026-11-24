import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, Settings, Sun, UserCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

interface AccountMenuProps {
  profileSettingsPath: string;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({ profileSettingsPath }) => {
  const { user, logout, updateThemeWithSync } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/admin/login');
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors text-left"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserCircle className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
        <div className="hidden sm:block leading-tight">
          <div className="text-xs font-semibold text-[#17243A] dark:text-slate-100 whitespace-nowrap">
            {user.fullName}
          </div>
          <div className="text-[11px] text-[#64748B] dark:text-slate-400 whitespace-nowrap">
            {user.role === 'PRINCIPAL' ? 'Principal' : `HOD · ${user.departmentCode}`}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-lg bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 shadow-lg py-1.5 z-50"
        >
          <div className="px-4 py-2.5 border-b border-[#D9E2EF] dark:border-slate-800">
            <div className="text-xs font-bold text-[#17243A] dark:text-white truncate">
              {user.fullName}
            </div>
            <div className="text-[11px] text-[#64748B] dark:text-slate-400 truncate mt-0.5">
              {user.employeeId} · {user.email}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate(profileSettingsPath);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#1F2937] dark:text-slate-200 hover:bg-[#F5F7FB] dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
            <span>Profile & Settings</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => updateThemeWithSync(theme === 'light' ? 'dark' : 'light')}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-[#1F2937] dark:text-slate-200 hover:bg-[#F5F7FB] dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-[#6D5CE8] shrink-0" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
            </span>
          </button>

          <div className="my-1 border-t border-[#D9E2EF] dark:border-slate-800" />

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#B42318] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};
