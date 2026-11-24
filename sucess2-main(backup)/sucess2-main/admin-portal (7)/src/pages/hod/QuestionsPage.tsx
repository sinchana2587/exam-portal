import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FileUp,
  History,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Send,
  Shuffle,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { parseValidSemester, useHodSemester } from '../../hooks/useHodSemester';
import { ApiClientError } from '../../services/apiClient';
import {
  courseOutcomeService,
  validateCourseOutcomePdfFile,
} from '../../services/courseOutcomeService';
import { documentConversionService } from '../../services/documentConversionService';
import { keyCorrectionService } from '../../services/keyCorrectionService';
import { subjectService } from '../../services/subjectService';
import {
  DynamicCapacityEvaluation,
  evaluateDynamicSetCapacity,
  questionService,
} from '../../services/questionService';
import {
  downloadQuestionExcelTemplate,
  parseAndValidateQuestionExcel,
  QuestionExcelParseResult,
} from '../../utils/fileHandlers';
import { formatSemesterOrdinal, MASTER_SEMESTER_OPTIONS } from '../../utils/semesterOptions';
import {
  ConversionLifecycleStatus,
  CourseOutcomeDocumentRevision,
  ExaminationRecord,
  ExtractedQuestionPreviewRow,
  HodSetGenerationSummary,
  KeyCorrectionRequest,
  PaperBlueprint,
  QuestionConversionSession,
  QuestionImageAsset,
  QuestionImageField,
  QuestionItem,
  QuestionPublicationRevision,
  Subject,
} from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import {
  ConversionStatusBadge,
  getConversionStatusLabel,
} from '../../components/ConversionStatusBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type QuestionsSubTab = 'pool' | 'blueprint' | 'key-correction' | 'history';
type ConverterGroupTab = 'ALL' | 'NEEDS_REVIEW' | number;

function resolveImageSrc(img: QuestionImageAsset): string {
  if (!img.base64Data) return '';
  return img.base64Data.startsWith('data:')
    ? img.base64Data
    : `data:${img.mimeType};base64,${img.base64Data}`;
}

const MODULE_SOURCE_LABELS: Record<string, string> = {
  QUESTION_LABEL: 'Explicit M-Tag',
  HEADING: 'Module Heading',
  PAGE_LABEL: 'Page Header',
  TOPIC: 'Topic Match',
  MANUAL: 'Manual Assign',
  UNKNOWN: 'Needs Module Review',
};

export const QuestionsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSemester, setSelectedSemester } = useHodSemester();

  const urlTab = searchParams.get('tab');
  const initialTab: QuestionsSubTab =
    urlTab === 'blueprint' ||
    urlTab === 'key-correction' ||
    urlTab === 'history'
      ? urlTab
      : 'pool';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectRetryNonce, setSubjectRetryNonce] = useState(0);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [publications, setPublications] = useState<QuestionPublicationRevision[]>([]);

  const [subTab, setSubTab] = useState<QuestionsSubTab>(initialTab);
  const [moduleFilter, setModuleFilter] = useState<number | 'ALL'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual Question Modal
  const [qModalOpen, setQModalOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<QuestionItem | null>(null);
  const [qForm, setQForm] = useState({
    moduleNumber: 1,
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A' as 'A' | 'B' | 'C' | 'D',
  });
  const [qSaving, setQSaving] = useState(false);

  // Excel Bulk Upload (Single module or All modules)
  const [selectedExcelModule, setSelectedExcelModule] = useState<number>(1);
  const [isBulkAllModulesUpload, setIsBulkAllModulesUpload] = useState<boolean>(false);
  const [excelResult, setExcelResult] = useState<QuestionExcelParseResult | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  // Section A: Backend-Driven Question PDF / Image-to-Excel Conversion (with Images)
  const [convPageRange, setConvPageRange] = useState<string>('');
  const [qConvPendingFile, setQConvPendingFile] = useState<File | null>(null);
  const [qConvSession, setQConvSession] = useState<QuestionConversionSession | null>(null);
  const [qConvStatus, setQConvStatus] = useState<ConversionLifecycleStatus>('WAITING_FOR_FILE');
  const [qConvStatusMsg, setQConvStatusMsg] = useState<string>('');
  const [qConvFileName, setQConvFileName] = useState<string>('');
  const [qConvGroupTab, setQConvGroupTab] = useState<ConverterGroupTab>('ALL');
  const [qConvRevalidating, setQConvRevalidating] = useState<boolean>(false);
  const [qConvDownloadingModule, setQConvDownloadingModule] = useState<number | null>(null);
  const [unassignedAttachMap, setUnassignedAttachMap] = useState<
    Record<string, { previewId: string; targetField: QuestionImageField }>
  >({});
  const [zoomImage, setZoomImage] = useState<QuestionImageAsset | null>(null);
  const qConvSeqRef = useRef<number>(0);
  const qConvDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section B: Independent Course Outcomes PDF Submission & Revision History (Shared Sem/Subject Context)
  const [coRevisions, setCoRevisions] = useState<CourseOutcomeDocumentRevision[]>([]);
  const [coLoading, setCoLoading] = useState<boolean>(false);
  const [coLoadError, setCoLoadError] = useState<string | null>(null);
  const [coSelectedFile, setCoSelectedFile] = useState<File | null>(null);
  const [coPreviewUrl, setCoPreviewUrl] = useState<string | null>(null);
  const [coPreviewExpanded, setCoPreviewExpanded] = useState<boolean>(false);
  const [coNotes, setCoNotes] = useState<string>('');
  const [coUploadStatus, setCoUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'UPLOADED' | 'FAILED'>('IDLE');
  const [coUploadMessage, setCoUploadMessage] = useState<string>('');
  const [coDownloadingId, setCoDownloadingId] = useState<string | null>(null);

  // Blueprint & Dynamic Disjoint Numbered Sets
  const [moduleDist, setModuleDist] = useState<Record<number, number>>({});
  const [configuredTotalQuestions, setConfiguredTotalQuestions] = useState<number>(0);
  const [savingBlueprint, setSavingBlueprint] = useState(false);
  const [generationSummary, setGenerationSummary] = useState<HodSetGenerationSummary | null>(null);
  const [generatingSets, setGeneratingSets] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Simplified Key Corrections Tab State
  const [eligibleExams, setEligibleExams] = useState<ExaminationRecord[]>([]);
  const [kcLoadingExams, setKcLoadingExams] = useState(false);
  const [kcSelectedExamId, setKcSelectedExamId] = useState('');
  const [examQuestions, setExamQuestions] = useState<QuestionItem[]>([]);
  const [kcLoadingQuestions, setKcLoadingQuestions] = useState(false);
  const [kcSelectedQuestionId, setKcSelectedQuestionId] = useState('');
  const [kcProposedOption, setKcProposedOption] = useState<'A' | 'B' | 'C' | 'D' | ''>('');
  const [kcSubmitting, setKcSubmitting] = useState(false);
  const [kcResultMsg, setKcResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const lastSubjectIdRef = useRef<string>('');
  const subjectFetchSeqRef = useRef<number>(0);
  const subjectDataSeqRef = useRef<number>(0);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (
      nextTab === 'pool' ||
      nextTab === 'blueprint' ||
      nextTab === 'key-correction' ||
      nextTab === 'history'
    ) {
      setSubTab(nextTab);
    }
    const urlSem = parseValidSemester(searchParams.get('semester'));
    if (urlSem !== null && urlSem !== selectedSemester) {
      setSelectedSemester(urlSem);
    } else if (urlSem === null) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('semester', String(selectedSemester));
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedSemester, setSelectedSemester, setSearchParams]);

  const switchSubTab = (tab: QuestionsSubTab) => {
    setSubTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.set('semester', String(selectedSemester));
    setSearchParams(nextParams, { replace: true });
    setFeedback(null);
  };

  const handleSemesterSelect = (nextSem: number) => {
    const valid = parseValidSemester(nextSem);
    if (valid === null || valid === selectedSemester) return;

    lastSubjectIdRef.current = '';
    setSelectedSemester(valid);
    setSubjects([]);
    setSelectedSubjectId('');
    setSubjectsError(null);
    setSubjectsLoading(true);

    setQuestions([]);
    setPublications([]);
    setGenerationSummary(null);
    setExcelResult(null);
    setFeedback(null);
    setCoRevisions([]);
    setCoLoadError(null);
    setCoSelectedFile(null);
    setCoPreviewExpanded(false);
    setCoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoNotes('');
    setCoUploadStatus('IDLE');
    setCoUploadMessage('');
    qConvSeqRef.current += 1;
    setQConvPendingFile(null);
    setQConvSession(null);
    setQConvStatus('WAITING_FOR_FILE');
    setQConvStatusMsg('');
    setQConvFileName('');
    setQConvGroupTab('ALL');
    setUnassignedAttachMap({});

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('semester', String(valid));
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (!user?.departmentId) return;
    const seq = ++subjectFetchSeqRef.current;
    const controller = new AbortController();

    setSubjectsLoading(true);
    setSubjectsError(null);
    setSubjects([]);
    setSelectedSubjectId('');

    subjectService
      .getDepartmentSubjects(user.departmentId, selectedSemester, controller.signal)
      .then((res) => {
        if (seq !== subjectFetchSeqRef.current || controller.signal.aborted) return;
        const activeSubjs = res.filter(
          (s) => s.status === 'Active' && s.semesterNumber === selectedSemester
        );
        setSubjects(activeSubjs);
        setSelectedSubjectId((prev) =>
          prev && activeSubjs.some((s) => s.id === prev) ? prev : activeSubjs[0]?.id || ''
        );
      })
      .catch((err) => {
        if (seq !== subjectFetchSeqRef.current || controller.signal.aborted) return;
        if (err instanceof ApiClientError && err.code === 'REQUEST_ABORTED') return;
        setSubjects([]);
        setSelectedSubjectId('');
        setSubjectsError(
          err instanceof Error
            ? err.message
            : `Unable to load subjects for ${formatSemesterOrdinal(selectedSemester)}.`
        );
      })
      .finally(() => {
        if (seq === subjectFetchSeqRef.current && !controller.signal.aborted) {
          setSubjectsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [user?.departmentId, selectedSemester, subjectRetryNonce]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => s.semesterNumber === selectedSemester);
  }, [subjects, selectedSemester]);

  const selectedSubject = useMemo(
    () => filteredSubjects.find((s) => s.id === selectedSubjectId) || null,
    [filteredSubjects, selectedSubjectId]
  );

  const loadCourseOutcomesRevisions = useCallback(async () => {
    if (!user || !selectedSubject || selectedSubject.semesterNumber !== selectedSemester) {
      setCoRevisions([]);
      setCoLoadError(null);
      return;
    }
    const targetSubjectId = selectedSubject.id;
    setCoLoading(true);
    setCoLoadError(null);
    try {
      const list = await courseOutcomeService.getRevisions(targetSubjectId, user);
      if (lastSubjectIdRef.current && lastSubjectIdRef.current !== targetSubjectId) return;
      setCoRevisions(Array.isArray(list) ? list : []);
    } catch (err) {
      if (lastSubjectIdRef.current && lastSubjectIdRef.current !== targetSubjectId) return;
      setCoRevisions([]);
      setCoLoadError(
        err instanceof Error
          ? err.message
          : 'Unable to load Course Outcomes submission history from the backend.'
      );
    } finally {
      setCoLoading(false);
    }
  }, [user, selectedSubject, selectedSemester]);

  const loadSubjectQuestionData = useCallback(async () => {
    if (!user?.departmentId || !selectedSubject || selectedSubject.semesterNumber !== selectedSemester) {
      setQuestions([]);
      setPublications([]);
      setGenerationSummary(null);
      setExcelResult(null);
      return;
    }
    const seq = ++subjectDataSeqRef.current;
    try {
      const [qs, pubs, bp] = await Promise.all([
        questionService.getSubjectQuestions(selectedSubject.id, user.departmentId),
        questionService.getPublicationHistory(selectedSubject.id, user.departmentId),
        questionService.getBlueprint(selectedSubject.id, user.departmentId).catch(() => null),
      ]);
      if (seq !== subjectDataSeqRef.current) return;

      const normalizedQs = Array.isArray(qs)
        ? qs
        : Array.isArray((qs as unknown as { questions?: QuestionItem[] })?.questions)
          ? (qs as unknown as { questions: QuestionItem[] }).questions
          : Array.isArray((qs as unknown as { data?: QuestionItem[] })?.data)
            ? (qs as unknown as { data: QuestionItem[] }).data
            : [];

      const normalizedPubs = Array.isArray(pubs)
        ? pubs
        : Array.isArray((pubs as unknown as { publications?: QuestionPublicationRevision[] })?.publications)
          ? (pubs as unknown as { publications: QuestionPublicationRevision[] }).publications
          : Array.isArray((pubs as unknown as { history?: QuestionPublicationRevision[] })?.history)
            ? (pubs as unknown as { history: QuestionPublicationRevision[] }).history
            : Array.isArray((pubs as unknown as { data?: QuestionPublicationRevision[] })?.data)
              ? (pubs as unknown as { data: QuestionPublicationRevision[] }).data
              : [];

      setQuestions(normalizedQs);
      setPublications(normalizedPubs);

      const switchedSubject = lastSubjectIdRef.current !== selectedSubject.id;
      if (switchedSubject || bp) {
        lastSubjectIdRef.current = selectedSubject.id;
        const dist: Record<number, number> = {};
        if (bp && bp.moduleDistribution) {
          for (let m = 1; m <= selectedSubject.moduleCount; m++) {
            dist[m] = Number(bp.moduleDistribution[m]) || 0;
          }
          setConfiguredTotalQuestions(bp.totalQuestions || 0);
        } else {
          for (let m = 1; m <= selectedSubject.moduleCount; m++) {
            dist[m] = 0;
          }
          setConfiguredTotalQuestions(0);
        }
        setModuleDist(dist);
        setModuleFilter('ALL');
        setSelectedExcelModule(1);
        setConvPageRange('');

        setQConvPendingFile(null);
        setQConvSession(null);
        setQConvStatus('WAITING_FOR_FILE');
        setQConvStatusMsg('');
        setQConvFileName('');
        setQConvGroupTab('ALL');
        setUnassignedAttachMap({});

        setCoSelectedFile(null);
        setCoPreviewExpanded(false);
        setCoPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setCoNotes('');
        setCoUploadStatus('IDLE');
        setCoUploadMessage('');
      }

      setGenerationSummary(null);
      setExcelResult(null);
    } catch (err) {
      if (seq !== subjectDataSeqRef.current) return;
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load subject questions.',
      });
    }
  }, [user?.departmentId, selectedSubject, selectedSemester]);

  useEffect(() => {
    loadSubjectQuestionData();
  }, [loadSubjectQuestionData]);

  useEffect(() => {
    loadCourseOutcomesRevisions();
  }, [loadCourseOutcomesRevisions]);

  useEffect(() => {
    return () => {
      if (coPreviewUrl) {
        URL.revokeObjectURL(coPreviewUrl);
      }
    };
  }, [coPreviewUrl]);

  // Key Corrections data loaders
  const loadEligibleExams = useCallback(async () => {
    if (!user?.departmentId) return;
    setKcLoadingExams(true);
    try {
      const list = await keyCorrectionService.getEligibleExaminations(user.departmentId);
      setEligibleExams(list);
      setKcSelectedExamId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        return list[0]?.id || '';
      });
    } catch (err) {
      setKcResultMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load completed examinations.',
      });
    } finally {
      setKcLoadingExams(false);
    }
  }, [user?.departmentId]);

  const [correctionHistory, setCorrectionHistory] = useState<KeyCorrectionRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const loadCorrectionHistory = useCallback(async () => {
    if (!user?.departmentId) return;
    setLoadingHistory(true);
    try {
      const history = await keyCorrectionService.getCorrectionHistory(user.departmentId);
      setCorrectionHistory(Array.isArray(history) ? history : []);
    } catch {
      setCorrectionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.departmentId]);

  useEffect(() => {
    if (subTab === 'key-correction') {
      loadEligibleExams();
      loadCorrectionHistory();
    }
  }, [subTab, loadEligibleExams, loadCorrectionHistory]);

  useEffect(() => {
    if (!kcSelectedExamId || !user?.departmentId) {
      setExamQuestions([]);
      setKcSelectedQuestionId('');
      setKcProposedOption('');
      return;
    }
    setKcLoadingQuestions(true);
    keyCorrectionService
      .getQuestionsForExamination(kcSelectedExamId, user.departmentId)
      .then((qs) => {
        setExamQuestions(qs);
        setKcSelectedQuestionId(qs[0]?.questionId || '');
        setKcProposedOption('');
      })
      .catch((err) => {
        setExamQuestions([]);
        setKcSelectedQuestionId('');
        setKcResultMsg({
          type: 'error',
          text: err instanceof Error ? err.message : 'Unable to load examination questions.',
        });
      })
      .finally(() => setKcLoadingQuestions(false));
  }, [kcSelectedExamId, user?.departmentId]);

  const selectedKcQuestion = useMemo(
    () => examQuestions.find((q) => q.questionId === kcSelectedQuestionId) || null,
    [examQuestions, kcSelectedQuestionId]
  );

  const handleSubmitKeyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !kcSelectedExamId || !kcSelectedQuestionId || !kcProposedOption) return;
    setKcSubmitting(true);
    setKcResultMsg(null);
    try {
      const created = await keyCorrectionService.submitCorrectionRequest(
        {
          examinationId: kcSelectedExamId,
          questionId: kcSelectedQuestionId,
          proposedCorrectOption: kcProposedOption,
        },
        user
      );
      setKcResultMsg({
        type: 'success',
        text: `Correction request submitted to COE (${created.questionId}: Option ${created.existingCorrectOption} → Option ${created.proposedCorrectOption}). Pending COE approval.`,
      });
      setKcProposedOption('');
      await loadEligibleExams();
      await loadCorrectionHistory();
    } catch (err) {
      setKcResultMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit key correction request.',
      });
    } finally {
      setKcSubmitting(false);
    }
  };

  const safeQuestions = useMemo(
    () => (Array.isArray(questions) ? questions : []),
    [questions]
  );

  const safePublications = useMemo(
    () => (Array.isArray(publications) ? publications : []),
    [publications]
  );

  const activeQuestions = useMemo(
    () => safeQuestions.filter((q) => q.status === 'Active'),
    [safeQuestions]
  );

  const filteredQuestions = useMemo(() => {
    if (moduleFilter === 'ALL') return safeQuestions;
    return safeQuestions.filter((q) => q.moduleNumber === moduleFilter);
  }, [safeQuestions, moduleFilter]);

  const blueprintTotal = useMemo(
    () => Object.values(moduleDist).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [moduleDist]
  );

  const capacityCheck: DynamicCapacityEvaluation | null = useMemo(() => {
    if (!selectedSubject) return null;
    return evaluateDynamicSetCapacity(
      selectedSubject.moduleCount,
      moduleDist,
      activeQuestions
    );
  }, [selectedSubject, moduleDist, activeQuestions]);

  const handleSaveManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSubject) return;
    setQSaving(true);
    setFeedback(null);
    try {
      if (editingQ) {
        await questionService.updateQuestion(editingQ.questionId, qForm, user);
        setFeedback({ type: 'success', text: `Updated question ${editingQ.questionId}.` });
      } else {
        const added = await questionService.addQuestion(
          { subjectId: selectedSubject.id, ...qForm },
          user
        );
        setFeedback({ type: 'success', text: `Added question ${added.questionId}.` });
      }
      setQModalOpen(false);
      await loadSubjectQuestionData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save question.',
      });
    } finally {
      setQSaving(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedSubject || !user) return;
    setFeedback(null);
    setIsBulkAllModulesUpload(false);
    const parsed = await parseAndValidateQuestionExcel(
      file,
      selectedSubject.moduleCount,
      safeQuestions,
      selectedExcelModule,
      user
    );
    setExcelResult(parsed);
  };

  const handleBulkExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedSubject || !user) return;
    setFeedback(null);
    setIsBulkAllModulesUpload(true);
    const parsed = await parseAndValidateQuestionExcel(
      file,
      selectedSubject.moduleCount,
      safeQuestions,
      undefined,
      user
    );
    setExcelResult(parsed);
  };

  const handleImportValidExcelQuestions = async () => {
    if (!user || !selectedSubject || !excelResult) return;
    const validRows = excelResult.rows
      .filter((r) =>
        r.isValid &&
        (isBulkAllModulesUpload
          ? r.moduleNumber !== null && r.moduleNumber >= 1 && r.moduleNumber <= selectedSubject.moduleCount
          : r.moduleNumber === selectedExcelModule)
      )
      .map((r) => ({
        moduleNumber: r.moduleNumber as number,
        questionText: r.questionText,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        correctOption: r.correctOption as 'A' | 'B' | 'C' | 'D',
        questionImages: r.questionImages,
        optionAImages: r.optionAImages,
        optionBImages: r.optionBImages,
        optionCImages: r.optionCImages,
        optionDImages: r.optionDImages,
      }));

    if (validRows.length === 0) return;

    setImportingExcel(true);
    try {
      const res = await questionService.bulkImportQuestions(
        selectedSubject.id,
        validRows,
        excelResult.fileName,
        user,
        isBulkAllModulesUpload ? undefined : selectedExcelModule
      );
      setFeedback({
        type: 'success',
        text: `Imported ${res.importedCount} validated ${
          isBulkAllModulesUpload
            ? `question(s) across all modules (1 to ${selectedSubject.moduleCount})`
            : `Module ${selectedExcelModule} question(s)`
        } into ${selectedSubject.code} (${(res.assignedQuestionIds || []).slice(0, 3).join(', ')}${(res.assignedQuestionIds || []).length > 3 ? '...' : ''})${res.skippedDuplicates > 0 ? ` · ${res.skippedDuplicates} duplicate skipped` : ''}.`,
      });
      setExcelResult(null);
      await loadSubjectQuestionData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Question import failed.',
      });
    } finally {
      setImportingExcel(false);
    }
  };

  const handleImportFromConverterSession = async () => {
    if (!user || !selectedSubject || !qConvSession) return;
    const validRows = qConvSession.records
      .filter((r) => r.isValid && r.assignedModuleNumber !== null && r.correctOption)
      .map((r) => ({
        moduleNumber: r.assignedModuleNumber as number,
        questionText: r.questionText,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        correctOption: r.correctOption as 'A' | 'B' | 'C' | 'D',
        questionImages: r.images?.filter((im) => im.targetField === 'QUESTION_TEXT') || [],
        optionAImages: r.images?.filter((im) => im.targetField === 'OPTION_A') || [],
        optionBImages: r.images?.filter((im) => im.targetField === 'OPTION_B') || [],
        optionCImages: r.images?.filter((im) => im.targetField === 'OPTION_C') || [],
        optionDImages: r.images?.filter((im) => im.targetField === 'OPTION_D') || [],
      }));

    if (validRows.length === 0) {
      setFeedback({
        type: 'error',
        text: 'No valid questions found to import. Please review any flagged questions below.',
      });
      return;
    }

    setImportingExcel(true);
    try {
      const res = await questionService.bulkImportQuestions(
        selectedSubject.id,
        validRows,
        qConvSession.originalFileName,
        user
      );
      setFeedback({
        type: 'success',
        text: `Successfully imported ${res.importedCount} question(s) from "${qConvSession.originalFileName}" directly into Question Pool!`,
      });
      await loadSubjectQuestionData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Question import failed.',
      });
    } finally {
      setImportingExcel(false);
    }
  };

  const mapQuestionConvError = (
    err: unknown
  ): { status: ConversionLifecycleStatus; message: string } => {
    if (err instanceof ApiClientError) {
      if (err.code === 'BACKEND_UNAVAILABLE' || err.status === 0) {
        return { status: 'BACKEND_UNAVAILABLE', message: err.message };
      }
      if (err.code === 'PROCESSING_TIMEOUT' || err.status === 408) {
        return { status: 'PROCESSING_TIMEOUT', message: err.message };
      }
      if (err.code === 'UNSUPPORTED_FORMAT') {
        return { status: 'UNSUPPORTED_FORMAT', message: err.message };
      }
      if (err.code === 'MODULE_MISMATCH') {
        return { status: 'MODULE_MISMATCH', message: err.message };
      }
      if (err.code === 'VALIDATION_FAILED') {
        return { status: 'VALIDATION_FAILED', message: err.message };
      }
      return { status: 'CORRUPTED_DOCUMENT', message: err.message };
    }
    return {
      status: 'CORRUPTED_DOCUMENT',
      message: err instanceof Error ? err.message : 'Question conversion failed.',
    };
  };

  const resetQuestionConverter = useCallback(() => {
    if (qConvDebounceRef.current) {
      clearTimeout(qConvDebounceRef.current);
      qConvDebounceRef.current = null;
    }
    qConvSeqRef.current += 1;
    setQConvPendingFile(null);
    setQConvSession(null);
    setQConvStatus('WAITING_FOR_FILE');
    setQConvStatusMsg('');
    setQConvFileName('');
    setQConvGroupTab('ALL');
    setQConvRevalidating(false);
    setQConvDownloadingModule(null);
    setUnassignedAttachMap({});
  }, []);

  const submitQuestionFileToBackend = async (file: File) => {
    if (!selectedSubject || !user?.departmentId || !user.departmentCode) return;

    const lowerName = file.name.toLowerCase();
    const isSupportedExt =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png');
    if (!isSupportedExt) {
      setQConvSession(null);
      setQConvFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      setQConvStatus('UNSUPPORTED_FORMAT');
      setQConvStatusMsg(
        'Unsupported document format. Upload a .pdf, .docx, .jpg, .jpeg, or .png question document.'
      );
      return;
    }
    if (file.size <= 0) {
      setQConvSession(null);
      setQConvStatus('CORRUPTED_DOCUMENT');
      setQConvStatusMsg('The selected question document is empty (0 bytes).');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setQConvSession(null);
      setQConvStatus('UNSUPPORTED_FORMAT');
      setQConvStatusMsg('Question document exceeds the 25 MB upload limit.');
      return;
    }

    if (qConvDebounceRef.current) {
      clearTimeout(qConvDebounceRef.current);
      qConvDebounceRef.current = null;
    }

    const seq = ++qConvSeqRef.current;
    setQConvPendingFile(file);
    setQConvSession(null);
    setQConvGroupTab('ALL');
    setUnassignedAttachMap({});
    setQConvFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    setQConvStatus('UPLOADING');
    setQConvStatusMsg(
      `Uploading "${file.name}" to the backend conversion service for ${selectedSubject.code}...`
    );

    try {
      const existingTexts = activeQuestions.map((q) => q.questionText.trim()).filter(Boolean);
      setQConvStatus('PROCESSING');
      setQConvStatusMsg(
        `Backend is identifying modules and extracting all questions & diagrams from "${file.name}" for ${selectedSubject.code}...`
      );
      const session = await documentConversionService.uploadQuestionDocument({
        file,
        semesterNumber: selectedSubject.semesterNumber,
        subject: selectedSubject,
        selectedPageRange: convPageRange.trim() || undefined,
        existingQuestionTexts: existingTexts,
        actor: user,
      });

      if (seq !== qConvSeqRef.current) return;
      setQConvSession(session);
      setQConvStatus(session.status);
      setQConvStatusMsg(session.statusMessage);
    } catch (err) {
      if (seq !== qConvSeqRef.current) return;
      const mapped = mapQuestionConvError(err);
      setQConvStatus(mapped.status);
      setQConvStatusMsg(mapped.message);
    }
  };

  const handleQuestionDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await submitQuestionFileToBackend(file);
  };

  const handleRetryQuestionConversion = async () => {
    if (!qConvPendingFile) return;
    await submitQuestionFileToBackend(qConvPendingFile);
  };

  const syncQuestionSession = useCallback(
    async (
      sessionSnapshot: QuestionConversionSession,
      nextRecords: ExtractedQuestionPreviewRow[],
      nextUnassigned: QuestionImageAsset[]
    ) => {
      if (!selectedSubject || !user) return;
      const seq = ++qConvSeqRef.current;
      setQConvRevalidating(true);

      try {
        const existingTexts = activeQuestions.map((q) => q.questionText.trim()).filter(Boolean);
        const updated = await documentConversionService.updateQuestionConversionRecords({
          conversionId: sessionSnapshot.conversionId,
          records: nextRecords,
          unassignedImages: nextUnassigned,
          existingQuestionTexts: existingTexts,
          actor: user,
        });
        if (seq !== qConvSeqRef.current) return;
        setQConvSession(updated);
        setQConvStatus(updated.status);
        setQConvStatusMsg(updated.statusMessage);
        setQConvGroupTab((prev) => {
          if (typeof prev === 'number' && !updated.detectedModules.some((g) => g.moduleNumber === prev)) {
            return 'ALL';
          }
          if (prev === 'NEEDS_REVIEW' && updated.needsModuleReviewCount === 0) {
            return 'ALL';
          }
          return prev;
        });
      } catch (err) {
        if (seq !== qConvSeqRef.current) return;
        const mapped = mapQuestionConvError(err);
        setQConvStatus(mapped.status);
        setQConvStatusMsg(mapped.message);
      } finally {
        if (seq === qConvSeqRef.current) {
          setQConvRevalidating(false);
        }
      }
    },
    [selectedSubject, user, activeQuestions]
  );

  const handleValidateQuestionSession = async () => {
    if (!qConvSession || !user) return;
    const seq = ++qConvSeqRef.current;
    setQConvRevalidating(true);
    try {
      const existingTexts = activeQuestions.map((q) => q.questionText.trim()).filter(Boolean);
      const updated = await documentConversionService.validateQuestionConversion({
        conversionId: qConvSession.conversionId,
        records: qConvSession.records,
        unassignedImages: qConvSession.unassignedImages,
        existingQuestionTexts: existingTexts,
        actor: user,
      });
      if (seq !== qConvSeqRef.current) return;
      setQConvSession(updated);
      setQConvStatus(updated.status);
      setQConvStatusMsg(updated.statusMessage);
      setQConvGroupTab((prev) => {
        if (typeof prev === 'number' && !updated.detectedModules.some((g) => g.moduleNumber === prev)) {
          return 'ALL';
        }
        if (prev === 'NEEDS_REVIEW' && updated.needsModuleReviewCount === 0) {
          return 'ALL';
        }
        return prev;
      });
    } catch (err) {
      if (seq !== qConvSeqRef.current) return;
      const mapped = mapQuestionConvError(err);
      setQConvStatus(mapped.status);
      setQConvStatusMsg(mapped.message);
    } finally {
      if (seq === qConvSeqRef.current) {
        setQConvRevalidating(false);
      }
    }
  };

  const scheduleQuestionSync = useCallback(
    (
      sessionSnapshot: QuestionConversionSession,
      nextRecords: ExtractedQuestionPreviewRow[],
      nextUnassigned: QuestionImageAsset[]
    ) => {
      if (qConvDebounceRef.current) {
        clearTimeout(qConvDebounceRef.current);
      }
      setQConvRevalidating(true);
      qConvDebounceRef.current = setTimeout(() => {
        void syncQuestionSession(sessionSnapshot, nextRecords, nextUnassigned);
      }, 320);
    },
    [syncQuestionSession]
  );

  const handleQuestionModuleChange = (previewId: string, rawVal: string) => {
    if (!qConvSession) return;
    const nextMod = rawVal === '' ? null : Number(rawVal);
    const nextRecords = qConvSession.records.map((r) =>
      r.previewId === previewId
        ? {
          ...r,
          assignedModuleNumber: nextMod,
          moduleSource: nextMod === null ? ('UNKNOWN' as const) : ('MANUAL' as const),
        }
        : r
    );
    const nextSession = { ...qConvSession, records: nextRecords, downloadEligible: false };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, qConvSession.unassignedImages);
  };

  const handleQuestionFieldEdit = (
    previewId: string,
    field: 'questionText' | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'correctOption',
    value: string
  ) => {
    if (!qConvSession) return;
    const nextRecords = qConvSession.records.map((r) =>
      r.previewId === previewId ? { ...r, [field]: value } : r
    );
    const localSession = { ...qConvSession, records: nextRecords, downloadEligible: false };
    setQConvSession(localSession);
    scheduleQuestionSync(localSession, nextRecords, qConvSession.unassignedImages);
  };

  const handleImageReassignField = (
    previewId: string,
    assetId: string,
    nextField: QuestionImageField
  ) => {
    if (!qConvSession) return;
    const nextRecords = qConvSession.records.map((r) => {
      if (r.previewId !== previewId) return r;
      return {
        ...r,
        images: r.images.map((im) =>
          im.assetId === assetId
            ? { ...im, targetField: nextField, uncertainAssociation: false }
            : im
        ),
      };
    });
    const nextSession = { ...qConvSession, records: nextRecords, downloadEligible: false };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, qConvSession.unassignedImages);
  };

  const handleImageConfirmPlacement = (previewId: string, assetId: string) => {
    if (!qConvSession) return;
    const nextRecords = qConvSession.records.map((r) =>
      r.previewId === previewId
        ? {
          ...r,
          images: r.images.map((im) =>
            im.assetId === assetId ? { ...im, uncertainAssociation: false } : im
          ),
        }
        : r
    );
    const nextSession = { ...qConvSession, records: nextRecords, downloadEligible: false };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, qConvSession.unassignedImages);
  };

  const handleImageMoveOrder = (previewId: string, assetId: string, direction: -1 | 1) => {
    if (!qConvSession) return;
    const nextRecords = qConvSession.records.map((r) => {
      if (r.previewId !== previewId) return r;
      const imgs = [...r.images];
      const pos = imgs.findIndex((im) => im.assetId === assetId);
      const swapPos = pos + direction;
      if (pos < 0 || swapPos < 0 || swapPos >= imgs.length) return r;
      [imgs[pos], imgs[swapPos]] = [imgs[swapPos], imgs[pos]];
      return {
        ...r,
        images: imgs.map((im, sIdx) => ({ ...im, sequence: sIdx + 1 })),
      };
    });
    const nextSession = { ...qConvSession, records: nextRecords, downloadEligible: false };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, qConvSession.unassignedImages);
  };

  const handleImageRemove = (
    previewId: string,
    assetId: string,
    moveToUnassigned: boolean
  ) => {
    if (!qConvSession) return;
    let movedAsset: QuestionImageAsset | null = null;
    const nextRecords = qConvSession.records.map((r) => {
      if (r.previewId !== previewId) return r;
      const kept: QuestionImageAsset[] = [];
      r.images.forEach((im) => {
        if (im.assetId === assetId) movedAsset = im;
        else kept.push(im);
      });
      return {
        ...r,
        images: kept.map((im, sIdx) => ({ ...im, sequence: sIdx + 1 })),
      };
    });
    const nextUnassigned =
      moveToUnassigned && movedAsset
        ? [...qConvSession.unassignedImages, movedAsset]
        : qConvSession.unassignedImages;
    const nextSession = {
      ...qConvSession,
      records: nextRecords,
      unassignedImages: nextUnassigned,
      downloadEligible: false,
    };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, nextUnassigned);
  };

  const handleAttachUnassignedImage = (asset: QuestionImageAsset) => {
    if (!qConvSession || qConvSession.records.length === 0) return;
    const selection = unassignedAttachMap[asset.assetId] || {
      previewId: qConvSession.records[0].previewId,
      targetField: asset.targetField || 'QUESTION_TEXT',
    };
    const nextRecords = qConvSession.records.map((r) => {
      if (r.previewId !== selection.previewId) return r;
      const attached: QuestionImageAsset = {
        ...asset,
        targetField: selection.targetField,
        uncertainAssociation: false,
        sequence: r.images.length + 1,
      };
      return { ...r, images: [...r.images, attached] };
    });
    const nextUnassigned = qConvSession.unassignedImages.filter(
      (im) => im.assetId !== asset.assetId
    );
    const nextSession = {
      ...qConvSession,
      records: nextRecords,
      unassignedImages: nextUnassigned,
      downloadEligible: false,
    };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, nextUnassigned);
  };

  const handleDiscardUnassignedImage = (assetId: string) => {
    if (!qConvSession) return;
    const nextUnassigned = qConvSession.unassignedImages.filter((im) => im.assetId !== assetId);
    const nextSession = {
      ...qConvSession,
      unassignedImages: nextUnassigned,
      downloadEligible: false,
    };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, qConvSession.records, nextUnassigned);
  };

  const handleAddBlankQuestionRow = () => {
    if (!qConvSession) return;
    const nextNum = qConvSession.records.length + 1;
    const defaultMod = typeof qConvGroupTab === 'number' ? qConvGroupTab : null;
    const blankRow: ExtractedQuestionPreviewRow = {
      previewId: `prev-q-manual-${Date.now()}-${nextNum}`,
      rowNumber: nextNum,
      detectedModuleNumber: defaultMod,
      assignedModuleNumber: defaultMod,
      moduleSource: defaultMod === null ? 'UNKNOWN' : 'MANUAL',
      pageNumber: 1,
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: '',
      answerKeyStatus: 'MISSING',
      images: [],
      isValid: false,
      uncertain: true,
      uncertainModule: defaultMod === null,
      errors: [
        defaultMod === null
          ? 'Select module, question content, four distinct options, and answer key.'
          : 'Enter question content, four distinct options, and answer key.',
      ],
      invalidFields: {
        moduleNumber: defaultMod === null,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        correctOption: true,
        images: false,
      },
      note: 'Incomplete manual review row',
    };
    const nextRecords = [...qConvSession.records, blankRow];
    const nextSession = { ...qConvSession, records: nextRecords, downloadEligible: false };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, qConvSession.unassignedImages);
  };

  const handleRemoveQuestionRow = (previewId: string) => {
    if (!qConvSession) return;
    const removed = qConvSession.records.find((r) => r.previewId === previewId);
    const nextRecords = qConvSession.records
      .filter((r) => r.previewId !== previewId)
      .map((r, i) => ({ ...r, rowNumber: i + 1 }));
    const nextUnassigned = removed?.images?.length
      ? [...qConvSession.unassignedImages, ...removed.images]
      : qConvSession.unassignedImages;
    const nextSession = {
      ...qConvSession,
      records: nextRecords,
      unassignedImages: nextUnassigned,
      downloadEligible: false,
    };
    setQConvSession(nextSession);
    void syncQuestionSession(nextSession, nextRecords, nextUnassigned);
  };

  const handleDownloadModuleExcel = async (
    moduleNumber: number,
    recommendedFileName: string,
    downloadUrl?: string
  ) => {
    if (!qConvSession || !user || qConvRevalidating) return;
    setQConvDownloadingModule(moduleNumber);
    try {
      await documentConversionService.downloadQuestionConversionExcel({
        conversionId: qConvSession.conversionId,
        moduleNumber,
        fallbackFileName: recommendedFileName,
        actor: user,
        downloadUrl,
      });
    } catch (err) {
      setQConvStatus('DOWNLOAD_FAILED');
      setQConvStatusMsg(
        err instanceof Error
          ? err.message
          : `Module ${moduleNumber} Excel export failed. Resolve remaining validation errors and retry.`
      );
    } finally {
      setQConvDownloadingModule(null);
    }
  };

  // Section B Handlers: Course Outcomes PDF Submission (100% independent of Question Conversion)
  const handleCourseOutcomeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = await validateCourseOutcomePdfFile(file);
    if (validationError) {
      setCoSelectedFile(null);
      setCoPreviewExpanded(false);
      setCoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCoUploadStatus('FAILED');
      setCoUploadMessage(validationError);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    setCoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextObjectUrl;
    });
    setCoSelectedFile(file);
    setCoPreviewExpanded(false);
    setCoUploadStatus('IDLE');
    setCoUploadMessage('');
  };

  const handleClearCourseOutcomeSelection = () => {
    setCoSelectedFile(null);
    setCoPreviewExpanded(false);
    setCoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoNotes('');
    setCoUploadStatus('IDLE');
    setCoUploadMessage('');
  };

  const submitCourseOutcomeToBackend = async () => {
    if (!coSelectedFile || !selectedSubject || !user) return;
    setCoUploadStatus('UPLOADING');
    setCoUploadMessage(
      `Submitting Course Outcomes PDF "${coSelectedFile.name}" for ${selectedSubject.code} (${formatSemesterOrdinal(selectedSubject.semesterNumber)}) to backend storage...`
    );

    try {
      const result = await courseOutcomeService.uploadCourseOutcomePdf({
        file: coSelectedFile,
        subject: selectedSubject,
        actor: user,
        notes: coNotes,
      });
      setCoRevisions(Array.isArray(result.revisions) ? result.revisions : []);
      setCoUploadStatus('UPLOADED');
      setCoUploadMessage(
        `Course Outcomes PDF submitted as ${result.uploadedRevision.revisionNumber} on ${result.uploadedRevision.uploadedAt} and made available to the COE Portal.`
      );
      setCoSelectedFile(null);
      setCoPreviewExpanded(false);
      setCoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCoNotes('');
    } catch (err) {
      setCoUploadStatus('FAILED');
      setCoUploadMessage(
        err instanceof Error
          ? err.message
          : 'Course Outcomes PDF upload failed due to a backend error.'
      );
    }
  };

  const handleDownloadCourseOutcomeRevision = async (rev: CourseOutcomeDocumentRevision) => {
    if (!user) return;
    setCoDownloadingId(rev.id);
    try {
      await courseOutcomeService.downloadCourseOutcomePdf({
        subjectId: rev.subjectId,
        documentId: rev.id,
        fallbackFileName: rev.fileName,
        actor: user,
      });
    } catch (err) {
      setCoUploadStatus('FAILED');
      setCoUploadMessage(
        err instanceof Error ? err.message : 'Unable to download Course Outcomes PDF from backend.'
      );
    } finally {
      setCoDownloadingId(null);
    }
  };

  const visibleConvRecords = useMemo(() => {
    if (!qConvSession) return [];
    if (qConvGroupTab === 'ALL') return qConvSession.records;
    if (qConvGroupTab === 'NEEDS_REVIEW') {
      return qConvSession.records.filter(
        (r) =>
          r.assignedModuleNumber === null ||
          r.uncertainModule ||
          r.assignedModuleNumber < 1 ||
          r.assignedModuleNumber > qConvSession.subjectModuleCount
      );
    }
    return qConvSession.records.filter((r) => r.assignedModuleNumber === qConvGroupTab);
  }, [qConvSession, qConvGroupTab]);

  const handleSaveBlueprint = async () => {
    if (!user || !selectedSubject) return;
    if (configuredTotalQuestions <= 0) {
      setFeedback({ type: 'error', text: 'Total questions must be greater than zero.' });
      return;
    }
    if (blueprintTotal !== configuredTotalQuestions) {
      setFeedback({
        type: 'error',
        text: `Sum of module questions (${blueprintTotal}) does not equal configured total questions (${configuredTotalQuestions}).`,
      });
      return;
    }
    setSavingBlueprint(true);
    setFeedback(null);
    try {
      const saved = await questionService.saveBlueprint(
        selectedSubject.id,
        {
          totalQuestions: configuredTotalQuestions,
          moduleDistribution: moduleDist,
        },
        user
      );
      setFeedback({
        type: 'success',
        text: `Paper blueprint saved successfully for ${selectedSubject.code}: ${saved.totalQuestions} questions across ${selectedSubject.moduleCount} modules.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save blueprint.',
      });
    } finally {
      setSavingBlueprint(false);
    }
  };

  const handleGenerateAvailableSets = async () => {
    if (!user || !selectedSubject || !capacityCheck?.isValid || capacityCheck.maxCompleteSets < 1) return;
    if (configuredTotalQuestions > 0 && blueprintTotal !== configuredTotalQuestions) {
      setFeedback({
        type: 'error',
        text: `Cannot generate sets: Sum of module questions (${blueprintTotal}) must equal configured total questions (${configuredTotalQuestions}).`,
      });
      return;
    }
    setFeedback(null);
    setGeneratingSets(true);
    const blueprint: PaperBlueprint = {
      totalQuestions: configuredTotalQuestions > 0 ? configuredTotalQuestions : blueprintTotal,
      moduleDistribution: moduleDist,
    };
    try {
      const summary = await questionService.generateAvailableNumberedSets(
        selectedSubject.id,
        blueprint,
        user
      );
      setGenerationSummary(summary);
      setFeedback({
        type: 'success',
        text: `Generated ${summary.generatedSetCount} fully disjoint numbered set(s) (${summary.totalUniqueQuestionsAllocated} unique questions allocated, 0 overlap). Ready for explicit publication to COE.`,
      });
    } catch (err) {
      setGenerationSummary(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate numbered sets.',
      });
    } finally {
      setGeneratingSets(false);
    }
  };

  const handleConfirmPublish = async () => {
    if (!user || !selectedSubject || !generationSummary || generationSummary.generatedSetCount < 1) {
      return;
    }
    setPublishing(true);
    try {
      const pub = await questionService.publishGeneratedSets(
        selectedSubject.id,
        generationSummary.generationId,
        publishNotes,
        user
      );
      setFeedback({
        type: 'success',
        text: `Published ${pub.setsGeneratedCount} fully disjoint numbered set(s) (${pub.revisionNumber}) for ${selectedSubject.code}. Sets 1${pub.setsGeneratedCount > 1 ? `–${pub.setsGeneratedCount}` : ''} are now available to the COE Portal for sitting selection.`,
      });
      setPublishDialogOpen(false);
      setPublishNotes('');
      setGenerationSummary(null);
      await loadSubjectQuestionData();
      switchSubTab('history');
    } catch (err) {
      setPublishDialogOpen(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Publication failed.',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#17243A] dark:text-white tracking-tight">
            Questions & Paper Blueprint ({user?.departmentCode})
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Manage subject-level questions dynamically across configured modules, validate Excel/PDF uploads, generate available disjoint numbered sets, and publish to COE.
          </p>
        </div>

        {/* Shared Semester & Subject Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white dark:bg-slate-900 px-3.5 py-2 rounded-lg border border-[#D9E2EF] dark:border-slate-800 flex items-center gap-2">
            <label htmlFor="q-semester" className="text-xs font-semibold text-[#64748B]">
              Semester:
            </label>
            <select
              id="q-semester"
              value={selectedSemester}
              onChange={(e) => handleSemesterSelect(Number(e.target.value))}
              className="text-sm font-bold text-[#17243A] dark:text-white bg-transparent focus:outline-none"
            >
              {MASTER_SEMESTER_OPTIONS.map((sem) => (
                <option key={sem.number} value={sem.number} className="dark:bg-slate-900">
                  {sem.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 px-3.5 py-2 rounded-lg border border-[#D9E2EF] dark:border-slate-800 flex items-center gap-2">
            <label htmlFor="q-subject" className="text-xs font-semibold text-[#64748B]">
              Subject:
            </label>
            {subjectsLoading && (
              <RefreshCw
                className="w-3.5 h-3.5 text-[#2563EB] animate-spin shrink-0"
                aria-label="Loading department subjects"
              />
            )}
            <select
              id="q-subject"
              value={selectedSubjectId}
              disabled={subjectsLoading || filteredSubjects.length === 0}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="text-sm font-bold text-[#17243A] dark:text-white bg-transparent focus:outline-none disabled:opacity-60"
            >
              {subjectsLoading ? (
                <option value="" className="dark:bg-slate-900">
                  Loading department subjects...
                </option>
              ) : subjectsError ? (
                <option value="" className="dark:bg-slate-900">
                  Failed to load subjects
                </option>
              ) : filteredSubjects.length === 0 ? (
                <option value="" className="dark:bg-slate-900">
                  No subjects for {formatSemesterOrdinal(selectedSemester)}
                </option>
              ) : (
                filteredSubjects.map((s) => (
                  <option key={s.id} value={s.id} className="dark:bg-slate-900">
                    {s.code} — {s.name} (Sem {s.semesterNumber} · {s.moduleCount} Modules)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${feedback.type === 'success'
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

      {/* Sub-tabs (Question Pool & Upload -> Document Converter -> QP Shuffling & Sets -> Paper Blueprint & Publish Sets -> Key Corrections -> Publication History) */}
      <div className="border-b border-[#D9E2EF] dark:border-slate-800 flex flex-wrap gap-6">
        <button
          type="button"
          onClick={() => switchSubTab('pool')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${subTab === 'pool'
            ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
            : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
            }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>Question Pool & Upload ({selectedSubject ? activeQuestions.length : 0})</span>
        </button>
        <button
          type="button"
          onClick={() => switchSubTab('blueprint')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${subTab === 'blueprint'
            ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
            : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
            }`}
        >
          <Send className="w-4 h-4" />
          <span>Paper Blueprint & Publish Sets</span>
        </button>
        <button
          type="button"
          onClick={() => switchSubTab('key-correction')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${subTab === 'key-correction'
            ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
            : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
            }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Key Corrections</span>
        </button>
        <button
          type="button"
          onClick={() => switchSubTab('history')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${subTab === 'history'
            ? 'border-[#2563EB] text-[#2563EB] dark:text-blue-400'
            : 'border-transparent text-[#64748B] hover:text-[#17243A] dark:hover:text-white'
            }`}
        >
          <History className="w-4 h-4" />
          <span>Publication History ({selectedSubject ? safePublications.length : 0})</span>
        </button>
      </div>

      {subTab !== 'key-correction' && subjectsLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-8 flex items-center justify-center gap-3 text-sm text-[#64748B]">
          <RefreshCw className="w-4 h-4 text-[#2563EB] animate-spin" />
          <span>Loading department subjects for {formatSemesterOrdinal(selectedSemester)}...</span>
        </div>
      ) : subTab !== 'key-correction' && subjectsError ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#B42318]/40 p-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-start gap-2.5 text-[#B42318] dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Unable to Load Department Subjects</div>
              <p className="mt-0.5">{subjectsError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubjectRetryNonce((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#B42318] hover:bg-[#911B12] text-white text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : subTab !== 'key-correction' && !selectedSubject ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-10 text-center space-y-2">
          <div className="text-sm font-semibold text-[#17243A] dark:text-white">
            No subjects have been added for this semester yet.
          </div>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Active context: <strong>{formatSemesterOrdinal(selectedSemester)}</strong>. Add subjects in Setup Class to manage question banks, Course Outcomes PDFs, and paper blueprints for this semester.
          </p>
        </div>
      ) : subTab !== 'key-correction' && selectedSubject ? (
        <>
          {/* Subject Context Strip */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Code: <strong className="font-mono">{selectedSubject.code}</strong>
              </span>
              <span>
                Semester: <strong>{formatSemesterOrdinal(selectedSubject.semesterNumber)}</strong>
              </span>
              <span>
                Configured Modules: <strong>{selectedSubject.moduleCount}</strong>
              </span>
              <span>
                Applicability: <strong>All Sections</strong>
              </span>
              <span>
                Active Question Pool: <strong className="tabular-nums">{activeQuestions.length}</strong>
              </span>
            </div>
            {safePublications[0] && (
              <div className="flex items-center gap-2">
                <span className="text-[#64748B]">Latest Publication:</span>
                <span className="font-mono font-bold">{safePublications[0].revisionNumber}</span>
                <StatusBadge status={safePublications[0].status} />
              </div>
            )}
          </div>

          {/* SUBTAB 1: QUESTION POOL & UPLOAD */}
          {subTab === 'pool' && (
            <div className="space-y-6">
              {/* Upload Controls */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                      Add or Bulk Upload Questions (Strict Module-Wise Batch)
                    </h2>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Each Excel upload imports questions for <strong>one selected module</strong> only. Required columns: <strong>Module Number, Question Text, Option A, Option B, Option C, Option D, Correct Option</strong> (embedded images supported).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800 text-xs">
                      <label htmlFor="excel-target-module" className="font-semibold text-[#64748B]">
                        Upload Module:
                      </label>
                      <select
                        id="excel-target-module"
                        value={selectedExcelModule}
                        onChange={(e) => {
                          setSelectedExcelModule(Number(e.target.value));
                          setExcelResult(null);
                        }}
                        className="font-bold text-[#17243A] dark:text-white bg-transparent focus:outline-none"
                      >
                        {Array.from({ length: selectedSubject.moduleCount }, (_, i) => i + 1).map(
                          (m) => (
                            <option key={m} value={m} className="dark:bg-slate-900">
                              Module {m}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingQ(null);
                        setQForm({
                          moduleNumber: selectedExcelModule,
                          questionText: '',
                          optionA: '',
                          optionB: '',
                          optionC: '',
                          optionD: '',
                          correctOption: 'A',
                        });
                        setQModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#17243A] dark:bg-slate-800 text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Individual Question</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadQuestionExcelTemplate(
                          selectedSubject.code,
                          selectedExcelModule
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Download Template</span>
                    </button>

                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Upload Module {selectedExcelModule} Excel (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleExcelUpload}
                      />
                    </label>

                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#16834A] hover:bg-[#126D3D] text-white text-xs font-semibold cursor-pointer">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Bulk Upload All Modules (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleBulkExcelUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* Excel Preview & Validation (with reconstructed cell-anchored images) */}
                {excelResult && (
                  <div className="p-4 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          <strong>File:</strong> {excelResult.fileName} (
                          {(excelResult.fileSizeBytes / 1024).toFixed(1)} KB)
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-semibold">
                          Target: {isBulkAllModulesUpload ? `All Modules (1 to ${selectedSubject.moduleCount})` : `Module ${selectedExcelModule}`}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#6D5CE8] dark:text-violet-300 font-semibold">
                          <ImageIcon className="w-3.5 h-3.5" />
                          Images Extracted: {excelResult.totalImagesExtracted}
                        </span>
                        {excelResult.questionsWithImagesCount !== undefined && (
                          <span className="inline-flex items-center gap-1 text-[#475569] dark:text-slate-300">
                            Questions w/ Img: <strong>{excelResult.questionsWithImagesCount}</strong>
                          </span>
                        )}
                        {excelResult.optionsWithImagesCount !== undefined && (
                          <span className="inline-flex items-center gap-1 text-[#475569] dark:text-slate-300">
                            Options w/ Img: <strong>{excelResult.optionsWithImagesCount}</strong>
                          </span>
                        )}
                      </div>
                      {excelResult.success && (
                        <div className="flex gap-3 font-semibold">
                          <span className="text-[#16834A] dark:text-emerald-400">
                            Valid: {excelResult.validCount}
                          </span>
                          <span
                            className={
                              excelResult.invalidCount > 0 ? 'text-[#B42318]' : 'text-[#64748B]'
                            }
                          >
                            Invalid: {excelResult.invalidCount}
                          </span>
                        </div>
                      )}
                    </div>

                    {excelResult.moduleBreakdown && Object.keys(excelResult.moduleBreakdown).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="font-semibold text-slate-500">Module Distribution:</span>
                        {Object.entries(excelResult.moduleBreakdown)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([m, c]) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border border-[#D9E2EF] dark:border-slate-600 font-medium text-[#1E293B] dark:text-slate-200"
                            >
                              Module {m}: <strong>{c}</strong>
                            </span>
                          ))}
                      </div>
                    )}

                    {!excelResult.success ? (
                      <div className="p-3 rounded-md bg-[#B42318]/10 border border-[#B42318]/30 text-xs text-[#B42318] dark:text-red-300 font-medium">
                        {excelResult.fatalError}
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto max-h-72 overflow-y-auto bg-white dark:bg-slate-900 rounded border border-[#D9E2EF] dark:border-slate-700">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F5F7FB] dark:bg-slate-800 border-b border-[#D9E2EF] dark:border-slate-700">
                                <th className="py-2 px-3">Row</th>
                                <th className="py-2 px-3">Sheet</th>
                                <th className="py-2 px-3">Mod</th>
                                <th className="py-2 px-3">Question, Options & Extracted Images</th>
                                <th className="py-2 px-3">Key</th>
                                <th className="py-2 px-3">Validation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                              {excelResult.rows.map((r) => (
                                <tr
                                  key={r.rowNumber}
                                  className={r.isValid ? '' : 'bg-[#B42318]/5 dark:bg-red-950/20'}
                                >
                                  <td className="py-2 px-3 tabular-nums align-top">{r.rowNumber}</td>
                                  <td className="py-2 px-3 align-top font-medium text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                                    {r.worksheetName || '—'}
                                  </td>
                                  <td className="py-2 px-3 tabular-nums align-top">
                                    {r.moduleRaw || '—'}
                                  </td>
                                  <td className="py-2 px-3 max-w-lg space-y-1.5 align-top">
                                    <div className="font-medium text-[#17243A] dark:text-white">
                                      {r.questionText || (r.questionImages.length > 0 ? '[Image Question]' : '—')}
                                    </div>
                                    {r.questionImages.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {r.questionImages.map((img) => (
                                          <button
                                            key={img.assetId}
                                            type="button"
                                            onClick={() => setZoomImage(img)}
                                            className="p-0.5 rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#2563EB]"
                                            title="Click to inspect question diagram"
                                          >
                                            <img
                                              src={resolveImageSrc(img)}
                                              alt={img.altText || 'Question diagram'}
                                              className="h-10 w-auto max-w-[120px] object-contain"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                                      {(
                                        [
                                          ['A', r.optionA, r.optionAImages],
                                          ['B', r.optionB, r.optionBImages],
                                          ['C', r.optionC, r.optionCImages],
                                          ['D', r.optionD, r.optionDImages],
                                        ] as [string, string, QuestionImageAsset[]][]
                                      ).map(([lbl, txt, imgs]) => (
                                        <div key={lbl} className="flex items-center gap-1.5">
                                          <span className="font-bold">{lbl}:</span>
                                          <span className="truncate">{txt || (imgs.length ? '[Image]' : '—')}</span>
                                          {imgs.map((im) => (
                                            <button
                                              key={im.assetId}
                                              type="button"
                                              onClick={() => setZoomImage(im)}
                                              className="shrink-0 p-0.5 rounded border border-[#D9E2EF] dark:border-slate-700"
                                            >
                                              <img
                                                src={resolveImageSrc(im)}
                                                alt={`Option ${lbl}`}
                                                className="h-6 w-auto object-contain"
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 font-bold align-top">
                                    {r.correctOption || '—'}
                                  </td>
                                  <td className="py-2 px-3 align-top">
                                    {r.isValid ? (
                                      <span className="text-[#16834A] font-semibold">Valid</span>
                                    ) : (
                                      <span className="text-[#B42318] font-medium">
                                        {r.errors.join(' | ')}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setExcelResult(null)}
                            className="px-3 py-1.5 rounded border border-[#D9E2EF] dark:border-slate-700 text-xs font-semibold"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            disabled={excelResult.validCount === 0 || importingExcel}
                            onClick={() => setConfirmImportOpen(true)}
                            className="px-4 py-1.5 rounded bg-[#16834A] hover:bg-[#126D3D] text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {importingExcel
                              ? 'Importing...'
                              : isBulkAllModulesUpload
                              ? `Import ${excelResult.validCount} Question(s) Across All Modules`
                              : `Import ${excelResult.validCount} Module ${selectedExcelModule} Question(s)`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* SECTION B: Course Outcomes PDF Document Submission (Independent of Question Conversion) */}
                <div className="pt-5 border-t border-[#D9E2EF] dark:border-slate-800 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                          Section B · Course Outcomes Document
                        </span>
                        <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                          Shared Context: {user?.departmentCode} · {formatSemesterOrdinal(selectedSubject.semesterNumber)} · {selectedSubject.code}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#2563EB]" />
                        <span>Course Outcomes Document (.pdf) Submission for COE Portal</span>
                      </h3>
                      <p className="text-xs text-[#64748B] dark:text-slate-400">
                        Submit the official Course Outcomes PDF directly for{' '}
                        <strong>
                          {selectedSubject.code} — {selectedSubject.name}
                        </strong>
                        . Stored as an original PDF document for COE Portal reference without OCR, question extraction, or Excel conversion. Replacing the file preserves earlier revisions with timestamps.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#17243A] hover:bg-[#0F172A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {coRevisions.some((r) => r.status === 'Active')
                            ? 'Select Replacement CO PDF (.pdf)'
                            : 'Select Course Outcomes PDF (.pdf)'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => void handleCourseOutcomeFileSelect(e)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Independent CO Upload / Validation / Error Feedback */}
                  {coUploadStatus !== 'IDLE' && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3 ${coUploadStatus === 'UPLOADED'
                        ? 'bg-[#16834A]/10 border-[#16834A]/30 text-[#16834A] dark:text-emerald-300'
                        : coUploadStatus === 'UPLOADING'
                          ? 'bg-[#2563EB]/10 border-[#2563EB]/30 text-[#2563EB] dark:text-blue-300'
                          : 'bg-[#B42318]/10 border-[#B42318]/30 text-[#B42318] dark:text-red-300'
                        }`}
                    >
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {coUploadStatus === 'UPLOADED' ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        ) : coUploadStatus === 'UPLOADING' ? (
                          <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        )}
                        <span className="font-medium leading-relaxed">{coUploadMessage}</span>
                      </div>

                      {coUploadStatus === 'FAILED' && coSelectedFile && (
                        <button
                          type="button"
                          onClick={() => void submitCourseOutcomeToBackend()}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#B42318] hover:bg-[#911B12] text-white text-[11px] font-semibold shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry Upload</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Selected Original CO PDF Staging Card + Optional Safe Preview */}
                  {coSelectedFile && (
                    <div className="p-4 rounded-lg border border-[#2563EB]/35 bg-[#F5F7FB] dark:bg-slate-800/60 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#2563EB]" />
                            <span>{coSelectedFile.name}</span>
                            <span className="font-normal text-[#64748B]">
                              ({(coSelectedFile.size / 1024).toFixed(1)} KB · PDF Verified)
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                            Target: {selectedSubject.code} · {formatSemesterOrdinal(selectedSubject.semesterNumber)} ·{' '}
                            {coRevisions.some((r) => r.status === 'Active')
                              ? 'Will archive current active revision as Superseded and publish a new CO revision to COE.'
                              : 'Ready to submit to backend storage for COE Portal.'}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {coPreviewUrl && (
                            <button
                              type="button"
                              onClick={() => setCoPreviewExpanded((v) => !v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                              <span>{coPreviewExpanded ? 'Hide PDF Preview' : 'Preview PDF'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={coUploadStatus === 'UPLOADING'}
                            onClick={handleClearCourseOutcomeSelection}
                            className="px-2.5 py-1.5 rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold disabled:opacity-50"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            disabled={coUploadStatus === 'UPLOADING'}
                            onClick={() => void submitCourseOutcomeToBackend()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#16834A] hover:bg-[#126D3D] disabled:opacity-50 text-white font-semibold"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {coUploadStatus === 'UPLOADING'
                                ? 'Uploading...'
                                : coRevisions.some((r) => r.status === 'Active')
                                  ? 'Replace & Submit New CO Revision'
                                  : 'Submit Course Outcomes PDF'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={coNotes}
                          onChange={(e) => setCoNotes(e.target.value)}
                          placeholder="Optional submission note (e.g., Updated CO1-CO5 NBA mapping for 2026-27)"
                          className="w-full px-3 py-1.5 rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                      </div>

                      {coPreviewExpanded && coPreviewUrl && (
                        <div className="rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden">
                          <iframe
                            src={coPreviewUrl}
                            title={`Course Outcomes PDF Preview - ${selectedSubject.code}`}
                            className="w-full h-72 border-0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Backend Course Outcomes Revision Status & Replacement History */}
                  {coLoadError ? (
                    <div className="p-3 rounded-lg border border-[#B42318]/30 bg-[#B42318]/5 text-xs text-[#B42318] dark:text-red-300 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{coLoadError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadCourseOutcomesRevisions()}
                        className="px-2.5 py-1 rounded border border-[#B42318]/40 font-semibold shrink-0"
                      >
                        Retry Load
                      </button>
                    </div>
                  ) : coLoading ? (
                    <div className="text-xs text-[#64748B] py-1">
                      Checking Course Outcomes submission status for {selectedSubject.code}...
                    </div>
                  ) : coRevisions.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB]/60 dark:bg-slate-800/30 text-xs text-[#64748B] dark:text-slate-400">
                      No Course Outcomes PDF submitted yet for <strong>{selectedSubject.code}</strong> ({formatSemesterOrdinal(selectedSubject.semesterNumber)}). Select a <code>.pdf</code> file above to submit.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/40 overflow-hidden text-xs">
                      <div className="px-4 py-2.5 border-b border-[#D9E2EF] dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                          <History className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>
                            Course Outcomes Submission History ({coRevisions.length} revision{coRevisions.length === 1 ? '' : 's'})
                          </span>
                        </div>
                        {coRevisions.some((r) => r.status === 'Active' && r.coeAccessible) && (
                          <span className="px-2 py-0.5 rounded bg-[#16834A]/15 text-[#16834A] dark:text-emerald-300 font-semibold text-[11px]">
                            Active Revision Available in COE Portal
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#F5F7FB] dark:bg-slate-800/70 border-b border-[#D9E2EF] dark:border-slate-700 text-[#64748B]">
                              <th className="py-2 px-3">Revision</th>
                              <th className="py-2 px-3">PDF File</th>
                              <th className="py-2 px-3">Submitted At</th>
                              <th className="py-2 px-3">Submitted By</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Document</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                            {coRevisions.map((rev) => (
                              <tr key={rev.id}>
                                <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">
                                  {rev.revisionNumber}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-[#17243A] dark:text-slate-100">
                                    {rev.fileName}
                                  </div>
                                  <div className="text-[11px] text-[#64748B]">
                                    {(rev.fileSizeBytes / 1024).toFixed(1)} KB
                                    {rev.notes ? ` · ${rev.notes}` : ''}
                                  </div>
                                </td>
                                <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                                  {rev.uploadedAt}
                                </td>
                                <td className="py-2 px-3">{rev.uploadedBy}</td>
                                <td className="py-2 px-3">
                                  <StatusBadge status={rev.status} />
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    disabled={coDownloadingId === rev.id}
                                    onClick={() => void handleDownloadCourseOutcomeRevision(rev)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                                  >
                                    <Download className="w-3 h-3 text-[#2563EB]" />
                                    <span>
                                      {coDownloadingId === rev.id ? 'Downloading...' : 'Download PDF'}
                                    </span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Module-Wise Question Filter & Table */}
              <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#D9E2EF] dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModuleFilter('ALL')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold border ${moduleFilter === 'ALL'
                      ? 'bg-[#17243A] dark:bg-[#2563EB] text-white border-[#17243A]'
                      : 'border-[#D9E2EF] dark:border-slate-700'
                      }`}
                  >
                    All Modules ({activeQuestions.length})
                  </button>
                  {Array.from({ length: selectedSubject.moduleCount }, (_, i) => i + 1).map((mod) => {
                    const count = activeQuestions.filter((q) => q.moduleNumber === mod).length;
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setModuleFilter(mod)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold border tabular-nums ${moduleFilter === mod
                          ? 'bg-[#17243A] dark:bg-[#2563EB] text-white border-[#17243A]'
                          : 'border-[#D9E2EF] dark:border-slate-700'
                          }`}
                      >
                        Module {mod} ({count})
                      </button>
                    );
                  })}
                </div>

                {filteredQuestions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#64748B]">
                    No questions in this module yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#F5F7FB] dark:bg-slate-800 border-b border-[#D9E2EF] dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-4">Question ID</th>
                          <th className="py-2.5 px-3">Mod</th>
                          <th className="py-2.5 px-4">Question & Options</th>
                          <th className="py-2.5 px-3">Key</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                        {filteredQuestions.map((q) => (
                          <tr key={q.questionId}>
                            <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                              {q.questionId}
                            </td>
                            <td className="py-3 px-3 tabular-nums">M{q.moduleNumber}</td>
                            <td className="py-3 px-4 max-w-xl space-y-1.5">
                              <div className="font-medium text-[#17243A] dark:text-slate-100">
                                {q.questionText || (q.questionImages?.length ? '[Diagram Question]' : '')}
                              </div>
                              {q.questionImages && q.questionImages.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {q.questionImages.map((img) => (
                                    <button
                                      key={img.assetId}
                                      type="button"
                                      onClick={() => setZoomImage(img)}
                                      className="p-0.5 rounded border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#2563EB]"
                                      title="Click to inspect question diagram"
                                    >
                                      <img
                                        src={resolveImageSrc(img)}
                                        alt={img.altText || 'Question image'}
                                        className="h-12 w-auto max-w-[140px] object-contain"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                {(
                                  [
                                    ['A', q.optionA, q.optionAImages],
                                    ['B', q.optionB, q.optionBImages],
                                    ['C', q.optionC, q.optionCImages],
                                    ['D', q.optionD, q.optionDImages],
                                  ] as [string, string, QuestionImageAsset[] | undefined][]
                                ).map(([lbl, txt, imgs]) => (
                                  <div key={lbl} className="flex items-center gap-1.5">
                                    <span>
                                      {lbl}: {txt || (imgs?.length ? '[Image]' : '')}
                                    </span>
                                    {imgs?.map((im) => (
                                      <button
                                        key={im.assetId}
                                        type="button"
                                        onClick={() => setZoomImage(im)}
                                        className="p-0.5 rounded border border-[#D9E2EF] dark:border-slate-700"
                                      >
                                        <img
                                          src={resolveImageSrc(im)}
                                          alt={`Option ${lbl}`}
                                          className="h-6 w-auto object-contain"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-bold text-[#16834A] dark:text-emerald-400">
                              {q.correctOption}
                            </td>
                            <td className="py-3 px-3">
                              <StatusBadge status={q.status} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingQ(q);
                                    setQForm({
                                      moduleNumber: q.moduleNumber,
                                      questionText: q.questionText,
                                      optionA: q.optionA,
                                      optionB: q.optionB,
                                      optionC: q.optionC,
                                      optionD: q.optionD,
                                      correctOption: q.correctOption,
                                    });
                                    setQModalOpen(true);
                                  }}
                                  className="p-1 rounded border border-[#D9E2EF] dark:border-slate-700 text-[#2563EB]"
                                  title="Edit before publication"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!user) return;
                                    await questionService.setQuestionStatus(
                                      q.questionId,
                                      q.status === 'Active' ? 'Archived' : 'Active',
                                      user
                                    );
                                    await loadSubjectQuestionData();
                                  }}
                                  className="p-1 rounded border border-[#D9E2EF] dark:border-slate-700 text-[#B7791F]"
                                  title={q.status === 'Active' ? 'Archive' : 'Restore'}
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* SUBTAB 2: PAPER BLUEPRINT & DYNAMIC DISJOINT SETS */}
          {subTab === 'blueprint' && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
                      Configure Paper Blueprint & Generate Available Disjoint Sets
                    </h2>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Set questions required per module for one paper set. The system dynamically calculates and generates the maximum number of complete, strictly non-overlapping numbered sets supported by the available pool.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 bg-[#F5F7FB] dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-[#D9E2EF] dark:border-slate-700">
                      <label className="text-xs font-bold text-[#17243A] dark:text-slate-200">
                        Total Questions:
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={configuredTotalQuestions || ''}
                        placeholder="e.g. 30"
                        onChange={(e) => {
                          const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                          setConfiguredTotalQuestions(val);
                        }}
                        className="w-16 px-2 py-0.5 text-sm font-bold rounded border border-[#D9E2EF] dark:border-slate-600 bg-white dark:bg-slate-900 tabular-nums"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveBlueprint}
                      disabled={savingBlueprint || configuredTotalQuestions <= 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#17243A] hover:bg-[#0F172A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingBlueprint ? 'Saving...' : 'Save Blueprint'}</span>
                    </button>
                  </div>
                </div>

                {configuredTotalQuestions > 0 && blueprintTotal !== configuredTotalQuestions && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/50 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      <strong>Distribution Mismatch:</strong> Sum of module questions ({blueprintTotal}) does not match configured total questions ({configuredTotalQuestions}). Adjust module requirements so they total exactly {configuredTotalQuestions}.
                    </span>
                  </div>
                )}

                {/* Module-Wise Capacity Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Array.from({ length: selectedSubject.moduleCount }, (_, i) => i + 1).map((mod) => {
                    const mc = capacityCheck?.moduleChecks.find((c) => c.moduleNumber === mod);
                    const available = mc?.availableCount ?? activeQuestions.filter((q) => q.moduleNumber === mod).length;
                    const perSet = Number(moduleDist[mod]) || 0;
                    const maxSets = mc?.maxSetsSupported ?? (perSet > 0 ? Math.floor(available / perSet) : null);
                    const isShort = perSet > available;
                    return (
                      <div
                        key={mod}
                        className={`p-3 rounded-lg border space-y-1.5 ${isShort
                          ? 'border-[#B42318]/40 bg-[#B42318]/5 dark:bg-red-950/20'
                          : mc?.isLimiting && perSet > 0
                            ? 'border-amber-300 dark:border-amber-700/70 bg-amber-50/40 dark:bg-amber-950/15'
                            : 'border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/50'
                          }`}
                      >
                        <div className="flex justify-between text-xs font-bold">
                          <span>Module {mod}</span>
                          <span className="text-[#64748B] font-normal tabular-nums">
                            Available: {available}
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={moduleDist[mod] ?? 0}
                          onChange={(e) => {
                            setModuleDist({
                              ...moduleDist,
                              [mod]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            });
                            setGenerationSummary(null);
                          }}
                          className="w-full px-2.5 py-1.5 text-sm font-bold rounded border border-[#D9E2EF] dark:border-slate-600 bg-white dark:bg-slate-900 tabular-nums"
                        />
                        <div
                          className={`text-[11px] tabular-nums ${perSet === 0
                            ? 'text-[#64748B] dark:text-slate-400'
                            : isShort
                              ? 'text-[#B42318] dark:text-red-300 font-semibold'
                              : 'text-[#16834A] dark:text-emerald-400 font-semibold'
                            }`}
                        >
                          {perSet === 0
                            ? '0 per set (Excluded)'
                            : isShort
                              ? `Need ${perSet - available} more · Max Sets: 0`
                              : `Max Sets: ${maxSets}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic Blueprint Capacity Summary & Action */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-[#D9E2EF] dark:border-slate-800">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      <span>
                        <span className="text-[#64748B]">Configured Questions Per Set:</span>{' '}
                        <strong className="text-base text-[#17243A] dark:text-white tabular-nums">
                          {blueprintTotal}
                        </strong>
                      </span>
                      <span>
                        <span className="text-[#64748B]">Total Available Unique Questions:</span>{' '}
                        <strong className="text-base text-[#17243A] dark:text-white tabular-nums">
                          {capacityCheck?.totalAvailablePool ?? activeQuestions.length}
                        </strong>
                      </span>
                      <span>
                        <span className="text-[#64748B]">Maximum Complete Numbered Sets:</span>{' '}
                        <strong
                          className={`text-base tabular-nums ${(capacityCheck?.maxCompleteSets ?? 0) > 0
                            ? 'text-[#16834A] dark:text-emerald-400'
                            : 'text-[#B42318] dark:text-red-400'
                            }`}
                        >
                          {capacityCheck?.maxCompleteSets ?? 0}
                        </strong>
                      </span>
                      <span>
                        <span className="text-[#64748B]">Limiting Module:</span>{' '}
                        <strong className="text-[#17243A] dark:text-white">
                          {capacityCheck?.limitingModuleLabel || '—'}
                        </strong>
                      </span>
                    </div>

                    {blueprintTotal > 0 && capacityCheck && capacityCheck.maxCompleteSets > 0 && (
                      <div className="text-xs font-bold text-[#16834A] dark:text-emerald-300">
                        {capacityCheck.maxCompleteSets} Complete Numbered Set
                        {capacityCheck.maxCompleteSets === 1 ? '' : 's'} Can Be Generated
                      </div>
                    )}

                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                      Institutional Rule: Zero question reuse across numbered sets. Generated set contents and Question ID mappings remain strictly confidential to the COE workflow.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      blueprintTotal <= 0 ||
                      !capacityCheck?.isValid ||
                      capacityCheck.maxCompleteSets < 1 ||
                      generatingSets
                    }
                    onClick={handleGenerateAvailableSets}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#6D5CE8] hover:bg-[#5847D6] disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-semibold shrink-0"
                  >
                    <Eye className="w-4 h-4" />
                    <span>
                      {generatingSets ? 'Generating...' : 'Generate Available Numbered Sets'}
                    </span>
                  </button>
                </div>

                {/* Live Insufficient Question Pool Blocking Panel (Shown ONLY when 0 complete sets can be formed) */}
                {capacityCheck && blueprintTotal > 0 && capacityCheck.maxCompleteSets === 0 && (
                  <div className="p-5 rounded-lg bg-[#B42318]/10 border border-[#B42318]/30 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 text-[#B42318] dark:text-red-300">
                        <div className="text-sm font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Unable to Generate Sets: Insufficient Question Pool for 1 Complete Set</span>
                        </div>
                        <p className="leading-relaxed">
                          Each complete numbered set requires <strong>{capacityCheck.totalPerSet}</strong> valid unique questions across configured modules.{' '}
                          <strong>{capacityCheck.totalShortageForOneSet}</strong> additional valid question(s) are needed in{' '}
                          <strong>{capacityCheck.limitingModuleLabel}</strong> to create at least one complete set. Partial sets cannot be generated.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                        <button
                          type="button"
                          onClick={() => switchSubTab('pool')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#17243A] hover:bg-[#0F172A] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-xs font-semibold"
                        >
                          <FileQuestion className="w-3.5 h-3.5" />
                          <span>Go to Question Pool & Upload</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-md border border-[#B42318]/25">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F5F7FB] dark:bg-slate-800 border-b border-[#D9E2EF] dark:border-slate-700 text-[#64748B] dark:text-slate-300">
                            <th className="py-2.5 px-4">Module</th>
                            <th className="py-2.5 px-4">Required Per Set</th>
                            <th className="py-2.5 px-4">Available</th>
                            <th className="py-2.5 px-4">Maximum Sets</th>
                            <th className="py-2.5 px-4">Additional Needed for 1 Set</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                          {capacityCheck.moduleChecks.map((mc) => (
                            <tr
                              key={mc.moduleNumber}
                              className={mc.shortage > 0 ? 'bg-[#B42318]/5 dark:bg-red-950/15' : ''}
                            >
                              <td className="py-2 px-4 font-semibold">Module {mc.moduleNumber}</td>
                              <td className="py-2 px-4 tabular-nums">{mc.requiredPerSet}</td>
                              <td className="py-2 px-4 tabular-nums">{mc.availableCount}</td>
                              <td className="py-2 px-4 tabular-nums">
                                {mc.maxSetsSupported === null ? '—' : mc.maxSetsSupported}
                              </td>
                              <td
                                className={`py-2 px-4 tabular-nums font-bold ${mc.shortage > 0
                                  ? 'text-[#B42318] dark:text-red-300'
                                  : 'text-[#16834A] dark:text-emerald-400'
                                  }`}
                              >
                                {mc.shortage}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[#F5F7FB] dark:bg-slate-800/80 font-bold border-t-2 border-[#D9E2EF] dark:border-slate-700">
                            <td className="py-2.5 px-4">Total</td>
                            <td className="py-2.5 px-4 tabular-nums">
                              {capacityCheck.totalPerSet}
                            </td>
                            <td className="py-2.5 px-4 tabular-nums">
                              {capacityCheck.totalAvailablePool}
                            </td>
                            <td className="py-2.5 px-4 tabular-nums">0</td>
                            <td className="py-2.5 px-4 tabular-nums text-[#B42318] dark:text-red-300">
                              {capacityCheck.totalShortageForOneSet}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Aggregate Generation Summary ONLY — Strict Confidentiality (Zero Set Question Previews) */}
                {generationSummary && (
                  <div className="space-y-4 pt-4 border-t border-[#D9E2EF] dark:border-slate-800">
                    <div className="p-4 rounded-lg bg-[#16834A]/10 border border-[#16834A]/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#16834A] dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {generationSummary.generatedSetCount} Numbered Set
                            {generationSummary.generatedSetCount === 1 ? '' : 's'} Generated Successfully
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPublishDialogOpen(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#16834A] hover:bg-[#126D3D] text-white text-xs font-semibold shrink-0 self-start sm:self-auto"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Publish Available Sets to COE</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-[#17243A] dark:text-slate-200">
                        <div className="p-2.5 rounded bg-white/80 dark:bg-slate-900/70 border border-[#16834A]/20">
                          <div className="text-[11px] text-[#64748B]">Questions per set</div>
                          <div className="font-bold tabular-nums mt-0.5">
                            {generationSummary.questionsPerSet}
                          </div>
                        </div>
                        <div className="p-2.5 rounded bg-white/80 dark:bg-slate-900/70 border border-[#16834A]/20">
                          <div className="text-[11px] text-[#64748B]">Total unique questions allocated</div>
                          <div className="font-bold tabular-nums mt-0.5">
                            {generationSummary.totalUniqueQuestionsAllocated}
                          </div>
                        </div>
                        <div className="p-2.5 rounded bg-white/80 dark:bg-slate-900/70 border border-[#16834A]/20">
                          <div className="text-[11px] text-[#64748B]">Question overlap across sets</div>
                          <div className="font-bold tabular-nums text-[#16834A] dark:text-emerald-400 mt-0.5">
                            {generationSummary.overlapAcrossSets} (Verified Disjoint)
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-[#17243A] dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                        {Object.entries(generationSummary.moduleDistribution).map(([mod, cnt]) => (
                          <span key={mod}>
                            Module {mod}: <strong>{cnt}</strong> question{cnt === 1 ? '' : 's'} per set
                          </span>
                        ))}
                      </div>

                      <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                        Set generation integrity: <strong>{generationSummary.integrityVerified ? 'Verified' : 'Pending'}</strong> · Generation ID:{' '}
                        <span className="font-mono">{generationSummary.generationId}</span> · Q-Bank Rev:{' '}
                        <span className="font-mono">{generationSummary.questionBankRevisionId}</span>
                      </div>
                    </div>

                    {/* Confidential Publication Status List (No question contents or Question IDs) */}
                    <div className="rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/40 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#17243A] dark:text-white">
                          Generated Numbered Set Status ({generationSummary.publicationStatus})
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                          Confidentiality enforced: question contents & set mappings are hidden from HOD and restricted to COE.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {generationSummary.setStatuses.map((ss) => (
                          <div
                            key={ss.setNumber}
                            className="p-2.5 rounded bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-[#17243A] dark:text-white">
                              Set {ss.setNumber} ({ss.totalQuestions} Qs)
                            </span>
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              {ss.publicationStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* SUBTAB 4: PUBLICATION HISTORY */}
          {subTab === 'history' && (
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-[#D9E2EF] dark:border-slate-800">
                <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                  Question Publication & Revision History — {selectedSubject.code}
                </h2>
              </div>
              {safePublications.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#64748B]">
                  No question sets have been published for {selectedSubject.code} yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F5F7FB] dark:bg-slate-800/60 border-b border-[#D9E2EF] dark:border-slate-800 text-[#64748B]">
                        <th className="py-3 px-5">Revision</th>
                        <th className="py-3 px-4">Published At</th>
                        <th className="py-3 px-4">Published By</th>
                        <th className="py-3 px-4">Blueprint</th>
                        <th className="py-3 px-4">Published Sets</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                      {safePublications.map((pub, idx) => (
                        <tr key={pub.id || pub.revisionNumber || idx}>
                          <td className="py-3 px-5 font-mono font-bold">
                            {pub.revisionNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {pub.publishedAt || '—'}
                          </td>
                          <td className="py-3 px-4">{pub.publishedBy || '—'}</td>
                          <td className="py-3 px-4">
                            {pub.blueprint?.totalQuestions ?? 0} Qs/set · {pub.totalUniqueQuestionsAllocated ?? 0} unique Qs
                          </td>
                          <td className="py-3 px-4 tabular-nums">
                            {pub.setsGeneratedCount === 1
                              ? 'Set 1 (1 Set)'
                              : `Sets 1–${pub.setsGeneratedCount ?? 0} (${pub.setsGeneratedCount ?? 0} Sets)`}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={pub.status} />
                          </td>
                          <td className="py-3 px-4 max-w-xs text-[#64748B] dark:text-slate-400">
                            {pub.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      ) : null}

      {/* SUBTAB 3: SIMPLIFIED KEY CORRECTIONS TAB */}
      {subTab === 'key-correction' && (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 shadow-xs p-6 max-w-3xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#17243A] dark:text-white">
              Submit Answer-Key Correction Request
            </h2>
          </div>

          {kcResultMsg && (
            <div
              className={`p-3.5 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${kcResultMsg.type === 'success'
                ? 'bg-[#16834A]/10 border-[#16834A]/30 text-[#16834A] dark:text-emerald-300'
                : 'bg-[#B42318]/10 border-[#B42318]/30 text-[#B42318] dark:text-red-300'
                }`}
            >
              {kcResultMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{kcResultMsg.text}</span>
            </div>
          )}

          {kcLoadingExams ? (
            <div className="py-6 text-sm text-[#64748B]">Loading completed examinations...</div>
          ) : eligibleExams.length === 0 ? (
            <div className="p-6 rounded-lg border border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-800/40 text-xs text-[#64748B]">
              No completed examinations awaiting result release are currently available for key correction.
            </div>
          ) : (
            <form onSubmit={handleSubmitKeyCorrection} className="space-y-4">
              <div>
                <label
                  htmlFor="kc-exam-select"
                  className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1.5"
                >
                  1. Completed Examination / Subject
                </label>
                <select
                  id="kc-exam-select"
                  value={kcSelectedExamId}
                  onChange={(e) => {
                    setKcSelectedExamId(e.target.value);
                    setKcResultMsg(null);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {eligibleExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.subjectCode} — {ex.subjectName} ({formatSemesterOrdinal(ex.semesterNumber)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="kc-question-select"
                  className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1.5"
                >
                  2. Question ID
                </label>
                <select
                  id="kc-question-select"
                  disabled={kcLoadingQuestions || examQuestions.length === 0}
                  value={kcSelectedQuestionId}
                  onChange={(e) => {
                    setKcSelectedQuestionId(e.target.value);
                    setKcProposedOption('');
                    setKcResultMsg(null);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-60"
                >
                  {kcLoadingQuestions ? (
                    <option value="">Loading questions...</option>
                  ) : examQuestions.length === 0 ? (
                    <option value="">No questions found for this examination</option>
                  ) : (
                    examQuestions.map((q) => (
                      <option key={q.questionId} value={q.questionId}>
                        {q.questionId} — {(q.questionText || '').slice(0, 75)}
                        {(q.questionText || '').length > 75 ? '...' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedKcQuestion && (
                <>
                  <div className="p-4 rounded-lg border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800/50 space-y-2.5">
                    <div className="text-xs font-semibold text-[#64748B]">
                      3. Original Question (Read-Only)
                    </div>
                    <p className="text-sm font-medium text-[#17243A] dark:text-white">
                      {selectedKcQuestion.questionText}
                    </p>
                    {selectedKcQuestion.questionImages &&
                      selectedKcQuestion.questionImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedKcQuestion.questionImages.map((img) => (
                            <img
                              key={img.assetId}
                              src={resolveImageSrc(img)}
                              alt={img.altText || 'Question diagram'}
                              className="h-14 w-auto rounded border border-[#D9E2EF] bg-white p-0.5 object-contain"
                            />
                          ))}
                        </div>
                      )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#1F2937] dark:text-slate-300 pt-1">
                      {(
                        [
                          ['A', selectedKcQuestion.optionA, selectedKcQuestion.optionAImages],
                          ['B', selectedKcQuestion.optionB, selectedKcQuestion.optionBImages],
                          ['C', selectedKcQuestion.optionC, selectedKcQuestion.optionCImages],
                          ['D', selectedKcQuestion.optionD, selectedKcQuestion.optionDImages],
                        ] as [string, string, QuestionImageAsset[] | undefined][]
                      ).map(([lbl, txt, imgs]) => (
                        <div
                          key={lbl}
                          className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 flex items-center gap-2"
                        >
                          <span className="font-bold">Option {lbl}:</span>
                          <span>{txt}</span>
                          {imgs?.map((im) => (
                            <img
                              key={im.assetId}
                              src={resolveImageSrc(im)}
                              alt={`Option ${lbl}`}
                              className="h-6 w-auto object-contain"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="kc-existing-answer"
                        className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1.5"
                      >
                        4. Existing Correct Answer
                      </label>
                      <input
                        id="kc-existing-answer"
                        type="text"
                        readOnly
                        value={`Option ${selectedKcQuestion.correctOption}`}
                        className="w-full px-3 py-2 text-sm font-bold rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-[#F5F7FB] dark:bg-slate-800 text-[#17243A] dark:text-white cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="kc-proposed-answer"
                        className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1.5"
                      >
                        5. Proposed Correct Answer
                      </label>
                      <select
                        id="kc-proposed-answer"
                        required
                        value={kcProposedOption}
                        onChange={(e) =>
                          setKcProposedOption(e.target.value as 'A' | 'B' | 'C' | 'D' | '')
                        }
                        className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="">Select Proposed Answer</option>
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={kcSubmitting || !kcProposedOption}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {kcSubmitting
                          ? 'Submitting Request...'
                          : 'Submit Correction Request to COE'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Key Correction Request History */}
          <div className="pt-6 border-t border-[#D9E2EF] dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#2563EB]" />
                Key Correction Request History &amp; COE Decisions
              </h3>
              <button
                type="button"
                onClick={loadCorrectionHistory}
                disabled={loadingHistory}
                className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                Refresh History
              </button>
            </div>
            {loadingHistory ? (
              <div className="py-4 text-xs text-[#64748B]">Loading correction history...</div>
            ) : correctionHistory.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/40 text-xs text-[#64748B]">
                No key correction requests have been submitted yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#D9E2EF] dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F7FB] dark:bg-slate-800/80 font-semibold text-[#64748B]">
                    <tr>
                      <th className="px-3.5 py-2.5">Subject</th>
                      <th className="px-3.5 py-2.5">Question ID</th>
                      <th className="px-3.5 py-2.5">Options</th>
                      <th className="px-3.5 py-2.5">Reason</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">COE Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E2EF] dark:divide-slate-800">
                    {correctionHistory.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3.5 py-2.5 font-medium">
                          {req.subjectCode} ({formatSemesterOrdinal(req.semesterNumber)})
                        </td>
                        <td className="px-3.5 py-2.5 font-mono">{req.questionId}</td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-semibold text-red-600">Option {req.existingCorrectOption}</span>
                          {' → '}
                          <span className="font-semibold text-green-600">Option {req.proposedCorrectOption}</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[#64748B] max-w-xs truncate">{req.reason || 'Disputed key'}</td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-[#64748B]">
                          {req.coeDecisionNote ? (
                            <span className="font-medium text-[#17243A] dark:text-slate-200">
                              {req.coeDecisionNote}
                            </span>
                          ) : (
                            <span className="italic">Awaiting review</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Manual Question Modal */}
      {qModalOpen && selectedSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#17243A] dark:text-white">
                {editingQ
                  ? `Edit Question (${editingQ.questionId})`
                  : `Add Question — ${selectedSubject.code}`}
              </h2>
              <button type="button" onClick={() => setQModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveManualQuestion} className="p-6 space-y-3.5 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Module Number</label>
                  <select
                    value={qForm.moduleNumber}
                    onChange={(e) => setQForm({ ...qForm, moduleNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {Array.from({ length: selectedSubject.moduleCount }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Module {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Correct Option</label>
                  <select
                    value={qForm.correctOption}
                    onChange={(e) =>
                      setQForm({ ...qForm, correctOption: e.target.value as 'A' | 'B' | 'C' | 'D' })
                    }
                    className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Question Text</label>
                <textarea
                  rows={2}
                  required
                  value={qForm.questionText}
                  onChange={(e) => setQForm({ ...qForm, questionText: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((key, idx) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold mb-1">
                      Option {['A', 'B', 'C', 'D'][idx]}
                    </label>
                    <input
                      type="text"
                      required
                      value={qForm[key]}
                      onChange={(e) => setQForm({ ...qForm, [key]: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={qSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[#2563EB] text-white"
                >
                  {qSaving ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={publishDialogOpen}
        title={`Publish ${generationSummary?.generatedSetCount || 0} Numbered Set${generationSummary?.generatedSetCount === 1 ? '' : 's'} for ${selectedSubject?.code}?`}
        description={`Publishing makes ${generationSummary?.generatedSetCount || 0} fully disjoint numbered set(s) (${generationSummary?.questionsPerSet || blueprintTotal} questions per set, ${generationSummary?.totalUniqueQuestionsAllocated || 0} unique questions allocated with zero overlap) available to the COE Portal for examination sitting selection.`}
        consequenceNote="Previous published revisions will be marked Superseded in Publication History. A–D shuffled versions are generated separately by the backend when the COE assigns a numbered set to a sitting."
        confirmLabel="Publish Available Sets"
        variant="primary"
        isLoading={publishing}
        onConfirm={handleConfirmPublish}
        onCancel={() => setPublishDialogOpen(false)}
      >
        <div>
          <label className="block text-xs font-semibold mb-1">Revision Note (Optional)</label>
          <input
            type="text"
            value={publishNotes}
            onChange={(e) => setPublishNotes(e.target.value)}
            placeholder="e.g., Board of Studies reviewed question bank"
            className="w-full px-3 py-2 text-xs rounded-md border border-[#D9E2EF] dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>
      </ConfirmDialog>

      {/* Excel Question Import Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmImportOpen}
        title="Confirm Question Bank Import"
        description={`Are you sure you want to import ${excelResult?.validCount || 0} validated questions into ${selectedSubject?.code || 'this subject'} from "${excelResult?.fileName || 'the uploaded file'}"?`}
        consequenceNote={`${excelResult?.validCount || 0} questions will be permanently assigned unique UIDs and inserted into the active question bank. ${excelResult?.totalImagesExtracted || 0} embedded diagram(s) will be persisted to the database.${excelResult && excelResult.invalidCount > 0 ? ` Note: ${excelResult.invalidCount} invalid row(s) will be discarded.` : ''}`}
        confirmLabel={importingExcel ? 'Importing...' : 'Confirm & Import Questions'}
        variant="primary"
        isLoading={importingExcel}
        onConfirm={async () => {
          setConfirmImportOpen(false);
          await handleImportValidExcelQuestions();
        }}
        onCancel={() => setConfirmImportOpen(false)}
      />

      {/* Image Zoom Inspection Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-[#F5F7FB] dark:bg-slate-950/60 border-b border-[#D9E2EF] dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <strong className="text-[#17243A] dark:text-white">
                  {zoomImage.altText || 'Extracted Question / Option Image'}
                </strong>{' '}
                <span className="text-[#64748B]">
                  ({zoomImage.targetField} · {zoomImage.width}×{zoomImage.height}px · {zoomImage.mimeType})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="p-1 text-[#64748B] hover:text-[#17243A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-slate-50 dark:bg-slate-950 max-h-[75vh] overflow-auto">
              <img
                src={resolveImageSrc(zoomImage)}
                alt={zoomImage.altText || 'Zoomed diagram'}
                className="max-w-full max-h-[65vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};