import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { OFFICIAL_MIT_LOGO_PATH } from '../components/InstitutionLogo';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../services/apiConfig';

const MIT_BUILDING_BG_PATH = '/assets/aistudio/Screenshot_2026-11-15_092631_74996ac2.png';

export const LoginPage: React.FC = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [headerLogoError, setHeaderLogoError] = useState(false);
  const [cardLogoError, setCardLogoError] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_CONFIG.baseUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
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

  useEffect(() => {
    if (user) {
      if (user.role === 'PRINCIPAL') {
        navigate('/admin/principal/dashboard', { replace: true });
      } else if (user.role === 'HOD') {
        navigate('/admin/hod/dashboard', { replace: true });
      } else {
        // Clear unauthorized session (e.g. COE) so user can log in with valid credentials
        void logout();
      }
    }
  }, [user, navigate, logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim()) {
      setErrorMessage('Please enter your username.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await login({ username: username.trim(), password });
      if (response.user.role === 'PRINCIPAL') {
        navigate('/admin/principal/dashboard', { replace: true });
      } else if (response.user.role === 'HOD') {
        navigate('/admin/hod/dashboard', { replace: true });
      } else {
        await logout();
        setErrorMessage(
          `Signed in as ${response.user.role}. This portal is restricted to Principal and HOD staff. COE accounts must sign in via the COE Portal.`
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please verify your credentials and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden w-full flex flex-col justify-between bg-[#0F1B33]">
      {/* Full-Viewport Official MIT Mysore Building Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#0F1B33]">
        {!bgError && (
          <img
            src={MIT_BUILDING_BG_PATH}
            alt="Maharaja Institute of Technology Mysore Campus Building"
            referrerPolicy="no-referrer"
            onError={() => setBgError(true)}
            className="w-full h-full object-cover object-[50%_58%] scale-[1.02]"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#162338]/45 via-[#182842]/45 to-[#0D1729]/70"
        />
      </div>

      {/* Full-Width Solid White Institutional Header Masthead */}
      <header className="relative z-20 shrink-0 w-full bg-white dark:bg-slate-900 border-b border-[#D9E2EF] dark:border-slate-800 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 lg:gap-5">
          {/* Circular Logo within White Header Space */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 shrink-0 rounded-full overflow-hidden flex items-center justify-center">
            {!headerLogoError ? (
              <img
                src={OFFICIAL_MIT_LOGO_PATH}
                alt="Maharaja Institute of Technology Mysore Official Logo"
                referrerPolicy="no-referrer"
                onError={() => setHeaderLogoError(true)}
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <span className="text-sm font-bold text-white bg-[#262F87] w-full h-full flex items-center justify-center">
                MITM
              </span>
            )}
          </div>

          {/* Unified Left-Aligned Institutional Masthead Stack */}
          <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-[#22246B] dark:text-indigo-300 font-serif leading-tight">
              Maharaja Education Trust ®, Mysuru
            </p>

            <h1 className="text-base sm:text-2xl lg:text-[28px] font-bold text-[#22246B] dark:text-white tracking-[0.015em] font-serif leading-tight mt-0.5">
              Maharaja Institute of Technology Mysore
            </h1>

            <p className="text-xs sm:text-sm font-bold text-[#22246B] dark:text-slate-200 leading-snug mt-0.5">
              ಮಹಾರಾಜ ತಾಂತ್ರಿಕ ಮಹಾವಿದ್ಯಾಲಯ ಮೈಸೂರು
            </p>

            <p className="text-[10px] sm:text-xs font-bold leading-snug mt-0.5 font-serif">
              <span className="text-[#E86C1F] dark:text-orange-400">
                An Autonomous Institution Affiliated to VTU, Belagavi
              </span>
              <span className="text-[#94A3B8] mx-2" aria-hidden="true">
                ·
              </span>
              <span className="text-[#22246B] dark:text-slate-300">
                Approved by AICTE, New Delhi, Recognized by GoK.
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* Centered Common Principal / HOD Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-[420px] flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-700/80 shadow-xl px-6 py-5 sm:px-8 sm:py-6">
          <div>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mb-2">
                {!cardLogoError ? (
                  <img
                    src={OFFICIAL_MIT_LOGO_PATH}
                    alt="MIT Mysore Official Emblem"
                    referrerPolicy="no-referrer"
                    onError={() => setCardLogoError(true)}
                    className="w-full h-full object-contain select-none"
                  />
                ) : (
                  <span className="text-sm font-bold text-white bg-[#262F87] w-full h-full flex items-center justify-center">
                    MITM
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#22246B] dark:text-white tracking-tight leading-snug">
                MIT Mysore Examination Management System
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Principal &amp; Head of Department Access
              </p>
            </div>

            {backendOnline === false && (
              <div
                role="alert"
                className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-500/50 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span className="leading-relaxed font-medium">
                  <strong>Central Backend Disconnected:</strong> The backend server ({API_CONFIG.baseUrl}) is not reachable.
                </span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="mb-3 p-2.5 rounded-lg bg-[#B42318]/10 dark:bg-red-950/40 border border-[#B42318]/30 dark:border-red-800 flex items-start gap-2 text-xs text-[#B42318] dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1"
                >
                  Username
                </label>
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#25287A]/25 focus:border-[#25287A] transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#25287A]/25 focus:border-[#25287A] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-white p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || backendOnline === false}
                className="w-full mt-2 py-2.5 sm:py-3 px-4 rounded-lg bg-[#25287A] hover:bg-[#1D2063] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : backendOnline === false ? (
                  <span>Backend Offline</span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E2E8F0] dark:border-slate-800 text-center">
            <p className="text-xs font-medium text-[#475569] dark:text-slate-300">
              For Principal / HOD Access Only
            </p>
          </div>
        </div>
      </main>

      {/* Clean Institutional Footer */}
      <footer className="relative z-10 shrink-0 w-full py-2 px-4 text-center text-xs font-medium text-white/90 drop-shadow-xs">
        Maharaja Institute of Technology Mysore · Administrative Examination Portal
      </footer>
    </div>
  );
};
