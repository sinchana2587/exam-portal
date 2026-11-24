import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  KeyRound,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { resultService } from '../services/resultService';
import { StatusIndicator } from '../components/StatusIndicator';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatSemesterLabel } from '../utils/academicSemesters';
import {
  exportResultsToPdf,
  exportRowsToCsv,
  exportRowsToExcel,
} from '../utils/csvExport';

export type ResultApprovalSectionId =
  | 'result-overview'
  | 'student-results'
  | 'answer-key-corrections';

export type StudentResultFilter = 'All' | 'Present' | 'Absent' | 'Passed' | 'Failed';

export const ResultApprovalPage: React.FC = () => {
  const {
    semesters,
    results,
    correctionRequests,
    activeExaminationId,
    setActiveExaminationId,
    refreshAll,
    notify,
  } = useExaminationStore();

  const [searchParams] = useSearchParams();
  const rawSection = searchParams.get('section') || 'result-overview';
  const activeSection: ResultApprovalSectionId =
    rawSection === 'student-results' || rawSection === 'answer-key-corrections'
      ? rawSection
      : 'result-overview';

  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');

  const filteredResults = useMemo(() => {
    if (semesterFilter === 'ALL') return results;
    const semNum = Number(semesterFilter);
    return results.filter((r) => r.semester === semNum);
  }, [results, semesterFilter]);

  const selectedResult = useMemo(() => {
    if (activeExaminationId) {
      const found = results.find((r) => r.examinationId === activeExaminationId);
      if (found) return found;
    }
    return results[0] || null;
  }, [results, activeExaminationId]);

  const [studentSearch, setStudentSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<StudentResultFilter>('All');
  const [decisionNotesMap, setDecisionNotesMap] = useState<Record<string, string>>(
    {}
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);

  const examCorrectionRequests = useMemo(() => {
    if (!selectedResult) return [];
    return correctionRequests.filter(
      (c) => c.examinationId === selectedResult.examinationId
    );
  }, [correctionRequests, selectedResult]);

  const pendingCorrectionsCount = useMemo(
    () =>
      examCorrectionRequests.filter((c) => c.status === 'Pending Review').length,
    [examCorrectionRequests]
  );

  // Identify highest overall marks among Present students (supports single or tied toppers)
  const highestPresentMarks = useMemo(() => {
    if (!selectedResult) return null;
    const presentStudents = selectedResult.studentResults.filter(
      (s) => s.attendanceStatus === 'Present' && s.totalMarksObtained !== null
    );
    if (presentStudents.length === 0) return null;
    return Math.max(...presentStudents.map((s) => s.totalMarksObtained ?? 0));
  }, [selectedResult]);

  // Filter counts for the 5 filter tabs: All, Present, Absent, Passed, Failed
  const filterCounts = useMemo(() => {
    if (!selectedResult) {
      return { All: 0, Present: 0, Absent: 0, Passed: 0, Failed: 0 };
    }
    const rows = selectedResult.studentResults;
    return {
      All: rows.length,
      Present: rows.filter((r) => r.attendanceStatus === 'Present').length,
      Absent: rows.filter((r) => r.attendanceStatus === 'Absent').length,
      Passed: rows.filter(
        (r) =>
          r.attendanceStatus === 'Present' &&
          (r.totalMarksObtained ?? 0) >= selectedResult.passingMarks
      ).length,
      Failed: rows.filter(
        (r) =>
          r.attendanceStatus === 'Present' &&
          (r.totalMarksObtained ?? 0) < selectedResult.passingMarks
      ).length,
    };
  }, [selectedResult]);

  const filteredStudents = useMemo(() => {
    if (!selectedResult) return [];
    return selectedResult.studentResults.filter((st) => {
      const q = studentSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        st.usn.toLowerCase().includes(q) ||
        st.studentName.toLowerCase().includes(q);

      if (!matchesQuery) return false;

      const isPresent = st.attendanceStatus === 'Present';
      const isPassed =
        isPresent && (st.totalMarksObtained ?? 0) >= selectedResult.passingMarks;
      const isFailed =
        isPresent && (st.totalMarksObtained ?? 0) < selectedResult.passingMarks;

      switch (resultFilter) {
        case 'Present':
          return isPresent;
        case 'Absent':
          return st.attendanceStatus === 'Absent';
        case 'Passed':
          return isPassed;
        case 'Failed':
          return isFailed;
        case 'All':
        default:
          return true;
      }
    });
  }, [selectedResult, studentSearch, resultFilter]);

  const handleReviewCorrection = async (
    requestId: string,
    decision: 'Approved' | 'Rejected'
  ) => {
    const notes =
      decisionNotesMap[requestId]?.trim() ||
      (decision === 'Approved'
        ? 'Verified against HOD subject justification; approved answer-key correction and recalculated marks.'
        : 'Existing option verified as accurate; correction request rejected.');

    setProcessingId(requestId);
    try {
      const outcome = await resultService.reviewAnswerKeyCorrection(
        requestId,
        decision,
        notes
      );
      await refreshAll();
      notify(
        decision === 'Approved' ? 'success' : 'info',
        `Answer-Key Correction ${decision}`,
        decision === 'Approved'
          ? `Updated examination answer key for ${outcome.updatedRequest.questionId}. Re-evaluated ${outcome.recalculatedStudentCount} present candidates (${outcome.scoreChangedCount} score(s) updated).`
          : `Rejected correction request for Question ${outcome.updatedRequest.questionId}.`
      );
    } catch (err) {
      notify(
        'error',
        'Review Action Failed',
        err instanceof Error ? err.message : 'Unable to process correction request.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAndRelease = async () => {
    if (!selectedResult) return;
    setProcessingId(selectedResult.id);
    try {
      await resultService.approveAndReleaseResults(selectedResult.id);
      await refreshAll();
      setReleaseConfirmOpen(false);
      notify(
        'success',
        'Results Approved & Released',
        `Final results for ${selectedResult.examinationCode} (${selectedResult.subjectName}) have been released to the ${selectedResult.department} HOD and Principal.`
      );
    } catch (err) {
      setReleaseConfirmOpen(false);
      notify(
        'error',
        'Result Release Blocked',
        err instanceof Error ? err.message : 'Cannot release results.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const buildExportRows = () => {
    if (!selectedResult) return [];
    return filteredStudents.map((st) => {
      const isTopper =
        st.attendanceStatus === 'Present' &&
        highestPresentMarks !== null &&
        st.totalMarksObtained === highestPresentMarks;
      const computedResult =
        st.attendanceStatus === 'Absent'
          ? 'Absent'
          : (st.totalMarksObtained ?? 0) >= selectedResult.passingMarks
            ? 'Pass'
            : 'Fail';
      return {
        'Student Name': isTopper ? `${st.studentName} (Topper)` : st.studentName,
        USN: st.usn,
        'Original Section': st.originalSection,
        'Overall Marks Obtained':
          st.attendanceStatus === 'Absent'
            ? 'Absent'
            : String(st.totalMarksObtained ?? 0),
        'Maximum Marks': st.maximumMarks,
        'Attendance Status': st.attendanceStatus,
        Result: computedResult,
      };
    });
  };

  const handleExportStudentResultsCsv = () => {
    if (!selectedResult) return;
    exportRowsToCsv(
      `${selectedResult.examinationCode}_${selectedResult.subjectCode}_Results.csv`,
      buildExportRows()
    );
    notify(
      'info',
      'CSV Exported',
      `Exported ${filteredStudents.length} student result records for ${selectedResult.subjectCode}.`
    );
  };

  const handleExportStudentResultsExcel = () => {
    if (!selectedResult) return;
    exportRowsToExcel(
      `${selectedResult.examinationCode}_${selectedResult.subjectCode}_Results.xlsx`,
      `${selectedResult.subjectCode} Results`,
      buildExportRows()
    );
    notify(
      'info',
      'Excel (.xlsx) Exported',
      `Exported ${filteredStudents.length} student result records as Excel (.xlsx).`
    );
  };

  const handleExportStudentResultsPdf = () => {
    if (!selectedResult) return;
    exportResultsToPdf(
      `${selectedResult.examinationCode}_${selectedResult.subjectCode}_Results.pdf`,
      {
        examinationCode: selectedResult.examinationCode,
        subjectCode: selectedResult.subjectCode,
        subjectName: selectedResult.subjectName,
        departmentName: selectedResult.departmentName,
        semester: selectedResult.semester,
        examDate: selectedResult.examDate,
        maximumMarks: selectedResult.maximumMarks,
        passingMarks: selectedResult.passingMarks,
      },
      filteredStudents.map((st) => {
        const isTopper =
          st.attendanceStatus === 'Present' &&
          highestPresentMarks !== null &&
          st.totalMarksObtained === highestPresentMarks;
        const computedResult =
          st.attendanceStatus === 'Absent'
            ? 'Absent'
            : (st.totalMarksObtained ?? 0) >= selectedResult.passingMarks
              ? 'Pass'
              : 'Fail';
        return {
          studentName: st.studentName,
          usn: st.usn,
          originalSection: st.originalSection,
          marksObtained:
            st.attendanceStatus === 'Absent'
              ? 'Absent'
              : String(st.totalMarksObtained ?? 0),
          maximumMarks: st.maximumMarks,
          attendanceStatus: st.attendanceStatus,
          resultStatus: computedResult,
          isTopper,
        };
      })
    );
    notify(
      'info',
      'PDF Report Exported',
      `Exported ${filteredStudents.length} student result records as formatted PDF.`
    );
  };

  if (!selectedResult) {
    return (
      <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-10 text-center text-sm text-[#64748B] dark:text-slate-400">
        No imported examination results found. Import a verified Lab Server result file first.
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Persistent Selected Result Context Banner */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-mono font-bold text-[#2563EB] dark:text-blue-400">
              {selectedResult.examinationCode}
            </span>
            <span className="text-lg font-bold text-[#1F2937] dark:text-white">
              {selectedResult.subjectCode}: {selectedResult.subjectName}
            </span>
            <StatusIndicator
              tone={
                selectedResult.approvalStatus === 'Approved & Released'
                  ? 'approved'
                  : pendingCorrectionsCount > 0 ||
                      selectedResult.recordsRequiringAttention > 0
                    ? 'danger'
                    : 'warning'
              }
              label={
                selectedResult.approvalStatus === 'Approved & Released'
                  ? 'Released'
                  : pendingCorrectionsCount > 0 ||
                      selectedResult.recordsRequiringAttention > 0
                    ? `Correction Pending (${pendingCorrectionsCount || selectedResult.recordsRequiringAttention})`
                    : 'Awaiting Approval'
              }
            />
          </div>
          <p className="text-sm text-[#64748B] dark:text-slate-400">
            {selectedResult.departmentName} ({selectedResult.department} &middot;{' '}
            {formatSemesterLabel(selectedResult.semester)}) &middot; Exam Date:{' '}
            <span className="font-mono">{selectedResult.examDate}</span> &middot; Max Marks:{' '}
            {selectedResult.maximumMarks} (Passing: {selectedResult.passingMarks})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportStudentResultsPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white bg-[#17243A] hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleExportStudentResultsExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white bg-[#16834A] hover:bg-green-700 rounded-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportStudentResultsCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-[#1F2937] dark:text-slate-200 bg-[#F5F7FB] dark:bg-[#0F172A] hover:bg-slate-200 dark:hover:bg-slate-800 border border-[#D9E2EF] dark:border-[#334155] rounded-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          {selectedResult.approvalStatus !== 'Approved & Released' && (
            <button
              type="button"
              disabled={
                pendingCorrectionsCount > 0 ||
                selectedResult.recordsRequiringAttention > 0
              }
              onClick={() => setReleaseConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 rounded-lg shadow-xs cursor-pointer"
              title={
                pendingCorrectionsCount > 0
                  ? 'Resolve all pending answer-key correction requests before releasing results'
                  : 'Approve and release results to HOD and Principal'
              }
            >
              <Send className="w-4 h-4" />
              Approve &amp; Release Results to HOD &amp; Principal
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================
          SECTION 1: RESULT OVERVIEW & RELEASE
         ======================================================================== */}
      {activeSection === 'result-overview' && (
        <div className="space-y-7">
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
            <div>
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
                Result Overview &amp; Final Release
              </h1>
              <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5 leading-relaxed">
                Review attendance summary and pending answer-key corrections before releasing results.
              </p>
            </div>

            {/* 6 Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Total Eligible Students
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#1F2937] dark:text-white">
                  {selectedResult.totalEligibleStudents}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Students Present
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#16834A] dark:text-emerald-400">
                  {selectedResult.studentsPresent}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Students Absent
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#B7791F] dark:text-amber-400">
                  {selectedResult.studentsAbsent}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Imported Result Records
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#2563EB] dark:text-blue-400">
                  {selectedResult.importedResultRecords}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Records Requiring Attention
                </div>
                <div className="mt-2 text-3xl font-bold font-mono text-[#1F2937] dark:text-white">
                  {selectedResult.recordsRequiringAttention}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-sm font-semibold text-[#64748B] dark:text-slate-400">
                  Pending Answer-Key Corrections
                </div>
                <div
                  className={`mt-2 text-3xl font-bold font-mono ${
                    pendingCorrectionsCount > 0
                      ? 'text-[#B42318] dark:text-red-400'
                      : 'text-[#16834A] dark:text-emerald-400'
                  }`}
                >
                  {pendingCorrectionsCount}
                </div>
              </div>
            </div>

            {/* Result Record Switcher Cards with 1st-8th Semester Filter */}
            <div className="pt-5 border-t border-[#D9E2EF] dark:border-[#334155]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                  Imported Examination Result Records ({filteredResults.length}
                  {semesterFilter !== 'ALL' ? ` of ${results.length}` : ''})
                </h2>

                <div className="flex items-center gap-2.5">
                  <Filter className="w-4 h-4 text-[#64748B] shrink-0" />
                  <select
                    aria-label="Filter imported results by semester"
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="px-3.5 py-2 text-sm font-medium rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  >
                    <option value="ALL">All Semesters (1st–8th)</option>
                    {semesters.map((sem) => (
                      <option key={sem.semesterNumber} value={String(sem.semesterNumber)}>
                        {sem.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredResults.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 text-center space-y-2.5">
                  <p className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    No imported examination results found for this semester.
                  </p>
                  <p className="text-sm text-[#64748B] dark:text-slate-400">
                    There are currently no imported examination result records for{' '}
                    {formatSemesterLabel(Number(semesterFilter))}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSemesterFilter('ALL')}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-blue-400 hover:bg-blue-50/40 cursor-pointer"
                  >
                    Show All Semesters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredResults.map((res) => {
                    const isSelected = res.id === selectedResult.id;
                    const pendingCorr = correctionRequests.filter(
                      (c) =>
                        c.examinationId === res.examinationId &&
                        c.status === 'Pending Review'
                    ).length;
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => setActiveExaminationId(res.examinationId)}
                        className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#2563EB]'
                            : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-mono font-bold text-[#2563EB] dark:text-blue-400">
                            {res.examinationCode}
                          </span>
                          <StatusIndicator
                            tone={
                              res.approvalStatus === 'Approved & Released'
                                ? 'approved'
                                : pendingCorr > 0 || res.recordsRequiringAttention > 0
                                  ? 'danger'
                                  : 'warning'
                            }
                            label={
                              res.approvalStatus === 'Approved & Released'
                                ? 'Released'
                                : pendingCorr > 0 || res.recordsRequiringAttention > 0
                                  ? `Correction Pending (${pendingCorr || res.recordsRequiringAttention})`
                                  : 'Awaiting Approval'
                            }
                          />
                        </div>
                        <div className="text-[17px] font-bold text-[#1F2937] dark:text-slate-100 mt-2">
                          {res.subjectCode} — {res.subjectName}
                        </div>
                        <div className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                          {res.departmentName} ({formatSemesterLabel(res.semester)}) &middot; Present:{' '}
                          {res.studentsPresent}, Absent: {res.studentsAbsent}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          SECTION 2: STUDENT-WISE RESULTS (WITH INLINE TOPPER BADGE & 5 FILTERS)
         ======================================================================== */}
      {activeSection === 'student-results' && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <div>
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
                Student-Wise Results ({filteredStudents.length} Students)
              </h1>
              <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5">
                Maximum Marks: {selectedResult.maximumMarks} &middot; Passing Marks: {selectedResult.passingMarks}
              </p>
            </div>

            <div className="relative w-full lg:w-80 shrink-0">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by Student Name or USN..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
              />
            </div>
          </div>

          {/* 5 Required Student-Result Filters: All, Present, Absent, Passed, Failed */}
          <div className="flex flex-wrap items-center gap-2.5">
            {(
              ['All', 'Present', 'Absent', 'Passed', 'Failed'] as StudentResultFilter[]
            ).map((filterOption) => {
              const isSelected = resultFilter === filterOption;
              return (
                <button
                  key={filterOption}
                  type="button"
                  onClick={() => setResultFilter(filterOption)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-200 border-[#D9E2EF] dark:border-[#334155] hover:border-[#2563EB]'
                  }`}
                >
                  <span>{filterOption}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-white dark:bg-slate-800 text-[#64748B] dark:text-slate-300'
                    }`}
                  >
                    {filterCounts[filterOption]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Student-Wise Results Table */}
          <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F5F7FB] dark:bg-[#0F172A] border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-5">Student Name</th>
                  <th className="py-4 px-5">USN</th>
                  <th className="py-4 px-5">Overall Marks Obtained</th>
                  <th className="py-4 px-5">Maximum Marks</th>
                  <th className="py-4 px-5">Attendance Status</th>
                  <th className="py-4 px-5">Pass/Fail Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155] text-sm">
                {filteredStudents.map((st) => {
                  const isTopper =
                    st.attendanceStatus === 'Present' &&
                    highestPresentMarks !== null &&
                    st.totalMarksObtained === highestPresentMarks;

                  const computedResult =
                    st.attendanceStatus === 'Absent'
                      ? 'Absent'
                      : (st.totalMarksObtained ?? 0) >= selectedResult.passingMarks
                        ? 'Pass'
                        : 'Fail';

                  return (
                    <tr
                      key={st.usn}
                      className={`hover:bg-[#F5F7FB]/60 dark:hover:bg-slate-800/50 ${
                        isTopper ? 'bg-violet-50/30 dark:bg-violet-950/15' : ''
                      }`}
                    >
                      <td className="py-3.5 px-5 font-bold text-[#1F2937] dark:text-slate-100">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span>{st.studentName}</span>
                          {isTopper && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#6D5CE8] text-white">
                              <Award className="w-3.5 h-3.5" />
                              Topper
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[#1F2937] dark:text-slate-200">
                        {st.usn}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-base">
                        {st.attendanceStatus === 'Absent' ? (
                          <span className="text-[#B7791F] dark:text-amber-400">Absent</span>
                        ) : (
                          <span className="text-[#1F2937] dark:text-white">
                            {st.totalMarksObtained}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[#64748B] dark:text-slate-300">
                        {st.maximumMarks}
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusIndicator
                          tone={st.attendanceStatus === 'Present' ? 'success' : 'warning'}
                          label={st.attendanceStatus}
                        />
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusIndicator
                          tone={
                            computedResult === 'Pass'
                              ? 'success'
                              : computedResult === 'Absent'
                                ? 'warning'
                                : 'danger'
                          }
                          label={computedResult}
                        />
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-sm text-[#64748B] dark:text-slate-400"
                    >
                      No student records match the selected filter ({resultFilter}) or search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================
          SECTION 3: ANSWER-KEY CORRECTION MANAGEMENT
         ======================================================================== */}
      {activeSection === 'answer-key-corrections' && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <div>
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight flex items-center gap-3">
                <KeyRound className="w-7 h-7 text-[#B42318]" />
                Answer-Key Correction Management
              </h1>
              <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5">
                Review HOD answer-key correction requests. Results remain blocked until all pending requests are resolved.
              </p>
            </div>
            {pendingCorrectionsCount > 0 && (
              <span className="px-4 py-2 rounded-lg text-sm font-bold bg-red-100 dark:bg-red-950/50 text-[#B42318] dark:text-red-300">
                {pendingCorrectionsCount} Unresolved Request(s) Blocking Result Release
              </span>
            )}
          </div>

          {examCorrectionRequests.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/40 text-sm text-[#64748B] dark:text-slate-400 text-center">
              No answer-key correction requests have been submitted by the HOD for this examination.
            </div>
          ) : (
            <div className="space-y-5">
              {examCorrectionRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-6 rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/50 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-mono font-bold text-[#2563EB] dark:text-blue-400">
                          {req.id}
                        </span>
                        <span className="text-[18px] font-bold text-[#1F2937] dark:text-white">
                          Question ID: {req.questionId}
                        </span>
                        <StatusIndicator
                          tone={
                            req.status === 'Approved'
                              ? 'success'
                              : req.status === 'Rejected'
                                ? 'danger'
                                : 'warning'
                          }
                          label={req.status}
                        />
                      </div>
                      <div className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                        Submitted by {req.submittedByHod} at {req.submittedAt} &middot;{' '}
                        {req.marksPerQuestion} mark per question &middot; Evaluates stored responses across all present students
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-sm font-mono">
                      <span className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/40 text-[#B42318] dark:text-red-300 font-bold">
                        Existing: {req.existingAnswer}
                      </span>
                      <span>&rarr;</span>
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-[#16834A] dark:text-emerald-300 font-bold">
                        Proposed: {req.proposedAnswer}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-[#1F2937] dark:text-slate-200 bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-[#D9E2EF] dark:border-[#334155] space-y-2 leading-relaxed">
                    <div>
                      <strong>HOD Reason:</strong> {req.reason}
                    </div>
                    <div className="text-[#64748B] dark:text-slate-400">
                      <strong>Supporting Explanation:</strong> {req.supportingExplanation}
                    </div>
                  </div>

                  {req.status === 'Pending Review' ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                      <input
                        type="text"
                        value={decisionNotesMap[req.id] || ''}
                        onChange={(e) =>
                          setDecisionNotesMap((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                        placeholder="Enter COE decision remark for audit record..."
                        className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100"
                      />
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          disabled={processingId === req.id}
                          onClick={() => handleReviewCorrection(req.id, 'Approved')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#16834A] hover:bg-green-700 rounded-lg cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve &amp; Recalculate Marks
                        </button>
                        <button
                          type="button"
                          disabled={processingId === req.id}
                          onClick={() => handleReviewCorrection(req.id, 'Rejected')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#B42318] hover:bg-red-700 rounded-lg cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject Request
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-sm text-[#64748B] dark:text-slate-400">
                      <div>
                        <strong>COE Decision ({req.coeDecisionAt}):</strong>{' '}
                        {req.coeDecisionNotes} — by {req.coeDecisionBy}
                      </div>
                      {req.recalculationSummary && (
                        <div className="font-semibold text-[#16834A] dark:text-emerald-400">
                          {req.recalculationSummary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result Release Confirmation Dialog */}
      <ConfirmDialog
        open={releaseConfirmOpen}
        title="Approve & Release Examination Results"
        description={`Confirm final approval and release of ${selectedResult.examinationCode} (${selectedResult.subjectName}) results to the ${selectedResult.department} Department HOD and Principal. (Students do not view marks on the student portal).`}
        confirmLabel="Approve & Release Results"
        tone="primary"
        onCancel={() => setReleaseConfirmOpen(false)}
        onConfirm={handleApproveAndRelease}
      />
    </div>
  );
};
