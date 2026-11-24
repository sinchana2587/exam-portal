import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Timer } from 'lucide-react';
import { InstitutionHeader } from '../../components/layout/InstitutionHeader';
import { useExamSession } from '../../hooks/useExamSession';
import { MIT_MYSORE_CAMPUS_BG_URL } from '../../assets/brandAssets';

/**
 * Examination Completion Page (/student/completion)
 * Strictly displays submission confirmation metadata without revealing marks,
 * correct answers, answer keys, rank, or performance analytics.
 * Automatically returns to the student login page after 10 seconds.
 */
export const ExamCompletionPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    student,
    examSession,
    submitted,
    submissionReceipt,
    logoutStudent,
  } = useExamSession();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          logoutStudent();
          navigate('/student/login', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [logoutStudent, navigate]);

  if (!student || !examSession) {
    return <Navigate to="/student/login" replace />;
  }

  if (!submitted && examSession.availabilityState !== 'COMPLETED') {
    return <Navigate to="/student/examination" replace />;
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#F7F9FC] flex flex-col justify-between font-sans text-[#243247] overflow-x-hidden">
      {/* Background Campus Image Layer - for Examination Completion Page */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${MIT_MYSORE_CAMPUS_BG_URL})` }}
        aria-hidden="true"
      >
        {/* Brighter, elegant institutional overlay making the background a shade lighter */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/72 via-white/58 to-white/72" />
      </div>

      {/* Standard Shared Institutional Header */}
      <div className="relative z-10">
        <InstitutionHeader
          rightSlot={
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-[#16865B] bg-emerald-50 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px] border border-emerald-200 shadow-xs">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#16865B]" />
              <span>Responses Locked on Lab Server</span>
            </div>
          }
        />
      </div>

      {/* Main Completion Card */}
      <main className="relative z-10 flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-center">
        <div className="max-w-[620px] w-full bg-white border border-[#DCE3EC] rounded-[10px] p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 institutional-card-shadow">
          {/* Success Header */}
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-[#DCE3EC]">
            <div className="w-12 h-12 rounded-[6px] bg-emerald-50 border border-emerald-200 text-[#16865B] flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-[23px] font-bold text-[#102A43] tracking-tight">
              Examination Submitted Successfully
            </h1>
            <p className="text-sm text-[#64748B] max-w-lg">
              Your examination responses have been submitted successfully. You
              may now inform the invigilator.
            </p>
          </div>

          {/* Official Submission Confirmation Details (No Marks or Answer Keys) */}
          <div className="border border-[#DCE3EC] rounded-[6px] divide-y divide-[#DCE3EC] text-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#F7F9FC]">
              <span className="text-[#64748B] font-medium">
                Submission Confirmation Reference
              </span>
              <span className="font-mono font-bold text-[#102A43]">
                {submissionReceipt?.confirmationReference ||
                  `MITM-SUB-2026-${student.usn}`}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#64748B]">Student USN</span>
              <span className="font-mono font-bold text-[#102A43]">
                {student.usn}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#64748B]">Candidate Name</span>
              <span className="font-semibold text-[#102A43]">
                {student.fullName}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#64748B]">Subject Name</span>
              <span className="font-semibold text-[#102A43] text-right">
                {examSession.subjectCode} – {examSession.subjectName}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#64748B]">Examination Session</span>
              <span className="font-medium text-[#243247] text-right">
                {examSession.examinationType} ({examSession.sessionSlot})
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[#64748B]">Submission Timestamp</span>
              <span className="font-mono tabular-nums font-medium text-[#243247]">
                {submissionReceipt?.submittedAt ||
                  new Date().toLocaleString('en-IN')}
              </span>
            </div>

            {submissionReceipt && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#64748B]">Submission Mode</span>
                <span className="font-medium text-[#16865B]">
                  {submissionReceipt.submissionTrigger === 'AUTO_TIMER_EXPIRED'
                    ? 'Automatic Submission (Lab Server Timer Expired)'
                    : 'Candidate Confirmed Final Submission'}
                </span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-[6px] bg-[#F7F9FC] border border-[#DCE3EC] text-xs text-[#64748B] leading-relaxed">
            In accordance with Maharaja Institute of Technology Mysore
            examination regulations, evaluation is performed centrally after
            session closure and result release is controlled by the Office of the
            Controller of Examinations (COE).
          </div>

          {/* Automatic Return to Login Notice & Live 10-Second Countdown */}
          <div className="p-4 rounded-[6px] bg-blue-50/70 border border-[#CBD5E1] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-[#102A43] font-medium text-center sm:text-left">
              <span className="w-2 h-2 rounded-full bg-[#2463B5] shrink-0" />
              <span>
                Examination closed and session locked. Returning to login page automatically in:
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-[#2463B5] bg-white px-3 py-1.5 rounded-[6px] border border-[#CBD5E1] text-sm shrink-0 tabular-nums">
              <Timer className="w-4 h-4 text-[#2463B5] shrink-0" />
              <span>00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}s</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 bg-white border-t border-[#DCE3EC] px-6 py-3.5 text-xs text-[#64748B]">
        <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Maharaja Institute of Technology Mysore</span>
          <span>MIT Mysore Student Examination Portal</span>
        </div>
      </footer>
    </div>
  );
};
