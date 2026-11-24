/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, KeyRound, Laptop, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import {
  emergencyRecoveryService,
} from '../../services/emergencyRecoveryService';
import { LAB_API_BASE_URL } from '../../services/apiConfig';
import {
  INSTITUTION_NAME,
  MIT_MYSORE_CAMPUS_BG_URL,
  MIT_MYSORE_LOGO_URL,
} from '../../assets/brandAssets';

export const InstructorLoginPage: React.FC = () => {
  const navigate = useNavigate();

  // If already authenticated as instructor, redirect directly to recovery dashboard
  if (emergencyRecoveryService.isInstructorAuthenticated()) {
    return <Navigate to="/recovery/dashboard" replace />;
  }

  const [recoveryId, setRecoveryId] = useState<string>('');
  const [recoveryKey, setRecoveryKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [clientSystemId] = useState<string>(
    emergencyRecoveryService.getClientSystemId()
  );

  useEffect(() => {
    let active = true;
    const checkBackend = async () => {
      try {
        const res = await fetch(`${LAB_API_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (active) setBackendOnline(res.ok);
      } catch {
        if (active) setBackendOnline(false);
      }
    };
    void checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIdError(null);
    setKeyError(null);

    const trimmedId = recoveryId.trim();
    const trimmedKey = recoveryKey.trim();

    let hasError = false;
    if (!trimmedId) {
      setIdError('Please enter your Recovery ID / Instructor ID.');
      hasError = true;
    }
    if (!trimmedKey) {
      setKeyError('Please enter your Recovery Key / Access Password.');
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);
    try {
      await emergencyRecoveryService.loginInstructor({
        recoveryId: trimmedId,
        recoveryKey: trimmedKey,
      });

      // Navigate to recovery dashboard upon verified authentication
      navigate('/recovery/dashboard', { replace: true });
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Invalid COE Emergency Recovery Credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col font-sans">
      {/* Institutional Top Bar */}
      <InstitutionHeader />

      {/* Main Container */}
      <main className="relative flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Subtle Background Watermark */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: `url(${MIT_MYSORE_CAMPUS_BG_URL})` }}
        />

        <div className="relative z-10 w-full max-w-[440px]">
          {/* Workstation & Server Status Badges */}
          <div className="mb-3 flex items-center justify-between text-xs text-[#64748B] px-1">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Laptop className="w-3.5 h-3.5 text-[#2463B5]" />
              Workstation: <strong className="text-[#102A43]">{clientSystemId} (Any PC Allowed)</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline === true
                    ? 'bg-emerald-500'
                    : backendOnline === false
                    ? 'bg-red-500'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              {backendOnline === true
                ? 'Lab Server Online'
                : backendOnline === false
                ? 'Lab Server Offline'
                : 'Connecting...'}
            </span>
          </div>

          {/* Authentication Card */}
          <div className="bg-white border border-[#DCE3EC] rounded-[10px] p-6 sm:p-8 institutional-card-shadow">
            {/* Header / Brand */}
            <div className="flex flex-col items-center text-center pb-5 border-b border-[#E2E8F0]">
              <div className="w-12 h-12 rounded-full bg-[#2463B5]/10 flex items-center justify-center text-[#2463B5] mb-2.5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-[17px] font-bold text-[#102A43] leading-snug">
                COE Invigilator & Recovery Portal
              </h1>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                Emergency Terminal Authorization · MIT Mysore
              </p>
            </div>

            {/* Error Notification */}
            {authError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-[6px] flex items-start gap-2.5 text-xs text-[#B42318]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{authError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4" noValidate>
              {/* Recovery ID / Instructor ID */}
              <div>
                <label className="block text-xs font-semibold text-[#102A43] uppercase tracking-wider mb-1.5">
                  Recovery ID / Instructor ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recoveryId}
                    onChange={(e) => {
                      setRecoveryId(e.target.value);
                      if (idError) setIdError(null);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="Enter Recovery ID / Username (e.g. LAB@0987)"
                    disabled={isLoading}
                    autoComplete="username"
                    className={`w-full h-[42px] px-3.5 text-sm bg-white border rounded-[6px] text-[#102A43] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2463B5] focus:border-transparent transition-all ${
                      idError ? 'border-[#B42318] ring-1 ring-[#B42318]' : 'border-[#CBD5E1]'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#94A3B8]">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                {idError && (
                  <p className="mt-1.5 text-xs text-[#B42318] font-medium">{idError}</p>
                )}
              </div>

              {/* Recovery Key / Access Password */}
              <div>
                <label className="block text-xs font-semibold text-[#102A43] uppercase tracking-wider mb-1.5">
                  Recovery Key / Access Password
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={recoveryKey}
                    onChange={(e) => {
                      setRecoveryKey(e.target.value);
                      if (keyError) setKeyError(null);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="Enter security key or password (e.g. lab.2587)"
                    disabled={isLoading}
                    autoComplete="current-password"
                    className={`w-full h-[42px] px-3.5 pr-10 text-sm bg-white border rounded-[6px] text-[#102A43] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2463B5] focus:border-transparent transition-all ${
                      keyError ? 'border-[#B42318] ring-1 ring-[#B42318]' : 'border-[#CBD5E1]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#64748B] focus:outline-none"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {keyError && (
                  <p className="mt-1.5 text-xs text-[#B42318] font-medium">{keyError}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[44px] rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white font-bold text-[14px] tracking-wide transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <span>AUTHENTICATE & OPEN CONSOLE</span>
                  )}
                </button>
              </div>

              {/* Return to Student Login Link */}
              <div className="pt-2 text-center">
                <Link
                  to="/student/login"
                  className="text-xs text-[#2463B5] hover:text-[#194F96] font-medium hover:underline inline-flex items-center gap-1"
                >
                  ← Return to Student Examination Login
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="relative z-10 bg-white border-t border-[#DCE3EC] py-3.5 text-xs text-[#64748B]">
        <div className="max-w-[1240px] w-full mx-auto px-6 flex flex-wrap items-center justify-between gap-2">
          <span>
            {INSTITUTION_NAME} · Controller of Examinations Emergency Console
          </span>
          <span>Protected Administrative Interface · Strict Audit Logging</span>
        </div>
      </footer>
    </div>
  );
};
