import {
  AnswerKeyCorrectionRequest,
  ExaminationLifecycleStatus,
  ExaminationResultRecord,
  PackageReadinessDisplayStatus,
  ResultProcessingDisplayStatus,
  ScheduledExamination,
  SessionMonitoringData,
  SittingName,
  SittingPackageStatus,
} from '../types/examination';
import { SemanticTone } from '../components/StatusIndicator';

export interface SittingStatusSummary {
  sittingId: string;
  sittingName: SittingName;
  examDate: string;
  startTime: string;
  lifecycleStatus: ExaminationLifecycleStatus;
  packageStatus: PackageReadinessDisplayStatus;
  resultImported: boolean;
}

export interface ExaminationStatusSummary {
  lifecycleStatus: ExaminationLifecycleStatus;
  packageStatus: PackageReadinessDisplayStatus;
  resultStatus: ResultProcessingDisplayStatus;
  pendingCorrectionsCount: number;
  recordsRequiringAttention: number;
  importedSittingsCount: number;
  totalSittingsCount: number;
  sittingSummaries: SittingStatusSummary[];
  hasPartialSittingCompletion: boolean;
  hasAnyImportedResult: boolean;
}

/**
 * Normalizes legacy stored examination status strings to the 4 canonical
 * Examination Lifecycle Statuses without altering underlying examination data.
 */
export function normalizeLegacyExamStatus(
  rawStatus: string | undefined
): ExaminationLifecycleStatus {
  switch ((rawStatus || '').trim()) {
    case 'Cancelled':
      return 'Cancelled';
    case 'Completed':
    case 'Exam Completed':
      return 'Exam Completed';
    case 'Active Today':
    case 'In Progress':
      return 'In Progress';
    case 'Draft':
    case 'Scheduled & Frozen':
    case 'Package Ready':
    case 'Scheduled':
    default:
      return 'Scheduled';
  }
}

/**
 * Derives the display-safe Package Readiness Status from a sitting's 4-stage package object.
 */
export function getSittingPackageReadinessStatus(
  pkg: SittingPackageStatus | undefined
): PackageReadinessDisplayStatus {
  if (!pkg) return 'Not Prepared';

  if (
    pkg.verificationReadinessStatus === 'Rejected' ||
    pkg.preparationStatus === 'Failed' ||
    pkg.securityStatus === 'Failed' ||
    Boolean(pkg.invalidatedReason)
  ) {
    return 'Rejected';
  }

  if (pkg.verificationReadinessStatus === 'Ready for Examination') {
    return 'Ready for Examination';
  }

  if (
    pkg.transferStatus === 'Transfer Failed' ||
    pkg.transferStatus === 'Interrupted'
  ) {
    return 'Transfer Failed';
  }

  if (pkg.transferStatus === 'Sending') {
    return 'Transferring';
  }

  if (
    pkg.transferStatus === 'Received' ||
    pkg.verificationReadinessStatus === 'Verifying'
  ) {
    return 'Verification Pending';
  }

  if (
    pkg.preparationStatus === 'Preparing' ||
    pkg.securityStatus === 'Securing Package'
  ) {
    return 'Preparing';
  }

  if (
    pkg.preparationStatus === 'Completed' &&
    pkg.securityStatus === 'Package Secured' &&
    pkg.transferStatus === 'Not Sent'
  ) {
    return 'Transfer Pending';
  }

  return 'Not Prepared';
}

/**
 * Computes three completely independent status dimensions for an examination:
 * 1. Examination Lifecycle Status (derived from actual sitting/session records, not examDate)
 * 2. Package Readiness Status (derived from sitting package stages)
 * 3. Result Processing Status (derived from imported result & correction records)
 */
export function getExaminationStatusSummary(
  exam: ScheduledExamination,
  monitors: SessionMonitoringData[],
  results: ExaminationResultRecord[],
  correctionRequests: AnswerKeyCorrectionRequest[]
): ExaminationStatusSummary {
  const resultRecord = results.find((r) => r.examinationId === exam.id);
  const pendingCorrectionsCount = correctionRequests.filter(
    (c) => c.examinationId === exam.id && c.status === 'Pending Review'
  ).length;
  const recordsRequiringAttention = resultRecord?.recordsRequiringAttention ?? 0;

  const importedSittingIds = new Set<string>(
    (resultRecord?.importedSittings || []).map((imp) => imp.sittingId)
  );
  // Fallback for legacy result records without importedSittings array
  if (
    resultRecord &&
    (!resultRecord.importedSittings || resultRecord.importedSittings.length === 0) &&
    (resultRecord.studentResults || []).length > 0
  ) {
    const resultUsnSet = new Set((resultRecord.studentResults || []).map((r) => r.usn));
    (exam?.sittings || []).forEach((sit) => {
      if ((sit?.assignedStudentUsns || []).some((u) => resultUsnSet.has(u))) {
        importedSittingIds.add(sit.sittingId);
      }
    });
  }

  const normalizedStoredStatus = normalizeLegacyExamStatus(
    exam?.status as string | undefined
  );
  const examMonitors = (monitors || []).filter((m) => m?.examinationId === exam?.id);

  const sittingSummaries: SittingStatusSummary[] = (exam?.sittings || []).map((sit) => {
    const mon = examMonitors.find(
      (m) => m.sessionId === sit.sittingId || m.sittingName === sit.sittingName
    );
    const resultImported = importedSittingIds.has(sit.sittingId);

    let sittingLifecycle: ExaminationLifecycleStatus = 'Scheduled';
    if (normalizedStoredStatus === 'Cancelled') {
      sittingLifecycle = 'Cancelled';
    } else if (mon?.sessionStatus === 'Completed' || resultImported) {
      sittingLifecycle = 'Exam Completed';
    } else if (
      mon &&
      (mon.sessionStatus === 'Active' ||
        mon.studentsLoggedIn > 0 ||
        mon.studentsStarted > 0)
    ) {
      sittingLifecycle = 'In Progress';
    } else if (!mon && normalizedStoredStatus === 'Exam Completed') {
      sittingLifecycle = 'Exam Completed';
    } else {
      sittingLifecycle = 'Scheduled';
    }

    return {
      sittingId: sit.sittingId,
      sittingName: sit.sittingName,
      examDate: sit.examDate,
      startTime: sit.startTime,
      lifecycleStatus: sittingLifecycle,
      packageStatus: getSittingPackageReadinessStatus(sit.packageInfo),
      resultImported,
    };
  });

  // 1. Overall Examination Lifecycle Status (never completed until ALL sittings finish)
  let lifecycleStatus: ExaminationLifecycleStatus = normalizedStoredStatus;
  let hasPartialSittingCompletion = false;

  if (normalizedStoredStatus === 'Cancelled') {
    lifecycleStatus = 'Cancelled';
  } else if (sittingSummaries.length > 0) {
    const allCompleted = sittingSummaries.every(
      (s) => s.lifecycleStatus === 'Exam Completed'
    );
    const anyInProgress = sittingSummaries.some(
      (s) => s.lifecycleStatus === 'In Progress'
    );
    const anyCompleted = sittingSummaries.some(
      (s) => s.lifecycleStatus === 'Exam Completed'
    );
    const anyScheduled = sittingSummaries.some(
      (s) => s.lifecycleStatus === 'Scheduled'
    );

    if (allCompleted) {
      lifecycleStatus = 'Exam Completed';
    } else if (anyInProgress) {
      lifecycleStatus = 'In Progress';
      hasPartialSittingCompletion = anyCompleted;
    } else if (anyCompleted && anyScheduled) {
      // One sitting has finished while another sitting is still pending -> NOT Exam Completed
      lifecycleStatus = 'In Progress';
      hasPartialSittingCompletion = true;
    } else {
      lifecycleStatus = 'Scheduled';
    }
  }

  // 2. Overall Package Readiness Status
  let packageStatus: PackageReadinessDisplayStatus = 'Not Prepared';
  if (sittingSummaries.length > 0) {
    const statuses = sittingSummaries.map((s) => s.packageStatus);
    if (statuses.includes('Rejected')) {
      packageStatus = 'Rejected';
    } else if (statuses.includes('Transfer Failed')) {
      packageStatus = 'Transfer Failed';
    } else if (statuses.includes('Transferring')) {
      packageStatus = 'Transferring';
    } else if (statuses.includes('Preparing')) {
      packageStatus = 'Preparing';
    } else if (statuses.includes('Verification Pending')) {
      packageStatus = 'Verification Pending';
    } else if (statuses.includes('Transfer Pending')) {
      packageStatus = 'Transfer Pending';
    } else if (statuses.every((s) => s === 'Ready for Examination')) {
      packageStatus = 'Ready for Examination';
    } else {
      packageStatus = 'Not Prepared';
    }
  }

  // 3. Independent Result Processing Status
  const hasAnyImportedResult = Boolean(
    resultRecord && resultRecord.studentResults.length > 0
  );
  const importedSittingsCount = importedSittingIds.size;
  const totalSittingsCount = exam.sittings.length;

  let resultStatus: ResultProcessingDisplayStatus = 'Not Imported';
  if (!hasAnyImportedResult) {
    resultStatus = 'Not Imported';
  } else if (resultRecord?.approvalStatus === 'Approved & Released') {
    resultStatus = 'Released';
  } else if (pendingCorrectionsCount > 0 || recordsRequiringAttention > 0) {
    resultStatus = 'Correction Pending';
  } else if (totalSittingsCount > 1 && importedSittingsCount < totalSittingsCount) {
    resultStatus = 'Imported';
  } else {
    resultStatus = 'Awaiting Approval';
  }

  return {
    lifecycleStatus,
    packageStatus,
    resultStatus,
    pendingCorrectionsCount,
    recordsRequiringAttention,
    importedSittingsCount,
    totalSittingsCount,
    sittingSummaries,
    hasPartialSittingCompletion,
    hasAnyImportedResult,
  };
}

export function getExamStatusTone(status: ExaminationLifecycleStatus): SemanticTone {
  switch (status) {
    case 'In Progress':
      return 'success';
    case 'Exam Completed':
      return 'neutral';
    case 'Cancelled':
      return 'danger';
    case 'Scheduled':
    default:
      return 'info';
  }
}

export function getPackageStatusTone(
  status: PackageReadinessDisplayStatus
): SemanticTone {
  switch (status) {
    case 'Ready for Examination':
      return 'verified';
    case 'Transfer Failed':
    case 'Rejected':
      return 'danger';
    case 'Transfer Pending':
    case 'Verification Pending':
      return 'warning';
    case 'Preparing':
    case 'Transferring':
      return 'transfer';
    case 'Not Prepared':
    default:
      return 'retired';
  }
}

export function getResultStatusTone(
  status: ResultProcessingDisplayStatus
): SemanticTone {
  switch (status) {
    case 'Released':
      return 'approved';
    case 'Correction Pending':
      return 'danger';
    case 'Awaiting Approval':
      return 'warning';
    case 'Imported':
      return 'info';
    case 'Not Imported':
    default:
      return 'retired';
  }
}
