import {
  AcademicSemester,
  DepartmentCode,
  DepartmentEligibilitySummary,
  DepartmentInfo,
  LabServerNode,
  QuestionSetMetadata,
  ScheduledExamination,
  SessionMonitoringData,
  SetNumber,
  SittingAllocation,
  SittingName,
  SittingPackageStatus,
  SittingQuestionPaperArchive,
  ArchivedQuestionSetData,
  SubjectInfo,
  PublishedQuestionSetFeedItem,
} from '../types/examination';
import { apiClient } from './apiClient';
import { normalizeAcademicSemesters } from '../utils/academicSemesters';
import { normalizeLegacyExamStatus } from '../utils/examinationStatus';
import { validateNumberedQuestionSetIntegrity } from '../utils/versionAllocation';

export interface SittingConfigInput {
  enabled: boolean;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  labId?: string;
  labIds?: string[];
  studentCount?: number;
  assignedStudentUsns?: string[];
  examiners?: Array<{
    examinerName: string;
    employeeId?: string;
    designation?: string;
    contactNumber?: string;
  }>;
}

export interface CreateScheduledExamInput {
  department: DepartmentCode;
  semester: number;
  subjectId?: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  passingMarks: number;
  labId?: string;
  labIds?: string[];
  morningSitting?: SittingConfigInput;
  afternoonSitting?: SittingConfigInput;
}

export interface UpdateSittingAllocationInput {
  morningSitting: SittingConfigInput;
  afternoonSitting: SittingConfigInput;
}

export interface UpdateExaminationScheduleInput {
  passingMarks: number;
  morningSitting: SittingConfigInput;
  afternoonSitting: SittingConfigInput;
  authorisedPackageRevision?: boolean;
}

export interface ExaminationLifecyclePermissions {
  isCompleted: boolean;
  isCancelled: boolean;
  isDraft: boolean;
  hasStarted: boolean;
  hasTransferredPackage: boolean;
  canEditNormally: boolean;
  requiresAuthorisedPackageRevision: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCancel: boolean;
  editBlockedReason?: string;
  removeBlockedReason?: string;
}

export function getExaminationLifecyclePermissions(
  exam: ScheduledExamination,
  monitors: SessionMonitoringData[]
): ExaminationLifecyclePermissions {
  const examMonitors = monitors.filter((m) => m.examinationId === exam.id);
  const normalizedStatus = normalizeLegacyExamStatus(exam.status as string | undefined);
  const allSittingsHaveCompletedMonitor =
    exam.sittings.length > 0 &&
    exam.sittings.every((sit) => {
      const mon = examMonitors.find(
        (m) => m.sessionId === sit.sittingId || m.sittingName === sit.sittingName
      );
      return mon?.sessionStatus === 'Completed';
    });
  const isCompleted =
    normalizedStatus === 'Exam Completed' || allSittingsHaveCompletedMonitor;
  const isCancelled = normalizedStatus === 'Cancelled';
  const isDraft = (exam.status as string) === 'Draft' && !exam.isFinalizedAndFrozen;
  const hasStarted =
    !isCompleted &&
    !isCancelled &&
    (normalizedStatus === 'In Progress' ||
      examMonitors.some(
        (m) =>
          m.sessionStatus === 'Active' ||
          m.sessionStatus === 'Completed' ||
          m.studentsLoggedIn > 0 ||
          m.studentsStarted > 0
      ));
  const hasTransferredPackage = exam.sittings.some(
    (s) =>
      s.packageInfo.transferStatus === 'Received' &&
      s.packageInfo.verificationReadinessStatus === 'Ready for Examination'
  );

  const canEditNormally =
    !isCompleted && !isCancelled && !hasStarted && !hasTransferredPackage;
  const requiresAuthorisedPackageRevision =
    !isCompleted && !isCancelled && !hasStarted && hasTransferredPackage;
  const canEdit = canEditNormally || requiresAuthorisedPackageRevision;
  const canDelete = isDraft && !hasStarted && !hasTransferredPackage;
  const canCancel = !isDraft && !isCompleted && !isCancelled && !hasStarted;

  let editBlockedReason: string | undefined;
  let removeBlockedReason: string | undefined;

  if (isCompleted) {
    editBlockedReason =
      'Completed examinations are permanently preserved and cannot be edited.';
    removeBlockedReason =
      'Completed examinations cannot be deleted under institutional retention rules.';
  } else if (isCancelled) {
    editBlockedReason = 'Cancelled examinations cannot be modified.';
    removeBlockedReason = 'Examination is already cancelled.';
  } else if (hasStarted) {
    editBlockedReason =
      'Examination has already started or students have logged in; schedule editing is disabled.';
    removeBlockedReason =
      'Examination has already started or students have logged in; deletion and cancellation are disabled.';
  }

  return {
    isCompleted,
    isCancelled,
    isDraft,
    hasStarted,
    hasTransferredPackage,
    canEditNormally,
    requiresAuthorisedPackageRevision,
    canEdit,
    canDelete,
    canCancel,
    editBlockedReason,
    removeBlockedReason,
  };
}

export function parseTimeToMinutes(timeStr: string): number {
  const clean = (timeStr || '').trim();
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10) % 12;
    if (match12[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + parseInt(match12[2], 10);
  }
  return 9 * 60 + 30;
}

/**
 * Half-open interval overlap check [start, start + duration).
 * Exact boundary equality (e.g., 09:30-10:30 and 10:30-11:30) does NOT overlap.
 */
export function doTimeIntervalsOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const sA = parseTimeToMinutes(startA);
  const eA = sA + Number(durationA);
  const sB = parseTimeToMinutes(startB);
  const eB = sB + Number(durationB);
  return sA < eB && sB < eA;
}

export function formatMinutesAsRange(startTime: string, durationMinutes: number): string {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = startMins + Number(durationMinutes);
  const fmt = (m: number) => {
    const h24 = Math.floor(m / 60) % 24;
    const min = m % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
  };
  return `${fmt(startMins)} – ${fmt(endMins)}`;
}

export interface BusyLabSlot {
  labId: string;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  label?: string;
}

export function findConflictingBookingForLab(
  labId: string,
  examDate: string,
  startTime: string,
  durationMinutes: number,
  allExaminations: ScheduledExamination[],
  excludeExamId?: string,
  excludeSittingName?: SittingName,
  siblingSlot?: BusyLabSlot | null,
  candidateCount: number = 0,
  labCapacity: number = 60
): string | null {
  if (!examDate || !startTime || !durationMinutes || durationMinutes <= 0) {
    return null;
  }

  let totalBooked = 0;
  const overlappingDetails: string[] = [];

  if (
    siblingSlot &&
    siblingSlot.labId === labId &&
    siblingSlot.examDate === examDate &&
    doTimeIntervalsOverlap(
      startTime,
      durationMinutes,
      siblingSlot.startTime,
      siblingSlot.durationMinutes
    )
  ) {
    const sibCount = (siblingSlot as any).studentCount || 0;
    totalBooked += sibCount;
    overlappingDetails.push(
      `${siblingSlot.label || 'Other sitting'} (${formatMinutesAsRange(
        siblingSlot.startTime,
        siblingSlot.durationMinutes
      )})`
    );
  }

  for (const otherExam of allExaminations) {
    const otherStatus = normalizeLegacyExamStatus(otherExam.status as string | undefined);
    if (otherStatus === 'Exam Completed' || otherStatus === 'Cancelled') continue;

    for (const otherSit of otherExam.sittings) {
      if (
        excludeExamId &&
        otherExam.id === excludeExamId &&
        (!excludeSittingName || otherSit.sittingName === excludeSittingName)
      ) {
        continue;
      }

      const otherDate = otherSit.examDate || otherExam.examDate;
      const otherLab = otherSit.labId || (otherSit as any).assignedLab;
      if (
        otherLab === labId &&
        otherDate === examDate &&
        doTimeIntervalsOverlap(
          startTime,
          durationMinutes,
          otherSit.startTime,
          otherSit.durationMinutes
        )
      ) {
        const count = otherSit.assignedStudentUsns?.length || (otherSit as any).studentCount || 0;
        totalBooked += count;
        overlappingDetails.push(
          `${otherExam.examCode} (${otherExam.subjectName} — ${
            otherSit.sittingName
          }, ${formatMinutesAsRange(otherSit.startTime, otherSit.durationMinutes)})`
        );
      }
    }
  }

  // Capacity-aware: only conflict if total booked + requested candidate count exceeds lab capacity
  if (totalBooked + candidateCount > labCapacity) {
    return `${labId} capacity exceeded: ${totalBooked}/${labCapacity} seats booked by ${overlappingDetails.join(
      ', '
    )}`;
  }

  return null;
}

export function getAvailableLaboratories(
  labServers: LabServerNode[],
  examDate: string,
  startTime: string,
  durationMinutes: number,
  allExaminations: ScheduledExamination[],
  excludeExamId?: string,
  excludeSittingName?: SittingName,
  siblingSlot?: BusyLabSlot | null,
  requiredSeats: number = 0
): LabServerNode[] {
  return labServers.filter((lab) => {
    if (((lab as any).status || 'ACTIVE') === 'INACTIVE') return false;
    const capacity = lab.capacity || 60;
    return (
      findConflictingBookingForLab(
        lab.id,
        examDate,
        startTime,
        durationMinutes,
        allExaminations,
        excludeExamId,
        excludeSittingName,
        siblingSlot,
        requiredSeats,
        capacity
      ) === null
    );
  });
}

export function computeSittingConfigFingerprint(
  exam: ScheduledExamination,
  sitting: SittingAllocation
): string {
  const sortedUsns = [...sitting.assignedStudentUsns].sort().join(',');
  return [
    exam.id,
    exam.revisionNumber ?? 1,
    exam.passingMarks,
    exam.maximumMarks,
    sitting.sittingId,
    sitting.examDate,
    sitting.startTime,
    sitting.durationMinutes,
    sitting.labId,
    sitting.selectedSetId || '',
    sitting.selectedSetNumber || '',
    sortedUsns,
  ].join('|');
}

export function getPackagePrerequisitesMissing(
  exam: ScheduledExamination,
  sitting: SittingAllocation
): string[] {
  const missing: string[] = [];
  if (exam.status === 'Cancelled') {
    missing.push('Examination has been cancelled.');
    return missing;
  }
  if (!exam.isFinalizedAndFrozen) {
    missing.push('Examination schedule must be confirmed and frozen.');
  }
  if (exam.students.length === 0 || sitting.assignedStudentUsns.length === 0) {
    missing.push('Eligible student list for this sitting is missing.');
  } else if (sitting.assignedStudentUsns.length !== sitting.studentCount) {
    missing.push('Student sitting allocations are not finalised.');
  }
  if (!sitting.selectedSetNumber || !sitting.selectedSetId) {
    missing.push(
      `Select a published numbered question set for ${sitting.sittingName} in Set Selection.`
    );
  } else {
    const selectedMeta = exam.questionSets.find(
      (qs) => qs.setId === sitting.selectedSetId || qs.setNumber === sitting.selectedSetNumber
    );
    if (!selectedMeta) {
      missing.push(
        `Selected question set (${sitting.selectedSetNumber}) could not be verified.`
      );
    } else {
      const check = validateNumberedQuestionSetIntegrity(selectedMeta, exam);
      if (!check.valid) {
        missing.push(check.errors[0]);
      }
    }
  }
  if (!sitting.versionsGenerated) {
    missing.push(
      `Confirm the selected set to generate Versions A–D for ${sitting.sittingName}.`
    );
  }
  if (
    sitting.versionsGenerated &&
    (!sitting.versionAllocations ||
      sitting.versionAllocations.length !== sitting.assignedStudentUsns.length)
  ) {
    missing.push(
      `Balanced USN-based A–D version allocations are incomplete for ${sitting.sittingName}. Re-confirm set selection.`
    );
  }
  return missing;
}

export function isSittingPackageOutdated(
  exam: ScheduledExamination,
  sitting: SittingAllocation
): boolean {
  const pkg = sitting.packageInfo;
  if (pkg.invalidatedReason) return true;
  if (
    pkg.packageRevision !== undefined &&
    pkg.packageRevision !== (exam.revisionNumber ?? 1)
  ) {
    return true;
  }
  if (
    pkg.packageConfigHash &&
    pkg.packageConfigHash !== computeSittingConfigFingerprint(exam, sitting)
  ) {
    return true;
  }
  return false;
}

export const examinationService = {
  async getDepartments(): Promise<DepartmentInfo[]> {
    const res = await apiClient.centralRequest<DepartmentInfo[]>(
      '/institution/departments',
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Fetches the authoritative 1st–8th academic semester master list.
   * Ensures all eight semesters are returned in ascending order independent of operational records.
   */
  async getSemesters(): Promise<AcademicSemester[]> {
    const res = await apiClient.centralRequest<AcademicSemester[]>(
      '/institution/semesters',
      { method: 'GET' }
    );
    return normalizeAcademicSemesters(res.data);
  },

  /**
   * Fetches the authoritative eligible candidate count and sections for a department + semester
   * from the HOD-published cohort records in PostgreSQL.
   */
  async getDepartmentEligibilitySummary(
    departmentId: DepartmentCode,
    semesterId: number
  ): Promise<DepartmentEligibilitySummary> {
    const res = await apiClient.centralRequest<DepartmentEligibilitySummary>(
      `/institution/eligibility?departmentId=${encodeURIComponent(
        departmentId
      )}&semesterId=${encodeURIComponent(String(semesterId))}`,
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Fetches HOD-published subjects filtered by Department ID and Semester ID.
   */
  async getSubjects(
    departmentId?: DepartmentCode,
    semesterId?: number
  ): Promise<SubjectInfo[]> {
    const query =
      departmentId && semesterId !== undefined
        ? `?departmentId=${encodeURIComponent(departmentId)}&semesterId=${encodeURIComponent(
            String(semesterId)
          )}&publishedOnly=true`
        : '?publishedOnly=true';
    const res = await apiClient.centralRequest<SubjectInfo[]>(
      `/institution/subjects${query}`,
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Fetches HOD-published question sets across all departments that are finalized and ready for scheduling.
   */
  async getPublishedQuestionSets(): Promise<PublishedQuestionSetFeedItem[]> {
    const res = await apiClient.centralRequest<PublishedQuestionSetFeedItem[]>(
      '/institution/published-question-sets',
      { method: 'GET' }
    );
    return res.data;
  },

  async getLabServers(): Promise<LabServerNode[]> {
    try {
      const res = await apiClient.centralRequest<any[]>('/institution/laboratories', {
        method: 'GET',
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((l: any) => ({
          id: l.id || l.labCode,
          labName: l.labName || l.name,
          serverIdentifier: l.serverIdentifier || `SRV-${l.id || l.labCode}`,
          department: l.department || 'LAB',
          capacity: Number(l.capacity) || 40,
          connectionStatus: (l.status === 'ACTIVE' ? 'Connected' : 'Disconnected') as any,
          registeredWorkstationIds: l.registeredWorkstationIds || [],
        }));
      }
    } catch {
      // fallback to lab server direct call
    }
    try {
      const res = await apiClient.labServerRequest<LabServerNode[]>('/labs/servers', {
        method: 'GET',
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [
        {
          id: 'LAB-CSE-01',
          labName: 'Computer Science Lab 01',
          serverIdentifier: 'LAB-CSE-01-SRV',
          department: 'CSE',
          capacity: 45,
          connectionStatus: 'Disconnected',
          registeredWorkstationIds: [],
        },
      ];
    }
  },

  async getLaboratories(): Promise<any[]> {
    const res = await apiClient.centralRequest<any[]>(
      '/institution/laboratories',
      { method: 'GET' }
    );
    return res.data;
  },

  async createLaboratory(data: { name: string; capacity: number; code?: string; buildingLocation?: string }): Promise<any> {
    const res = await apiClient.centralRequest<any>(
      '/institution/laboratories',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateLaboratory(
    id: string | number,
    data: { code?: string; name?: string; capacity?: number; buildingLocation?: string; status?: string }
  ): Promise<any> {
    const res = await apiClient.centralRequest<any>(
      `/institution/laboratories/${encodeURIComponent(String(id))}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async saveExaminers(
    examinationId: string,
    examiners: Array<{
      sittingName: string;
      examinerName: string;
      employeeId?: string;
      designation?: string;
      assignedLab?: string;
      contactNumber?: string;
    }>
  ): Promise<any> {
    const res = await apiClient.centralRequest<any>(
      `/examinations/${encodeURIComponent(examinationId)}/examiners`,
      {
        method: 'POST',
        body: JSON.stringify({ examiners }),
      }
    );
    return res.data;
  },

  async getScheduledExaminations(): Promise<ScheduledExamination[]> {
    const res = await apiClient.centralRequest<ScheduledExamination[]>(
      '/examinations/scheduled',
      { method: 'GET' }
    );
    return res.data;
  },

  async scheduleExamination(
    input: CreateScheduledExamInput
  ): Promise<ScheduledExamination> {
    const res = await apiClient.centralRequest<ScheduledExamination>(
      '/examinations/schedule',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    return res.data;
  },

  async updateExaminationSettings(
    examinationId: string,
    updates: {
      examDate: string;
      startTime: string;
      durationMinutes: number;
      passingMarks: number;
    }
  ): Promise<ScheduledExamination> {
    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/settings`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
    return res.data;
  },

  async updateSittingAllocation(
    examinationId: string,
    config: UpdateSittingAllocationInput
  ): Promise<ScheduledExamination> {
    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/sittings`,
      {
        method: 'PUT',
        body: JSON.stringify(config),
      }
    );
    return res.data;
  },

  async confirmExaminationSchedule(
    examinationId: string
  ): Promise<ScheduledExamination> {
    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/confirm-schedule`,
      { method: 'POST' }
    );
    return res.data;
  },

  async getPublishedQuestionSetsForExam(
    examinationId: string
  ): Promise<QuestionSetMetadata[]> {
    const res = await apiClient.centralRequest<QuestionSetMetadata[]>(
      `/examinations/${encodeURIComponent(examinationId)}/question-sets`,
      { method: 'GET' }
    );
    return res.data;
  },

  async selectQuestionSetForSitting(
    examinationId: string,
    sittingName: SittingName,
    setNumber: SetNumber
  ): Promise<ScheduledExamination> {
    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/select-set`,
      {
        method: 'POST',
        body: JSON.stringify({ examinationId, sittingName, setNumber }),
      }
    );
    return res.data;
  },

  /**
   * Requests the Central Java Backend to prepare, encrypt, digitally sign, and transfer
   * a sitting's independent examination package to the designated Lab Server and wait for
   * genuine Lab Server verification acknowledgement.
   */
  async prepareAndSendSittingPackage(
    examinationId: string,
    sittingName: SittingName,
    onStageUpdate?: (stagePkg: SittingPackageStatus) => void
  ): Promise<ScheduledExamination> {
    const precheckRes = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}`,
      { method: 'GET' }
    );

    const targetExamSnapshot = precheckRes.data;
    const targetSittingSnapshot = targetExamSnapshot.sittings.find(
      (s) => s.sittingName === sittingName
    );
    if (!targetSittingSnapshot) {
      throw new Error(`${sittingName} not found for this examination.`);
    }

    const missingPrereqs = getPackagePrerequisitesMissing(
      targetExamSnapshot,
      targetSittingSnapshot
    );
    if (missingPrereqs.length > 0) {
      throw new Error(missingPrereqs[0]);
    }

    const rev = targetExamSnapshot.revisionNumber ?? 1;

    if (onStageUpdate) {
      onStageUpdate({
        packageId: targetSittingSnapshot.packageInfo.packageId,
        packageRevision: rev,
        preparationStatus: 'Preparing',
        securityStatus: 'Securing Package',
        transferStatus: 'Sending',
        verificationReadinessStatus: 'Verification Pending',
        statusMessage: `Preparing, signing, and transferring examination package to ${targetSittingSnapshot.labName}...`,
      });
    }

    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/prepare-and-send-package`,
      {
        method: 'POST',
        body: JSON.stringify({
          examinationId,
          sittingId: targetSittingSnapshot.sittingId,
          sittingName,
          packageRevision: rev,
          labId: targetSittingSnapshot.labId,
        }),
      }
    );

    return res.data;
  },

  /**
   * Queries Lab Server package receipt first and retries LAN transfer of an already
   * prepared & secured package via the Central Java Backend.
   */
  async retrySittingPackageTransfer(
    examinationId: string,
    sittingName: SittingName,
    onStageUpdate?: (stagePkg: SittingPackageStatus) => void
  ): Promise<ScheduledExamination> {
    const inspectRes = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}`,
      { method: 'GET' }
    );

    const examSnap = inspectRes.data;
    const sitSnap = examSnap.sittings.find((s) => s.sittingName === sittingName);
    if (!sitSnap) throw new Error('Sitting not found.');

    if (
      sitSnap.packageInfo.preparationStatus !== 'Completed' ||
      sitSnap.packageInfo.securityStatus !== 'Package Secured' ||
      !sitSnap.packageInfo.packageId
    ) {
      throw new Error(
        'No secured package is available for retry. Click Prepare & Send to Lab first.'
      );
    }

    if (isSittingPackageOutdated(examSnap, sitSnap)) {
      throw new Error(
        'This package is outdated because examination settings or student allocations changed. Click Prepare & Send to Lab to generate a fresh revision.'
      );
    }

    if (onStageUpdate) {
      onStageUpdate({
        ...sitSnap.packageInfo,
        transferStatus: 'Sending',
        verificationReadinessStatus: 'Verification Pending',
        statusMessage: `Checking Lab Server receipt and retrying LAN transfer for ${sitSnap.packageInfo.packageId}...`,
      });
    }

    const receiptCheck = await apiClient.labServerRequest<{
      alreadyReceived: boolean;
      verified: boolean;
      rejectionReason?: string;
    }>(
      `/labs/examinations/${encodeURIComponent(
        examinationId
      )}/sittings/${encodeURIComponent(
        sitSnap.sittingId
      )}/package-receipt?packageId=${encodeURIComponent(
        sitSnap.packageInfo.packageId
      )}&revision=${encodeURIComponent(
        String(sitSnap.packageInfo.packageRevision ?? examSnap.revisionNumber ?? 1)
      )}`,
      { method: 'GET' }
    );

    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/retry-transfer`,
      {
        method: 'POST',
        body: JSON.stringify({
          examinationId,
          sittingId: sitSnap.sittingId,
          sittingName,
          packageId: sitSnap.packageInfo.packageId,
          packageRevision:
            sitSnap.packageInfo.packageRevision ?? examSnap.revisionNumber ?? 1,
          receiptCheck: receiptCheck.data,
        }),
      }
    );

    return res.data;
  },

  async updateExaminationSchedule(
    examinationId: string,
    updates: UpdateExaminationScheduleInput
  ): Promise<ScheduledExamination> {
    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
    return res.data;
  },

  async deleteExamination(examinationId: string): Promise<{ deletedId: string }> {
    const res = await apiClient.centralRequest<{ deletedId: string }>(
      `/examinations/${encodeURIComponent(examinationId)}`,
      { method: 'DELETE' }
    );
    return res.data;
  },

  async cancelExamination(
    examinationId: string,
    reason: string
  ): Promise<ScheduledExamination> {
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      throw new Error(
        'A mandatory cancellation reason (at least 5 characters) is required.'
      );
    }

    const res = await apiClient.centralRequest<ScheduledExamination>(
      `/examinations/${encodeURIComponent(examinationId)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: cleanReason }),
      }
    );
    return res.data;
  },

  /**
   * Fetches frozen sitting-wise Question Paper Archive metadata from the Central Java Backend.
   * Availability is enforced server-side only after each sitting is officially Completed and closed.
   */
  async getQuestionPaperArchives(
    examinationId: string
  ): Promise<SittingQuestionPaperArchive[]> {
    const res = await apiClient.centralRequest<SittingQuestionPaperArchive[]>(
      `/examinations/${encodeURIComponent(examinationId)}/question-paper-archive`,
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Retrieves the structured JSON question set data including complete questions, options,
   * module distributions, and confidential evaluation key.
   */
  async getQuestionPaperArchiveData(
    examinationId: string,
    sittingId: string
  ): Promise<ArchivedQuestionSetData> {
    const res = await apiClient.centralRequest<ArchivedQuestionSetData>(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/question-paper-archive/data`,
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Downloads the genuine backend-generated multi-sheet Excel workbook (.xlsx).
   */
  async downloadQuestionPaperXlsx(
    examinationId: string,
    sittingId: string
  ): Promise<{ blob: Blob; contentType: string; filename?: string }> {
    return apiClient.centralBlobRequest(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/question-paper-archive/download-excel`,
      { method: 'GET' }
    );
  },

  /**
   * Retrieves the genuine backend-generated archival PDF (original frozen numbered set, no answers)
   * for a completed examination sitting.
   */
  async downloadOriginalQuestionPaperPdf(
    examinationId: string,
    sittingId: string
  ): Promise<{ blob: Blob; contentType: string; filename?: string }> {
    return apiClient.centralBlobRequest(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/question-paper-archive/download`,
      { method: 'GET' }
    );
  },

  /**
   * Retrieves the restricted COE-only answer key PDF associated with a frozen archived sitting paper,
   * when authorised and exposed separately by the backend.
   */
  async downloadRestrictedAnswerKeyPdf(
    examinationId: string,
    sittingId: string
  ): Promise<{ blob: Blob; contentType: string; filename?: string }> {
    return apiClient.centralBlobRequest(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/question-paper-archive/answer-key/download`,
      { method: 'GET' }
    );
  },
};
