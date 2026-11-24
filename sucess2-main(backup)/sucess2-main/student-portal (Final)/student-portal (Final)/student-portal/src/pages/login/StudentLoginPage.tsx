import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import { DualModeDobInput } from '../../components/common/DualModeDobInput';
import { useExamSession } from '../../hooks/useExamSession';
import {
  normalizeDobInput,
  validateDobInput,
  validateUsnInput,
} from '../../utils/examFormatters';
import { API_MODE, LAB_API_BASE_URL } from '../../services/apiConfig';
import {
  emergencyRecoveryService,
} from '../../services/emergencyRecoveryService';
import { EmergencyRecoveryDashboard } from '../recovery/EmergencyRecoveryDashboard';
import {
  INSTITUTION_NAME,
  MIT_MYSORE_CAMPUS_BG_URL,
  MIT_MYSORE_LOGO_URL,
} from '../../assets/brandAssets';

export const StudentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    student,
    examSession,
    examStarted,
    submitted,
    responses,
    currentQuestionIndex,
    remainingSeconds,
    loginStudent,
    logoutStudent,
  } = useExamSession();

  const [usn, setUsn] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [usnError, setUsnError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [clientSystemId, setClientSystemId] = useState<string>(
    emergencyRecoveryService.getClientSystemId()
  );

  React.useEffect(() => {
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

  // In-Console Recovery & Re-Login Dashboard State (Accessible ONLY with Instructor credentials)
  const [showInConsoleRecoveryModal, setShowInConsoleRecoveryModal] = useState<boolean>(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setUsnError(null);
    setDobError(null);

    // Request Fullscreen Mode immediately upon student login attempt
    if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement?.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const trimmedUsn = usn.trim();
    const rawDob = dateOfBirth.trim();

    // 1. COE INVIGILATOR / EMERGENCY RECOVERY LOGIN
    // Controlled by central COE portal, authenticated through terminal student login form only
    if (emergencyRecoveryService.isInstructorCredentialId(trimmedUsn)) {
      if (!rawDob) {
        setDobError('Password / Access Key is required for COE Invigilator.');
        return;
      }

      setIsLoading(true);
      try {
        await emergencyRecoveryService.loginInstructor({
          recoveryId: trimmedUsn,
          recoveryKey: rawDob,
        });

        // Request Fullscreen Mode immediately when entering COE Console
        if (
          typeof document !== 'undefined' &&
          !document.fullscreenElement &&
          document.documentElement?.requestFullscreen
        ) {
          document.documentElement.requestFullscreen().catch(() => {});
        }

        // Open the In-Console Recovery Manager directly in the terminal
        setShowInConsoleRecoveryModal(true);
        setUsn('');
        setDateOfBirth('');
        setUsnError(null);
        setDobError(null);
        setAuthError(null);
        return;
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Authentication failed: Invalid credentials.'
        );
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // 2. NORMAL STUDENT LOGIN
    const uErr = validateUsnInput(trimmedUsn);
    const dErr = validateDobInput(rawDob);
    setUsnError(uErr);
    setDobError(dErr);

    if (uErr || dErr) {
      return;
    }

    setIsLoading(true);
    try {
      const normalizedUsn = trimmedUsn.toUpperCase();
      const normalizedDob = normalizeDobInput(rawDob);
      await loginStudent({
        usn: normalizedUsn,
        dateOfBirth: normalizedDob,
        workstationId: clientSystemId,
      });

      // Check if student has an authorized recovery pending
      const pendingAuth = emergencyRecoveryService.getPendingRecoveryAuthorisation(normalizedUsn);
      if (pendingAuth) {
        // Automatically consume recovery authorization on the current machine
        const currentSysId = emergencyRecoveryService.getClientSystemId();
        emergencyRecoveryService.consumeRecoveryAuthorisation(normalizedUsn, currentSysId);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Authentication with local Lab Server failed.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Post-authentication Examination Availability & State Gate
  if (student && examSession) {
    if (submitted || examSession.availabilityState === 'COMPLETED') {
      return <Navigate to="/student/completion" replace />;
    }

    if (examStarted) {
      return <Navigate to="/student/examination" replace />;
    }

    // If candidate has not started the exam yet, proceed to instructions
    return <Navigate to="/student/instructions" replace />;
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#F7F9FC] flex flex-col justify-between overflow-x-hidden">
      {/* Background Campus Image Layer - ONLY on Student Login Page */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${MIT_MYSORE_CAMPUS_BG_URL})` }}
        aria-hidden="true"
      >
        {/* Brighter, elegant institutional overlay making the background a shade lighter */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/72 via-white/58 to-white/72" />
      </div>

      {/* Shared Institutional Header - Blue Banner Theme */}
      <div className="relative z-10">
        <InstitutionHeader systemId={clientSystemId} theme="blue" hideLanIndicator={true} />
      </div>

      {/* Main Content: Single Centered Student Login Card */}
      <main className="relative z-10 flex-1 w-full max-w-[1240px] mx-auto px-6 py-8 flex flex-col items-center justify-center">
        {/* Student Login Card */}
        <div className="w-full max-w-[430px] bg-white border border-[#CBD5E1] rounded-[10px] shadow-[0_10px_30px_rgba(16,42,67,0.15)] relative z-20">
          {/* Card Banner: Institution Logo, Name & Student Login */}
          <div className="px-6 py-4 bg-gradient-to-r from-[#102A43] via-[#16365C] to-[#102A43] text-white flex items-center gap-3.5 border-b border-[#243B53] rounded-t-[9px]">
            <div className="w-12 h-12 rounded-[6px] bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src={MIT_MYSORE_LOGO_URL}
                alt="Official Logo of Maharaja Institute of Technology Mysore"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-left min-w-0">
              <div className="font-institution font-bold text-[12px] text-blue-200 uppercase tracking-wide truncate">
                {INSTITUTION_NAME}
              </div>
              <h2 className="text-[20px] font-bold text-white leading-tight mt-0.5">
                Student Login
              </h2>
              <p className="text-[11px] text-blue-100/80 mt-0.5">
                Enter credentials to access examination
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {backendOnline === false && (
              <div
                className="p-3 rounded-[6px] bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Examination Server Offline:</strong> Unable to connect to the examination server ({LAB_API_BASE_URL}). Please ensure the server is running.
                </span>
              </div>
            )}

            {authError && (
              <div
                className="p-3 rounded-[6px] bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#B42318]"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} noValidate className="space-y-[18px] text-left">
            {/* Field 1: USN or Emergency Recovery ID */}
            <div>
              <label
                htmlFor="student-usn"
                className="block text-[13px] font-semibold text-[#243B53] mb-1.5"
              >
                University Seat Number (USN){' '}
                <span className="text-[#B42318]">*</span>
              </label>
              <input
                id="student-usn"
                type="text"
                value={usn}
                onChange={(e) => {
                  setUsn(e.target.value.toUpperCase());
                  if (usnError) setUsnError(null);
                  if (authError) setAuthError(null);
                }}
                placeholder="e.g., 4MH25CS149"
                autoComplete="off"
                spellCheck={false}
                className={`h-[43px] w-full px-3.5 rounded-[6px] border text-sm font-mono uppercase bg-white text-[#243247] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2463B5] focus:border-[#2463B5] transition-colors duration-150 ${
                  usnError ? 'border-[#B42318]' : 'border-[#CBD5E1]'
                }`}
              />
              {usnError ? (
                <p className="mt-1.5 text-xs text-[#B42318] font-medium">
                  {usnError}
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] text-[#64748B]">
                  Enter your 10-character institutional USN
                </p>
              )}
            </div>

            {/* Field 2: Dual-Mode Date of Birth / Recovery Key */}
            <div>
              <label
                htmlFor="student-dob"
                className="block text-[13px] font-semibold text-[#243B53] mb-1.5"
              >
                Date of Birth <span className="text-[#B42318]">*</span>
              </label>
              <DualModeDobInput
                id="student-dob"
                value={dateOfBirth}
                onChange={(val) => {
                  setDateOfBirth(val);
                  if (dobError) setDobError(null);
                  if (authError) setAuthError(null);
                }}
                hasError={Boolean(dobError)}
                placeholder="YYYY-MM-DD"
              />
              {dobError ? (
                <p className="mt-1.5 text-xs text-[#B42318] font-medium">
                  {dobError}
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] text-[#64748B]">
                  Select from calendar or type manually (YYYY-MM-DD)
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || backendOnline === false}
                className="w-full h-[44px] rounded-[6px] bg-[#2463B5] hover:bg-[#194F96] text-white font-bold text-[14px] tracking-wide transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2463B5]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying with Lab Server...</span>
                  </>
                ) : backendOnline === false ? (
                  <span>Server Offline</span>
                ) : (
                  <span>LOGIN</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>

      {/* Institutional Footer */}
      <footer className="relative z-10 bg-white border-t border-[#DCE3EC] py-3.5 text-xs text-[#64748B]">
        <div className="max-w-[1240px] w-full mx-auto px-6 flex flex-wrap items-center justify-between gap-2">
          <span>
            Maharaja Institute of Technology Mysore · Student Examination Portal
          </span>
          <div className="flex items-center gap-4">
            <Link
              to="/instructor/login"
              className="text-[#64748B] hover:text-[#2463B5] transition-colors underline-offset-2 hover:underline"
            >
              Invigilator / Recovery Login
            </Link>
          </div>
        </div>
      </footer>

      {/* IN-CONSOLE EMERGENCY RECOVERY & RE-LOGIN OVERLAY (Accessible ONLY by Instructor) */}
      {showInConsoleRecoveryModal && (
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col p-0 overflow-y-auto animate-in fade-in">
          <div className="w-full h-full min-h-screen bg-white flex flex-col">
            <EmergencyRecoveryDashboard
              onClose={() => {
                setShowInConsoleRecoveryModal(false);
                emergencyRecoveryService.logoutInstructor();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
