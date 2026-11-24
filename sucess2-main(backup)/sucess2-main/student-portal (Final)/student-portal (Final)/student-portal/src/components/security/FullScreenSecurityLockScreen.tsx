/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { InstitutionHeader } from '../layout/InstitutionHeader';
import { SecurityLockState } from '../../types/security';

interface FullScreenSecurityLockScreenProps {
  lockState: SecurityLockState;
  studentName: string;
  studentUsn: string;
  isVerifying: boolean;
  verificationError: string | null;
  onVerifyPassword: (password: string) => Promise<boolean>;
}

export const FullScreenSecurityLockScreen: React.FC<FullScreenSecurityLockScreenProps> = ({
  lockState,
  studentName,
  studentUsn,
  isVerifying,
  verificationError,
  onVerifyPassword,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    const success = await onVerifyPassword(password);
    if (!success) {
      setPassword(''); // Clear password field on failed attempt
    }
  };

  const isPermanentlyLocked = lockState.isPermanentlyLocked;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-screen-title"
      className="fixed inset-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-[#070D18] text-[#243247] flex flex-col justify-between select-none overflow-y-auto font-sans"
    >
      {/* Dynamic Security Atmosphere Background Layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Ambient Top Crimson Alert Glow (Breathing Pulse) */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[500px] rounded-full bg-red-600/15 blur-[120px] animate-security-pulse" />

        {/* Ambient Bottom Blue Technical Glow */}
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[400px] rounded-full bg-blue-600/10 blur-[100px]" />

        {/* High-Tech Security Matrix Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* Dynamic Concentric Security Sonar / Radar Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full border border-red-500/25 animate-security-sonar-1" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-red-500/15 animate-security-sonar-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-red-500/10 animate-security-sonar-3" />

        {/* Translucent Security Shield Watermark */}
        <ShieldAlert
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] text-red-500/[0.04]"
          strokeWidth={0.75}
        />

        {/* Active Laser Scanner Beam Sweeping Vertically */}
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent blur-[1px] animate-security-scanner" />
      </div>

      {/* Top Bar: Standard Shared Institutional Header */}
      <div className="relative z-20">
        <InstitutionHeader
          subtitle="MIT Mysore Student Examination Portal"
          rightSlot={
            <div className="flex items-center gap-2.5 sm:gap-3 font-mono text-xs sm:text-sm text-[#243247] bg-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] border border-[#CBD5E1] shadow-xs">
              <span className="text-[#64748B] font-semibold font-sans">USN:</span>
              <span className="text-[#102A43] font-bold">{studentUsn}</span>
              <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
              <span className="text-[#64748B] hidden sm:inline">{studentName}</span>
            </div>
          }
        />
      </div>

      {/* Center: Security Lockdown Content in Centered White Card with 4-Side Animated Hazard Stripe Perimeter */}
      <main className="relative z-10 flex-1 max-w-[1240px] w-full mx-auto px-6 py-8 flex flex-col items-center justify-center my-auto">
        {/* Outer 4-Sided Animated Hazard Perimeter Frame */}
        <div className="max-w-[496px] w-full p-[3.5px] sm:p-1 rounded-[16px] relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.65),0_0_45px_rgba(220,38,38,0.28)] institutional-card-shadow">
          {/* Animated Warning Stripe running on all 4 sides */}
          <div
            className="absolute inset-0 bg-[linear-gradient(45deg,#DC2626_25%,#B45309_25%,#B45309_50%,#DC2626_50%,#DC2626_75%,#B45309_75%,#B45309_100%)] bg-[size:28px_28px] animate-warning-stripe pointer-events-none"
            aria-hidden="true"
          />

          {/* Inner White Card */}
          <div className="relative bg-white rounded-[12px] overflow-hidden p-6 sm:p-8 space-y-5 text-center text-[#243247]">
            {/* Live Security Alert Beacon */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#B42318] text-[11px] font-bold font-mono tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#B42318] animate-ping" />
              <span>TERMINAL RESTRICTED · LOCKDOWN ACTIVE</span>
            </div>

            {/* Security Lock Icon with Alert Pulse */}
            <div className="relative flex items-center justify-center my-1">
              <div className="absolute w-16 h-16 rounded-full bg-red-500/20 animate-ping opacity-60" />
              <div
                className={`w-14 h-14 rounded-[12px] border flex items-center justify-center relative z-10 shadow-sm transition-colors duration-150 ${isPermanentlyLocked
                    ? 'bg-red-50 border-red-300 text-[#B42318]'
                    : 'bg-red-50 border-red-200 text-[#B42318]'
                  }`}
              >
                {isPermanentlyLocked ? (
                  <ShieldX className="w-7 h-7 text-[#B42318]" />
                ) : (
                  <Lock className="w-7 h-7 text-[#B42318] animate-pulse" />
                )}
              </div>
            </div>

            {/* Heading & Mandatory Prompt Messages */}
            <div className="space-y-1.5">
              <h1
                id="lock-screen-title"
                className="text-[20px] font-bold tracking-tight text-[#102A43] uppercase"
              >
                EXAMINATION SESSION LOCKED
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
                A security violation has been detected. Your examination progress has been securely saved.
              </p>
            </div>

            {/* Violation Telemetry Badge */}
            {lockState.violation && (
              <div className="px-3.5 py-2 rounded-[6px] bg-red-50 border border-red-200 text-xs text-[#243247] font-mono flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[#B42318] font-bold uppercase">
                  Violation #{lockState.violationCount}:
                </span>
                <span className="text-[#243247] font-medium">{lockState.violation.label}</span>
                <span className="text-[#64748B] text-[10px]">
                  ({lockState.violation.detectedAt})
                </span>
              </div>
            )}

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-amber-50 border border-amber-300 text-[#B54708] text-xs font-bold tracking-wider uppercase">
              <ShieldAlert className="w-3.5 h-3.5 text-[#B54708]" />
              <span>INVIGILATOR AUTHORIZATION REQUIRED</span>
            </div>

            {/* Saved Examination Progress Summary */}
            <div className="w-full bg-[#F7F9FC] border border-[#DCE3EC] rounded-[6px] p-3.5 text-xs text-left space-y-2">
              <div className="text-[11px] font-bold text-[#102A43] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16865B]" />
                  <span>Examination Progress Secured &amp; Preserved</span>
                </span>
                <span className="text-[#16865B] font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded-[6px] border border-emerald-200">
                  Lab Server Synchronized
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-[#DCE3EC]">
                <div>
                  <span className="text-[#64748B]">Attempted Questions:</span>
                  <div className="font-bold text-[#102A43]">
                    {lockState.savedAnswerCount} Responses Saved
                  </div>
                </div>
                <div>
                  <span className="text-[#64748B]">Remaining Timer:</span>
                  <div className="font-bold font-mono text-[#2463B5]">
                    {Math.floor(lockState.savedRemainingSeconds / 60)}m {lockState.savedRemainingSeconds % 60}s
                  </div>
                </div>
                <div className="col-span-2 pt-0.5 text-[#64748B] text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#64748B]" />
                  <span>Incident Logged: </span>
                  <strong className="text-[#243247] font-mono">
                    {lockState.violation?.detectedAt || new Date().toLocaleTimeString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Error Notification if Incorrect Password */}
            {verificationError && (
              <div
                role="alert"
                className="w-full p-3 rounded-[6px] bg-red-50 border border-red-200 text-[#B42318] text-xs flex items-start gap-2.5 text-left"
              >
                <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#B42318]">
                    Authorization Failed
                  </div>
                  <div className="mt-0.5 text-[#B42318] leading-relaxed">
                    {verificationError}
                  </div>
                </div>
              </div>
            )}

            {/* Permanent Lock Message when Max Attempts Exceeded */}
            {isPermanentlyLocked ? (
              <div className="w-full p-4 rounded-[6px] bg-red-50 border border-red-300 text-[#B42318] text-xs space-y-2 text-left">
                <div className="font-bold text-[#B42318] flex items-center gap-2 text-sm">
                  <ShieldX className="w-4 h-4 text-[#B42318]" />
                  <span>Session Permanently Locked</span>
                </div>
                <p className="text-[#243247] leading-relaxed">
                  Maximum unauthorized unlock attempts exceeded (3/3). This candidate terminal is locked against further input.
                </p>
                <p className="text-[#64748B] text-[11px]">
                  Examination invigilator intervention is required to inspect this terminal.
                </p>
              </div>
            ) : (
              /* Password Authorization Form */
              <form onSubmit={handleSubmit} className="w-full space-y-3.5">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Invigilator Secret Password"
                    disabled={isVerifying}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="h-[43px] w-full pl-4 pr-11 rounded-[6px] border border-[#CBD5E1] bg-white text-[#243247] placeholder-[#64748B] text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#2463B5] focus:border-[#2463B5] disabled:opacity-60 transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#243247] p-1 transition-colors duration-150 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || !password.trim()}
                  className="h-[44px] w-full px-4 rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Invigilator Credentials...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>VERIFY &amp; RESUME EXAMINATION</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full border-t border-white/10 bg-[#050A14] py-3.5 px-6 text-xs text-slate-400 select-none">
        <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span>Maharaja Institute of Technology Mysore · CBT Security Broker</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Strict Lockdown Engine · Active Containment</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
