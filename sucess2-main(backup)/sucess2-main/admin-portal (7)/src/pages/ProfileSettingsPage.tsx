import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Moon,
  Save,
  Sun,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { authService } from '../services/authService';

export const ProfileSettingsPage: React.FC = () => {
  const { user, refreshUser, updateThemeWithSync } = useAuth();
  const { theme } = useTheme();

  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) return null;

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactMsg(null);
    setContactSaving(true);
    try {
      const updated = await authService.updateContactNumber(user.id, contactNumber);
      refreshUser(updated);
      setContactMsg({ type: 'success', text: 'Contact number updated successfully.' });
    } catch (err) {
      setContactMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update contact number.',
      });
    } finally {
      setContactSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New Password and Confirm New Password do not match.' });
      return;
    }

    setPwdSaving(true);
    try {
      const res = await authService.changePassword(user.id, {
        currentPassword,
        newPassword,
      });
      setPwdMsg({ type: 'success', text: res.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update password.',
      });
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
          Profile & Settings
        </h1>
        <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
          View institutional account identity, update permitted contact details, manage password security, and choose portal appearance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information Card */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#D9E2EF] dark:border-slate-800 pb-3.5">
            <UserCircle2 className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Account Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">Full Name</div>
              <div className="mt-1 font-semibold text-[#17243A] dark:text-slate-100">
                {user.fullName}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">Employee ID</div>
              <div className="mt-1 font-mono font-semibold text-[#17243A] dark:text-slate-100">
                {user.employeeId}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">Official Email</div>
              <div className="mt-1 font-medium text-[#1F2937] dark:text-slate-200 break-all">
                {user.email}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                Designation / Role
              </div>
              <div className="mt-1 font-medium text-[#1F2937] dark:text-slate-200">
                {user.designation} ({user.role})
              </div>
            </div>
            {user.role === 'HOD' && (
              <div>
                <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                  Assigned Department (Read-Only)
                </div>
                <div className="mt-1 font-semibold text-[#2563EB] dark:text-blue-400">
                  {user.departmentName} ({user.departmentCode})
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">Last Login</div>
              <div className="mt-1 font-mono text-xs text-[#1F2937] dark:text-slate-300 tabular-nums">
                {user.lastLogin}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSaveContact}
            className="pt-4 border-t border-[#D9E2EF] dark:border-slate-800 space-y-3"
          >
            <label
              htmlFor="profile-contact"
              className="block text-sm font-medium text-[#1F2937] dark:text-slate-200"
            >
              Contact Number
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="profile-contact"
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 9845011223"
                className="flex-1 px-3.5 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
              <button
                type="submit"
                disabled={contactSaving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{contactSaving ? 'Saving...' : 'Save Contact'}</span>
              </button>
            </div>
            {contactMsg && (
              <p
                className={`text-xs font-medium flex items-center gap-1.5 ${
                  contactMsg.type === 'success'
                    ? 'text-[#16834A] dark:text-emerald-400'
                    : 'text-[#B42318] dark:text-red-400'
                }`}
              >
                {contactMsg.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{contactMsg.text}</span>
              </p>
            )}
          </form>
        </section>

        {/* Change Password Card */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D9E2EF] dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-[#6D5CE8] dark:text-violet-400" />
              <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
                Change Password
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-slate-400 hover:text-[#17243A] dark:hover:text-white"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Hide' : 'Show'}</span>
            </button>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <div>
              <label
                htmlFor="current-password"
                className="block text-xs font-medium text-[#1F2937] dark:text-slate-300 mb-1"
              >
                Current Password
              </label>
              <input
                id="current-password"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-[#1F2937] dark:text-slate-300 mb-1"
              >
                New Password
              </label>
              <input
                id="new-password"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Min 8 chars, upper, lower, digit, symbol"
                className="w-full px-3.5 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-[#1F2937] dark:text-slate-300 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>

            {pwdMsg && (
              <div
                className={`p-3 rounded-md text-xs font-medium flex items-start gap-2 ${
                  pwdMsg.type === 'success'
                    ? 'bg-[#16834A]/10 text-[#16834A] dark:text-emerald-300 border border-[#16834A]/30'
                    : 'bg-[#B42318]/10 text-[#B42318] dark:text-red-300 border border-[#B42318]/30'
                }`}
              >
                {pwdMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{pwdMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwdSaving}
              className="px-4 py-2 rounded-md bg-[#17243A] dark:bg-[#2563EB] hover:bg-[#1E2E4A] dark:hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {pwdSaving ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>

      {/* Appearance Selector */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#17243A] dark:text-white">Portal Appearance</h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            Select Light Mode or Dark Mode. Your preference persists across refreshes and sign-in sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <button
            type="button"
            onClick={() => updateThemeWithSync('light')}
            className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-all ${
              theme === 'light'
                ? 'border-[#2563EB] bg-[#2563EB]/5 ring-2 ring-[#2563EB]/20'
                : 'border-[#D9E2EF] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="p-2 rounded-md bg-amber-100 text-amber-700">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#17243A] dark:text-white">Light Mode</div>
              <div className="text-xs text-[#64748B] dark:text-slate-400">
                High-contrast bright administrative surface
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateThemeWithSync('dark')}
            className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-all ${
              theme === 'dark'
                ? 'border-[#2563EB] bg-[#2563EB]/10 ring-2 ring-[#2563EB]/30'
                : 'border-[#D9E2EF] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="p-2 rounded-md bg-slate-800 text-indigo-300">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#17243A] dark:text-white">Dark Mode</div>
              <div className="text-xs text-[#64748B] dark:text-slate-400">
                Low-glare dark workspace theme
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
