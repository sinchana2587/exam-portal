import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  KeyRound,
  Lock,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import {
  examinationService,
  getAvailableLaboratories,
  getExaminationLifecyclePermissions,
  getPackagePrerequisitesMissing,
  isSittingPackageOutdated,
} from '../services/examinationService';
import {
  DepartmentCode,
  ScheduledExamination,
  SetNumber,
  SittingName,
  SittingPackageStatus,
  SittingQuestionPaperArchive,
  SubjectInfo,
  PublishedQuestionSetFeedItem,
} from '../types/examination';
import {
  exportArchivedQuestionSetExcel,
  exportArchivedQuestionSetDocx,
} from '../services/archiveExportService';
import { StatusIndicator } from '../components/StatusIndicator';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SessionUnlockCredentialPanel } from '../components/SessionUnlockCredentialPanel';
import { formatSemesterLabel } from '../utils/academicSemesters';
import {
  getExaminationStatusSummary,
  getExamStatusTone,
  getPackageStatusTone,
  getResultStatusTone,
  getSittingPackageReadinessStatus,
} from '../utils/examinationStatus';

function getLocalDateIsoOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export type ScheduleSectionId =
  | 'examination-details'
  | 'sitting-arrangements'
  | 'set-selection'
  | 'package-transfer';

function normalizeScheduleSection(raw: string | null): ScheduleSectionId {
  if (
    raw === 'sitting-arrangements' ||
    raw === 'student-eligibility' ||
    raw === 'sitting-allocation'
  ) {
    return 'sitting-arrangements';
  }
  if (raw === 'set-selection') return 'set-selection';
  if (raw === 'package-transfer') return 'package-transfer';
  return 'examination-details';
}

function formatTime24To12(time24: string): string {
  const clean = (time24 || '09:30').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return clean;
  const h24 = parseInt(match[1], 10) % 24;
  const min = match[2];
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${min} ${period}`;
}

function computeSuggestedMorningCount(totalEligible: number, morningCap: number): number {
  if (totalEligible <= 1) return totalEligible;
  const safeCap = Math.max(1, morningCap);
  if (totalEligible > safeCap) {
    return Math.max(1, Math.min(safeCap, totalEligible - 1));
  }
  return Math.max(1, Math.min(safeCap, Math.ceil(totalEligible / 2)));
}

interface AmPmTimePickerProps {
  value: string;
  onChange: (newTime24: string) => void;
  disabled?: boolean;
}

const AmPmTimePicker: React.FC<AmPmTimePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const match = (value || '09:30').match(/^(\d{1,2}):(\d{2})/);
  const h24 = match ? parseInt(match[1], 10) % 24 : 9;
  const minute = match ? match[2] : '30';
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const [minuteText, setMinuteText] = useState(minute);

  useEffect(() => {
    setMinuteText(minute);
  }, [minute]);

  const updateParts = (
    newHour12: number,
    newMinute: string,
    newPeriod: 'AM' | 'PM'
  ) => {
    let target24 = newHour12 % 12;
    if (newPeriod === 'PM') target24 += 12;
    const safeMin = newMinute.padStart(2, '0');
    onChange(`${String(target24).padStart(2, '0')}:${safeMin}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinuteText(raw);
    if (raw === '') return;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      updateParts(hour12, raw.padStart(2, '0'), period);
    }
  };

  const handleMinuteBlur = () => {
    const num = parseInt(minuteText, 10);
    const validMin = isNaN(num) ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
    setMinuteText(validMin);
    updateParts(hour12, validMin, period);
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Hour"
        disabled={disabled}
        value={hour12}
        onChange={(e) => updateParts(Number(e.target.value), minuteText || minute, period)}
        className="px-2.5 py-2.5 text-sm font-mono rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 disabled:opacity-50"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="text-sm font-bold text-[#64748B]">:</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        aria-label="Minute"
        title="Enter minute (00-59)"
        placeholder="MM"
        disabled={disabled}
        value={minuteText}
        onChange={handleMinuteChange}
        onBlur={handleMinuteBlur}
        className="w-14 px-2 py-2.5 text-center text-sm font-mono rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
      />
      <div className="inline-flex rounded-lg border border-[#D9E2EF] dark:border-[#334155] overflow-hidden bg-[#F5F7FB] dark:bg-[#0F172A]">
        {(['AM', 'PM'] as const).map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => updateParts(hour12, minuteText || minute, p)}
            className={`px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
              period === p
                ? 'bg-[#2563EB] text-white'
                : 'text-[#64748B] dark:text-slate-300 hover:text-[#1F2937] dark:hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

export const SchedulingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    departments,
    semesters,
    subjects,
    labServers,
    examinations,
    monitors,
    results,
    correctionRequests,
    sessionUnlockCredentials,
    activeExaminationId,
    setActiveExaminationId,
    refreshAll,
    notify,
  } = useExaminationStore();

  const [searchParams] = useSearchParams();
  const activeSection = normalizeScheduleSection(searchParams.get('section'));

  const [examListSemesterFilter, setExamListSemesterFilter] = useState<string>('ALL');

  const filteredExaminations = useMemo(() => {
    if (examListSemesterFilter === 'ALL') return examinations;
    const semNum = Number(examListSemesterFilter);
    return examinations.filter((e) => e.semester === semNum);
  }, [examinations, examListSemesterFilter]);

  const selectedExam = useMemo(() => {
    if (activeExaminationId) {
      const found = examinations.find((e) => e.id === activeExaminationId);
      if (found) return found;
    }
    return examinations[0] || null;
  }, [examinations, activeExaminationId]);

  const selectedExamSummary = useMemo(() => {
    if (!selectedExam) return null;
    return getExaminationStatusSummary(
      selectedExam,
      monitors,
      results,
      correctionRequests
    );
  }, [selectedExam, monitors, results, correctionRequests]);

  useEffect(() => {
    if (!activeExaminationId && examinations.length > 0) {
      setActiveExaminationId(examinations[0].id);
    }
  }, [activeExaminationId, examinations, setActiveExaminationId]);

  // Question Paper Archive states (local to Examination Details; backed by Central Java Backend)
  const [archiveRecords, setArchiveRecords] = useState<SittingQuestionPaperArchive[]>(
    []
  );
  const [loadingArchives, setLoadingArchives] = useState<boolean>(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [inspectingArchive, setInspectingArchive] =
    useState<SittingQuestionPaperArchive | null>(null);
  const [downloadingArchiveKey, setDownloadingArchiveKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!selectedExam?.id) {
      setArchiveRecords([]);
      setArchiveError(null);
      setInspectingArchive(null);
      return;
    }
    let active = true;
    setLoadingArchives(true);
    setArchiveError(null);
    examinationService
      .getQuestionPaperArchives(selectedExam.id)
      .then((records) => {
        if (!active) return;
        setArchiveRecords(Array.isArray(records) ? records : []);
      })
      .catch((err) => {
        if (!active) return;
        setArchiveRecords([]);
        setArchiveError(
          err instanceof Error
            ? err.message
            : 'Unable to load Question Paper Archive metadata from backend.'
        );
      })
      .finally(() => {
        if (active) setLoadingArchives(false);
      });
    return () => {
      active = false;
    };
  }, [selectedExam?.id, selectedExam?.revisionNumber]);

  const sittingArchiveRows = useMemo<SittingQuestionPaperArchive[]>(() => {
    if (!selectedExam || !selectedExamSummary) return [];
    return selectedExam.sittings.map((sit) => {
      const sitSummary = selectedExamSummary.sittingSummaries.find(
        (s) => s.sittingId === sit.sittingId
      );
      const sitLifecycle = sitSummary?.lifecycleStatus || 'Scheduled';
      const backendArch = archiveRecords.find((a) =>
        a.sittingId === sit.sittingId ||
        (a.rawSittingName && (sit.sittingName || '').toUpperCase().includes(a.rawSittingName)) ||
        (a.sittingName && sit.sittingName && a.sittingName.toLowerCase() === sit.sittingName.toLowerCase())
      );
      const isSittingCompleted = sitLifecycle === 'Exam Completed';
      const isAvailable = Boolean(backendArch?.archiveAvailable || (backendArch as any)?.status === 'Available');
      const archiveAvailable =
        isSittingCompleted && isAvailable;
      const pdfAvailable = isSittingCompleted && (isAvailable || Boolean(backendArch?.pdfAvailable));

      const fallbackVersions =
        sit.generatedPaperVersions?.map((v) => ({
          version: v.version,
          numberedSetId: v.numberedSetId,
          numberedSetLabel: v.numberedSetLabel,
          questionCount: v.questionOrder.length,
          questionOrder: v.questionOrder,
          optionOrdersByQuestionId: v.optionOrdersByQuestionId,
          allocatedStudentCount: sit.aggregateVersionCounts?.[v.version],
        })) || [];

      let availabilityMessage = backendArch?.availabilityMessage;
      if (!isSittingCompleted) {
        availabilityMessage =
          sitLifecycle === 'Cancelled'
            ? 'Examination cancelled. Archival paper download is not applicable.'
            : 'The original question paper will be available after this examination sitting has been completed and closed.';
      } else if (!archiveAvailable || !pdfAvailable) {
        availabilityMessage =
          backendArch?.availabilityMessage ||
          (archiveError
            ? 'Backend archive service is currently unavailable. Original paper download requires Java backend confirmation.'
            : 'Sitting completed — awaiting backend archive generation confirmation.');
      }

      return {
        archiveId: backendArch?.archiveId,
        examinationId: selectedExam.id,
        examCode: backendArch?.examCode || selectedExam.examCode,
        examinationName:
          backendArch?.examinationName ||
          `${selectedExam.examCode} — ${selectedExam.subjectName}`,
        department: backendArch?.department || selectedExam.department,
        departmentName: backendArch?.departmentName || selectedExam.departmentName,
        semester: backendArch?.semester || selectedExam.semester,
        subjectId: backendArch?.subjectId || selectedExam.subjectId,
        subjectCode: backendArch?.subjectCode || selectedExam.subjectCode,
        subjectName: backendArch?.subjectName || selectedExam.subjectName,
        examDate: backendArch?.examDate || sit.examDate || selectedExam.examDate,
        sittingId: sit.sittingId,
        sittingName: sit.sittingName,
        rawSittingName: (backendArch as any)?.rawSittingName || (sit.sittingName.includes('Afternoon') ? 'AFTERNOON' : 'MORNING'),
        startTime: backendArch?.startTime || sit.startTime,
        durationMinutes: backendArch?.durationMinutes || sit.durationMinutes,
        labName: backendArch?.labName || sit.labName,
        selectedSetId: backendArch?.selectedSetId || sit.selectedSetId,
        selectedSetNumber: (backendArch as any)?.originalPaperSetNumber ? `Set ${(backendArch as any).originalPaperSetNumber}` : (backendArch?.selectedSetNumber || sit.selectedSetNumber),
        selectedSetRevision:
          backendArch?.selectedSetRevision || selectedExam.questionBankRevisionId,
        snapshotId: backendArch?.snapshotId || selectedExam.snapshotId,
        questionBankRevisionId:
          backendArch?.questionBankRevisionId || selectedExam.questionBankRevisionId,
        blueprintRevisionId:
          backendArch?.blueprintRevisionId || selectedExam.blueprintRevisionId,
        questionCount: backendArch?.questionCount ?? selectedExam.totalQuestions,
        maximumMarks: backendArch?.maximumMarks ?? selectedExam.maximumMarks,
        sittingStatus: backendArch?.sittingStatus || sitLifecycle,
        archiveAvailable,
        pdfAvailable,
        restrictedAnswerKeyAvailable:
          isSittingCompleted && Boolean(backendArch?.restrictedAnswerKeyAvailable),
        archivedAt: backendArch?.archivedAt,
        downloadUrl: (backendArch as any)?.downloadUrl,
        excelDownloadUrl: (backendArch as any)?.excelDownloadUrl,
        dataUrl: (backendArch as any)?.dataUrl,
        availabilityMessage,
        preservedVersions:
          backendArch?.preservedVersions && backendArch.preservedVersions.length > 0
            ? backendArch.preservedVersions
            : fallbackVersions,
      };
    });
  }, [selectedExam, selectedExamSummary, archiveRecords, archiveError]);

  const handleDownloadArchiveExcel = async (row: SittingQuestionPaperArchive) => {
    if (row.sittingStatus !== 'Exam Completed' || !row.archiveAvailable) {
      notify(
        'error',
        'Archive Unavailable',
        'The archived question set workbook will be available after this examination sitting has been completed and closed.'
      );
      return;
    }

    const opKey = `${row.sittingId}-excel`;
    setDownloadingArchiveKey(opKey);
    try {
      const sittingKey = row.rawSittingName || (row.sittingName.includes('Afternoon') ? 'AFTERNOON' : 'MORNING');
      try {
        const archiveData = await examinationService.getQuestionPaperArchiveData(
          row.examinationId,
          sittingKey
        );
        await exportArchivedQuestionSetExcel(archiveData);
      } catch (dataErr) {
        const result = await examinationService.downloadQuestionPaperXlsx(
          row.examinationId,
          sittingKey
        );
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        const defaultName = `${row.examCode}_${row.sittingName.replace(/\s+/g, '_')}_Set_${row.selectedSetNumber || '1'}_Archive.xlsx`;
        a.href = url;
        a.download = result.filename || defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      notify(
        'success',
        'Question Set Excel Archive Downloaded',
        `Downloaded complete question set workbook (.xlsx) with answers and metadata for ${row.examCode}.`
      );
    } catch (err) {
      notify(
        'error',
        'Excel Archive Download Failed',
        err instanceof Error ? err.message : 'Unable to download question set workbook from backend.'
      );
    } finally {
      setDownloadingArchiveKey(null);
    }
  };

  const handleDownloadArchiveDocx = async (row: SittingQuestionPaperArchive) => {
    if (row.sittingStatus !== 'Exam Completed' || !row.archiveAvailable) {
      notify(
        'error',
        'Archive Unavailable',
        'The archived question set will be available after this examination sitting has been completed and closed.'
      );
      return;
    }

    const opKey = `${row.sittingId}-docx`;
    setDownloadingArchiveKey(opKey);
    try {
      const sittingKey = row.rawSittingName || (row.sittingName.includes('Afternoon') ? 'AFTERNOON' : 'MORNING');
      const archiveData = await examinationService.getQuestionPaperArchiveData(
        row.examinationId,
        sittingKey
      );
      await exportArchivedQuestionSetDocx(archiveData);

      notify(
        'success',
        'Question Set Word Document Downloaded',
        `Downloaded complete question set document (.docx) with answers and evaluation scheme for ${row.examCode}.`
      );
    } catch (err) {
      notify(
        'error',
        'Word Document Download Failed',
        err instanceof Error ? err.message : 'Unable to generate Word document for archived question set.'
      );
    } finally {
      setDownloadingArchiveKey(null);
    }
  };

  const handleDownloadArchivePdf = async (
    row: SittingQuestionPaperArchive,
    kind: 'paper' | 'answer-key'
  ) => {
    if (row.sittingStatus !== 'Exam Completed' || !row.archiveAvailable || !row.pdfAvailable) {
      notify(
        'error',
        'Archive Unavailable',
        'The original question paper will be available after this examination sitting has been completed and closed.'
      );
      return;
    }

    const opKey = `${row.sittingId}-${kind}`;
    setDownloadingArchiveKey(opKey);
    try {
      const sittingKey = row.rawSittingName || (row.sittingName.includes('Afternoon') ? 'AFTERNOON' : 'MORNING');
      const result =
        kind === 'answer-key'
          ? await examinationService.downloadRestrictedAnswerKeyPdf(
              row.examinationId,
              sittingKey
            )
          : await examinationService.downloadOriginalQuestionPaperPdf(
              row.examinationId,
              sittingKey
            );

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      const sitSlug = row.sittingName.replace(/\s+/g, '_');
      const setSlug = (row.selectedSetNumber || 'Original_Set').replace(/\s+/g, '_');
      const defaultName =
        kind === 'answer-key'
          ? `${row.examCode}_${sitSlug}_${setSlug}_Restricted_Answer_Key.pdf`
          : `${row.examCode}_${sitSlug}_${setSlug}_Original_Question_Paper.pdf`;
      a.href = url;
      a.download = result.filename || defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify(
        'success',
        kind === 'answer-key' ? 'Restricted Answer Key Downloaded' : 'Original Question Paper Downloaded',
        `Downloaded archival PDF for ${row.examCode} (${row.sittingName} — ${row.selectedSetNumber || 'Frozen Set'}).`
      );
    } catch (err) {
      notify(
        'error',
        'Archive Download Failed',
        err instanceof Error
          ? err.message
          : 'Unable to download archival PDF from backend.'
      );
    } finally {
      setDownloadingArchiveKey(null);
    }
  };

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [authorisedPackageRevision, setAuthorisedPackageRevision] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Action Confirmation Dialog States
  const [pendingRevisionExam, setPendingRevisionExam] =
    useState<ScheduledExamination | null>(null);
  const [deleteTargetExam, setDeleteTargetExam] =
    useState<ScheduledExamination | null>(null);
  const [cancelTargetExam, setCancelTargetExam] =
    useState<ScheduledExamination | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // ============================================================================
  // SCHEDULE NEW / EDIT EXAMINATION FORM STATE
  // ============================================================================
  const defaultFutureDate = useMemo(() => getLocalDateIsoOffset(2), []);
  const [formDepartment, setFormDepartment] = useState<DepartmentCode>('CSE');
  const [formSemester, setFormSemester] = useState<number>(5);
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [departmentSemesterSubjects, setDepartmentSemesterSubjects] = useState<
    SubjectInfo[]
  >([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);
  const [eligibleSummaryCount, setEligibleSummaryCount] = useState<number>(0);
  const [loadingEligibility, setLoadingEligibility] = useState<boolean>(false);
  const [formPassingMarks, setFormPassingMarks] = useState<number>(12);

  // HOD-Published Question Sets Feed State
  const [publishedSetsFeed, setPublishedSetsFeed] = useState<PublishedQuestionSetFeedItem[]>([]);
  const [loadingPublishedSets, setLoadingPublishedSets] = useState<boolean>(false);

  const loadPublishedSets = useCallback(async () => {
    setLoadingPublishedSets(true);
    try {
      const feed = await examinationService.getPublishedQuestionSets();
      setPublishedSetsFeed(Array.isArray(feed) ? feed : []);
    } catch {
      setPublishedSetsFeed([]);
    } finally {
      setLoadingPublishedSets(false);
    }
  }, []);

  useEffect(() => {
    loadPublishedSets();
  }, [loadPublishedSets]);

  const handleScheduleThisSet = (item: PublishedQuestionSetFeedItem) => {
    setEditingExamId(null);
    setAuthorisedPackageRevision(false);
    setFormDepartment(item.departmentCode);
    setFormSemester(item.semester);
    setFormSubjectId(item.subjectId);
    setShowScheduleForm(true);
    notify(
      'info',
      'Question Set Selected for Scheduling',
      `Loaded ${item.subjectCode} (${item.subjectName}) for ${item.departmentCode} Semester ${item.semester}. Available: ${item.availableSets.join(', ')}.`
    );
  };

  // Sitting Configuration inside Schedule New / Edit Examination Form
  const [formMorningEnabled, setFormMorningEnabled] = useState<boolean>(true);
  const [formMorningDate, setFormMorningDate] = useState<string>(defaultFutureDate);
  const [formMorningStartTime, setFormMorningStartTime] = useState<string>('09:30');
  const [formMorningDuration, setFormMorningDuration] = useState<number | ''>(60);
  const [formMorningLabIds, setFormMorningLabIds] = useState<string[]>(['LAB-CSE-01']);
  const [formMorningStudentCount, setFormMorningStudentCount] = useState<number>(0);

  const [formAfternoonEnabled, setFormAfternoonEnabled] = useState<boolean>(true);
  const [formAfternoonDate, setFormAfternoonDate] = useState<string>(defaultFutureDate);
  const [formAfternoonStartTime, setFormAfternoonStartTime] = useState<string>('14:00');
  const [formAfternoonDuration, setFormAfternoonDuration] = useState<number | ''>(60);
  const [formAfternoonLabIds, setFormAfternoonLabIds] = useState<string[]>(['LAB-CSE-01']);

  // Quick Add Laboratory State
  const [showQuickAddLabModal, setShowQuickAddLabModal] = useState<boolean>(false);
  const [quickAddLabForSitting, setQuickAddLabForSitting] = useState<'morning' | 'afternoon'>('morning');
  const [quickAddLabName, setQuickAddLabName] = useState<string>('');
  const [quickAddLabCapacity, setQuickAddLabCapacity] = useState<number>(40);
  const [submittingQuickAddLab, setSubmittingQuickAddLab] = useState<boolean>(false);

  const editingExam = useMemo(
    () =>
      editingExamId
        ? examinations.find((e) => e.id === editingExamId) || null
        : null,
    [editingExamId, examinations]
  );

  // Use exact existing student count when editing; genuine backend eligibility count when creating
  const formEligibleTotal = useMemo(() => {
    if (editingExam) return editingExam.students.length;
    return eligibleSummaryCount;
  }, [editingExam, eligibleSummaryCount]);

  useEffect(() => {
    if (editingExam) return;
    let active = true;
    setLoadingEligibility(true);
    examinationService
      .getDepartmentEligibilitySummary(formDepartment, formSemester)
      .then((summary) => {
        if (!active) return;
        setEligibleSummaryCount(Math.max(0, summary.eligibleCount ?? 0));
      })
      .catch(() => {
        if (!active) return;
        setEligibleSummaryCount(0);
      })
      .finally(() => {
        if (active) setLoadingEligibility(false);
      });
    return () => {
      active = false;
    };
  }, [formDepartment, formSemester, editingExam, showScheduleForm]);

  // Fetch HOD-published subjects filtered by exact Department ID & Semester ID
  useEffect(() => {
    let active = true;
    setLoadingSubjects(true);
    examinationService
      .getSubjects(formDepartment, formSemester)
      .then((fetched) => {
        if (!active) return;
        const matched = fetched.filter((s) => s.hodPublished);
        setDepartmentSemesterSubjects(matched);
        if (editingExam) {
          setFormSubjectId(editingExam.subjectId);
        } else if (matched.length > 0) {
          setFormSubjectId((prev) =>
            matched.some((s) => s.id === prev) ? prev : matched[0].id
          );
        } else {
          setFormSubjectId('');
        }
      })
      .catch(() => {
        if (!active) return;
        setDepartmentSemesterSubjects([]);
        if (!editingExam) setFormSubjectId('');
      })
      .finally(() => {
        if (active) setLoadingSubjects(false);
      });
    return () => {
      active = false;
    };
  }, [formDepartment, formSemester, subjects, editingExam]);

  const selectedFormSubject = useMemo(
    () => departmentSemesterSubjects.find((s) => s.id === formSubjectId) || null,
    [departmentSemesterSubjects, formSubjectId]
  );

  // Derive read-only paper marks from HOD-published subject (or saved exam when editing)
  const derivedTotalQuestions =
    editingExam?.totalQuestions ?? selectedFormSubject?.questionCountPerSet ?? 0;
  const derivedMarksPerQuestion =
    editingExam?.marksPerQuestion ?? selectedFormSubject?.marksPerQuestion ?? 0;
  const derivedMaximumMarks =
    editingExam?.maximumMarks ??
    selectedFormSubject?.maximumMarks ??
    derivedTotalQuestions * derivedMarksPerQuestion;

  useEffect(() => {
    if (!editingExam && derivedMaximumMarks > 0) {
      setFormPassingMarks((prev) =>
        prev > 0 && prev < derivedMaximumMarks
          ? prev
          : Math.max(1, Math.floor(derivedMaximumMarks * 0.4))
      );
    }
  }, [derivedMaximumMarks, editingExam]);

  // Dynamic available laboratories for Create/Edit Form (excludes current editing exam's sitting slot)
  const availableFormMorningLabs = useMemo(() => {
    return labServers.filter((l) => ((l as any).status || 'ACTIVE') !== 'INACTIVE');
  }, [labServers]);

  const availableFormAfternoonLabs = useMemo(() => {
    return labServers.filter((l) => ((l as any).status || 'ACTIVE') !== 'INACTIVE');
  }, [labServers]);

  useEffect(() => {
    if (availableFormMorningLabs.length > 0 && formMorningLabIds.length === 0) {
      setFormMorningLabIds([availableFormMorningLabs[0].id]);
    }
  }, [availableFormMorningLabs, formMorningLabIds.length]);

  useEffect(() => {
    if (availableFormAfternoonLabs.length > 0 && formAfternoonLabIds.length === 0) {
      setFormAfternoonLabIds([availableFormAfternoonLabs[0].id]);
    }
  }, [availableFormAfternoonLabs, formAfternoonLabIds.length]);

  const toggleMorningLab = (labId: string) => {
    setFormMorningLabIds((prev) => {
      if (prev.includes(labId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== labId);
      }
      return [...prev, labId];
    });
  };

  const toggleAfternoonLab = (labId: string) => {
    setFormAfternoonLabIds((prev) => {
      if (prev.includes(labId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== labId);
      }
      return [...prev, labId];
    });
  };

  const formMorningCombinedCapacity = useMemo(() => {
    return formMorningLabIds.reduce((sum, id) => {
      const lab = labServers.find((l) => l.id === id);
      return sum + (lab?.capacity || 0);
    }, 0);
  }, [formMorningLabIds, labServers]);

  const formAfternoonCombinedCapacity = useMemo(() => {
    return formAfternoonLabIds.reduce((sum, id) => {
      const lab = labServers.find((l) => l.id === id);
      return sum + (lab?.capacity || 0);
    }, 0);
  }, [formAfternoonLabIds, labServers]);

  const totalAvailableCapacity = useMemo(() => {
    let tot = 0;
    if (formMorningEnabled) tot += formMorningCombinedCapacity;
    if (formAfternoonEnabled) tot += formAfternoonCombinedCapacity;
    return tot;
  }, [formMorningEnabled, formMorningCombinedCapacity, formAfternoonEnabled, formAfternoonCombinedCapacity]);

  const capacityShortage = useMemo(() => {
    return Math.max(0, formEligibleTotal - totalAvailableCapacity);
  }, [formEligibleTotal, totalAvailableCapacity]);

  const isCapacityInsufficient = useMemo(() => {
    return formEligibleTotal > totalAvailableCapacity;
  }, [formEligibleTotal, totalAvailableCapacity]);

  const { formMorningAssigned, formAfternoonAssigned } = useMemo(() => {
    if (formEligibleTotal <= 0) return { formMorningAssigned: 0, formAfternoonAssigned: 0 };
    if (formMorningEnabled && formAfternoonEnabled) {
      const combined = Math.max(1, formMorningCombinedCapacity + formAfternoonCombinedCapacity);
      let m = Math.round((formEligibleTotal * formMorningCombinedCapacity) / combined);
      if (m > formMorningCombinedCapacity) m = formMorningCombinedCapacity;
      let a = formEligibleTotal - m;
      if (a > formAfternoonCombinedCapacity) {
        a = formAfternoonCombinedCapacity;
        m = Math.min(formEligibleTotal - a, formMorningCombinedCapacity);
      }
      return { formMorningAssigned: m, formAfternoonAssigned: a };
    }
    if (formMorningEnabled) {
      return { formMorningAssigned: formEligibleTotal, formAfternoonAssigned: 0 };
    }
    return { formMorningAssigned: 0, formAfternoonAssigned: formEligibleTotal };
  }, [formEligibleTotal, formMorningEnabled, formAfternoonEnabled, formMorningCombinedCapacity, formAfternoonCombinedCapacity]);

  const openCreateNewForm = () => {
    setEditingExamId(null);
    setAuthorisedPackageRevision(false);
    setFormDepartment('CSE');
    setFormSemester(5);
    setFormMorningDate(defaultFutureDate);
    setFormMorningStartTime('09:30');
    setFormMorningDuration(60);
    setFormAfternoonDate(defaultFutureDate);
    setFormAfternoonStartTime('14:00');
    setFormAfternoonDuration(60);
    setShowScheduleForm(true);
  };

  const populateFormFromExam = (
    exam: ScheduledExamination,
    isAuthorisedRevision: boolean
  ) => {
    const morningSit = exam.sittings.find(
      (s) => s.sittingName === 'Morning Sitting'
    );
    const afternoonSit = exam.sittings.find(
      (s) => s.sittingName === 'Afternoon Sitting'
    );
    const fallbackLabId = exam.selectedLabIds[0] || labServers[0]?.id || 'LAB-CSE-01';

    setEditingExamId(exam.id);
    setAuthorisedPackageRevision(isAuthorisedRevision);
    setActiveExaminationId(exam.id);

    setFormDepartment(exam.department);
    setFormSemester(exam.semester);
    setFormSubjectId(exam.subjectId);
    setFormPassingMarks(exam.passingMarks);

    const hasMorning = Boolean(morningSit);
    const hasAfternoon = Boolean(afternoonSit);

    setFormMorningEnabled(hasMorning);
    setFormMorningDate(morningSit?.examDate || exam.examDate);
    setFormMorningStartTime(morningSit?.startTime || '09:30');
    setFormMorningDuration(morningSit?.durationMinutes || exam.durationMinutes || 60);
    const mLabIds = (morningSit as any)?.labIds || (morningSit?.labId ? [morningSit.labId] : [fallbackLabId]);
    setFormMorningLabIds(mLabIds);

    setFormAfternoonEnabled(hasAfternoon);
    setFormAfternoonDate(afternoonSit?.examDate || exam.examDate);
    setFormAfternoonStartTime(afternoonSit?.startTime || '14:00');
    setFormAfternoonDuration(
      afternoonSit?.durationMinutes || exam.durationMinutes || 60
    );
    const aLabIds = (afternoonSit as any)?.labIds || (afternoonSit?.labId ? [afternoonSit.labId] : [fallbackLabId]);
    setFormAfternoonLabIds(aLabIds);

    if (hasMorning && hasAfternoon) {
      setFormMorningStudentCount(
        morningSit?.studentCount ?? morningSit?.assignedStudentUsns.length ?? 0
      );
    } else if (hasMorning) {
      setFormMorningStudentCount(exam.students.length);
    } else {
      setFormMorningStudentCount(0);
    }

    setShowScheduleForm(true);
  };

  const handleClickEditExam = (exam: ScheduledExamination) => {
    const perms = getExaminationLifecyclePermissions(exam, monitors);
    if (!perms.canEdit) {
      notify(
        'error',
        'Editing Disabled',
        perms.editBlockedReason || 'This examination cannot be edited.'
      );
      return;
    }
    if (perms.requiresAuthorisedPackageRevision) {
      setPendingRevisionExam(exam);
      return;
    }
    populateFormFromExam(exam, false);
  };

  const handleDepartmentChange = (deptCode: DepartmentCode) => {
    if (editingExamId) return;
    setFormSubjectId('');
    setDepartmentSemesterSubjects([]);
    setFormDepartment(deptCode);
  };

  const handleSemesterChange = (sem: number) => {
    if (editingExamId) return;
    setFormSubjectId('');
    setDepartmentSemesterSubjects([]);
    setFormSemester(sem);
  };

  const handleFormSittingMode = (mode: 'morning' | 'afternoon' | 'both') => {
    if (mode === 'morning') {
      setFormMorningEnabled(true);
      setFormAfternoonEnabled(false);
      setFormMorningStudentCount(formEligibleTotal);
    } else if (mode === 'afternoon') {
      setFormMorningEnabled(false);
      setFormAfternoonEnabled(true);
      setFormMorningStudentCount(0);
    } else {
      const cap =
        labServers.find((l) => l.id === formMorningLabIds[0])?.capacity || 60;
      setFormMorningEnabled(true);
      setFormAfternoonEnabled(true);
      setFormMorningStudentCount(
        computeSuggestedMorningCount(formEligibleTotal, cap)
      );
    }
  };

  const handleFormMorningCountChange = (value: number) => {
    if (!formMorningEnabled || !formAfternoonEnabled) return;
    if (formEligibleTotal <= 1) {
      setFormMorningStudentCount(formEligibleTotal);
      return;
    }
    const clamped = Math.max(
      1,
      Math.min(formEligibleTotal - 1, Math.round(value || 1))
    );
    setFormMorningStudentCount(clamped);
  };

  const handleFormAfternoonCountChange = (value: number) => {
    if (!formMorningEnabled || !formAfternoonEnabled) return;
    if (formEligibleTotal <= 1) return;
    const clampedAft = Math.max(
      1,
      Math.min(formEligibleTotal - 1, Math.round(value || 1))
    );
    setFormMorningStudentCount(formEligibleTotal - clampedAft);
  };

  const formMorningLabCap = formMorningCombinedCapacity;
  const formAfternoonLabCap = formAfternoonCombinedCapacity;

  const handleSubmitScheduleForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingExam && !selectedFormSubject) {
      notify(
        'error',
        'Subject Required',
        'No published subject selected for the chosen department and semester.'
      );
      return;
    }
    if (!editingExam && formEligibleTotal <= 0) {
      notify(
        'error',
        'No Eligible Students',
        `No HOD-published eligible students were found for ${formDepartment} Semester ${formSemester}.`
      );
      return;
    }
    if (!formMorningEnabled && !formAfternoonEnabled) {
      notify(
        'error',
        'Sitting Required',
        'Enable at least one sitting (Morning Sitting, Afternoon Sitting, or both).'
      );
      return;
    }
    if (formMorningEnabled && formMorningLabIds.length === 0) {
      notify(
        'error',
        'Laboratory Required',
        'Please select at least one laboratory for the Morning Sitting.'
      );
      return;
    }
    if (formAfternoonEnabled && formAfternoonLabIds.length === 0) {
      notify(
        'error',
        'Laboratory Required',
        'Please select at least one laboratory for the Afternoon Sitting.'
      );
      return;
    }
    if (formMorningEnabled) {
      const mDur = typeof formMorningDuration === 'number' ? formMorningDuration : parseInt(String(formMorningDuration), 10);
      if (!mDur || isNaN(mDur) || mDur <= 0 || !Number.isInteger(mDur)) {
        notify(
          'error',
          'Invalid Examination Duration',
          'Morning sitting examination duration must be a positive whole number in minutes (e.g. 20, 35, 50, 60, 75, 90).'
        );
        return;
      }
    }
    if (formAfternoonEnabled) {
      const aDur = typeof formAfternoonDuration === 'number' ? formAfternoonDuration : parseInt(String(formAfternoonDuration), 10);
      if (!aDur || isNaN(aDur) || aDur <= 0 || !Number.isInteger(aDur)) {
        notify(
          'error',
          'Invalid Examination Duration',
          'Afternoon sitting examination duration must be a positive whole number in minutes (e.g. 20, 35, 50, 60, 75, 90).'
        );
        return;
      }
    }
    if (isCapacityInsufficient) {
      notify(
        'error',
        'Insufficient Laboratory Capacity',
        `Selected laboratories provide ${totalAvailableCapacity} PCs for ${formEligibleTotal} eligible students (Shortage: ${capacityShortage} seats). Please select additional laboratories.`
      );
      return;
    }

    setSubmitting(true);
    try {
      if (editingExam) {
        const updated = await examinationService.updateExaminationSchedule(
          editingExam.id,
          {
            passingMarks: Number(formPassingMarks),
            authorisedPackageRevision,
            morningSitting: {
              enabled: formMorningEnabled,
              examDate: formMorningDate,
              startTime: formMorningStartTime,
              durationMinutes: Number(formMorningDuration),
              labId: formMorningLabIds[0] || 'LAB-CSE-01',
              labIds: formMorningLabIds,
              studentCount: formMorningAssigned,
            },
            afternoonSitting: {
              enabled: formAfternoonEnabled,
              examDate: formAfternoonDate,
              startTime: formAfternoonStartTime,
              durationMinutes: Number(formAfternoonDuration),
              labId: formAfternoonLabIds[0] || 'LAB-CSE-01',
              labIds: formAfternoonLabIds,
              studentCount: formAfternoonAssigned,
            },
          }
        );
        await refreshAll();
        await loadPublishedSets();
        setActiveExaminationId(updated.id);
        setShowScheduleForm(false);
        setEditingExamId(null);
        setAuthorisedPackageRevision(false);
        notify(
          'success',
          authorisedPackageRevision
            ? 'Authorised Revision Saved (Packages Invalidated)'
            : 'Examination Schedule Updated',
          authorisedPackageRevision
            ? `${updated.examCode} updated to Rev ${updated.revisionNumber}. Prepare a new package and obtain fresh Lab Server verification.`
            : `${updated.examCode} (${updated.subjectName}) updated successfully with snapshot ${updated.snapshotId}.`
        );
      } else if (selectedFormSubject) {
        const primaryDate = formMorningEnabled ? formMorningDate : formAfternoonDate;
        const primaryStart = formMorningEnabled
          ? formMorningStartTime
          : formAfternoonStartTime;
        const primaryDur = formMorningEnabled
          ? Number(formMorningDuration)
          : Number(formAfternoonDuration);
        const primaryLab = formMorningEnabled
          ? formMorningLabIds.join(', ')
          : formAfternoonLabIds.join(', ');

        const created = await examinationService.scheduleExamination({
          department: formDepartment,
          semester: formSemester,
          subjectId: selectedFormSubject.id,
          subjectCode: selectedFormSubject.code,
          examDate: primaryDate,
          startTime: primaryStart,
          durationMinutes: primaryDur,
          passingMarks: Number(formPassingMarks),
          labId: primaryLab,
          morningSitting: {
            enabled: formMorningEnabled,
            examDate: formMorningDate,
            startTime: formMorningStartTime,
            durationMinutes: Number(formMorningDuration),
            labId: formMorningLabIds[0] || 'LAB-CSE-01',
            labIds: formMorningLabIds,
            studentCount: formMorningAssigned,
          },
          afternoonSitting: {
            enabled: formAfternoonEnabled,
            examDate: formAfternoonDate,
            startTime: formAfternoonStartTime,
            durationMinutes: Number(formAfternoonDuration),
            labId: formAfternoonLabIds[0] || 'LAB-CSE-01',
            labIds: formAfternoonLabIds,
            studentCount: formAfternoonAssigned,
          },
        });
        await refreshAll();
        await loadPublishedSets();
        setActiveExaminationId(created.id);
        setShowScheduleForm(false);
        notify(
          'success',
          'Examination Schedule Saved',
          `${created.examCode} (${created.subjectName}) saved with student allocations and snapshot ${created.snapshotId}.`
        );
      }
    } catch (err) {
      notify(
        'error',
        'Scheduling Validation Error',
        err instanceof Error ? err.message : 'Unable to save examination schedule.'
      );
    } finally {
      setSubmitting(false);
    }
  };

    const handleQuickAddLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddLabName.trim()) {
      notify('error', 'Validation Error', 'Laboratory Name is required.');
      return;
    }
    if (quickAddLabCapacity <= 0) {
      notify('error', 'Validation Error', 'Number of seats / PCs must be greater than zero.');
      return;
    }

    setSubmittingQuickAddLab(true);
    try {
      const created = await examinationService.createLaboratory({
        name: quickAddLabName.trim(),
        capacity: Number(quickAddLabCapacity),
      });
      await refreshAll();
      const newLabId = created.id || created.labCode || created.code || ('LAB-' + Date.now());
      if (quickAddLabForSitting === 'morning') {
        setFormMorningLabIds((prev) => Array.from(new Set([...prev, newLabId])));
      } else {
        setFormAfternoonLabIds((prev) => Array.from(new Set([...prev, newLabId])));
      }
      setShowQuickAddLabModal(false);
      setQuickAddLabName('');
      setQuickAddLabCapacity(40);
      notify(
        'success',
        'Laboratory Added',
        `Laboratory "${quickAddLabName.trim()}" (${quickAddLabCapacity} PCs) created and selected.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create laboratory';
      notify('error', 'Lab Creation Failed', msg);
    } finally {
      setSubmittingQuickAddLab(false);
    }
  };

const handleConfirmDeleteDraft = async () => {
    if (!deleteTargetExam) return;
    setSubmitting(true);
    try {
      const targetCode = deleteTargetExam.examCode;
      await examinationService.deleteExamination(deleteTargetExam.id);
      if (editingExamId === deleteTargetExam.id) {
        setEditingExamId(null);
        setShowScheduleForm(false);
      }
      setDeleteTargetExam(null);
      await refreshAll();
      await loadPublishedSets();
      notify(
        'success',
        'Draft Examination Deleted',
        `${targetCode} has been permanently deleted.`
      );
    } catch (err) {
      notify(
        'error',
        'Deletion Blocked',
        err instanceof Error ? err.message : 'Unable to delete examination.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancelExam = async () => {
    if (!cancelTargetExam) return;
    if (cancelReason.trim().length < 5) {
      notify(
        'error',
        'Cancellation Reason Required',
        'Enter a mandatory cancellation reason (at least 5 characters).'
      );
      return;
    }
    setSubmitting(true);
    try {
      const cancelled = await examinationService.cancelExamination(
        cancelTargetExam.id,
        cancelReason
      );
      if (editingExamId === cancelled.id) {
        setEditingExamId(null);
        setShowScheduleForm(false);
      }
      setCancelTargetExam(null);
      setCancelReason('');
      await refreshAll();
      await loadPublishedSets();
      notify(
        'success',
        'Examination Cancelled',
        `${cancelled.examCode} has been cancelled and logged in Audit Logs.`
      );
    } catch (err) {
      notify(
        'error',
        'Cancellation Blocked',
        err instanceof Error ? err.message : 'Unable to cancel examination.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // SECTION 2: SITTING ARRANGEMENTS (PURE READ-ONLY OVERVIEW)
  // ============================================================================
  const [viewingSittingRoster, setViewingSittingRoster] = useState<SittingName | null>(
    null
  );
  const [rosterSearch, setRosterSearch] = useState('');

  useEffect(() => {
    if (selectedExam && selectedExam.sittings.length > 0) {
      setViewingSittingRoster((prev) =>
        prev && selectedExam.sittings.some((s) => s.sittingName === prev)
          ? prev
          : selectedExam.sittings[0].sittingName
      );
    } else {
      setViewingSittingRoster(null);
    }
    setRosterSearch('');
  }, [selectedExam]);

  const activeSavedSitting = useMemo(() => {
    if (!selectedExam || !viewingSittingRoster) return null;
    return (
      selectedExam.sittings.find((s) => s.sittingName === viewingSittingRoster) ||
      null
    );
  }, [selectedExam, viewingSittingRoster]);

  const savedSittingAssignedStudents = useMemo(() => {
    if (!selectedExam || !activeSavedSitting) return [];
    const usnSet = new Set(activeSavedSitting.assignedStudentUsns);
    const matched = selectedExam.students.filter((st) => usnSet.has(st.usn));
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return matched;
    return matched.filter(
      (st) =>
        st.usn.toLowerCase().includes(q) ||
        st.studentName.toLowerCase().includes(q) ||
        st.originalSection.toLowerCase().includes(q)
    );
  }, [selectedExam, activeSavedSitting, rosterSearch]);

  const totalAllocatedSavedCount = useMemo(() => {
    if (!selectedExam) return 0;
    return selectedExam.sittings.reduce(
      (sum, sit) => sum + sit.assignedStudentUsns.length,
      0
    );
  }, [selectedExam]);

  // ============================================================================
  // SECTION 3 & 4: SET SELECTION & PACKAGE TRANSFER
  // ============================================================================
  const [pendingSetChoices, setPendingSetChoices] = useState<
    Partial<Record<SittingName, SetNumber>>
  >({});

  useEffect(() => {
    if (selectedExam) {
      const initialPending: Partial<Record<SittingName, SetNumber>> = {};
      selectedExam.sittings.forEach((sit) => {
        if (sit.selectedSetNumber) {
          initialPending[sit.sittingName] = sit.selectedSetNumber;
        }
      });
      setPendingSetChoices(initialPending);
    }
  }, [selectedExam]);

  const handleConfirmQuestionSetForSitting = async (sittingName: SittingName) => {
    if (!selectedExam) return;
    const chosenSet = pendingSetChoices[sittingName];
    if (!chosenSet) {
      notify(
        'error',
        'Set Selection Required',
        `Select a published numbered question set for ${sittingName} before confirming.`
      );
      return;
    }
    setSubmitting(true);
    try {
      await examinationService.selectQuestionSetForSitting(
        selectedExam.id,
        sittingName,
        chosenSet
      );
      await refreshAll();
      await loadPublishedSets();
      notify(
        'success',
        'Set Confirmed & Versions A–D Generated',
        `${chosenSet} confirmed for ${sittingName}. Versions A, B, C, and D generated.`
      );
    } catch (err) {
      notify(
        'error',
        'Set Selection Blocked',
        err instanceof Error ? err.message : 'Unable to confirm question set.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const [inFlightSittings, setInFlightSittings] = useState<
    Partial<Record<SittingName, boolean>>
  >({});
  const [livePackageStages, setLivePackageStages] = useState<
    Partial<Record<SittingName, SittingPackageStatus>>
  >({});

  useEffect(() => {
    setInFlightSittings({});
    setLivePackageStages({});
  }, [selectedExam?.id]);

  const handlePrepareAndSendToLab = async (sittingName: SittingName) => {
    if (!selectedExam || inFlightSittings[sittingName]) return;
    setInFlightSittings((prev) => ({ ...prev, [sittingName]: true }));
    try {
      const updated = await examinationService.prepareAndSendSittingPackage(
        selectedExam.id,
        sittingName,
        (stagePkg) =>
          setLivePackageStages((prev) => ({ ...prev, [sittingName]: stagePkg }))
      );
      setLivePackageStages((prev) => {
        const next = { ...prev };
        delete next[sittingName];
        return next;
      });
      await refreshAll();
      const sit = updated.sittings.find((s) => s.sittingName === sittingName);
      if (sit?.packageInfo.verificationReadinessStatus === 'Ready for Examination') {
        notify(
          'success',
          'Lab Ready for Examination',
          `Package verified successfully for ${sittingName}. ${sit.labName} is ready for examination.`
        );
      } else {
        notify(
          'error',
          'Transfer Interrupted',
          sit?.packageInfo.failureReason ||
            'Transfer interrupted. Retry transfer once Lab Server connectivity is restored.'
        );
      }
    } catch (err) {
      setLivePackageStages((prev) => {
        const next = { ...prev };
        delete next[sittingName];
        return next;
      });
      notify(
        'error',
        'Package Preparation & Transfer Blocked',
        err instanceof Error
          ? err.message
          : 'Package preparation failed. Please retry.'
      );
    } finally {
      setInFlightSittings((prev) => ({ ...prev, [sittingName]: false }));
    }
  };

  const handleRetryTransfer = async (sittingName: SittingName) => {
    if (!selectedExam || inFlightSittings[sittingName]) return;
    setInFlightSittings((prev) => ({ ...prev, [sittingName]: true }));
    try {
      const updated = await examinationService.retrySittingPackageTransfer(
        selectedExam.id,
        sittingName,
        (stagePkg) =>
          setLivePackageStages((prev) => ({ ...prev, [sittingName]: stagePkg }))
      );
      setLivePackageStages((prev) => {
        const next = { ...prev };
        delete next[sittingName];
        return next;
      });
      await refreshAll();
      const sit = updated.sittings.find((s) => s.sittingName === sittingName);
      if (sit?.packageInfo.verificationReadinessStatus === 'Ready for Examination') {
        notify(
          'success',
          'Transfer & Verification Completed',
          `Package verified successfully for ${sittingName}. Lab is ready for examination.`
        );
      } else {
        notify(
          'error',
          'Retry Transfer Failed',
          sit?.packageInfo.failureReason ||
            'Transfer interrupted. Retry transfer.'
        );
      }
    } catch (err) {
      setLivePackageStages((prev) => {
        const next = { ...prev };
        delete next[sittingName];
        return next;
      });
      await refreshAll();
      notify(
        'error',
        'Retry Transfer Blocked',
        err instanceof Error ? err.message : 'Unable to retry transfer.'
      );
    } finally {
      setInFlightSittings((prev) => ({ ...prev, [sittingName]: false }));
    }
  };

  return (
    <div className="space-y-7">
      {/* Persistent Selected Examination Context Summary Banner */}
      {selectedExam && selectedExamSummary && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 shadow-xs space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-mono font-bold text-[#2563EB] dark:text-blue-400">
                {selectedExam.examCode}
              </span>
              {(selectedExam.revisionNumber ?? 1) > 1 && (
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-[#1F2937] dark:text-slate-200">
                  Rev {selectedExam.revisionNumber}
                </span>
              )}
              <span className="text-lg font-bold text-[#1F2937] dark:text-white">
                {selectedExam.subjectName} ({selectedExam.subjectCode}) &ndash;{' '}
                {selectedExam.department} &ndash; Semester {selectedExam.semester}
              </span>
            </div>

            <p className="text-sm text-[#64748B] dark:text-slate-400 leading-relaxed">
              {selectedExam.departmentName} ({selectedExam.department}) &middot; Semester{' '}
              {selectedExam.semester} &middot; Sections{' '}
              <strong className="text-[#1F2937] dark:text-slate-200">
                {selectedExam.combinedSections.join(', ')}
              </strong>{' '}
              ({selectedExam.students.length} Eligible Students) &middot; Date &amp; Sittings:{' '}
              <strong className="text-[#1F2937] dark:text-slate-200">
                {selectedExam.sittings
                  .map(
                    (s) =>
                      `${s.sittingName} (${s.examDate} ${formatTime24To12(s.startTime)})`
                  )
                  .join(' | ')}
              </strong>{' '}
              &middot; {selectedExam.totalQuestions} Questions &times;{' '}
              {selectedExam.marksPerQuestion} Mark(s) = {selectedExam.maximumMarks} Max
              Marks (Passing: {selectedExam.passingMarks})
            </p>
          </div>

          {/* Three Independent Status Tracks: Examination Progress -> Package Readiness -> Result Processing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="px-4 py-2.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155] flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                Examination Status
              </span>
              <StatusIndicator
                tone={getExamStatusTone(selectedExamSummary.lifecycleStatus)}
                label={selectedExamSummary.lifecycleStatus}
              />
            </div>

            <div className="px-4 py-2.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155] flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                Package Status
              </span>
              <StatusIndicator
                tone={getPackageStatusTone(selectedExamSummary.packageStatus)}
                label={selectedExamSummary.packageStatus}
              />
            </div>

            {selectedExamSummary.lifecycleStatus !== 'Cancelled' && (
              <div className="px-4 py-2.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155] flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                  Result Status
                </span>
                <StatusIndicator
                  tone={getResultStatusTone(selectedExamSummary.resultStatus)}
                  label={
                    selectedExamSummary.resultStatus === 'Correction Pending' &&
                    selectedExamSummary.pendingCorrectionsCount > 0
                      ? `Correction Pending (${selectedExamSummary.pendingCorrectionsCount})`
                      : selectedExamSummary.resultStatus
                  }
                />
              </div>
            )}
          </div>

          {/* Independent Per-Sitting Statuses for Multi-Sitting Examinations */}
          {selectedExamSummary.sittingSummaries.length > 1 && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] dark:text-slate-400">
              <span className="font-bold uppercase tracking-wide">Sitting Status:</span>
              {selectedExamSummary.sittingSummaries.map((sitSum) => (
                <span
                  key={sitSum.sittingId}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155]"
                >
                  <strong className="text-[#1F2937] dark:text-slate-200">
                    {sitSum.sittingName}:
                  </strong>
                  <StatusIndicator
                    tone={getExamStatusTone(sitSum.lifecycleStatus)}
                    label={sitSum.lifecycleStatus}
                    className="text-xs"
                  />
                </span>
              ))}
            </div>
          )}

          {/* Read-only Shortcut to Result Approval when Exam is Completed */}
          {selectedExamSummary.lifecycleStatus === 'Exam Completed' &&
            selectedExamSummary.resultStatus !== 'Released' && (
              <div className="px-4 py-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-[#1F2937] dark:text-slate-200">
                  <strong>Examination Completed</strong> &mdash; Result Status:{' '}
                  <strong>{selectedExamSummary.resultStatus}</strong>
                  {selectedExamSummary.resultStatus === 'Correction Pending' &&
                  selectedExamSummary.pendingCorrectionsCount > 0
                    ? ` (${selectedExamSummary.pendingCorrectionsCount} answer-key correction request(s) pending COE review)`
                    : '.'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveExaminationId(selectedExam.id);
                    navigate(
                      selectedExamSummary.resultStatus === 'Correction Pending'
                        ? '/results/approval?section=answer-key-corrections'
                        : '/results/approval'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Open Result Approval
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

          {selectedExam.status === 'Cancelled' && selectedExam.cancellationReason && (
            <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-[#B42318] dark:text-red-300">
              <strong>Cancelled</strong>
              {selectedExam.cancelledAt ? ` on ${selectedExam.cancelledAt}` : ''}
              {selectedExam.cancelledBy ? ` by ${selectedExam.cancelledBy}` : ''} —
              Reason: {selectedExam.cancellationReason}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          SECTION 1: EXAMINATION DETAILS (CREATE / EDIT / DELETE / CANCEL)
         ======================================================================== */}
      {activeSection === 'examination-details' && (
        <div className="space-y-7">
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
                  Examination Details
                </h1>
                <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5">
                  Configure examination registration, sitting dates, start times, durations, laboratories, and student distribution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (showScheduleForm) {
                    setShowScheduleForm(false);
                    setEditingExamId(null);
                    setAuthorisedPackageRevision(false);
                  } else {
                    openCreateNewForm();
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                {showScheduleForm
                  ? editingExam
                    ? 'Close Edit Form'
                    : 'Close New Schedule Form'
                  : 'Schedule New Examination'}
              </button>
            </div>

            {/* HOD-Published Question Sets Ready for Scheduling */}
            {publishedSetsFeed.length > 0 && (
              <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                    <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                      HOD-Published Question Sets Ready for Scheduling
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {publishedSetsFeed.length} Subject Set(s) Available
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {publishedSetsFeed.map((ps) => (
                    <div
                      key={ps.bankId}
                      className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-[#2563EB] dark:text-blue-400">
                            {ps.subjectCode}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                            {ps.revisionNumber}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-[#1F2937] dark:text-white line-clamp-1">
                          {ps.subjectName}
                        </h3>
                        <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                          {ps.departmentCode} — Semester {ps.semester} • {ps.setCount} Set(s) ({ps.availableSets.join(', ')})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleScheduleThisSet(ps)}
                        className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer transition-colors shadow-2xs"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>SCHEDULE THIS SET</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule New / Edit Examination Form */}
            {showScheduleForm && (
              <form
                onSubmit={handleSubmitScheduleForm}
                className="pt-6 border-t border-[#D9E2EF] dark:border-[#334155] space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                      {editingExam
                        ? `Edit Examination Schedule (${editingExam.examCode})`
                        : 'Schedule New Examination'}
                    </h2>
                    {editingExam && (
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                        Updating existing record {editingExam.id}. Original eligible student roster and examination ID are preserved.
                      </p>
                    )}
                  </div>
                  <span className="text-[14px] font-semibold text-[#2563EB] dark:text-blue-400">
                    {formDepartment} Semester {formSemester} ({formEligibleTotal} Eligible Students)
                  </span>
                </div>

                {editingExam && authorisedPackageRevision && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 flex items-start gap-3 text-sm text-[#B7791F] dark:text-amber-300">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <strong>
                        Authorised Schedule Revision (Rev{' '}
                        {(editingExam.revisionNumber ?? 1) + 1}):
                      </strong>{' '}
                      Saving changes will invalidate the previously transferred Lab Server package, update revision references, and require new package preparation and Lab Server verification.
                    </div>
                  </div>
                )}

                {/* Academic Selection & Paper Marks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Department
                    </label>
                    <select
                      disabled={Boolean(editingExam)}
                      value={formDepartment}
                      onChange={(e) =>
                        handleDepartmentChange(e.target.value as DepartmentCode)
                      }
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {departments.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} — {d.name} (Sections {d.sections.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Semester
                    </label>
                    <select
                      disabled={Boolean(editingExam)}
                      value={formSemester}
                      onChange={(e) => handleSemesterChange(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {semesters.map((sem) => (
                        <option key={sem.semesterNumber} value={sem.semesterNumber}>
                          {sem.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Registered Subject ({formDepartment} — {formatSemesterLabel(formSemester)})
                    </label>
                    {editingExam ? (
                      <input
                        type="text"
                        readOnly
                        value={`${editingExam.subjectCode} — ${editingExam.subjectName}`}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A]/60 text-[#64748B] dark:text-slate-300 cursor-not-allowed"
                      />
                    ) : loadingSubjects ? (
                      <div className="px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#64748B]">
                        Loading published subjects...
                      </div>
                    ) : departmentSemesterSubjects.length === 0 ? (
                      <div className="px-3.5 py-2.5 text-sm rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-[#B7791F] dark:text-amber-300 font-medium">
                        No subjects found for the selected department and semester.
                      </div>
                    ) : (
                      <select
                        value={formSubjectId}
                        onChange={(e) => setFormSubjectId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                      >
                        {departmentSemesterSubjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.code} — {sub.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Total Questions (From HOD Paper)
                    </label>
                    <input
                      type="number"
                      value={derivedTotalQuestions}
                      readOnly
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A]/60 text-[#64748B] dark:text-slate-300 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Marks per Question (From Paper)
                    </label>
                    <input
                      type="number"
                      value={derivedMarksPerQuestion}
                      readOnly
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A]/60 text-[#64748B] dark:text-slate-300 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Maximum Marks (Read-Only)
                    </label>
                    <input
                      type="number"
                      value={derivedMaximumMarks}
                      readOnly
                      className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A]/60 text-[#1F2937] dark:text-slate-200 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                      Passing Marks (&lt; {derivedMaximumMarks})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, derivedMaximumMarks - 1)}
                      value={formPassingMarks}
                      onChange={(e) => setFormPassingMarks(Number(e.target.value))}
                      required
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Sitting Configuration inside Schedule New / Edit Examination */}
                <div className="space-y-4 pt-4 border-t border-[#D9E2EF] dark:border-[#334155]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-[17px] font-bold text-[#1F2937] dark:text-slate-100">
                        Sitting Configuration (
                        {loadingEligibility && !editingExam
                          ? 'Loading eligible count...'
                          : `${formEligibleTotal} Eligible Students`}
                        )
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                        Configure Morning Sitting, Afternoon Sitting, or both. Dates, start times, durations, available laboratories, and student counts are saved with the schedule.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFormSittingMode('morning')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          formMorningEnabled && !formAfternoonEnabled
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-200 border-[#D9E2EF] dark:border-[#334155]'
                        }`}
                      >
                        Morning Only
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormSittingMode('afternoon')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          !formMorningEnabled && formAfternoonEnabled
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-200 border-[#D9E2EF] dark:border-[#334155]'
                        }`}
                      >
                        Afternoon Only
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormSittingMode('both')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          formMorningEnabled && formAfternoonEnabled
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-200 border-[#D9E2EF] dark:border-[#334155]'
                        }`}
                      >
                        Both Sittings
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Morning Sitting Config Card */}
                    <div
                      className={`p-5 rounded-xl border transition-colors space-y-4 ${
                        formMorningEnabled
                          ? 'border-[#2563EB] bg-blue-50/20 dark:bg-blue-950/20'
                          : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formMorningEnabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleFormSittingMode(
                                checked
                                  ? formAfternoonEnabled
                                    ? 'both'
                                    : 'morning'
                                  : 'afternoon'
                              );
                            }}
                            className="w-4 h-4 rounded text-[#2563EB]"
                          />
                          <span className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                            Morning Sitting
                          </span>
                        </label>
                        <span
                          className={`text-xs font-mono font-semibold ${
                            formMorningEnabled && formMorningAssigned > formMorningCombinedCapacity
                              ? 'text-[#B42318] dark:text-red-400'
                              : 'text-[#2563EB] dark:text-blue-400'
                          }`}
                        >
                          {formMorningEnabled
                            ? `${formMorningAssigned} Students / ${formMorningCombinedCapacity} PCs Capacity`
                            : 'Disabled'}
                        </span>
                      </div>

                      {formMorningEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-300 mb-1.5">
                              Examination Date
                            </label>
                            <input
                              type="date"
                              value={formMorningDate}
                              onChange={(e) => setFormMorningDate(e.target.value)}
                              required
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-300 mb-1.5">
                              Start Time (AM / PM)
                            </label>
                            <AmPmTimePicker
                              value={formMorningStartTime}
                              onChange={setFormMorningStartTime}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-300 mb-1.5">
                              Examination Duration (Minutes)
                            </label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="Enter duration"
                              value={formMorningDuration}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') {
                                  setFormMorningDuration('');
                                } else {
                                  const parsed = parseInt(v, 10);
                                  setFormMorningDuration(isNaN(parsed) ? '' : parsed);
                                }
                              }}
                              required
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-[#64748B] dark:text-slate-300">
                                Laboratory
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddLabForSitting('morning');
                                  setShowQuickAddLabModal(true);
                                }}
                                className="text-xs font-semibold text-[#2563EB] hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add Laboratory
                              </button>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A]">
                              {availableFormMorningLabs.length === 0 ? (
                                <div className="text-xs text-slate-400 py-1">No laboratories found.</div>
                              ) : (
                                availableFormMorningLabs.map((lab) => {
                                  const isChecked = formMorningLabIds.includes(lab.id);
                                  return (
                                    <label
                                      key={lab.id}
                                      className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                        isChecked
                                          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 font-semibold'
                                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleMorningLab(lab.id)}
                                          className="w-3.5 h-3.5 rounded text-[#2563EB]"
                                        />
                                        <span className="text-[#1F2937] dark:text-slate-200">{lab.labName}</span>
                                      </div>
                                      <span className="font-mono text-slate-500 dark:text-slate-400">
                                        {lab.capacity} PCs
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400">
                              <span>Selected: {formMorningLabIds.length} lab(s)</span>
                              <span className="font-bold text-[#2563EB] dark:text-blue-400">
                                Combined Capacity: {formMorningCombinedCapacity} PCs
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Afternoon Sitting Config Card */}
                    <div
                      className={`p-5 rounded-xl border transition-colors space-y-4 ${
                        formAfternoonEnabled
                          ? 'border-[#2563EB] bg-blue-50/20 dark:bg-blue-950/20'
                          : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formAfternoonEnabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleFormSittingMode(
                                checked
                                  ? formMorningEnabled
                                    ? 'both'
                                    : 'afternoon'
                                  : 'morning'
                              );
                            }}
                            className="w-4 h-4 rounded text-[#2563EB]"
                          />
                          <span className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                            Afternoon Sitting
                          </span>
                        </label>
                        <span
                          className={`text-xs font-mono font-semibold ${
                            formAfternoonEnabled && formAfternoonAssigned > formAfternoonCombinedCapacity
                              ? 'text-[#B42318] dark:text-red-400'
                              : 'text-[#2563EB] dark:text-blue-400'
                          }`}
                        >
                          {formAfternoonEnabled
                            ? `${formAfternoonAssigned} Students / ${formAfternoonCombinedCapacity} PCs Capacity`
                            : 'Disabled'}
                        </span>
                      </div>

                      {formAfternoonEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-300 mb-1.5">
                              Examination Date
                            </label>
                            <input
                              type="date"
                              value={formAfternoonDate}
                              onChange={(e) => setFormAfternoonDate(e.target.value)}
                              required
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-300 mb-1.5">
                              Start Time (AM / PM)
                            </label>
                            <AmPmTimePicker
                              value={formAfternoonStartTime}
                              onChange={setFormAfternoonStartTime}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#64748B] dark:text-slate-300 mb-1.5">
                              Examination Duration (Minutes)
                            </label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="Enter duration"
                              value={formAfternoonDuration}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') {
                                  setFormAfternoonDuration('');
                                } else {
                                  const parsed = parseInt(v, 10);
                                  setFormAfternoonDuration(isNaN(parsed) ? '' : parsed);
                                }
                              }}
                              required
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-[#64748B] dark:text-slate-300">
                                Laboratory
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddLabForSitting('afternoon');
                                  setShowQuickAddLabModal(true);
                                }}
                                className="text-xs font-semibold text-[#2563EB] hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add Laboratory
                              </button>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A]">
                              {availableFormAfternoonLabs.length === 0 ? (
                                <div className="text-xs text-slate-400 py-1">No laboratories found.</div>
                              ) : (
                                availableFormAfternoonLabs.map((lab) => {
                                  const isChecked = formAfternoonLabIds.includes(lab.id);
                                  return (
                                    <label
                                      key={lab.id}
                                      className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                        isChecked
                                          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 font-semibold'
                                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleAfternoonLab(lab.id)}
                                          className="w-3.5 h-3.5 rounded text-[#2563EB]"
                                        />
                                        <span className="text-[#1F2937] dark:text-slate-200">{lab.labName}</span>
                                      </div>
                                      <span className="font-mono text-slate-500 dark:text-slate-400">
                                        {lab.capacity} PCs
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400">
                              <span>Selected: {formAfternoonLabIds.length} lab(s)</span>
                              <span className="font-bold text-[#2563EB] dark:text-blue-400">
                                Combined Capacity: {formAfternoonCombinedCapacity} PCs
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Allocation Preview & Capacity Shortage Banner */}
                {isCapacityInsufficient ? (
                  <div className="p-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">Insufficient Laboratory Capacity</div>
                      <div className="text-xs mt-1">
                        {formEligibleTotal} eligible students require {formEligibleTotal} PCs, but selected laboratories provide only {totalAvailableCapacity} PCs.
                        Shortage: <strong className="underline">{capacityShortage} seats</strong>. Please select additional laboratories or use "+ Add Laboratory" to expand capacity.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-[#1F2937] dark:text-slate-200 space-y-2">
                    <div className="text-xs font-bold text-[#2563EB] dark:text-blue-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Automatic Student Allocation Preview (Capacity-Weighted)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {formMorningEnabled && (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155]">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Morning Sitting:</span>{' '}
                          <strong>{formMorningAssigned}</strong> students allocated across {formMorningLabIds.length} laboratory ({formMorningCombinedCapacity} PCs capacity).
                        </div>
                      )}
                      {formAfternoonEnabled && (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155]">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Afternoon Sitting:</span>{' '}
                          <strong>{formAfternoonAssigned}</strong> students allocated across {formAfternoonLabIds.length} laboratory ({formAfternoonCombinedCapacity} PCs capacity).
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                      Total {formEligibleTotal} eligible students allocated without omission or capacity overflow. Original section and USN are preserved.
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleForm(false);
                      setEditingExamId(null);
                      setAuthorisedPackageRevision(false);
                    }}
                    className="px-4 py-2.5 text-sm font-semibold text-[#64748B] dark:text-slate-300 bg-[#F5F7FB] dark:bg-[#0F172A] rounded-lg border border-[#D9E2EF] dark:border-[#334155] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (!editingExam && !selectedFormSubject) || isCapacityInsufficient}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    {editingExam
                      ? authorisedPackageRevision
                        ? 'Save Authorised Revision'
                        : 'Update Examination Schedule'
                      : 'Save Examination Schedule'}
                  </button>
                </div></form>
            )}

            {/* Scheduled Examinations Cards with Semester Filter + Edit & Delete/Cancel Actions */}
            <div className="pt-5 border-t border-[#D9E2EF] dark:border-[#334155]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                  Scheduled Examinations ({filteredExaminations.length}
                  {examListSemesterFilter !== 'ALL' ? ` of ${examinations.length}` : ''})
                </h2>

                <div className="flex items-center gap-2.5">
                  <Filter className="w-4 h-4 text-[#64748B] shrink-0" />
                  <select
                    aria-label="Filter scheduled examinations by semester"
                    value={examListSemesterFilter}
                    onChange={(e) => setExamListSemesterFilter(e.target.value)}
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

              {examinations.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 text-center space-y-2">
                  <p className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    No Examinations Scheduled
                  </p>
                  <p className="text-sm text-[#64748B] dark:text-slate-400">
                    No examination schedules were returned by the central backend. Use{' '}
                    <strong>Schedule New Examination</strong> above to create a schedule.
                  </p>
                </div>
              ) : filteredExaminations.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 text-center space-y-2.5">
                  <p className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    No examinations found for this semester.
                  </p>
                  <p className="text-sm text-[#64748B] dark:text-slate-400">
                    There are currently no scheduled examinations for{' '}
                    {formatSemesterLabel(Number(examListSemesterFilter))}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setExamListSemesterFilter('ALL')}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-blue-400 hover:bg-blue-50/40 cursor-pointer"
                  >
                    Show All Semesters
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredExaminations.map((exam) => {
                  const isSelected = selectedExam?.id === exam.id;
                  const eligibleCnt = exam.students.length;
                  const perms = getExaminationLifecyclePermissions(exam, monitors);
                  const summary = getExaminationStatusSummary(
                    exam,
                    monitors,
                    results,
                    correctionRequests
                  );
                  const uniqueExamDates = Array.from(
                    new Set(exam.sittings.map((s) => s.examDate).filter(Boolean))
                  );
                  const examDateDisplay =
                    uniqueExamDates.length > 0
                      ? uniqueExamDates.join(', ')
                      : exam.examDate;

                  return (
                    <div
                      key={exam.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveExaminationId(exam.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveExaminationId(exam.id);
                        }
                      }}
                      className={`text-left p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                        isSelected
                          ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#2563EB]'
                          : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 hover:border-slate-400'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[13px] font-mono font-bold text-[#2563EB] dark:text-blue-400 truncate">
                              {exam.examCode}
                            </span>
                            {(exam.revisionNumber ?? 1) > 1 && (
                              <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-200/80 dark:bg-slate-800 text-[#1F2937] dark:text-slate-200 shrink-0">
                                Rev {exam.revisionNumber}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono font-semibold text-[#64748B] dark:text-slate-400 shrink-0">
                            Date: {examDateDisplay}
                          </span>
                        </div>

                        <div>
                          <div className="text-[17px] font-bold text-[#1F2937] dark:text-slate-100">
                            {exam.subjectName} ({exam.subjectCode}) &ndash; {exam.department}{' '}
                            &ndash; Semester {exam.semester}
                          </div>
                          <div className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                            {exam.departmentName} &middot; Sections{' '}
                            {exam.combinedSections.join(', ')} ({eligibleCnt} Eligible)
                          </div>
                          <div className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1 font-mono">
                            {exam.totalQuestions} Questions &middot; Max Marks:{' '}
                            {exam.maximumMarks} &middot; Passing: {exam.passingMarks}
                          </div>
                        </div>

                        {/* Separated Status Display: Examination Status / Package Status / Result Status */}
                        <div className="p-3.5 rounded-lg bg-white/90 dark:bg-[#1E293B]/90 border border-[#D9E2EF] dark:border-[#334155] space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#64748B] dark:text-slate-400">
                              Examination Status:
                            </span>
                            <StatusIndicator
                              tone={getExamStatusTone(summary.lifecycleStatus)}
                              label={summary.lifecycleStatus}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#64748B] dark:text-slate-400">
                              Package Status:
                            </span>
                            <StatusIndicator
                              tone={getPackageStatusTone(summary.packageStatus)}
                              label={summary.packageStatus}
                            />
                          </div>

                          {summary.lifecycleStatus !== 'Cancelled' && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#64748B] dark:text-slate-400">
                                Result Status:
                              </span>
                              <StatusIndicator
                                tone={getResultStatusTone(summary.resultStatus)}
                                label={
                                  summary.resultStatus === 'Correction Pending' &&
                                  summary.pendingCorrectionsCount > 0
                                    ? `Correction Pending (${summary.pendingCorrectionsCount})`
                                    : summary.resultStatus
                                }
                              />
                            </div>
                          )}

                          {/* Independent Per-Sitting Status Breakdown when multiple sittings exist */}
                          {summary.sittingSummaries.length > 1 && (
                            <div className="pt-2 mt-1 border-t border-[#D9E2EF]/70 dark:border-[#334155] space-y-1">
                              {summary.sittingSummaries.map((sitSum) => (
                                <div
                                  key={sitSum.sittingId}
                                  className="flex items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-slate-400"
                                >
                                  <span className="font-medium">
                                    {sitSum.sittingName} ({sitSum.examDate}):
                                  </span>
                                  <span className="font-semibold text-[#1F2937] dark:text-slate-200">
                                    {sitSum.lifecycleStatus} &middot; Package:{' '}
                                    {sitSum.packageStatus}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {exam.status === 'Cancelled' && exam.cancellationReason && (
                          <div className="text-xs text-[#B42318] dark:text-red-300 font-medium">
                            Cancelled Reason: {exam.cancellationReason}
                          </div>
                        )}
                      </div>

                      {/* Card Lifecycle Actions: Shortcut to Result Approval (when completed) + Edit / Cancel */}
                      <div
                        className="pt-3 border-t border-[#D9E2EF]/70 dark:border-[#334155] flex flex-wrap items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {summary.lifecycleStatus === 'Exam Completed' &&
                        summary.resultStatus !== 'Released' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveExaminationId(exam.id);
                              navigate(
                                summary.resultStatus === 'Correction Pending'
                                  ? '/results/approval?section=answer-key-corrections'
                                  : '/results/approval'
                              );
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            <span>Go to Result Approval</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-xs text-[#64748B] dark:text-slate-400 truncate max-w-[55%]">
                            {perms.hasStarted
                              ? 'In Progress — Schedule Locked'
                              : perms.isCompleted
                                ? 'Retained Permanently'
                                : perms.isCancelled
                                  ? 'Cancelled'
                                  : perms.requiresAuthorisedPackageRevision
                                    ? 'Package Transferred'
                                    : `${exam.sittings.length} Sitting(s)`}
                          </span>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={!perms.canEdit || submitting}
                            title={
                              perms.editBlockedReason ||
                              (perms.requiresAuthorisedPackageRevision
                                ? 'Authorised Schedule Revision (invalidates transferred package)'
                                : 'Edit Examination Schedule')
                            }
                            onClick={() => handleClickEditExam(exam)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100 hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>
                              {perms.requiresAuthorisedPackageRevision
                                ? 'Revise'
                                : 'Edit'}
                            </span>
                          </button>

                          {perms.isDraft ? (
                            <button
                              type="button"
                              disabled={!perms.canDelete || submitting}
                              title={perms.removeBlockedReason || 'Delete Draft Examination'}
                              onClick={() => setDeleteTargetExam(exam)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-[#1E293B] text-[#B42318] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!perms.canCancel || submitting}
                              title={
                                perms.removeBlockedReason ||
                                'Cancel Examination (Reason Required)'
                              }
                              onClick={() => {
                                setCancelReason('');
                                setCancelTargetExam(exam);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-[#1E293B] text-[#B42318] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Examination Academic & Published Paper Summary (Read-Only) */}
          {selectedExam && (
            <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-5">
              <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                    Published Paper &amp; Examination Summary
                  </h2>
                  <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                    Academic registration and HOD-published question paper configuration for {selectedExam.examCode}.
                  </p>
                </div>
                {selectedExam.snapshotId && (
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-bold text-[#16834A] dark:text-emerald-300 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                    Snapshot: {selectedExam.snapshotId}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Department &amp; Semester
                  </div>
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100 mt-1.5">
                    {selectedExam.departmentName} ({selectedExam.department}) &middot; Sem{' '}
                    {selectedExam.semester}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Registered Subject
                  </div>
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100 mt-1.5">
                    {selectedExam.subjectCode} — {selectedExam.subjectName}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Published Paper Information
                  </div>
                  <div className="text-base font-bold text-[#16834A] dark:text-emerald-400 mt-1.5">
                    {selectedExam.hodQuestionSetsPublished
                      ? `Published by HOD (${selectedExam.questionSets.length} Sets)`
                      : 'Awaiting HOD Publication'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Total Questions (From HOD)
                  </div>
                  <div className="text-base font-mono font-bold text-[#1F2937] dark:text-slate-100 mt-1.5">
                    {selectedExam.totalQuestions} Questions ({selectedExam.marksPerQuestion} Mark/Q)
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Maximum Marks (From HOD)
                  </div>
                  <div className="text-base font-mono font-bold text-[#1F2937] dark:text-slate-100 mt-1.5">
                    {selectedExam.maximumMarks} Marks
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Passing Marks
                  </div>
                  <div className="text-base font-mono font-bold text-[#2563EB] dark:text-blue-400 mt-1.5">
                    {selectedExam.passingMarks} Marks
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Individual Examination -> Individual Sitting Details -> Question Paper Archive */}
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100 flex items-center gap-2.5">
                  <Archive className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                  Individual Sitting Details &amp; Question Paper Archive
                </h2>
                <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                  Per-sitting frozen question set records and official archival PDFs. Each sitting maintains its own independent Question Paper Archive generated by the Java backend after that sitting is officially completed and closed.
                </p>
              </div>
              {selectedExam && loadingArchives && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155] text-xs font-semibold text-[#64748B] dark:text-slate-300 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Checking Backend Archive Status...
                </span>
              )}
            </div>

            {!selectedExam ? (
              <div className="p-6 sm:p-8 rounded-xl border border-dashed border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/60 dark:bg-[#0F172A]/50 space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                    <Archive className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                      Question Paper Archive — Awaiting Examination Selection
                    </h3>
                    <p className="text-sm text-[#64748B] dark:text-slate-400 leading-relaxed">
                      No examination is currently loaded or selected (schedule an examination or connect to the Central Java Backend to load examinations). Question Paper Archive information becomes available here for each individual sitting once an examination and its sitting details are loaded.
                    </p>
                    <p className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                      The original question paper will be available after this examination sitting has been completed and closed.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155]">
                    <div className="font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                      Archive Scope
                    </div>
                    <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                      Separate Per-Sitting Record (Morning / Afternoon)
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155]">
                    <div className="font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                      Archive Generation Status
                    </div>
                    <div className="font-bold text-[#64748B] dark:text-slate-300 mt-1">
                      Unavailable — No Examination Loaded
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155]">
                    <div className="font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                      Download &amp; Restricted Answer Key
                    </div>
                    <div className="font-bold text-[#64748B] dark:text-slate-300 mt-1">
                      Requires Completed Sitting &amp; Backend Archive PDF
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {archiveError && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Central Java Backend archive service unavailable ({archiveError}). Showing sitting schedule details below without simulated archive downloads. Genuine archive generation status and PDFs require live backend connectivity.
                    </span>
                  </div>
                )}

                {sittingArchiveRows.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 text-sm text-[#64748B] dark:text-slate-400 text-center">
                    No sitting details found for {selectedExam.examCode}. Sitting-level Question Paper Archive sections appear once sittings are configured.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sittingArchiveRows.map((row) => {
                      const sitObj = selectedExam.sittings.find(
                        (s) => s.sittingId === row.sittingId
                      );
                      const isCompleted = row.sittingStatus === 'Exam Completed';
                      const isCancelled = row.sittingStatus === 'Cancelled';
                      const canDownload =
                        isCompleted && row.archiveAvailable && row.pdfAvailable;
                      const isDownloadingPaper =
                        downloadingArchiveKey === `${row.sittingId}-paper`;
                      const isDownloadingKey =
                        downloadingArchiveKey === `${row.sittingId}-answer-key`;
                      const isDownloadingExcel =
                        downloadingArchiveKey === `${row.sittingId}-excel`;
                      const isDownloadingDocx =
                        downloadingArchiveKey === `${row.sittingId}-docx`;

                      const archiveGenerationStatusLabel = isCancelled
                        ? 'Not Applicable (Examination Cancelled)'
                        : !isCompleted
                          ? 'Not Yet Generated (Sitting Not Completed)'
                          : canDownload
                            ? `Generated & Frozen${row.archivedAt ? ` (${row.archivedAt})` : ''}`
                            : archiveError
                              ? 'Unavailable (Backend Service Offline)'
                              : 'Pending Backend Archive Generation';

                      const archiveAvailabilityLabel = isCancelled
                        ? 'Not Applicable'
                        : canDownload
                          ? 'Available for Download'
                          : 'Not Available (Locked Until Completed)';

                      return (
                        <div
                          key={row.sittingId}
                          className="rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/50 dark:bg-[#0F172A]/50 p-5 sm:p-6 space-y-5"
                        >
                          {/* Individual Sitting Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2.5">
                                <h3 className="text-lg font-bold text-[#1F2937] dark:text-slate-100">
                                  {row.sittingName}
                                </h3>
                                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] text-[#2563EB] dark:text-blue-400">
                                  {row.sittingId}
                                </span>
                              </div>
                              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                                Date: <strong className="text-[#1F2937] dark:text-slate-200">{row.examDate}</strong> &middot; Time:{' '}
                                <strong className="text-[#1F2937] dark:text-slate-200">{formatTime24To12(row.startTime)}</strong> ({row.durationMinutes} mins) &middot; Lab:{' '}
                                <strong className="text-[#1F2937] dark:text-slate-200">{row.labName}</strong>
                                {sitObj ? ` · ${sitObj.studentCount} Eligible Students` : ''}
                              </p>
                            </div>
                            <StatusIndicator
                              tone={getExamStatusTone(row.sittingStatus)}
                              label={`Sitting: ${row.sittingStatus}`}
                            />
                          </div>

                          {/* Dedicated Question Paper Archive Subsection inside this Sitting's Details */}
                          <div className="rounded-xl bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center gap-2">
                                <Archive className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
                                Question Paper Archive
                              </h4>
                              <StatusIndicator
                                tone={
                                  canDownload
                                    ? 'success'
                                    : isCancelled
                                      ? 'neutral'
                                      : 'warning'
                                }
                                label={archiveAvailabilityLabel}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                              <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                                  Selected Numbered Question Set
                                </div>
                                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                                  {row.selectedSetNumber ? (
                                    <span className="text-[#2563EB] dark:text-blue-400">
                                      {row.selectedSetNumber}
                                    </span>
                                  ) : (
                                    <span className="text-[#64748B] dark:text-slate-400">
                                      Not Selected
                                    </span>
                                  )}
                                </div>
                                {row.selectedSetRevision && (
                                  <div className="text-xs font-mono text-[#64748B] dark:text-slate-400 mt-0.5">
                                    Revision: {row.selectedSetRevision}
                                  </div>
                                )}
                              </div>

                              <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                                  Examination &amp; Subject Details
                                </div>
                                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                                  {row.examCode} &middot; {row.subjectCode}
                                </div>
                                <div className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                                  {row.subjectName} ({row.department} &middot; {formatSemesterLabel(row.semester)})
                                </div>
                              </div>

                              <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                                  Sitting Information
                                </div>
                                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                                  {row.sittingName} ({row.examDate})
                                </div>
                                <div className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                                  {formatTime24To12(row.startTime)} &middot; {row.labName}
                                </div>
                              </div>

                              <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                                  Archive Generation Status
                                </div>
                                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                                  {archiveGenerationStatusLabel}
                                </div>
                                {row.snapshotId && (
                                  <div className="text-xs font-mono text-[#64748B] dark:text-slate-400 mt-0.5">
                                    Snapshot: {row.snapshotId}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Pre-completion or Backend-pending Notice */}
                            {!canDownload && (
                              <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A]/70 border border-[#D9E2EF] dark:border-[#334155] flex items-start gap-2.5 text-xs text-[#64748B] dark:text-slate-300">
                                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#B7791F] dark:text-amber-400" />
                                <span>
                                  {row.availabilityMessage ||
                                    'The original question paper will be available after this examination sitting has been completed and closed.'}
                                </span>
                              </div>
                            )}

                            {/* Archive Actions: Complete Question Set (.xlsx) + Word (.docx) + PDF + Restricted Answer Key Access */}
                            <div className="pt-2 border-t border-[#D9E2EF]/80 dark:border-[#334155] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!canDownload || isDownloadingExcel}
                                  onClick={() => handleDownloadArchiveExcel(row)}
                                  title={
                                    canDownload
                                      ? 'Download complete archived question set workbook with answers (.xlsx)'
                                      : 'The question set workbook will be available after this examination sitting has been completed and closed.'
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                  {isDownloadingExcel
                                    ? 'Generating...'
                                    : 'Complete Set (.xlsx)'}
                                </button>

                                <button
                                  type="button"
                                  disabled={!canDownload || isDownloadingDocx}
                                  onClick={() => handleDownloadArchiveDocx(row)}
                                  title={
                                    canDownload
                                      ? 'Download formatted Word document (.docx)'
                                      : 'The Word document will be available after this examination sitting has been completed and closed.'
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-[#2563EB] dark:text-blue-300 hover:bg-blue-100/70 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {isDownloadingDocx
                                    ? 'Generating...'
                                    : 'Word (.docx)'}
                                </button>

                                <button
                                  type="button"
                                  disabled={!canDownload || isDownloadingPaper}
                                  onClick={() => handleDownloadArchivePdf(row, 'paper')}
                                  title={
                                    canDownload
                                      ? 'Download backend-generated multi-page question paper PDF'
                                      : 'The question paper PDF will be available after this examination sitting has been completed and closed.'
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {isDownloadingPaper
                                    ? 'Downloading...'
                                    : 'Paper (PDF)'}
                                </button>

                                {canDownload && (
                                  <button
                                    type="button"
                                    onClick={() => setInspectingArchive(row)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Inspect Set &amp; Versions
                                  </button>
                                )}
                              </div>

                              {/* Separate Restricted Answer Key Access */}
                              <div className="flex items-center gap-2 text-xs">
                                {canDownload && row.restrictedAnswerKeyAvailable ? (
                                  <button
                                    type="button"
                                    disabled={isDownloadingKey}
                                    onClick={() =>
                                      handleDownloadArchivePdf(row, 'answer-key')
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-[#B7791F] dark:text-amber-300 hover:bg-amber-100/70 disabled:opacity-50 cursor-pointer"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    {isDownloadingKey
                                      ? 'Downloading...'
                                      : 'Answer Key (PDF)'}
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155] text-[#64748B] dark:text-slate-400">
                                    <KeyRound className="w-3.5 h-3.5" />
                                    {canDownload
                                      ? 'Restricted Answer Key: Verified'
                                      : 'Restricted Answer Key: Locked Until Sitting Completion'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================
          SECTION 2: SITTING ARRANGEMENTS (READ-ONLY OVERVIEW)
         ======================================================================== */}
      {activeSection === 'sitting-arrangements' && selectedExam && (
        <div className="space-y-7">
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
            {/* Header & Eligible vs Allocated Summary */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 border-b border-[#D9E2EF] dark:border-[#334155] pb-6">
              <div className="space-y-1.5">
                <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
                  Sitting Arrangements
                </h1>
                <p className="text-[15px] text-[#64748B] dark:text-slate-400 leading-relaxed max-w-3xl">
                  Read-only overview of saved examination sittings, assigned laboratories, and eligible student rosters for {selectedExam.examCode}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                  <Users className="w-6 h-6 text-[#2563EB] dark:text-blue-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Total Allocated / Eligible
                    </div>
                    <div className="text-xl font-mono font-bold text-[#17243A] dark:text-white leading-tight">
                      {totalAllocatedSavedCount} / {selectedExam.students.length} Students
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enabled Sitting Cards (Read-Only) */}
            <div
              className={`grid grid-cols-1 ${
                selectedExam.sittings.length > 1 ? 'lg:grid-cols-2' : ''
              } gap-6`}
            >
              {selectedExam.sittings.map((sit) => {
                const isViewing = viewingSittingRoster === sit.sittingName;
                const sitSummary = selectedExamSummary?.sittingSummaries.find(
                  (s) => s.sittingId === sit.sittingId
                );
                return (
                  <div
                    key={sit.sittingId}
                    className={`p-6 rounded-xl border transition-all flex flex-col justify-between gap-5 ${
                      isViewing
                        ? 'bg-blue-50/35 dark:bg-blue-950/25 border-[#2563EB]'
                        : 'bg-[#F5F7FB]/50 dark:bg-[#0F172A]/40 border-[#D9E2EF] dark:border-[#334155]'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-3.5">
                        <div className="flex items-center gap-3">
                          <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                            {sit.sittingName}
                          </h2>
                          {sitSummary && (
                            <StatusIndicator
                              tone={getExamStatusTone(sitSummary.lifecycleStatus)}
                              label={sitSummary.lifecycleStatus}
                            />
                          )}
                        </div>
                        <span className="px-3.5 py-1.5 rounded-lg text-sm font-mono font-bold bg-blue-100 dark:bg-blue-950 text-[#2563EB] dark:text-blue-300">
                          {sit.assignedStudentUsns.length} Students
                        </span>
                      </div>

                      <dl className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[#64748B] dark:text-slate-400">
                            Assigned Laboratory:
                          </dt>
                          <dd className="font-bold text-[#1F2937] dark:text-slate-100 text-right">
                            {sit.labName} ({sit.labCapacity} PCs)
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-[#64748B] dark:text-slate-400">
                            Saved Timing:
                          </dt>
                          <dd className="font-mono font-semibold text-[#1F2937] dark:text-slate-200 text-right">
                            {sit.examDate} &middot; {formatTime24To12(sit.startTime)} (
                            {sit.durationMinutes} mins)
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingSittingRoster(sit.sittingName)}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                        isViewing
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-100 border-[#D9E2EF] dark:border-[#334155] hover:border-[#2563EB]'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      View Assigned Students ({sit.assignedStudentUsns.length})
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Read-Only Assigned Student Table for Clicked Sitting */}
          {activeSavedSitting && (
            <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
                <div>
                  <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                    {activeSavedSitting.sittingName} — Assigned Students (
                    {activeSavedSitting.assignedStudentUsns.length})
                  </h2>
                  <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                    {activeSavedSitting.labName} &middot; Read-only student list from saved examination allocation.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search by Name, USN, or Section..."
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
                <div className="max-h-[440px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 bg-[#F5F7FB] dark:bg-[#0F172A] border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-5 w-16">#</th>
                        <th className="py-3.5 px-5">Student Name</th>
                        <th className="py-3.5 px-5">USN</th>
                        <th className="py-3.5 px-5">Original Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155]">
                      {savedSittingAssignedStudents.map((st, idx) => (
                        <tr
                          key={st.usn}
                          className="hover:bg-[#F5F7FB]/60 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-3.5 px-5 font-mono text-[#64748B]">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-[#1F2937] dark:text-slate-100">
                            {st.studentName}
                          </td>
                          <td className="py-3.5 px-5 font-mono font-semibold text-[#1F2937] dark:text-slate-200">
                            {st.usn}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-[#1F2937] dark:text-slate-200">
                              Section {st.originalSection}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {savedSittingAssignedStudents.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-8 text-center text-sm text-[#64748B] dark:text-slate-400"
                          >
                            No assigned students match the current search filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          SECTION 3: SET SELECTION & VERSION GENERATION
         ======================================================================== */}
      {activeSection === 'set-selection' && selectedExam && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-8">
          <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
              Set Selection &amp; Version Generation
            </h1>
            <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5 leading-relaxed">
              Select a published question set for each examination sitting. Versions A–D will be generated after confirmation.
            </p>
          </div>

          {/* Current Sitting Set Selection Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155]">
              <span className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                Morning Sitting:
              </span>
              <span
                className={`text-sm font-bold ${
                  selectedExam.sittings.find((s) => s.sittingName === 'Morning Sitting')
                    ?.selectedSetNumber
                    ? 'text-[#16834A] dark:text-emerald-400'
                    : 'text-[#B7791F] dark:text-amber-400'
                }`}
              >
                {selectedExam.sittings.find((s) => s.sittingName === 'Morning Sitting')
                  ? selectedExam.sittings.find((s) => s.sittingName === 'Morning Sitting')
                      ?.selectedSetNumber || 'Not Selected'
                  : 'Not Configured'}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155]">
              <span className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                Afternoon Sitting:
              </span>
              <span
                className={`text-sm font-bold ${
                  selectedExam.sittings.find((s) => s.sittingName === 'Afternoon Sitting')
                    ?.selectedSetNumber
                    ? 'text-[#16834A] dark:text-emerald-400'
                    : 'text-[#B7791F] dark:text-amber-400'
                }`}
              >
                {selectedExam.sittings.find((s) => s.sittingName === 'Afternoon Sitting')
                  ? selectedExam.sittings.find((s) => s.sittingName === 'Afternoon Sitting')
                      ?.selectedSetNumber || 'Not Selected'
                  : 'Not Configured'}
              </span>
            </div>
          </div>

          {/* Question-Set Availability Table */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
              Published Numbered Question Sets ({selectedExam.questionSets.length})
            </h2>

            <div className="overflow-x-auto border border-[#D9E2EF] dark:border-[#334155] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F7FB] dark:bg-[#0F172A]/60 border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">Set Number</th>
                    <th className="py-4 px-5">Publication Status</th>
                    <th className="py-4 px-5">Number of Questions</th>
                    <th className="py-4 px-5">Selection Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155] text-sm">
                  {selectedExam.questionSets.map((qs) => {
                    const isPublishedAndActive =
                      qs.publicationStatus === 'Published by HOD' &&
                      qs.isActive !== false &&
                      !qs.supersededBySetId;
                    return (
                      <tr key={qs.setId}>
                        <td className="py-4 px-5 font-bold text-[#1F2937] dark:text-slate-100">
                          <div>{qs.setNumber}</div>
                          {qs.questionBankRevisionId && (
                            <div className="text-[11px] font-mono font-normal text-[#64748B] dark:text-slate-400 mt-0.5">
                              {qs.questionBankRevisionId}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <StatusIndicator
                            tone={isPublishedAndActive ? 'success' : 'warning'}
                            label={qs.publicationStatus}
                          />
                        </td>
                        <td className="py-4 px-5 font-mono text-[#1F2937] dark:text-slate-200">
                          {qs.numberOfQuestions} Questions
                        </td>
                        <td className="py-4 px-5">
                          <StatusIndicator
                            tone={qs.selectionStatus === 'Available' ? 'neutral' : 'info'}
                            label={qs.selectionStatus}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sitting Set Selection & Confirmation */}
          <div className="space-y-4 pt-4 border-t border-[#D9E2EF] dark:border-[#334155]">
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
              Confirm Question Set per Sitting
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {selectedExam.sittings.map((sitting) => {
                const pendingChoice = pendingSetChoices[sitting.sittingName];
                const confirmedSet = sitting.selectedSetNumber;
                return (
                  <div
                    key={sitting.sittingId}
                    className="p-6 rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/40 dark:bg-[#0F172A]/40 space-y-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[18px] font-bold text-[#1F2937] dark:text-slate-100">
                          {sitting.sittingName}:{' '}
                          <span
                            className={
                              confirmedSet
                                ? 'text-[#16834A] dark:text-emerald-400'
                                : 'text-[#B7791F] dark:text-amber-400'
                            }
                          >
                            {confirmedSet || 'Not Selected'}
                          </span>
                        </div>
                        <div className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
                          {sitting.labName} &middot; {sitting.studentCount} Students
                        </div>
                      </div>
                      <StatusIndicator
                        tone={confirmedSet ? 'success' : 'warning'}
                        label={confirmedSet ? `Confirmed: ${confirmedSet}` : 'Not Selected'}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2.5">
                        {selectedExam.questionSets.map((qs) => {
                          const setNum = qs.setNumber;
                          const isConfirmedForOtherSitting = selectedExam.sittings.some(
                            (s) => s.sittingName !== sitting.sittingName && s.selectedSetNumber === setNum
                          );
                          const isSelectable =
                            qs.publicationStatus === 'Published by HOD' &&
                            qs.isActive !== false &&
                            !qs.supersededBySetId &&
                            !isConfirmedForOtherSitting;
                          const isChosen = pendingChoice === setNum;
                          const isConfirmed = confirmedSet === setNum;
                          return (
                            <button
                              key={qs.setId}
                              type="button"
                              disabled={submitting || !isSelectable}
                              title={
                                isConfirmedForOtherSitting
                                  ? `${qs.setNumber} is already scheduled for another sitting`
                                  : isSelectable
                                    ? `${qs.setNumber} (${qs.numberOfQuestions} Qs)`
                                    : `${qs.setNumber} unavailable (${qs.publicationStatus})`
                              }
                              onClick={() =>
                                setPendingSetChoices((prev) => ({
                                  ...prev,
                                  [sitting.sittingName]: setNum,
                                }))
                              }
                              className={`min-w-[84px] py-2.5 px-4 rounded-lg text-sm font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                isChosen
                                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                  : isConfirmed
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-[#16834A] dark:text-emerald-300 border-[#16834A]'
                                    : 'bg-white dark:bg-[#1E293B] text-[#1F2937] dark:text-slate-200 border-[#D9E2EF] dark:border-[#334155] hover:border-[#2563EB]'
                              }`}
                            >
                              {setNum}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1 flex items-center justify-between gap-3">
                        <span className="text-xs text-[#64748B] dark:text-slate-400">
                          {pendingChoice
                            ? `Selected: ${pendingChoice}${
                                confirmedSet === pendingChoice ? ' (Confirmed)' : ''
                              }`
                            : 'Not Selected'}
                        </span>
                        <button
                          type="button"
                          disabled={
                            submitting ||
                            !pendingChoice ||
                            selectedExam.status === 'Cancelled'
                          }
                          onClick={() =>
                            handleConfirmQuestionSetForSitting(sitting.sittingName)
                          }
                          className="px-4 py-2.5 text-sm font-semibold text-white bg-[#16834A] hover:bg-green-700 disabled:opacity-40 rounded-lg cursor-pointer shrink-0"
                        >
                          Confirm Set &amp; Generate Versions A–D
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#D9E2EF] dark:border-[#334155] space-y-4">
                      <div>
                        <div className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider mb-3">
                          Version Generation Status
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {sitting.versions.map((ver) => (
                            <div
                              key={ver.version}
                              className="p-3 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] flex items-center justify-between text-sm"
                            >
                              <span className="font-bold text-[#1F2937] dark:text-slate-100">
                                Version {ver.version}
                              </span>
                              <span
                                className={`text-[13px] font-semibold ${
                                  sitting.versionsGenerated
                                    ? 'text-[#16834A] dark:text-emerald-400'
                                    : 'text-[#64748B] dark:text-slate-400'
                                }`}
                              >
                                {sitting.versionsGenerated ? 'Generated' : 'Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {sitting.aggregateVersionCounts && (
                        <div className="p-3.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                              Aggregate USN Version Distribution
                            </span>
                            <span className="text-xs font-mono font-bold text-[#1F2937] dark:text-slate-100">
                              Total: {sitting.aggregateVersionCounts.total} Students
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {(['A', 'B', 'C', 'D'] as const).map((verKey) => (
                              <div
                                key={verKey}
                                className="py-1.5 px-2 rounded bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155]"
                              >
                                <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-semibold">
                                  Ver {verKey}
                                </div>
                                <div className="text-sm font-mono font-bold text-[#2563EB] dark:text-blue-400">
                                  {sitting.aggregateVersionCounts?.[verKey] ?? 0}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
                            CSPRNG balanced allocation keyed to Student ID / USN (no PC-number or USN-digit pattern; never exposed to HOD).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          SECTION 4: PACKAGE PREPARATION & LAB TRANSFER
         ======================================================================== */}
      {activeSection === 'package-transfer' && selectedExam && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
                Package Preparation &amp; Lab Transfer
              </h1>
              <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5">
                Prepare and send each sitting&apos;s examination package to its assigned Lab Server and monitor verification readiness.
              </p>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              selectedExam.sittings.length > 1 ? 'xl:grid-cols-2' : ''
            } gap-6`}
          >
            {selectedExam.sittings.map((sit) => {
              const pkg = livePackageStages[sit.sittingName] || sit.packageInfo;
              const isBusy = Boolean(inFlightSittings[sit.sittingName]);
              const missingPrereqs = getPackagePrerequisitesMissing(selectedExam, sit);
              const isOutdated = isSittingPackageOutdated(selectedExam, sit);
              const isReady =
                pkg.verificationReadinessStatus === 'Ready for Examination' &&
                !isOutdated;
              const canRetryTransfer =
                !isOutdated &&
                pkg.preparationStatus === 'Completed' &&
                pkg.securityStatus === 'Package Secured' &&
                Boolean(pkg.packageId) &&
                (pkg.transferStatus === 'Transfer Failed' ||
                  pkg.transferStatus === 'Interrupted');

              const prepTone =
                pkg.preparationStatus === 'Completed'
                  ? 'success'
                  : pkg.preparationStatus === 'Failed'
                    ? 'danger'
                    : pkg.preparationStatus === 'Preparing'
                      ? 'info'
                      : 'neutral';

              const secTone =
                pkg.securityStatus === 'Package Secured'
                  ? 'success'
                  : pkg.securityStatus === 'Failed'
                    ? 'danger'
                    : pkg.securityStatus === 'Securing Package'
                      ? 'info'
                      : 'neutral';

              const transferTone =
                pkg.transferStatus === 'Received'
                  ? 'success'
                  : pkg.transferStatus === 'Transfer Failed' ||
                      pkg.transferStatus === 'Interrupted'
                    ? 'danger'
                    : pkg.transferStatus === 'Sending'
                      ? 'info'
                      : 'neutral';

              const verifyTone =
                pkg.verificationReadinessStatus === 'Ready for Examination' ||
                pkg.verificationReadinessStatus === 'Verified'
                  ? 'success'
                  : pkg.verificationReadinessStatus === 'Rejected'
                    ? 'danger'
                    : pkg.verificationReadinessStatus === 'Verifying'
                      ? 'info'
                      : 'warning';

              return (
                <div
                  key={sit.sittingId}
                  className="p-6 rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/40 dark:bg-[#0F172A]/40 space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-5">
                    {/* Card Header & Readiness Badge */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-4">
                      <div>
                        <h2 className="text-[19px] font-bold text-[#1F2937] dark:text-slate-100">
                          {sit.sittingName}
                        </h2>
                        <div className="text-xs font-mono text-[#64748B] dark:text-slate-400 mt-1">
                          Sitting ID: {sit.sittingId}
                          {pkg.packageRevision && pkg.packageRevision > 1
                            ? ` · Rev ${pkg.packageRevision}`
                            : ''}
                        </div>
                      </div>
                      {isReady ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold tracking-wide text-[#16834A] dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          READY FOR EXAMINATION
                        </span>
                      ) : (
                        <StatusIndicator
                          tone={getPackageStatusTone(getSittingPackageReadinessStatus(pkg))}
                          label={getSittingPackageReadinessStatus(pkg)}
                        />
                      )}
                    </div>

                    {/* Examination Information */}
                    <div className="p-4 rounded-xl bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155]">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-3">
                        Examination Information
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 text-sm">
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Examination
                          </dt>
                          <dd className="font-semibold text-[#1F2937] dark:text-slate-100">
                            {selectedExam.examCode}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Department &amp; Semester
                          </dt>
                          <dd className="font-semibold text-[#1F2937] dark:text-slate-100">
                            {selectedExam.department} · Semester {selectedExam.semester}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Subject
                          </dt>
                          <dd className="font-semibold text-[#1F2937] dark:text-slate-100">
                            {selectedExam.subjectCode} — {selectedExam.subjectName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Date &amp; Time
                          </dt>
                          <dd className="font-mono font-semibold text-[#1F2937] dark:text-slate-100">
                            {sit.examDate} · {formatTime24To12(sit.startTime)} (
                            {sit.durationMinutes}m)
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Assigned Laboratory
                          </dt>
                          <dd className="font-semibold text-[#1F2937] dark:text-slate-100">
                            {sit.labName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Selected Question Set
                          </dt>
                          <dd
                            className={`font-bold ${
                              sit.selectedSetNumber
                                ? 'text-[#16834A] dark:text-emerald-400'
                                : 'text-[#B7791F] dark:text-amber-400'
                            }`}
                          >
                            {sit.selectedSetNumber || 'Not Selected'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Assigned Students
                          </dt>
                          <dd className="font-mono font-bold text-[#1F2937] dark:text-slate-100">
                            {sit.assignedStudentUsns.length} Students
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            Advance PC Allocation
                          </dt>
                          <dd className="font-semibold text-[#16834A] dark:text-emerald-400">
                            Disabled (Dynamic Login Binding)
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#64748B] dark:text-slate-400">
                            USN Versions &amp; Offline Verifier
                          </dt>
                          <dd className="font-semibold text-[#1F2937] dark:text-slate-100">
                            {sit.aggregateVersionCounts
                              ? `A:${sit.aggregateVersionCounts.A} B:${sit.aggregateVersionCounts.B} C:${sit.aggregateVersionCounts.C} D:${sit.aggregateVersionCounts.D}`
                              : 'Pending Set Selection'}
                          </dd>
                        </div>
                        {pkg.packageId && (
                          <div className="sm:col-span-2">
                            <dt className="text-xs text-[#64748B] dark:text-slate-400">
                              Package ID
                            </dt>
                            <dd className="font-mono font-bold text-[#2563EB] dark:text-blue-400">
                              {pkg.packageId}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Outdated / Invalidated Warning */}
                    {pkg.invalidatedReason && (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-sm text-[#B7791F] dark:text-amber-300 leading-relaxed">
                        <strong>Package Revision Required:</strong>{' '}
                        {pkg.invalidatedReason}
                      </div>
                    )}

                    {/* Four Understandable Status Stages */}
                    <div className="p-4 rounded-xl bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#D9E2EF]/60 dark:border-[#334155]">
                        <span className="font-medium text-[#64748B] dark:text-slate-400">
                          1. Package Preparation
                        </span>
                        <StatusIndicator tone={prepTone} label={pkg.preparationStatus} />
                      </div>

                      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#D9E2EF]/60 dark:border-[#334155]">
                        <span className="font-medium text-[#64748B] dark:text-slate-400">
                          2. Package Security
                        </span>
                        <StatusIndicator tone={secTone} label={pkg.securityStatus} />
                      </div>

                      <div className="py-1.5 border-b border-[#D9E2EF]/60 dark:border-[#334155] space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[#64748B] dark:text-slate-400">
                            3. Transfer and Receipt
                          </span>
                          <StatusIndicator
                            tone={transferTone}
                            label={
                              pkg.transferStatus === 'Sending' &&
                              typeof pkg.transferProgressPercent === 'number'
                                ? `Sending (${pkg.transferProgressPercent}%)`
                                : pkg.transferStatus
                            }
                          />
                        </div>
                        {pkg.transferStatus === 'Sending' &&
                          typeof pkg.transferProgressPercent === 'number' && (
                            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-[#2563EB] transition-all duration-200"
                                style={{
                                  width: `${Math.min(100, Math.max(5, pkg.transferProgressPercent))}%`,
                                }}
                              />
                            </div>
                          )}
                      </div>

                      <div className="flex items-center justify-between gap-3 py-1.5">
                        <span className="font-medium text-[#64748B] dark:text-slate-400">
                          4. Lab Server Verification &amp; Readiness
                        </span>
                        <StatusIndicator
                          tone={verifyTone}
                          label={pkg.verificationReadinessStatus}
                        />
                      </div>
                    </div>

                    {/* Prerequisite Blocker or Operational Failure / Success Message */}
                    {missingPrereqs.length > 0 && (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-[#B7791F] dark:text-amber-300 leading-relaxed">
                        <strong>Action Unavailable:</strong> {missingPrereqs[0]}
                      </div>
                    )}

                    {pkg.failureReason && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-[#B42318] dark:text-red-300 leading-relaxed">
                        <strong>Status Detail:</strong> {pkg.failureReason}
                      </div>
                    )}

                    {!pkg.failureReason && pkg.statusMessage && (
                      <div
                        className={`p-3.5 rounded-xl border text-sm leading-relaxed ${
                          isReady
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-[#16834A] dark:text-emerald-300 font-medium'
                            : 'bg-[#F5F7FB] dark:bg-[#0F172A]/60 border-[#D9E2EF] dark:border-[#334155] text-[#64748B] dark:text-slate-300'
                        }`}
                      >
                        {pkg.statusMessage}
                      </div>
                    )}
                  </div>

                  {/* Operational Actions: Prepare & Send to Lab + Conditional Retry Transfer */}
                  <div className="pt-5 border-t border-[#D9E2EF] dark:border-[#334155] flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={
                        isBusy ||
                        submitting ||
                        missingPrereqs.length > 0 ||
                        isReady
                      }
                      onClick={() => handlePrepareAndSendToLab(sit.sittingName)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {isBusy ? 'Processing Transfer...' : 'Prepare & Send to Lab'}
                    </button>

                    {canRetryTransfer && (
                      <button
                        type="button"
                        disabled={isBusy || submitting || selectedExam.status === 'Cancelled'}
                        onClick={() => handleRetryTransfer(sit.sittingName)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#16834A] hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry Transfer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-Sitting Invigilator Session Unlock Passwords */}
          <div className="pt-4 border-t border-[#D9E2EF] dark:border-[#334155] space-y-4">
            <div>
              <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                Invigilator Session Unlock Passwords
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Generate, regenerate, or revoke sitting-specific Invigilator Session Unlock Passwords (salted verifier synced to the Lab Server for offline suspicious-activity unlock verification).
              </p>
            </div>
            <div
              className={`grid grid-cols-1 ${
                selectedExam.sittings.length > 1 ? 'xl:grid-cols-2' : ''
              } gap-6`}
            >
              {selectedExam.sittings.map((sit) => {
                const cred = sessionUnlockCredentials.find(
                  (c) =>
                    (String(c.examinationId) === String(selectedExam.id) || String((c as any).examination_id) === String(selectedExam.id)) &&
                    (c.sittingId === sit.sittingId ||
                     c.sittingId === sit.sittingName ||
                     c.sittingName === sit.sittingName ||
                     (c as any).sitting_name === sit.sittingName ||
                     (sit.sittingName && c.sittingName?.toLowerCase() === sit.sittingName.toLowerCase()))
                );
                const labServer = labServers.find((l) => l.id === sit.labId);
                const monitorForSit = monitors.find(
                  (m) =>
                    m.examinationId === selectedExam.id &&
                    m.sessionId === sit.sittingId
                );
                return (
                  <SessionUnlockCredentialPanel
                    key={`cred-${sit.sittingId}`}
                    examination={selectedExam}
                    sitting={sit}
                    credential={cred}
                    isLabConnected={labServer?.connectionStatus === 'Connected'}
                    sessionStatus={monitorForSit?.sessionStatus}
                    onRefresh={refreshAll}
                    onNotify={notify}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          CONFIRMATION DIALOGS: AUTHORISED REVISION / DELETE DRAFT / CANCEL EXAM
         ======================================================================== */}
      <ConfirmDialog
        open={Boolean(pendingRevisionExam)}
        title="Authorised Schedule Revision Required"
        description={
          pendingRevisionExam
            ? `An examination package for ${pendingRevisionExam.examCode} (${pendingRevisionExam.subjectName}) has already been transferred to the Lab Server. Ordinary editing is blocked.`
            : ''
        }
        consequenceNote="Proceeding opens an authorised pre-examination schedule revision. Saving changes will invalidate the previous Lab Server package, increment the examination revision, update snapshot and session references, and require new package preparation and Lab Server verification."
        confirmLabel="Proceed with Authorised Revision"
        variant="primary"
        onCancel={() => setPendingRevisionExam(null)}
        onConfirm={() => {
          if (pendingRevisionExam) {
            populateFormFromExam(pendingRevisionExam, true);
          }
          setPendingRevisionExam(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTargetExam)}
        title="Delete Draft Examination"
        description={
          deleteTargetExam
            ? `Permanently delete draft examination ${deleteTargetExam.examCode} (${deleteTargetExam.subjectCode} — ${deleteTargetExam.subjectName})?`
            : ''
        }
        consequenceNote="This draft examination has not been frozen or transferred. Deleting removes the draft schedule record and logs the deletion in Audit Logs."
        confirmLabel="Delete Draft Examination"
        variant="destructive"
        loading={submitting}
        onCancel={() => setDeleteTargetExam(null)}
        onConfirm={handleConfirmDeleteDraft}
      />

      {(activeSection === 'sitting-arrangements' ||
        activeSection === 'set-selection' ||
        activeSection === 'package-transfer') &&
        !selectedExam && (
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-10 text-center space-y-3 shadow-xs">
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
              No Scheduled Examination Selected
            </h2>
            <p className="text-sm text-[#64748B] dark:text-slate-400 max-w-lg mx-auto">
              Create or select an examination in Examination Details before managing sitting arrangements, question sets, or lab packages.
            </p>
            <button
              type="button"
              onClick={() => navigate('/schedule?section=examination-details')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Open Examination Details
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      <ConfirmDialog
        open={Boolean(cancelTargetExam)}
        title="Cancel Scheduled Examination"
        description={
          cancelTargetExam
            ? `Cancel ${cancelTargetExam.examCode} (${cancelTargetExam.subjectCode} — ${cancelTargetExam.subjectName})? Enter a mandatory institutional reason below.`
            : ''
        }
        consequenceNote="Cancelling marks the examination as Cancelled, invalidates any prepared or unstarted Lab Server packages, releases booked laboratory slots, and permanently preserves cancellation history in Audit Logs."
        confirmLabel="Confirm Cancellation"
        variant="destructive"
        loading={submitting}
        confirmDisabled={cancelReason.trim().length < 5}
        onCancel={() => {
          setCancelTargetExam(null);
          setCancelReason('');
        }}
        onConfirm={handleConfirmCancelExam}
      >
        <div>
          <label
            htmlFor="coe-cancel-reason"
            className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2"
          >
            Mandatory Cancellation Reason <span className="text-[#B42318]">*</span>
          </label>
          <textarea
            id="coe-cancel-reason"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter official reason for cancelling this examination..."
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-slate-800 text-[#1F2937] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
          />
          {cancelReason.trim().length > 0 && cancelReason.trim().length < 5 && (
            <p className="mt-1 text-xs font-medium text-[#B42318] dark:text-red-400">
              Please enter at least 5 characters explaining the cancellation.
            </p>
          )}
        </div>
      </ConfirmDialog>

      {/* ========================================================================
          QUESTION PAPER ARCHIVE INSPECTION & OFFICIAL PDF DOWNLOAD MODAL
         ======================================================================== */}
      {inspectingArchive && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/65 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-modal-title"
        >
          <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl max-w-3xl w-full p-6 sm:p-7 shadow-xl space-y-6 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#D9E2EF] dark:border-[#334155] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {inspectingArchive.examCode}
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#64748B] dark:text-slate-400">
                    {inspectingArchive.sittingName} ({inspectingArchive.sittingId})
                  </span>
                </div>
                <h3
                  id="archive-modal-title"
                  className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-2"
                >
                  Original Selected Question Paper Archive
                </h3>
                <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
                  Frozen snapshot preserved prior to A/B/C/D version shuffling. Generated and verified by the Central Java Backend.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingArchive(null)}
                aria-label="Close archive inspection dialog"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1F2937] dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="p-3.5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-xs font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  Department &amp; Semester
                </div>
                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                  {inspectingArchive.departmentName} ({inspectingArchive.department}) &middot;{' '}
                  {formatSemesterLabel(inspectingArchive.semester)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-xs font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  Subject
                </div>
                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                  {inspectingArchive.subjectCode} — {inspectingArchive.subjectName}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-xs font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  Examination Date &amp; Sitting
                </div>
                <div className="font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                  {inspectingArchive.examDate} &middot; {inspectingArchive.startTime} (
                  {inspectingArchive.durationMinutes} mins)
                </div>
                <div className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  {inspectingArchive.labName}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-xs font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  Selected Numbered Set
                </div>
                <div className="font-bold text-[#2563EB] dark:text-blue-400 mt-1">
                  {inspectingArchive.selectedSetNumber || 'Frozen Set'}
                  {inspectingArchive.selectedSetRevision
                    ? ` (${inspectingArchive.selectedSetRevision})`
                    : ''}
                </div>
                {inspectingArchive.snapshotId && (
                  <div className="text-xs font-mono text-[#64748B] dark:text-slate-400 mt-0.5">
                    Snapshot: {inspectingArchive.snapshotId}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-xs font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  Question Count &amp; Max Marks
                </div>
                <div className="font-mono font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                  {inspectingArchive.questionCount} Questions &middot;{' '}
                  {inspectingArchive.maximumMarks} Marks
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155]">
                <div className="text-xs font-semibold uppercase text-[#64748B] dark:text-slate-400">
                  Archive Creation Timestamp
                </div>
                <div className="font-mono font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                  {inspectingArchive.archivedAt || 'Recorded by Backend'}
                </div>
              </div>
            </div>

            {/* Preserved A/B/C/D Shuffled Version Records (derived from the frozen original set) */}
            {inspectingArchive.preservedVersions &&
              inspectingArchive.preservedVersions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#1F2937] dark:text-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2563EB]" />
                      Preserved A / B / C / D Student Version Mappings
                    </h4>
                    <span className="text-xs text-[#64748B] dark:text-slate-400">
                      Stable question IDs retained across versions
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {inspectingArchive.preservedVersions.map((ver) => (
                      <div
                        key={ver.version}
                        className="p-3.5 rounded-xl border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB]/60 dark:bg-[#0F172A]/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                            Version {ver.version}
                          </span>
                          <span className="text-xs font-mono font-semibold text-[#2563EB] dark:text-blue-400">
                            {ver.questionCount} Qs
                          </span>
                        </div>
                        <div className="text-xs text-[#64748B] dark:text-slate-400">
                          Source: {ver.numberedSetLabel}
                        </div>
                        {typeof ver.allocatedStudentCount === 'number' && (
                          <div className="text-xs font-mono text-[#16834A] dark:text-emerald-400">
                            Allocated: {ver.allocatedStudentCount} Student(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Download Actions */}
            <div className="pt-4 border-t border-[#D9E2EF] dark:border-[#334155] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#64748B] dark:text-slate-400">
                The complete question set archive includes all {inspectingArchive.questionCount} questions across modules with official answers and evaluation scheme.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={
                    downloadingArchiveKey === `${inspectingArchive.sittingId}-excel`
                  }
                  onClick={() => handleDownloadArchiveExcel(inspectingArchive)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {downloadingArchiveKey === `${inspectingArchive.sittingId}-excel`
                    ? 'Generating Excel Workbook...'
                    : 'Download Complete Set (.xlsx)'}
                </button>

                <button
                  type="button"
                  disabled={
                    downloadingArchiveKey === `${inspectingArchive.sittingId}-docx`
                  }
                  onClick={() => handleDownloadArchiveDocx(inspectingArchive)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-[#2563EB] dark:text-blue-300 hover:bg-blue-100/70 disabled:opacity-50 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  {downloadingArchiveKey === `${inspectingArchive.sittingId}-docx`
                    ? 'Generating Word...'
                    : 'Download Word (.docx)'}
                </button>

                <button
                  type="button"
                  disabled={
                    downloadingArchiveKey === `${inspectingArchive.sittingId}-paper`
                  }
                  onClick={() => handleDownloadArchivePdf(inspectingArchive, 'paper')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100 hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {downloadingArchiveKey === `${inspectingArchive.sittingId}-paper`
                    ? 'Downloading PDF...'
                    : 'Question Paper (PDF)'}
                </button>

                {inspectingArchive.restrictedAnswerKeyAvailable && (
                  <button
                    type="button"
                    disabled={
                      downloadingArchiveKey === `${inspectingArchive.sittingId}-answer-key`
                    }
                    onClick={() =>
                      handleDownloadArchivePdf(inspectingArchive, 'answer-key')
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-[#B7791F] dark:text-amber-300 hover:bg-amber-100/70 disabled:opacity-50 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    {downloadingArchiveKey ===
                    `${inspectingArchive.sittingId}-answer-key`
                      ? 'Downloading...'
                      : 'Answer Key (PDF)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    
      {/* Quick Add Laboratory Modal */}
      {showQuickAddLabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#2563EB]" />
                Add Laboratory ({quickAddLabForSitting === 'morning' ? 'Morning Sitting' : 'Afternoon Sitting'})
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickAddLabModal(false)}
                className="text-[#64748B] hover:text-[#1F2937] dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddLab} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                  Laboratory Name *
                </label>
                <input
                  type="text"
                  required
                  value={quickAddLabName}
                  onChange={(e) => setQuickAddLabName(e.target.value)}
                  placeholder="e.g. Computer Science Lab 2"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                  Number of Seats / PCs Available *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quickAddLabCapacity}
                  onChange={(e) => setQuickAddLabCapacity(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 40"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddLabModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#64748B] hover:text-[#1F2937] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuickAddLab}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs disabled:opacity-50"
                >
                  {submittingQuickAddLab ? 'Saving Lab...' : 'Save Laboratory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
</div>
  );
};
