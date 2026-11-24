import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileCheck2,
  FileUp,
  Filter,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { resultService } from '../services/resultService';
import {
  FileVerificationReport,
  ResultImportAcknowledgement,
  SittingName,
  VerificationCheckStatus,
} from '../types/examination';
import { StatusIndicator, SemanticTone } from '../components/StatusIndicator';
import { getExaminationStatusSummary } from '../utils/examinationStatus';
import { formatSemesterLabel } from '../utils/academicSemesters';

function mapCheckStatusToTone(status: VerificationCheckStatus): SemanticTone {
  switch (status) {
    case 'Verified':
      return 'verified';
    case 'Failed':
      return 'rejected';
    case 'Warning':
      return 'warning';
    case 'Pending':
    default:
      return 'pending';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export const ResultImportPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    examinations,
    semesters,
    monitors,
    results,
    correctionRequests,
    activeExaminationId,
    setActiveExaminationId,
    refreshAll,
    notify,
  } = useExaminationStore();

  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');

  // Only completed or eligible-for-result-import examinations (exclude Cancelled)
  const eligibleExaminations = useMemo(() => {
    return examinations.filter((exam) => {
      const summary = getExaminationStatusSummary(
        exam,
        monitors,
        results,
        correctionRequests
      );
      if (summary.lifecycleStatus === 'Cancelled') return false;
      if (
        summary.lifecycleStatus === 'Exam Completed' ||
        summary.lifecycleStatus === 'In Progress'
      ) {
        return true;
      }
      const hasReadySitting = exam.sittings.some(
        (s) => s.packageInfo.verificationReadinessStatus === 'Ready for Examination'
      );
      const hasEligibleMonitor = monitors.some(
        (m) =>
          m.examinationId === exam.id &&
          (m.sessionStatus === 'Active' || m.sessionStatus === 'Completed')
      );
      return hasReadySitting || hasEligibleMonitor;
    });
  }, [examinations, monitors, results, correctionRequests]);

  const filteredEligibleExaminations = useMemo(() => {
    if (semesterFilter === 'ALL') return eligibleExaminations;
    const semNum = Number(semesterFilter);
    return eligibleExaminations.filter((e) => e.semester === semNum);
  }, [eligibleExaminations, semesterFilter]);

  const selectedExam = useMemo(() => {
    if (activeExaminationId) {
      const found = filteredEligibleExaminations.find(
        (e) => e.id === activeExaminationId
      );
      if (found) return found;
    }
    return filteredEligibleExaminations[0] || null;
  }, [filteredEligibleExaminations, activeExaminationId]);

  const [selectedSitting, setSelectedSitting] =
    useState<SittingName>('Morning Sitting');

  // Keep selectedSitting aligned with available sittings of selectedExam
  useEffect(() => {
    if (!selectedExam) return;
    const exists = selectedExam.sittings.some(
      (s) => s.sittingName === selectedSitting
    );
    if (!exists && selectedExam.sittings[0]) {
      setSelectedSitting(selectedExam.sittings[0].sittingName);
    }
  }, [selectedExam, selectedSitting]);

  const selectedSittingObj = useMemo(() => {
    if (!selectedExam) return null;
    return (
      selectedExam.sittings.find((s) => s.sittingName === selectedSitting) ||
      selectedExam.sittings[0] ||
      null
    );
  }, [selectedExam, selectedSitting]);

  const importedResultForExam = useMemo(() => {
    if (!selectedExam) return null;
    return results.find((r) => r.examinationId === selectedExam.id) || null;
  }, [results, selectedExam]);

  const importedSittingInfo = useMemo(() => {
    if (!importedResultForExam || !selectedSittingObj) return null;
    return (
      importedResultForExam.importedSittings?.find(
        (imp) => imp.sittingId === selectedSittingObj.sittingId
      ) || null
    );
  }, [importedResultForExam, selectedSittingObj]);

  // Upload & Verification states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetchingFromLab, setFetchingFromLab] = useState(false);
  const [verificationReport, setVerificationReport] =
    useState<FileVerificationReport | null>(null);
  const [importAcknowledgement, setImportAcknowledgement] =
    useState<ResultImportAcknowledgement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetUploadAndVerificationState = () => {
    setUploadedFile(null);
    setFileValidationError(null);
    setVerificationReport(null);
    setImportAcknowledgement(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectExam = (examId: string) => {
    const exam = eligibleExaminations.find((ex) => ex.id === examId);
    setActiveExaminationId(examId);
    if (exam?.sittings[0]) {
      setSelectedSitting(exam.sittings[0].sittingName);
    }
    resetUploadAndVerificationState();
  };

  const handleSelectSitting = (sittingName: SittingName) => {
    setSelectedSitting(sittingName);
    resetUploadAndVerificationState();
  };

  const acceptSelectedFile = (file: File | undefined | null) => {
    if (!file) return;
    setVerificationReport(null);
    setImportAcknowledgement(null);

    if (!file.name.toLowerCase().endsWith('.labresult')) {
      setUploadedFile(null);
      setFileValidationError(
        `Unsupported file "${file.name}". Only signed Lab Server result packages (.labresult) are accepted.`
      );
      return;
    }

    setUploadedFile(file);
    setFileValidationError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    acceptSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    acceptSelectedFile(file);
  };

  const handleFetchFromLabServer = async () => {
    if (!selectedExam || !selectedSittingObj) return;
    setFetchingFromLab(true);
    setFileValidationError(null);
    try {
      notify(
        'info',
        'Contacting Lab Server',
        `Finalizing sitting and downloading result package for ${selectedSittingObj.sittingName}...`
      );
      const file = await resultService.downloadResultPackageFromLabServer(
        selectedExam.id,
        selectedSittingObj.sittingName
      );
      acceptSelectedFile(file);
      notify(
        'success',
        'Result Package Received',
        `Retrieved ${file.name} (${formatFileSize(file.size)}) directly from Lab Server.`
      );
    } catch (err) {
      notify(
        'error',
        'Fetch from Lab Server Failed',
        err instanceof Error ? err.message : 'Failed to retrieve package from Lab Server.'
      );
    } finally {
      setFetchingFromLab(false);
    }
  };

  const handleVerifyResultFile = async () => {
    if (!selectedExam || !selectedSittingObj || !uploadedFile) return;
    setVerifying(true);
    setImportAcknowledgement(null);
    try {
      const report = await resultService.verifyUploadedResultFile(
        selectedExam.id,
        selectedSittingObj.sittingName,
        uploadedFile
      );
      setVerificationReport(report);
      await refreshAll();
      if (report.isValidForImport) {
        notify(
          'success',
          'Result File Verified Successfully',
          `${report.recordsInFile} student records verified for ${selectedExam.examCode} (${selectedSittingObj.sittingName}).`
        );
      } else {
        notify(
          'error',
          'Verification Failed',
          report.summaryMessage || 'Result file failed verification checks.'
        );
      }
    } catch (err) {
      notify(
        'error',
        'Verification Error',
        err instanceof Error ? err.message : 'Unable to verify uploaded result file.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleImportVerifiedResults = async () => {
    if (
      !verificationReport ||
      !verificationReport.isValidForImport ||
      verificationReport.alreadyImported ||
      !uploadedFile
    ) {
      return;
    }
    setImporting(true);
    try {
      const ack = await resultService.importVerifiedResults(
        verificationReport,
        uploadedFile
      );
      setImportAcknowledgement(ack);
      setVerificationReport((prev) =>
        prev
          ? {
              ...prev,
              alreadyImported: true,
            }
          : null
      );
      await refreshAll();
      setActiveExaminationId(ack.examinationId);
      notify('success', 'Results Imported', ack.message);
    } catch (err) {
      notify(
        'error',
        'Import Blocked',
        err instanceof Error ? err.message : 'Failed to import verified results.'
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs">
        <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
          Import Results
        </h1>
        <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5">
          Select an examination sitting, upload the signed <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155]">.labresult</code> package received from the Lab Server, verify all package checks, and import verified results into Result Approval.
        </p>
      </div>

      {/* SECTION A – Select Examination and Sitting */}
      <section className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-4">
          <div>
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
              Section A &ndash; Select Examination and Sitting
            </h2>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
              Completed or result-eligible examinations are listed below. Morning and Afternoon sittings are verified and imported independently.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#64748B] shrink-0" />
              <select
                aria-label="Filter eligible examinations by semester"
                value={semesterFilter}
                onChange={(e) => {
                  setSemesterFilter(e.target.value);
                  resetUploadAndVerificationState();
                }}
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
            {selectedSittingObj && (
              <StatusIndicator
                tone={importedSittingInfo ? 'success' : 'pending'}
                label={
                  importedSittingInfo
                    ? `${selectedSittingObj.sittingName}: Imported (${importedSittingInfo.recordCount} Records)`
                    : `${selectedSittingObj.sittingName}: Awaiting Result Import`
                }
              />
            )}
          </div>
        </div>

        {eligibleExaminations.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155] text-sm text-[#64748B] dark:text-slate-400">
            No completed or result-ready examination sessions are currently available for result import.
          </div>
        ) : filteredEligibleExaminations.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-dashed border-[#D9E2EF] dark:border-[#334155] text-center space-y-2.5">
            <p className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
              No eligible examinations found for this semester.
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              There are currently no result-eligible examinations for{' '}
              {formatSemesterLabel(Number(semesterFilter))}.
            </p>
            <button
              type="button"
              onClick={() => setSemesterFilter('ALL')}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-blue-400 cursor-pointer"
            >
              Show All Semesters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="result-import-exam-select"
                  className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2"
                >
                  Examination
                </label>
                <select
                  id="result-import-exam-select"
                  value={selectedExam?.id || ''}
                  onChange={(e) => handleSelectExam(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                >
                  {filteredEligibleExaminations.map((ex) => {
                    const summary = getExaminationStatusSummary(
                      ex,
                      monitors,
                      results,
                      correctionRequests
                    );
                    return (
                      <option key={ex.id} value={ex.id}>
                        {ex.examCode} &mdash; {ex.subjectCode}: {ex.subjectName} ({ex.department} &middot; {formatSemesterLabel(ex.semester)}) &bull; {summary.lifecycleStatus}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="result-import-sitting-select"
                  className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2"
                >
                  Sitting
                </label>
                <select
                  id="result-import-sitting-select"
                  value={selectedSittingObj?.sittingName || ''}
                  onChange={(e) =>
                    handleSelectSitting(e.target.value as SittingName)
                  }
                  className="w-full px-4 py-3 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                >
                  {selectedExam?.sittings.map((sit) => {
                    const sitImported = importedResultForExam?.importedSittings?.some(
                      (imp) => imp.sittingId === sit.sittingId
                    );
                    return (
                      <option key={sit.sittingId} value={sit.sittingName}>
                        {sit.sittingName} &mdash; {sit.labName} ({sit.studentCount} Eligible Students)
                        {sitImported ? ' [Imported]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedExam && selectedSittingObj && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    Department &amp; Semester
                  </div>
                  <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                    {selectedExam.departmentName} ({selectedExam.department}) &middot;{' '}
                    {formatSemesterLabel(selectedExam.semester)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    Subject
                  </div>
                  <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                    {selectedExam.subjectCode} &mdash; {selectedExam.subjectName}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    Assigned Laboratory
                  </div>
                  <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                    {selectedSittingObj.labName}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    Selected Numbered Set
                  </div>
                  <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                    {selectedSittingObj.selectedSetNumber || 'Not Selected'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    Examination Session ID
                  </div>
                  <div className="text-sm font-mono font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                    {selectedSittingObj.sittingId}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    Frozen Eligible Students ({selectedSittingObj.sittingName})
                  </div>
                  <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                    {selectedSittingObj.studentCount} Candidate(s) &middot; {selectedSittingObj.examDate} ({selectedSittingObj.startTime})
                  </div>
                </div>
              </div>
            )}

            {importedSittingInfo && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-[#16834A] dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    Results for <strong>{importedSittingInfo.sittingName}</strong> have already been imported (Ref:{' '}
                    <span className="font-mono font-semibold">{importedSittingInfo.importReferenceId}</span> &middot; Package:{' '}
                    <span className="font-mono font-semibold">{importedSittingInfo.packageId}</span> &middot; {importedSittingInfo.importedAt}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/results/approval?section=student-results')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Open Result Approval &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* SECTION B – Upload Lab Server Result File */}
      <section className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-5">
        <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-4">
          <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
            Section B &ndash; Upload Lab Server Result File
          </h2>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
            Select the signed result package received from the examination Lab Server.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".labresult"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-7 text-center transition-colors ${
            isDragActive
              ? 'border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40'
          }`}
        >
          <Upload className="w-8 h-8 text-[#2563EB] mx-auto mb-3" />
          <div className="text-[15px] font-bold text-[#1F2937] dark:text-slate-100">
            Drag and drop a signed <code className="font-mono text-sm">.labresult</code> file here
          </div>
          <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1">
            Accepted format: <span className="font-mono font-semibold">.labresult</span> result package only. Verification runs only after clicking <strong>Verify Result File</strong>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={!selectedExam || !selectedSittingObj || verifying || importing || fetchingFromLab}
              onClick={handleFetchFromLabServer}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#059669] hover:bg-emerald-700 disabled:opacity-40 rounded-lg cursor-pointer shadow-xs"
              title="Download signed .labresult package directly from connected Lab Server over LAN"
            >
              {fetchingFromLab ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching from Lab Server...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Fetch from Connected Lab Server
                </>
              )}
            </button>

            <button
              type="button"
              disabled={!selectedExam || !selectedSittingObj || verifying || importing || fetchingFromLab}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 rounded-lg cursor-pointer shadow-xs"
            >
              <FileUp className="w-4 h-4" />
              Choose File (.labresult)
            </button>

            {uploadedFile && (
              <button
                type="button"
                disabled={verifying || importing}
                onClick={resetUploadAndVerificationState}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#1F2937] dark:text-slate-200 bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Remove / Replace File
              </button>
            )}
          </div>
        </div>

        {/* Selected File Validation / Metadata Bar */}
        {fileValidationError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-start gap-3 text-sm text-[#B42318] dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">File Validation Failed</div>
              <div className="mt-0.5">{fileValidationError}</div>
            </div>
          </div>
        )}

        {uploadedFile && !fileValidationError && (
          <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileArchive className="w-6 h-6 text-[#2563EB] shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 truncate">
                  {uploadedFile.name}
                </div>
                <div className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  Size: <span className="font-mono">{formatFileSize(uploadedFile.size)}</span> &middot; Validation:{' '}
                  <span className="font-semibold text-[#16834A] dark:text-emerald-400">
                    Valid .labresult extension &mdash; Ready for verification
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={
                  !selectedExam ||
                  !selectedSittingObj ||
                  !uploadedFile ||
                  verifying ||
                  importing
                }
                onClick={handleVerifyResultFile}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#17243A] hover:bg-slate-800 dark:bg-[#2563EB] dark:hover:bg-blue-700 disabled:opacity-40 rounded-lg shadow-xs cursor-pointer"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Result File...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify Result File
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION C – Verification Summary & Import Verified Results */}
      <section className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-4">
          <div>
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
              Section C &ndash; Verification Summary &amp; Import Verified Results
            </h2>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
              Package authenticity, session alignment, and candidate USN checks must all pass before results can be imported.
            </p>
          </div>
          {verificationReport && (
            <StatusIndicator
              tone={
                verificationReport.isValidForImport && !verificationReport.alreadyImported
                  ? 'success'
                  : 'danger'
              }
              label={
                verificationReport.isValidForImport && !verificationReport.alreadyImported
                  ? 'Result File Verified Successfully'
                  : verificationReport.alreadyImported
                    ? 'Already Imported'
                    : 'Verification Failed'
              }
            />
          )}
        </div>

        {!verificationReport ? (
          <div className="py-12 text-center space-y-2.5">
            <FileUp className="w-10 h-10 text-[#64748B] mx-auto" />
            <div className="text-base font-bold text-[#1F2937] dark:text-slate-200">
              Awaiting Result File Verification
            </div>
            <p className="text-sm text-[#64748B] dark:text-slate-400 max-w-lg mx-auto">
              Select an examination and sitting in Section A, choose a signed <code className="font-mono text-xs">.labresult</code> file in Section B, and click <strong>Verify Result File</strong> to inspect package verification checks.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Verification Status Banner */}
            {verificationReport.isValidForImport && !verificationReport.alreadyImported ? (
              <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-base font-bold text-[#16834A] dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    Result File Verified Successfully
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">Total Records</div>
                    <div className="font-bold text-[#1F2937] dark:text-slate-100">
                      {verificationReport.recordsInFile}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">Present</div>
                    <div className="font-bold text-[#16834A] dark:text-emerald-400">
                      {verificationReport.presentCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">Absent</div>
                    <div className="font-bold text-[#B42318] dark:text-red-400">
                      {verificationReport.absentCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">Matched Eligible</div>
                    <div className="font-bold text-[#1F2937] dark:text-slate-100">
                      {verificationReport.matchedEligibleCount} / {verificationReport.totalFrozenEligibleStudents}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">Package ID</div>
                    <div className="font-mono font-bold text-[#1F2937] dark:text-slate-100 truncate">
                      {verificationReport.packageId || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">Verified At</div>
                    <div className="font-mono text-xs font-semibold text-[#1F2937] dark:text-slate-100">
                      {verificationReport.uploadedAt}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-2.5">
                <div className="flex items-center gap-2.5 text-base font-bold text-[#B42318] dark:text-red-300">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  {verificationReport.summaryMessage}
                </div>
                {verificationReport.validationErrors.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-[#B42318] dark:text-red-300 space-y-1">
                    {verificationReport.validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Package Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                Package Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Package ID</div>
                  <div className="font-mono font-bold text-[#1F2937] dark:text-slate-100 mt-0.5 break-all">
                    {verificationReport.packageId || 'Unavailable'}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Examination</div>
                  <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                    {verificationReport.examinationCode}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Sitting &amp; Session ID</div>
                  <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                    {verificationReport.sittingName}{' '}
                    <span className="font-mono text-xs text-[#64748B] dark:text-slate-400">
                      ({verificationReport.sessionId})
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Subject</div>
                  <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                    {verificationReport.subjectCode} &mdash; {verificationReport.subjectName}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Package Creation Time</div>
                  <div className="font-mono text-xs font-semibold text-[#1F2937] dark:text-slate-100 mt-1">
                    {verificationReport.packageCreatedAt || 'Unavailable'}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Total Result Records</div>
                  <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                    {verificationReport.recordsInFile} record(s)
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Uploaded File</div>
                  <div className="font-mono text-xs font-semibold text-[#1F2937] dark:text-slate-100 mt-1 truncate">
                    {verificationReport.fileName} ({formatFileSize(verificationReport.fileSizeBytes)})
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Verification Timestamp</div>
                  <div className="font-mono text-xs font-semibold text-[#1F2937] dark:text-slate-100 mt-1">
                    {verificationReport.uploadedAt}
                  </div>
                </div>
              </div>
            </div>

            {/* 8-Row Verification Checklist */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                Verification Checklist
              </h3>
              <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#F5F7FB] dark:bg-[#0F172A] border-b border-[#D9E2EF] dark:border-[#334155] text-xs uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                      <th className="py-3 px-4 font-semibold">Check</th>
                      <th className="py-3 px-4 font-semibold">What It Means</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155]">
                    {verificationReport.checklist.map((item) => (
                      <tr
                        key={item.id}
                        className="bg-white dark:bg-[#1E293B]"
                      >
                        <td className="py-3 px-4 font-semibold text-[#1F2937] dark:text-slate-100 whitespace-nowrap">
                          {item.check}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] dark:text-slate-400">
                          {item.description}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusIndicator
                            tone={mapCheckStatusToTone(item.status)}
                            label={item.status}
                          />
                        </td>
                        <td className="py-3 px-4 text-xs text-[#64748B] dark:text-slate-400">
                          {item.reason || (item.status === 'Verified' ? 'Passed' : 'Awaiting prerequisite check')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import Action */}
            <div className="pt-4 border-t border-[#D9E2EF] dark:border-[#334155] flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-[#64748B] dark:text-slate-400">
                {verificationReport.alreadyImported
                  ? 'This result package or sitting has already been imported.'
                  : verificationReport.isValidForImport
                    ? `All 8 checks verified. Ready to import ${verificationReport.recordsInFile} records for ${verificationReport.sittingName}.`
                    : 'Resolve all failed verification checks before importing results.'}
              </div>

              <button
                type="button"
                disabled={
                  !verificationReport.isValidForImport ||
                  verificationReport.alreadyImported ||
                  !uploadedFile ||
                  importing ||
                  verifying
                }
                onClick={handleImportVerifiedResults}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#16834A] hover:bg-green-700 disabled:opacity-40 rounded-lg shadow-xs cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing Verified Results...
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    Import Verified Results
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Import Acknowledgement Card */}
        {importAcknowledgement && (
          <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-[#16834A] dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {importAcknowledgement.message}
              </div>
              <button
                type="button"
                onClick={() => navigate('/results/approval?section=student-results')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Open Result Approval &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Import Reference ID</div>
                <div className="font-mono font-bold text-[#1F2937] dark:text-slate-100">
                  {importAcknowledgement.importReferenceId}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Examination &amp; Sitting</div>
                <div className="font-bold text-[#1F2937] dark:text-slate-100">
                  {importAcknowledgement.examinationCode} &middot; {importAcknowledgement.sittingName}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Imported Record Count</div>
                <div className="font-bold text-[#1F2937] dark:text-slate-100">
                  {importAcknowledgement.recordCount} Student(s)
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">Import Timestamp</div>
                <div className="font-mono text-xs font-semibold text-[#1F2937] dark:text-slate-100 mt-0.5">
                  {importAcknowledgement.importedAt}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
