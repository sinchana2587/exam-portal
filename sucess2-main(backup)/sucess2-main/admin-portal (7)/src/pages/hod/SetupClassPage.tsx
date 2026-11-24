import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileUp,
  GraduationCap,
  History,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { parseValidSemester, useHodSemester } from '../../hooks/useHodSemester';
import { ApiClientError } from '../../services/apiClient';
import { subjectService } from '../../services/subjectService';
import {
  AcademicContextData,
  studentService,
} from '../../services/studentService';
import {
  downloadStudentExcelTemplate,
  parseAndValidateStudentExcel,
  StudentExcelParseResult,
} from '../../utils/fileHandlers';
import {
  convertStudentDocumentInBrowser,
  downloadBrowserStudentExcel,
  revalidateStudentSessionInBrowser,
} from '../../utils/browserStudentConverter';
import { BrowserDocumentError } from '../../utils/browserPdfOcr';
import { MASTER_SEMESTER_OPTIONS } from '../../utils/semesterOptions';
import {
  ConversionLifecycleStatus,
  EligibleStudent,
  ExtractedStudentPreviewRow,
  StudentConversionSession,
  StudentListRevision,
  Subject,
} from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { ConversionStatusBadge } from '../../components/ConversionStatusBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const SetupClassPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSemester, setSelectedSemester } = useHodSemester();

  const initialTab = searchParams.get('tab') === 'students' ? 'students' : 'subjects';
  const [activeTab, setActiveTab] = useState<'subjects' | 'students'>(initialTab);

  const [context, setContext] = useState<AcademicContextData | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const loadSeqRef = useRef(0);

  // Add Section dialog state (Student Lists tab only)
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [addSectionError, setAddSectionError] = useState('');

  // Delete Section dialog state
  const [deleteSectionModalOpen, setDeleteSectionModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  const [deleteSectionError, setDeleteSectionError] = useState<string | null>(null);
  const [confirmWithStudents, setConfirmWithStudents] = useState(false);

  // Student Semester Promotion / Graduation state
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [targetPromoteSection, setTargetPromoteSection] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState('');

  const [graduateModalOpen, setGraduateModalOpen] = useState(false);
  const [graduating, setGraduating] = useState(false);
  const [graduateError, setGraduateError] = useState('');

  // Subject CRUD state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [viewingSubject, setViewingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    moduleCount: 5,
  });
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [deleteTargetSubject, setDeleteTargetSubject] = useState<Subject | null>(null);

  // Student Lists state
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [revisions, setRevisions] = useState<StudentListRevision[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Excel upload state
  const [excelResult, setExcelResult] = useState<StudentExcelParseResult | null>(null);
  const [excelSourceType, setExcelSourceType] = useState<'EXCEL_UPLOAD' | 'PDF_CONVERTED_EXCEL'>('EXCEL_UPLOAD');
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [savingList, setSavingList] = useState(false);

  // PDF/Image-to-Excel converter state (Converter A — 100% frontend-only)
  const [convSession, setConvSession] = useState<StudentConversionSession | null>(null);
  const [convStatus, setConvStatus] = useState<ConversionLifecycleStatus>('WAITING_FOR_FILE');
  const [convStatusMsg, setConvStatusMsg] = useState<string>('');
  const [convProgress, setConvProgress] = useState<number | undefined>(undefined);
  const [convFileName, setConvFileName] = useState('');
  const [convRevalidating, setConvRevalidating] = useState(false);
  const [convDownloading, setConvDownloading] = useState(false);
  const convValidationSeq = React.useRef(0);
  const convDebounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Individual Student modal state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EligibleStudent | null>(null);
  const [studentForm, setStudentForm] = useState({ usn: '', studentName: '', dob: '' });
  const [studentFormSaving, setStudentFormSaving] = useState(false);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<EligibleStudent | null>(null);

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab === 'students' || paramTab === 'subjects') {
      setActiveTab(paramTab);
    }
    const nextSem = parseValidSemester(searchParams.get('semester'));
    if (nextSem !== null && nextSem !== selectedSemester) {
      setSelectedSemester(nextSem);
    } else if (nextSem === null) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('semester', String(selectedSemester));
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedSemester, setSelectedSemester, setSearchParams]);

  const handleSemesterChange = (nextSem: number) => {
    setSelectedSemester(nextSem);
    setSubjects([]);
    setSelectedSection('');
    setRevisions([]);
    setExcelResult(null);
    setLoadError(null);
    setFeedback(null);
    resetConverterState();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('semester', String(nextSem));
    setSearchParams(nextParams, { replace: true });
  };

  const switchTab = (tab: 'subjects' | 'students') => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.set('semester', String(selectedSemester));
    setSearchParams(nextParams, { replace: true });
    setFeedback(null);
  };

  const loadContextAndSubjects = useCallback(async (signal?: AbortSignal) => {
    if (!user?.departmentId) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [ctx, subjs] = await Promise.all([
        studentService.getAcademicContext(user.departmentId),
        subjectService.getDepartmentSubjects(user.departmentId, selectedSemester, signal),
      ]);
      if (seq !== loadSeqRef.current || signal?.aborted) return;
      setContext(ctx);
      setSubjects(subjs.filter((s) => s.semesterNumber === selectedSemester));

      const semSections = ctx.departmentSections
        .filter((s) => s.semesterNumber === selectedSemester)
        .map((s) => s.name);
      setSelectedSection((prev) => {
        if (semSections.length === 0) return '';
        if (prev && semSections.includes(prev)) return prev;
        return semSections[0];
      });
    } catch (err) {
      if (seq !== loadSeqRef.current || signal?.aborted) return;
      if (err instanceof ApiClientError && err.code === 'REQUEST_ABORTED') return;
      setSubjects([]);
      setLoadError(err instanceof Error ? err.message : 'Unable to load class setup.');
    } finally {
      if (seq === loadSeqRef.current && !signal?.aborted) {
        setLoading(false);
      }
    }
  }, [user?.departmentId, selectedSemester]);

  useEffect(() => {
    const controller = new AbortController();
    void loadContextAndSubjects(controller.signal);
    return () => controller.abort();
  }, [loadContextAndSubjects]);

  const semesterSections = useMemo(() => {
    if (!context) return [];
    const names = context.departmentSections
      .filter((s) => s.semesterNumber === selectedSemester)
      .map((s) => s.name);
    return Array.from(new Set(names));
  }, [context, selectedSemester]);

  const loadSectionStudents = useCallback(async () => {
    if (!user?.departmentId || !selectedSection) {
      setRevisions([]);
      setStudentsError(null);
      return;
    }
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const revs = await studentService.getSectionRevisions(
        user.departmentId,
        selectedSemester,
        selectedSection
      );
      setRevisions(revs);
    } catch (err) {
      setRevisions([]);
      setStudentsError(err instanceof Error ? err.message : 'Unable to load student lists.');
    } finally {
      setStudentsLoading(false);
    }
  }, [user?.departmentId, selectedSemester, selectedSection]);

  useEffect(() => {
    if (activeTab === 'students') {
      loadSectionStudents();
    }
  }, [activeTab, loadSectionStudents]);

  const currentRevision = useMemo(
    () => revisions.find((r) => r.status === 'Active' || r.status === 'Frozen by COE') || null,
    [revisions]
  );
  const isRosterFrozen = currentRevision?.status === 'Frozen by COE';
  const currentAcademicYearId =
    context?.academicYears.find((a) => a.isCurrent)?.id || context?.academicYears[0]?.id || '';

  const handleOpenAddSectionModal = () => {
    setNewSectionName('');
    setAddSectionError('');
    setAddSectionModalOpen(true);
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const clean = newSectionName.trim();
    if (!clean) {
      setAddSectionError('Section Name is required.');
      return;
    }
    setAddingSection(true);
    setAddSectionError('');
    setFeedback(null);
    try {
      const created = await studentService.addSectionToSemester(
        selectedSemester,
        clean,
        user
      );
      setNewSectionName('');
      setAddSectionModalOpen(false);
      setSelectedSection(created.name);
      await loadContextAndSubjects();
      setFeedback({
        type: 'success',
        text: `Added "${created.name}" to Semester ${selectedSemester}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to add section.';
      setAddSectionError(msg);
    } finally {
      setAddingSection(false);
    }
  };

  const handleOpenDeleteSectionModal = (secName: string) => {
    setSectionToDelete(secName);
    setDeleteSectionError(null);
    setConfirmWithStudents(false);
    setDeleteSectionModalOpen(true);
  };

  const handleDeleteSection = async () => {
    if (!user || !sectionToDelete) return;
    setDeletingSection(true);
    setDeleteSectionError(null);
    try {
      await studentService.deleteSectionFromSemester(
        selectedSemester,
        sectionToDelete,
        user,
        confirmWithStudents
      );
      const deleted = sectionToDelete;
      setDeleteSectionModalOpen(false);
      setSectionToDelete(null);
      setConfirmWithStudents(false);
      const remainingSections = semesterSections.filter((s) => s !== deleted);
      setSelectedSection(remainingSections.length > 0 ? remainingSections[0] : '');
      await loadContextAndSubjects();
      setFeedback({
        type: 'success',
        text: `Deleted "${deleted}" from Semester ${selectedSemester}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete section.';
      setDeleteSectionError(msg);
      if (msg.toLowerCase().includes('enrolled student') || msg.toLowerCase().includes('confirm')) {
        setConfirmWithStudents(true);
      }
    } finally {
      setDeletingSection(false);
    }
  };

  // Subject Handlers
  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      code: '',
      name: '',
      moduleCount: 5,
    });
    setSubjectModalOpen(true);
  };

  const openEditSubject = (subj: Subject) => {
    setEditingSubject(subj);
    setSubjectForm({
      code: subj.code,
      name: subj.name,
      moduleCount: subj.moduleCount,
    });
    setSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubjectSaving(true);
    setFeedback(null);
    try {
      if (editingSubject) {
        await subjectService.updateSubject(
          editingSubject.id,
          {
            code: subjectForm.code,
            name: subjectForm.name,
            moduleCount: subjectForm.moduleCount,
          },
          user
        );
        setFeedback({ type: 'success', text: `Updated subject ${subjectForm.code}.` });
      } else {
        await subjectService.createSubject(
          {
            code: subjectForm.code,
            name: subjectForm.name,
            semesterNumber: selectedSemester,
            academicYearId: currentAcademicYearId,
            moduleCount: subjectForm.moduleCount,
          },
          user
        );
        setFeedback({ type: 'success', text: `Created subject ${subjectForm.code}.` });
      }
      setSubjectModalOpen(false);
      await loadContextAndSubjects();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save subject.',
      });
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleToggleSubjectStatus = async (subj: Subject) => {
    if (!user) return;
    const next = subj.status === 'Active' ? 'Archived' : 'Active';
    try {
      await subjectService.changeSubjectStatus(subj.id, next, user);
      setFeedback({
        type: 'success',
        text: `${subj.code} marked as ${next}.`,
      });
      await loadContextAndSubjects();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to change subject status.',
      });
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!user || !deleteTargetSubject) return;
    const target = deleteTargetSubject;
    try {
      await subjectService.deleteSubject(target.id, user);
      setSubjects((prev) => prev.filter((s) => s.id !== target.id));
      setFeedback({
        type: 'success',
        text: `Safely archived subject ${target.code} — ${target.name}. Historical examination data preserved.`,
      });
      setDeleteTargetSubject(null);
      await loadContextAndSubjects();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Cannot archive subject.',
      });
      setDeleteTargetSubject(null);
    }
  };

  const resetConverterState = useCallback(() => {
    if (convDebounceTimer.current) {
      clearTimeout(convDebounceTimer.current);
      convDebounceTimer.current = null;
    }
    convValidationSeq.current += 1;
    setConvSession(null);
    setConvStatus('WAITING_FOR_FILE');
    setConvStatusMsg('');
    setConvProgress(undefined);
    setConvFileName('');
    setConvRevalidating(false);
    setConvDownloading(false);
  }, []);

  // Excel Student Upload Handlers
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.departmentId || !user.departmentCode || !selectedSection) return;

    setFeedback(null);
    const result = await parseAndValidateStudentExcel(file, {
      departmentId: user.departmentId,
      departmentCode: user.departmentCode,
      semesterNumber: selectedSemester,
      section: selectedSection,
    });
    const isConvertedExcel =
      file.name.includes('_Student_List') || file.name.startsWith('Converted_');
    setExcelSourceType(isConvertedExcel ? 'PDF_CONVERTED_EXCEL' : 'EXCEL_UPLOAD');
    setExcelResult(result);
  };

  const handleCommitStudentList = async () => {
    if (!user || !excelResult || !selectedSection) return;
    setSavingList(true);
    try {
      const saved = await studentService.saveOrReplaceStudentList(
        {
          academicYearId: currentAcademicYearId,
          semesterNumber: selectedSemester,
          section: selectedSection,
          fileName: excelResult.fileName,
          sourceType: excelSourceType,
          rows: excelResult.rows,
          isReplacement: Boolean(currentRevision),
        },
        user
      );
      const count = saved.validCount ?? (saved as any)?.uploadedCount ?? excelResult.validCount;
      const revNum = saved.revisionNumber ?? 'R1';
      setFeedback({
        type: 'success',
        text: `Saved ${count} eligible students for Semester ${selectedSemester} ${selectedSection} (${revNum}).`,
      });
      setExcelResult(null);
      setConfirmUploadOpen(false);
      await loadSectionStudents();
    } catch (err) {
      setConfirmUploadOpen(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save student list.',
      });
    } finally {
      setSavingList(false);
    }
  };

  const mapErrorToConversionStatus = (err: unknown): { status: ConversionLifecycleStatus; message: string } => {
    if (err instanceof BrowserDocumentError) {
      if (err.code === 'UNSUPPORTED_FORMAT') return { status: 'UNSUPPORTED_FORMAT', message: err.message };
      if (err.code === 'PROCESSING_TIMEOUT') return { status: 'PROCESSING_TIMEOUT', message: err.message };
      return { status: 'CORRUPTED_DOCUMENT', message: err.message };
    }
    return {
      status: 'CORRUPTED_DOCUMENT',
      message: err instanceof Error ? err.message : 'Document conversion failed.',
    };
  };

  // Converter A: 100% Frontend-Only Student List PDF/Image-to-Excel Conversion Handlers
  const handlePdfUploadForConversion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.departmentId || !user.departmentCode || !selectedSection) return;

    if (convDebounceTimer.current) {
      clearTimeout(convDebounceTimer.current);
      convDebounceTimer.current = null;
    }

    const seq = ++convValidationSeq.current;
    setConvSession(null);
    setConvFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    setConvProgress(3);
    setConvStatus('PROCESSING');
    setConvStatusMsg('Reading file locally in browser (100% client-side, zero backend calls)...');

    try {
      let existingConflicts: Record<string, string> = {};
      try {
        existingConflicts = await studentService.getAllCrossSectionUsnConflicts(
          user.departmentId,
          selectedSemester,
          selectedSection
        );
      } catch {
        // Local conversion proceeds normally even if backend conflict lookup is disconnected
        existingConflicts = {};
      }
      if (seq !== convValidationSeq.current) return;

      const session = await convertStudentDocumentInBrowser({
        file,
        hodUserId: user.id,
        departmentId: user.departmentId,
        departmentCode: user.departmentCode,
        semesterNumber: selectedSemester,
        section: selectedSection,
        existingUsnConflicts: existingConflicts,
        onProgress: (ev) => {
          if (seq !== convValidationSeq.current) return;
          setConvProgress(ev.percent);
          setConvStatusMsg(ev.message);
          if (ev.phase === 'RUNNING_OCR' || ev.phase === 'EXTRACTING_TEXT') {
            setConvStatus('EXTRACTING_TEXT');
          } else if (ev.phase === 'PARSING' || ev.phase === 'FINALIZING') {
            setConvStatus('EXTRACTING_TABLES');
          } else {
            setConvStatus('PROCESSING');
          }
        },
      });

      if (seq !== convValidationSeq.current) return;
      setConvProgress(100);
      setConvSession(session);
      setConvStatus(session.status);
      setConvStatusMsg(session.statusMessage);
    } catch (err) {
      if (seq !== convValidationSeq.current) return;
      setConvProgress(undefined);
      const mapped = mapErrorToConversionStatus(err);
      setConvStatus(mapped.status);
      setConvStatusMsg(mapped.message);
    }
  };

  const syncStudentSessionRecords = useCallback(
    async (
      sessionToSync: StudentConversionSession,
      nextRecords: ExtractedStudentPreviewRow[],
      nextSectionConfirmed: boolean
    ) => {
      if (!user?.departmentId || !selectedSection) return;
      const seq = ++convValidationSeq.current;
      setConvRevalidating(true);
      setConvStatus('VALIDATION_PENDING');
      setConvStatusMsg('Revalidating edited student records locally...');

      try {
        const usns = nextRecords.map((r) => r.usn.trim().toUpperCase()).filter(Boolean);
        let existingConflicts: Record<string, string> = {};
        try {
          existingConflicts = await studentService.findCrossSectionOrDeptUsnConflicts(
            user.departmentId,
            selectedSemester,
            selectedSection,
            usns
          );
        } catch {
          existingConflicts = {};
        }
        const updated = revalidateStudentSessionInBrowser(
          sessionToSync,
          nextRecords,
          existingConflicts,
          nextSectionConfirmed
        );
        if (seq !== convValidationSeq.current) return;
        setConvSession(updated);
        setConvStatus(updated.status);
        setConvStatusMsg(updated.statusMessage);
      } catch (err) {
        if (seq !== convValidationSeq.current) return;
        const mapped = mapErrorToConversionStatus(err);
        setConvStatus(mapped.status);
        setConvStatusMsg(mapped.message);
      } finally {
        if (seq === convValidationSeq.current) {
          setConvRevalidating(false);
        }
      }
    },
    [user, selectedSemester, selectedSection]
  );

  const scheduleStudentRecordSync = useCallback(
    (sessionSnapshot: StudentConversionSession, nextRecords: ExtractedStudentPreviewRow[], confirmed: boolean) => {
      if (convDebounceTimer.current) {
        clearTimeout(convDebounceTimer.current);
      }
      setConvRevalidating(true);
      convDebounceTimer.current = setTimeout(() => {
        syncStudentSessionRecords(sessionSnapshot, nextRecords, confirmed);
      }, 280);
    },
    [syncStudentSessionRecords]
  );

  const handleStudentRowEdit = (
    idx: number,
    field: 'usn' | 'studentName' | 'dob',
    value: string
  ) => {
    if (!convSession) return;
    const nextRecords = convSession.records.map((r, i) =>
      i === idx
        ? {
            ...r,
            [field]: field === 'usn' ? value.toUpperCase() : value,
          }
        : r
    );
    const updatedLocal: StudentConversionSession = {
      ...convSession,
      records: nextRecords,
      downloadEligible: false,
    };
    setConvSession(updatedLocal);
    scheduleStudentRecordSync(updatedLocal, nextRecords, updatedLocal.sectionConfirmed);
  };

  const handleAddBlankStudentReviewRow = () => {
    if (!convSession) return;
    const nextNum = convSession.records.length + 1;
    const nextRecords: ExtractedStudentPreviewRow[] = [
      ...convSession.records,
      {
        tempId: `stu-manual-${Date.now()}-${nextNum}`,
        rowNumber: nextNum,
        usn: '',
        studentName: '',
        dob: '',
        isValid: false,
        uncertain: true,
        errors: ['Missing USN, Student Name, and DOB.'],
        invalidFields: { usn: true, studentName: true, dob: true },
        note: 'Enter USN, Student Name, and DOB.',
      },
    ];
    const nextSession = { ...convSession, records: nextRecords, downloadEligible: false };
    setConvSession(nextSession);
    syncStudentSessionRecords(nextSession, nextRecords, nextSession.sectionConfirmed);
  };

  const handleRemoveStudentReviewRow = (idx: number) => {
    if (!convSession) return;
    const nextRecords = convSession.records
      .filter((_, i) => i !== idx)
      .map((r, i) => ({ ...r, rowNumber: i + 1 }));
    const nextSession = { ...convSession, records: nextRecords, downloadEligible: false };
    setConvSession(nextSession);
    syncStudentSessionRecords(nextSession, nextRecords, nextSession.sectionConfirmed);
  };

  const handleApplySuggestedCorrection = (idx: number, suggestion: string) => {
    if (!convSession) return;
    const row = convSession.records[idx];
    if (!row) return;
    const isUsn = /^4MH/i.test(suggestion);
    const field: 'usn' | 'dob' = isUsn ? 'usn' : 'dob';
    const nextRecords = convSession.records.map((r, i) =>
      i === idx ? { ...r, [field]: suggestion } : r
    );
    const nextSession = { ...convSession, records: nextRecords, downloadEligible: false };
    setConvSession(nextSession);
    syncStudentSessionRecords(nextSession, nextRecords, nextSession.sectionConfirmed);
  };

  const handleToggleSectionConfirmed = (checked: boolean) => {
    if (!convSession) return;
    const nextSession = { ...convSession, sectionConfirmed: checked, downloadEligible: false };
    setConvSession(nextSession);
    syncStudentSessionRecords(nextSession, nextSession.records, checked);
  };

  const handleDownloadConvertedExcel = async () => {
    if (!convSession || !convSession.downloadEligible || convRevalidating) return;
    setConvDownloading(true);
    try {
      await downloadBrowserStudentExcel(convSession);
    } catch (err) {
      setConvStatus('DOWNLOAD_FAILED');
      setConvStatusMsg(
        err instanceof Error
          ? err.message
          : 'Excel download failed. Correct any remaining validation errors and retry.'
      );
    } finally {
      setConvDownloading(false);
    }
  };

  const canDownloadConvertedExcel =
    Boolean(convSession?.downloadEligible) && !convRevalidating && !convDownloading;

  // Individual Student CRUD Handlers
  const handleSaveIndividualStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSection) return;
    setStudentFormSaving(true);
    setFeedback(null);
    try {
      if (editingStudent && currentRevision) {
        await studentService.updateIndividualStudent(
          currentRevision.id,
          editingStudent.id,
          studentForm,
          user
        );
        setFeedback({ type: 'success', text: `Updated student ${studentForm.usn.toUpperCase()}.` });
      } else {
        await studentService.addIndividualStudent(
          {
            academicYearId: currentAcademicYearId,
            semesterNumber: selectedSemester,
            section: selectedSection,
            usn: studentForm.usn,
            studentName: studentForm.studentName,
            dob: studentForm.dob,
          },
          user
        );
        setFeedback({ type: 'success', text: `Added student ${studentForm.usn.toUpperCase()}.` });
      }
      setStudentModalOpen(false);
      await loadSectionStudents();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save student record.',
      });
    } finally {
      setStudentFormSaving(false);
    }
  };

  const handleConfirmRemoveStudent = async () => {
    if (!user || !currentRevision || !removeStudentTarget) return;
    try {
      await studentService.removeIndividualStudent(
        currentRevision.id,
        removeStudentTarget.id,
        user
      );
      setFeedback({
        type: 'success',
        text: `Removed ${removeStudentTarget.usn} from ${selectedSection}.`,
      });
      setRemoveStudentTarget(null);
      await loadSectionStudents();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to remove student.',
      });
      setRemoveStudentTarget(null);
    }
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection) return;
    setPromoteError('');
    setPromoting(true);
    try {
      const res = await studentService.promoteStudentsSemester({
        sourceSemester: selectedSemester,
        sourceSection: selectedSection,
        targetSemester: selectedSemester + 1,
        targetSection: targetPromoteSection.trim() || selectedSection,
      });
      setFeedback({
        type: 'success',
        text: res.message || `Promoted ${res.promotedCount} students from Sem ${selectedSemester} (${selectedSection}) to Sem ${selectedSemester + 1}.`,
      });
      setPromoteModalOpen(false);
      await loadContext();
      await loadSectionStudents();
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote students to next semester.');
    } finally {
      setPromoting(false);
    }
  };

  const handleGraduateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGraduateError('');
    setGraduating(true);
    try {
      const res = await studentService.graduateSemester8Students({
        section: selectedSection || undefined,
      });
      setFeedback({
        type: 'success',
        text: res.message || `Successfully graduated ${res.graduatedCount} Semester 8 students.`,
      });
      setGraduateModalOpen(false);
      await loadContext();
      await loadSectionStudents();
    } catch (err) {
      setGraduateError(err instanceof Error ? err.message : 'Failed to graduate Semester 8 students.');
    } finally {
      setGraduating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Common Semester Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            Setup Class — {user?.departmentName || user?.departmentCode}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Configure subjects with flexible modules & sections and manage section-wise eligible student lists for examinations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-[#D9E2EF] dark:border-slate-800">
            <label htmlFor="setup-semester" className="text-xs font-semibold text-[#64748B]">
              Semester:
            </label>
            <select
              id="setup-semester"
              value={selectedSemester}
              onChange={(e) => handleSemesterChange(Number(e.target.value))}
              className="text-sm font-bold text-[#17243A] dark:text-white bg-transparent focus:outline-none"
            >
              {MASTER_SEMESTER_OPTIONS.map((sem) => (
                <option key={sem.number} value={sem.number} className="dark:bg-slate-900">
                  {sem.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-[#16834A]/10 border-[#16834A]/30 text-[#16834A] dark:text-emerald-300'
              : 'bg-[#B42318]/10 border-[#B42318]/30 text-[#B42318] dark:text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Internal Tabs */}
      <div className="border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => switchTab('subjects')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'subjects'
                ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
                : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Subjects</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab('students')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'students'
                ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
                : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Lists</span>
          </button>
        </div>
      </div>

      {/* TAB A — SUBJECTS */}
      {activeTab === 'subjects' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#64748B] dark:text-slate-400">
              Showing subjects for <strong>{user?.departmentCode} Semester {selectedSemester}</strong>. Subjects are applicable to all sections of this semester.
            </div>
            <button
              type="button"
              onClick={openCreateSubject}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Subject</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-[#64748B]">Loading subjects...</div>
            ) : loadError ? (
              <div className="p-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#B42318] bg-[#B42318]/5">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadContextAndSubjects()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#B42318]/40 bg-white dark:bg-slate-900 font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : subjects.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#64748B]">
                No subjects configured for Semester {selectedSemester}. Click "Create Subject" to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                      <th className="py-3 px-5">Subject Code</th>
                      <th className="py-3 px-4">Subject Name</th>
                      <th className="py-3 px-4">Module Count</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-sm">
                    {subjects.map((subj) => (
                      <tr key={subj.id}>
                        <td className="py-3.5 px-5 font-mono font-bold text-[#17243A] dark:text-white">
                          {subj.code}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#1F2937] dark:text-slate-200">
                          {subj.name}
                        </td>
                        <td className="py-3.5 px-4 tabular-nums font-semibold">
                          {subj.moduleCount} Modules
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={subj.status} />
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingSubject(subj)}
                              title="View Subject Details"
                              className="p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#64748B] hover:text-[#17243A] dark:hover:text-white"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditSubject(subj)}
                              title="Edit Subject"
                              className="p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#2563EB]"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSubjectStatus(subj)}
                              title={subj.status === 'Active' ? 'Archive Subject' : 'Activate Subject'}
                              className="p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-[#B7791F]"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetSubject(subj)}
                              title={
                                subj.hasDependentRecords
                                  ? 'Cannot delete: dependent records exist (Archive instead)'
                                  : 'Delete unused subject'
                              }
                              className={`p-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 ${
                                subj.hasDependentRecords
                                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                  : 'text-[#B42318] hover:bg-red-50 dark:hover:bg-red-950/30'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB B — STUDENT LISTS */
        <div className="space-y-6">
          {/* Dynamic Section Tabs + Single Modal Trigger (+ Add Section) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {semesterSections.length === 0 ? (
                <div className="text-xs text-[#B7791F] font-medium">
                  No sections configured for Semester {selectedSemester} yet. Click "+ Add Section" to create one.
                </div>
              ) : (
                semesterSections.map((sec) => (
                  <div
                    key={sec}
                    className={`inline-flex items-center rounded-lg border text-xs font-semibold transition-colors ${
                      selectedSection === sec
                        ? 'bg-[#17243A] dark:bg-[#2563EB] text-white border-[#17243A] dark:border-[#2563EB]'
                        : 'bg-white dark:bg-slate-900 text-[#1F2937] dark:text-slate-300 border-[#D9E2EF] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSection(sec);
                        setExcelResult(null);
                        resetConverterState();
                      }}
                      className="px-3.5 py-2 cursor-pointer"
                    >
                      {sec}
                    </button>
                    <button
                      type="button"
                      title={`Delete ${sec}`}
                      aria-label={`Delete ${sec}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteSectionModal(sec);
                      }}
                      className={`pr-2.5 pl-1 py-2 transition-colors cursor-pointer ${
                        selectedSection === sec
                          ? 'text-white/70 hover:text-red-200'
                          : 'text-slate-400 hover:text-red-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedSection && selectedSemester < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    setPromoteError('');
                    setTargetPromoteSection(selectedSection);
                    setPromoteModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  title={`Promote ${selectedSection} students to Semester ${selectedSemester + 1}`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Promote to Sem {selectedSemester + 1}</span>
                </button>
              )}
              {selectedSection && selectedSemester === 8 && (
                <button
                  type="button"
                  onClick={() => {
                    setGraduateError('');
                    setGraduateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  title="Graduate / Archive Semester 8 class"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Graduate Class</span>
                </button>
              )}
              {selectedSection && (
                <button
                  type="button"
                  onClick={() => handleOpenDeleteSectionModal(selectedSection)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  title={`Delete ${selectedSection}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Section</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenAddSectionModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold text-[#17243A] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Add Section</span>
              </button>
            </div>
          </div>

          {selectedSection && (
            <>
              {isRosterFrozen && (
                <div className="p-3.5 rounded-lg bg-[#6D5CE8]/10 border border-[#6D5CE8]/30 text-xs text-[#6D5CE8] dark:text-violet-300 flex items-center gap-2 font-medium">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    The eligible student list for {user?.departmentCode} Semester {selectedSemester} {selectedSection} is Frozen by COE for scheduled examination operations and cannot be replaced or modified.
                  </span>
                </div>
              )}

              {/* Active Eligible Student Roster */}
              <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                        Eligible Student List — {selectedSection} (Sem {selectedSemester})
                      </h2>
                      {currentRevision && <StatusBadge status={currentRevision.status} />}
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      DOB is displayed strictly inside this authorized Student Lists view for Student Portal USN+DOB login verification.
                    </p>
                  </div>

                  {!isRosterFrozen && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStudent(null);
                        setStudentForm({ usn: '', studentName: '', dob: '' });
                        setStudentModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Individual Student</span>
                    </button>
                  )}
                </div>

                {studentsLoading ? (
                  <div className="p-8 text-center text-sm text-[#64748B]">Loading eligible roster...</div>
                ) : studentsError ? (
                  <div className="p-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#B42318] bg-[#B42318]/5">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{studentsError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadSectionStudents()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#B42318]/40 bg-white dark:bg-slate-900 font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : !currentRevision || currentRevision.students.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#64748B]">
                    No active eligible student list uploaded for {selectedSection} yet. Upload an Excel sheet or add students individually below.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[#F5F7FB] dark:bg-slate-800 border-b border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold text-[#64748B] dark:text-slate-300">
                        <tr>
                          <th className="py-3 px-5">#</th>
                          <th className="py-3 px-4">USN</th>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">DOB (YYYY-MM-DD)</th>
                          {!isRosterFrozen && <th className="py-3 px-5 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800 text-xs">
                        {currentRevision.students.map((stu, idx) => (
                          <tr key={stu.id}>
                            <td className="py-2.5 px-5 tabular-nums text-[#64748B]">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-mono font-semibold text-[#17243A] dark:text-white">
                              {stu.usn}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-[#1F2937] dark:text-slate-200">
                              {stu.studentName}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-[#64748B] dark:text-slate-300">
                              {stu.dob}
                            </td>
                            {!isRosterFrozen && (
                              <td className="py-2.5 px-5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingStudent(stu);
                                      setStudentForm({
                                        usn: stu.usn,
                                        studentName: stu.studentName,
                                        dob: stu.dob,
                                      });
                                      setStudentModalOpen(true);
                                    }}
                                    className="p-1 rounded border border-[#D9E2EF] dark:border-slate-700 text-[#2563EB]"
                                    title="Edit student"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemoveStudentTarget(stu)}
                                    className="p-1 rounded border border-[#D9E2EF] dark:border-slate-700 text-[#B42318]"
                                    title="Remove student"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Standard Excel Upload Section */}
              {!isRosterFrozen && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-[#16834A]" />
                        <span>Upload / Replace Eligible Student List via Excel (.xlsx)</span>
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                        Required columns strictly: <strong>USN</strong>, <strong>Student Name</strong>, <strong>DOB</strong> (no Section column; bound automatically to {selectedSection}).
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          user?.departmentCode &&
                          downloadStudentExcelTemplate(
                            user.departmentCode,
                            selectedSemester,
                            selectedSection
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Download Excel Template</span>
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Upload Excel File</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleExcelFileSelect}
                        />
                      </label>
                    </div>
                  </div>

                  {excelResult && (
                    <div className="p-4 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/60 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <strong>File:</strong> {excelResult.fileName} (
                          {(excelResult.fileSizeBytes / 1024).toFixed(1)} KB)
                        </div>
                        {excelResult.success && (
                          <div className="flex items-center gap-3">
                            <span className="text-[#16834A] dark:text-emerald-400 font-semibold">
                              Valid: {excelResult.validCount}
                            </span>
                            <span
                              className={`font-semibold ${
                                excelResult.invalidCount > 0 ? 'text-[#B42318]' : 'text-[#64748B]'
                              }`}
                            >
                              Invalid: {excelResult.invalidCount}
                            </span>
                          </div>
                        )}
                      </div>

                      {!excelResult.success ? (
                        <div className="p-3 rounded-md bg-[#B42318]/10 border border-[#B42318]/30 text-xs text-[#B42318] dark:text-red-300 font-medium">
                          {excelResult.fatalError}
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto max-h-64 overflow-y-auto bg-white dark:bg-slate-900 rounded-md border border-[#D9E2EF] dark:border-slate-700">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-[#F5F7FB] dark:bg-slate-800 border-b border-[#D9E2EF] dark:border-slate-700">
                                  <th className="py-2 px-3">Row</th>
                                  <th className="py-2 px-3">USN</th>
                                  <th className="py-2 px-3">Student Name</th>
                                  <th className="py-2 px-3">DOB</th>
                                  <th className="py-2 px-3">Validation Report</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                                {excelResult.rows.map((r) => (
                                  <tr
                                    key={r.rowNumber}
                                    className={
                                      r.isValid ? '' : 'bg-[#B42318]/5 dark:bg-red-950/20'
                                    }
                                  >
                                    <td className="py-2 px-3 tabular-nums">{r.rowNumber}</td>
                                    <td className="py-2 px-3 font-mono font-semibold">{r.usn || '—'}</td>
                                    <td className="py-2 px-3">{r.studentName || '—'}</td>
                                    <td className="py-2 px-3 font-mono">{r.dob || '—'}</td>
                                    <td className="py-2 px-3">
                                      {r.isValid ? (
                                        <span className="text-[#16834A] dark:text-emerald-400 font-semibold">
                                          Valid
                                        </span>
                                      ) : (
                                        <span className="text-[#B42318] dark:text-red-300 font-medium">
                                          {r.errors.join(' | ')}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setExcelResult(null)}
                              className="px-3.5 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold"
                            >
                              Discard Preview
                            </button>
                            <button
                              type="button"
                              disabled={excelResult.invalidCount > 0 || excelResult.validCount === 0}
                              onClick={() => setConfirmUploadOpen(true)}
                              className="px-4 py-2 rounded-md bg-[#16834A] hover:bg-[#126D3D] text-white text-xs font-semibold disabled:opacity-50"
                            >
                              {currentRevision
                                ? 'Replace Existing Section List'
                                : 'Save Valid Student List'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Upload & Replacement History */}
              <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#6D5CE8]" />
                  <h3 className="text-base font-bold text-[#17243A] dark:text-white">
                    Upload & Replacement Revision History — {selectedSection}
                  </h3>
                </div>
                {revisions.length === 0 ? (
                  <div className="p-6 text-xs text-[#64748B]">
                    No prior uploads recorded for {selectedSection}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-[#64748B]">
                          <th className="py-2.5 px-5">Revision</th>
                          <th className="py-2.5 px-4">Source / File</th>
                          <th className="py-2.5 px-4">Students</th>
                          <th className="py-2.5 px-4">Uploaded By & Time</th>
                          <th className="py-2.5 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                        {revisions.map((rev) => (
                          <tr key={rev.id}>
                            <td className="py-2.5 px-5 font-mono font-bold">{rev.revisionNumber}</td>
                            <td className="py-2.5 px-4">{rev.fileName || rev.sourceType}</td>
                            <td className="py-2.5 px-4 tabular-nums">{rev.totalStudents}</td>
                            <td className="py-2.5 px-4">
                              {rev.uploadedBy} · <span className="font-mono">{rev.uploadedAt}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <StatusBadge status={rev.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* Create / Edit Subject Modal */}
      {subjectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                {editingSubject ? `Edit Subject (${editingSubject.code})` : `Create Subject — Sem ${selectedSemester}`}
              </h2>
              <button
                type="button"
                onClick={() => setSubjectModalOpen(false)}
                className="p-1 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSubject} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Subject Code</label>
                  <input
                    type="text"
                    required
                    value={subjectForm.code}
                    onChange={(e) =>
                      setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })
                    }
                    placeholder="Enter code"
                    className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Module Count (1–12)</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={subjectForm.moduleCount}
                    onChange={(e) =>
                      setSubjectForm({
                        ...subjectForm,
                        moduleCount: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="Enter subject name"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 p-2.5 text-xs text-blue-700 dark:text-blue-300">
                This subject will automatically apply to all sections in Semester {selectedSemester}.
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subjectSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] text-white"
                >
                  {subjectSaving ? 'Saving...' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Subject Modal */}
      {viewingSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl p-6 space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-[#D9E2EF] dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base">
                {viewingSubject.code} — {viewingSubject.name}
              </h3>
              <button type="button" onClick={() => setViewingSubject(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>Department: {viewingSubject.departmentCode}</div>
            <div>Semester: {viewingSubject.semesterNumber}</div>
            <div>Module Count: {viewingSubject.moduleCount}</div>
            <div>Applicability: All Sections (Semester {viewingSubject.semesterNumber})</div>
            <div>
              Status: <StatusBadge status={viewingSubject.status} />
            </div>
            <div className="text-xs text-[#64748B]">
              Dependent Question/Exam/Result Records:{' '}
              {viewingSubject.hasDependentRecords ? 'Present (Deletion blocked — use Archive)' : 'None'}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Individual Student Modal */}
      {studentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                {editingStudent ? `Edit Student (${editingStudent.usn})` : `Add Eligible Student — ${selectedSection}`}
              </h2>
              <button
                type="button"
                onClick={() => setStudentModalOpen(false)}
                className="p-1 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveIndividualStudent} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">USN</label>
                <input
                  type="text"
                  required
                  value={studentForm.usn}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, usn: e.target.value.toUpperCase() })
                  }
                  placeholder="Enter institutional USN"
                  className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  value={studentForm.studentName}
                  onChange={(e) => setStudentForm({ ...studentForm, studentName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Date of Birth (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={studentForm.dob}
                  onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={studentFormSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] text-white"
                >
                  {studentFormSaving ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetSubject)}
        title={`Archive Subject ${deleteTargetSubject?.code}?`}
        description={`Are you sure you want to archive ${deleteTargetSubject?.code} — ${deleteTargetSubject?.name}? The subject will be marked as Archived. All question-bank, blueprint, examination, and result history will be permanently preserved.`}
        confirmLabel="Archive Subject"
        variant="destructive"
        onConfirm={handleConfirmDeleteSubject}
        onCancel={() => setDeleteTargetSubject(null)}
      />

      <ConfirmDialog
        isOpen={confirmUploadOpen}
        title={
          currentRevision
            ? `Replace Eligible Student List for ${selectedSection}?`
            : `Save Eligible Student List for ${selectedSection}?`
        }
        description={`This will commit ${excelResult?.validCount || 0} validated student(s) from "${excelResult?.fileName}" into Semester ${selectedSemester} ${selectedSection}.`}
        consequenceNote={
          currentRevision
            ? `The previous active list (${currentRevision.revisionNumber}) will be marked as Replaced in upload history.`
            : undefined
        }
        confirmLabel={currentRevision ? 'Confirm Replacement' : 'Save Student List'}
        variant="primary"
        isLoading={savingList}
        onConfirm={handleCommitStudentList}
        onCancel={() => setConfirmUploadOpen(false)}
      />

      {/* Create Section Modal (Student Lists Tab) */}
      {addSectionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-section-modal-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2
                id="create-section-modal-title"
                className="text-base font-bold text-[#17243A] dark:text-white"
              >
                Create Section — Semester {selectedSemester}
              </h2>
              <button
                type="button"
                onClick={() => setAddSectionModalOpen(false)}
                className="p-1 text-[#64748B]"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSection} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="new-section-name"
                  className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1.5"
                >
                  Section Name
                </label>
                <input
                  id="new-section-name"
                  type="text"
                  autoFocus
                  required
                  value={newSectionName}
                  onChange={(e) => {
                    setNewSectionName(e.target.value);
                    if (addSectionError) setAddSectionError('');
                  }}
                  placeholder="e.g., Section D"
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                {addSectionError && (
                  <p className="text-xs text-[#B42318] dark:text-red-300 font-medium mt-1.5">
                    {addSectionError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAddSectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSection || !newSectionName.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:opacity-50 cursor-pointer"
                >
                  {addingSection ? 'Creating...' : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteSectionModalOpen && sectionToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-[#D9E2EF] dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#17243A] dark:text-white">
                  Delete {sectionToDelete}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteSectionModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete <strong>{sectionToDelete}</strong> from{' '}
                <strong>Semester {selectedSemester}</strong>?
              </p>
              {confirmWithStudents && (
                <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ This section has enrolled students. Confirming will remove the section and its student roster.
                </div>
              )}
              {deleteSectionError && (
                <p className="text-xs text-[#B42318] dark:text-red-300 font-medium">
                  {deleteSectionError}
                </p>
              )}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteSectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSection}
                  disabled={deletingSection}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {deletingSection ? 'Deleting...' : confirmWithStudents ? 'Confirm & Delete' : 'Delete Section'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promote Students to Next Semester Modal */}
      {promoteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-[#D9E2EF] dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-950/60">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#17243A] dark:text-white">
                  Promote Students to Semester {selectedSemester + 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPromoteModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePromoteSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="font-semibold">Batch Progression:</div>
                <div>All active enrolled students in <strong>Semester {selectedSemester} ({selectedSection})</strong> will be advanced to <strong>Semester {selectedSemester + 1}</strong> atomically.</div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">USNs, examination history, and result records remain fully preserved.</div>
              </div>

              {promoteError && (
                <div className="p-3 rounded-md bg-[#B42318]/10 border border-[#B42318]/30 text-xs font-medium text-[#B42318] dark:text-red-300">
                  {promoteError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1">
                  Target Section in Semester {selectedSemester + 1}
                </label>
                <input
                  type="text"
                  required
                  value={targetPromoteSection}
                  onChange={(e) => setTargetPromoteSection(e.target.value.toUpperCase())}
                  placeholder={`e.g. ${selectedSection}`}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#17243A] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#D9E2EF] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPromoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promoting}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {promoting ? 'Promoting...' : `Confirm Promotion to Sem ${selectedSemester + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Graduate Semester 8 Modal */}
      {graduateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-[#D9E2EF] dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-950/60">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <GraduationCap className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#17243A] dark:text-white">
                  Graduate Semester 8 Students
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGraduateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGraduateSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300 space-y-1">
                <div className="font-semibold">Graduation & Archival:</div>
                <div>All active enrolled students in <strong>Semester 8 {selectedSection ? `(${selectedSection})` : ''}</strong> will be marked as <strong>GRADUATED</strong>.</div>
                <div className="text-[11px] text-indigo-700 dark:text-indigo-400">Academic transcripts, result imports, and exam history remain permanently accessible for institutional reporting.</div>
              </div>

              {graduateError && (
                <div className="p-3 rounded-md bg-[#B42318]/10 border border-[#B42318]/30 text-xs font-medium text-[#B42318] dark:text-red-300">
                  {graduateError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#D9E2EF] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setGraduateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={graduating}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {graduating ? 'Graduating...' : 'Confirm Graduation / Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(removeStudentTarget)}
        title={`Remove Student ${removeStudentTarget?.usn}?`}
        description={`Remove ${removeStudentTarget?.studentName} (${removeStudentTarget?.usn}) from Semester ${selectedSemester} ${selectedSection}? Removal is blocked if examination records exist.`}
        confirmLabel="Remove Student"
        variant="destructive"
        onConfirm={handleConfirmRemoveStudent}
        onCancel={() => setRemoveStudentTarget(null)}
      />
    </div>
  );
};
