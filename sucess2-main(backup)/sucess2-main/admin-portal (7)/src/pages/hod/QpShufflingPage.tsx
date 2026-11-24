import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Layers,
  Lock,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHodSemester } from '../../hooks/useHodSemester';
import { subjectService } from '../../services/subjectService';
import { questionService } from '../../services/questionService';
import { Subject, QuestionItem } from '../../types';
import {
  BlueprintConfig,
  calculateBlueprint,
  ExamType,
  generateQPSetsAndVariants,
  GenerationResult,
  letterToIndex,
  parseQpExcelFile,
  QpQuestion,
  VERSION_LABELS,
} from '../../utils/qpShuffling';
import { formatSemesterOrdinal } from '../../utils/semesterOptions';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export interface QpShufflingPageProps {
  embedded?: boolean;
  embeddedSubjectId?: string;
  onPublished?: () => Promise<void> | void;
}

export const QpShufflingPage: React.FC<QpShufflingPageProps> = ({
  embedded = false,
  embeddedSubjectId,
  onPublished,
} = {}) => {
  const { user } = useAuth();
  const { selectedSemester } = useHodSemester();

  // Subject selection & Question Pool
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(embeddedSubjectId || '');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [, setSubjectsError] = useState<string | null>(null);

  const [rawQuestions, setRawQuestions] = useState<QuestionItem[]>([]);
  const [, setLoadingQuestions] = useState(false);
  const [uploadedQuestions, setUploadedQuestions] = useState<QpQuestion[] | null>(null);

  // Configuration State
  const [examType, setExamType] = useState<ExamType>('SEE');
  const [selectedModules, setSelectedModules] = useState<number[]>([1, 2, 3, 4, 5]);
  const [customCounts, setCustomCounts] = useState<Record<number, number>>({
    1: 6,
    2: 6,
    3: 6,
    4: 6,
    5: 6,
  });
  const [setsCount, setSetsCount] = useState<number>(4);
  const [versionsCount, setVersionsCount] = useState<number>(4);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [randomSeed, setRandomSeed] = useState<string>('');

  // Generation Output
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [, setGenerationError] = useState<string | null>(null);

  // View state
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Save / Publish Modal
  const [publishDialogOpen, setPublishDialogOpen] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);

  // Sync subject when embedded inside QuestionsPage
  useEffect(() => {
    if (embeddedSubjectId) {
      setSelectedSubjectId(embeddedSubjectId);
      setGenerationResult(null);
    }
  }, [embeddedSubjectId]);

  // Load subjects for department & semester
  const loadSubjects = useCallback(async () => {
    if (!user?.departmentId) return;
    setLoadingSubjects(true);
    setSubjectsError(null);
    try {
      const list = await subjectService.getDepartmentSubjects(user.departmentId, selectedSemester);
      setSubjects(list);
      if (list.length > 0) {
        setSelectedSubjectId((prev) => {
          if (embeddedSubjectId && list.some((s) => s.id === embeddedSubjectId)) {
            return embeddedSubjectId;
          }
          return list.some((s) => s.id === prev) ? prev : list[0].id;
        });
      } else {
        setSelectedSubjectId('');
      }
    } catch (err: any) {
      setSubjectsError(err?.message || 'Unable to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [user?.departmentId, selectedSemester, embeddedSubjectId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  // Load question bank questions for the selected subject
  const loadQuestions = useCallback(async (subjectId: string) => {
    if (!subjectId || !user?.departmentId) {
      setRawQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    try {
      const qs = await questionService.getSubjectQuestions(subjectId, user.departmentId);
      setRawQuestions(qs || []);
      setUploadedQuestions(null);
    } catch (err: any) {
      console.warn('Could not load subject questions:', err);
      setRawQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, [user?.departmentId]);

  useEffect(() => {
    if (selectedSubjectId) {
      loadQuestions(selectedSubjectId);
    }
  }, [selectedSubjectId, loadQuestions]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  // Harmonized Question Pool
  const questionPool: QpQuestion[] = useMemo(() => {
    if (uploadedQuestions && uploadedQuestions.length > 0) {
      return uploadedQuestions;
    }
    return rawQuestions
      .filter((q) => q.status === 'Active')
      .map((q) => ({
        id: q.questionId,
        moduleNumber: q.moduleNumber,
        questionText: q.questionText,
        options: [q.optionA, q.optionB, q.optionC, q.optionD],
        correctIndex: letterToIndex(q.correctOption),
        correctOptionLetter: q.correctOption,
      }));
  }, [uploadedQuestions, rawQuestions]);

  // Question counts by module in the pool
  const poolByModule = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    questionPool.forEach((q) => {
      if (counts[q.moduleNumber] !== undefined) {
        counts[q.moduleNumber]++;
      } else {
        counts[q.moduleNumber] = 1;
      }
    });
    return counts;
  }, [questionPool]);

  // Handle Exam Type toggle
  const handleExamTypeChange = (type: ExamType) => {
    setExamType(type);
    if (type === 'SEE') {
      setSelectedModules([1, 2, 3, 4, 5]);
      setCustomCounts({ 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 });
    } else {
      setSelectedModules([1, 2, 3]);
      setCustomCounts({ 1: 10, 2: 10, 3: 10, 4: 0, 5: 0 });
    }
  };

  // Blueprint calculation
  const currentBlueprint: BlueprintConfig = useMemo(() => {
    const bp = calculateBlueprint(examType, selectedModules, customCounts);
    bp.setsCount = setsCount;
    bp.versionsCount = versionsCount;
    bp.shuffleQuestions = shuffleQuestions;
    bp.shuffleOptions = shuffleOptions;
    bp.randomSeed = randomSeed.trim() || undefined;
    return bp;
  }, [
    examType,
    selectedModules,
    customCounts,
    setsCount,
    versionsCount,
    shuffleQuestions,
    shuffleOptions,
    randomSeed,
  ]);

  // Capacity sufficiency check
  const capacityStatus = useMemo(() => {
    const checks = currentBlueprint.selectedModules.map((m) => {
      const reqPerSet = currentBlueprint.questionsPerModule[m] || 0;
      const totalNeeded = reqPerSet * currentBlueprint.setsCount;
      const available = poolByModule[m] || 0;
      const deficit = Math.max(0, totalNeeded - available);
      return {
        module: m,
        reqPerSet,
        totalNeeded,
        available,
        deficit,
        isSufficient: deficit === 0,
      };
    });

    const isSufficient = checks.every((c) => c.isSufficient) && currentBlueprint.totalQuestions > 0;
    const totalNeededAll = checks.reduce((acc, c) => acc + c.totalNeeded, 0);

    return { checks, isSufficient, totalNeededAll };
  }, [currentBlueprint, poolByModule]);

  // Direct Excel Upload Handler
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const qps = await parseQpExcelFile(file);
      if (qps.length === 0) {
        setFeedback({
          type: 'error',
          text: 'No valid question rows found in uploaded Excel spreadsheet. Ensure columns for Question Text and Options A-D exist.',
        });
        return;
      }

      const distinctMods = Array.from(new Set(qps.map((q) => q.moduleNumber))).sort((a, b) => a - b);
      setUploadedQuestions(qps);
      setFeedback({
        type: 'success',
        text: `Loaded ${qps.length} questions across ${distinctMods.length} module(s) (${distinctMods.map((m) => `M${m}`).join(', ')}) from ${file.name} for instant shuffling.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: `Upload failed: ${err?.message || 'Invalid spreadsheet'}`,
      });
    }
  };

  // Generate QP Sets & Versions
  const handleGenerate = () => {
    setGenerationError(null);
    setIsGenerating(true);
    setFeedback(null);

    try {
      const result = generateQPSetsAndVariants({
        subjectCode: activeSubject?.code || 'QP',
        subjectName: activeSubject?.name || 'Question Paper',
        departmentCode: user?.departmentCode || 'DEPT',
        semester: selectedSemester,
        questionPool,
        blueprint: currentBlueprint,
      });

      setGenerationResult(result);
      setActiveSetIndex(0);
      setFeedback({
        type: 'success',
        text: `Successfully generated and sealed ${result.sets.length} disjoint sets (${result.blueprint.versionsCount} randomized versions each). Question contents are hidden for confidentiality — review the summary below and Publish & Send to CoE.`,
      });
    } catch (err: any) {
      setGenerationError(err?.message || 'QP generation failed.');
      setFeedback({
        type: 'error',
        text: err?.message || 'QP generation failed.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save / Publish to Central Backend
  const handlePublish = async () => {
    if (!selectedSubjectId || !activeSubject || !user) return;
    setPublishing(true);
    try {
      // If HOD uploaded an Excel file directly on the QP Shuffling page, persist it to PostgreSQL first
      if (uploadedQuestions && uploadedQuestions.length > 0) {
        await questionService.bulkImportQuestions(
          selectedSubjectId,
          uploadedQuestions.map((q) => ({
            moduleNumber: q.moduleNumber,
            questionText: q.questionText,
            optionA: q.options[0] || '',
            optionB: q.options[1] || '',
            optionC: q.options[2] || '',
            optionD: q.options[3] || '',
            correctOption: (q.correctOptionLetter || 'A') as 'A' | 'B' | 'C' | 'D',
          })),
          'QP_Shuffling_Excel_Upload.xlsx',
          user,
          undefined
        );
      }

      // Generate Stage A disjoint sets on backend with the selected blueprint distribution
      const genSummary = await questionService.generateAvailableNumberedSets(
        selectedSubjectId,
        {
          totalQuestions: currentBlueprint.totalQuestions,
          moduleDistribution: currentBlueprint.questionsPerModule,
        },
        user
      );

      // Publish generated sets to CoE
      const pubRev = await questionService.publishGeneratedSets(
        selectedSubjectId,
        genSummary.generationId || `GEN-${Date.now()}`,
        `Generated ${currentBlueprint.setsCount} disjoint sets (${currentBlueprint.versionsCount} versions each) across ${currentBlueprint.selectedModules.length} modules`,
        user
      );

      await loadQuestions(selectedSubjectId);
      await onPublished?.();
      setFeedback({
        type: 'success',
        text: `Question sets (${pubRev?.revisionNumber || 'Published'}) successfully persisted and published to Controller of Examinations (CoE)!`,
      });
      setPublishDialogOpen(false);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: `Publish error: ${err?.message || 'Could not publish sets to backend.'}`,
      });
    } finally {
      setPublishing(false);
    }
  };

  const currentSet = generationResult?.sets[activeSetIndex] || null;
  const activeVersionLabels = generationResult
    ? VERSION_LABELS.slice(0, generationResult.blueprint.versionsCount)
    : [];

  return (
    <div className={embedded ? 'space-y-6' : 'p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto'}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D9E2EF] dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
            <Shuffle className="w-4 h-4" />
            <span>HOD Question Paper Shuffling & Generation</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#17243A] dark:text-white mt-1">
            Question Paper Generation & Shuffling Engine
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Generate sealed, disjoint question sets (Sets 1–4) and permute question positions and options
            across versions (A–D) with strict zero-overlap for confidential handoff to CoE.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#17243A] dark:text-slate-200 bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="w-4 h-4 text-[#2563EB]" />
            <span>Upload Question Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelUpload}
            />
          </label>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-[#12B76A]/10 text-[#027A48] border border-[#12B76A]/30 dark:bg-green-950/40 dark:text-green-300'
              : 'bg-[#B42318]/10 text-[#B42318] border border-[#B42318]/30 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 whitespace-pre-line">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 rounded"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Grid: Config (Left) + Pool & Action (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Blueprint & Shuffling Rules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#D9E2EF] dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#2563EB]" />
                <span>1. Examination Blueprint & Shuffling Rules</span>
              </h2>
              <div className="flex items-center gap-1 bg-[#F5F7FB] dark:bg-slate-800 p-1 rounded-lg border border-[#D9E2EF] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleExamTypeChange('SEE')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    examType === 'SEE'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-[#64748B] hover:text-[#17243A] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  SEE (5 Modules)
                </button>
                <button
                  type="button"
                  onClick={() => handleExamTypeChange('INTERNAL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    examType === 'INTERNAL'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-[#64748B] hover:text-[#17243A] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Internal (3 Modules)
                </button>
              </div>
            </div>

            {/* Subject Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1.5">
                Target Subject ({formatSemesterOrdinal(selectedSemester)} - {user?.departmentCode})
              </label>
              {loadingSubjects ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : subjects.length > 0 ? (
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No subjects registered for this semester. You can upload an Excel file directly.
                </p>
              )}
            </div>

            {/* Module Distribution Sliders/Inputs */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#17243A] dark:text-slate-200">
                Questions per Module (Per Paper Set)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((mod) => {
                  const isIncluded = currentBlueprint.selectedModules.includes(mod);
                  const count = customCounts[mod] || 0;
                  const available = poolByModule[mod] || 0;
                  const reqTotal = count * setsCount;
                  const hasShortage = reqTotal > available;

                  return (
                    <div
                      key={mod}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        isIncluded
                          ? hasShortage
                            ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700'
                            : 'border-[#2563EB]/40 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800'
                          : 'border-slate-200 bg-slate-50 opacity-60 dark:bg-slate-800/40 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#17243A] dark:text-white">
                          Module {mod}
                        </span>
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedModules((prev) =>
                                Array.from(new Set([...prev, mod])).sort((a, b) => a - b)
                              );
                              setCustomCounts((prev) => ({
                                ...prev,
                                [mod]: prev[mod] > 0 ? prev[mod] : examType === 'SEE' ? 6 : 10,
                              }));
                            } else {
                              setSelectedModules((prev) => {
                                const next = prev.filter((m) => m !== mod);
                                return next.length > 0 ? next : prev;
                              });
                              setCustomCounts((prev) => ({ ...prev, [mod]: 0 }));
                            }
                          }}
                          className="rounded text-[#2563EB]"
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={count}
                        disabled={!isIncluded}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setCustomCounts((prev) => ({ ...prev, [mod]: val }));
                        }}
                        className="w-full text-center text-sm font-bold bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 rounded py-1 mb-1"
                      />
                      <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                        Pool: <strong>{available}</strong> Qs
                      </div>
                      {isIncluded && (
                        <div
                          className={`text-[10px] font-semibold mt-0.5 ${
                            hasShortage ? 'text-amber-600 dark:text-amber-400' : 'text-[#12B76A]'
                          }`}
                        >
                          {hasShortage ? `Needs +${reqTotal - available}` : `Req: ${reqTotal}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Set & Version Multipliers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1">
                  Number of Disjoint Sets to Generate
                </label>
                <select
                  value={setsCount}
                  onChange={(e) => setSetsCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-lg"
                >
                  <option value={1}>1 Set (Set 1 only)</option>
                  <option value={2}>2 Sets (Set 1, Set 2)</option>
                  <option value={4}>4 Sets (Set 1, Set 2, Set 3, Set 4) [Standard]</option>
                  <option value={8}>8 Sets (Stage A & Stage B Dual Sessions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17243A] dark:text-slate-200 mb-1">
                  Versions per Set (Permutations)
                </label>
                <select
                  value={versionsCount}
                  onChange={(e) => setVersionsCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-lg"
                >
                  <option value={2}>2 Versions (A, B)</option>
                  <option value={3}>3 Versions (A, B, C)</option>
                  <option value={4}>4 Versions (A, B, C, D) [Standard Checkerboard]</option>
                </select>
              </div>
            </div>

            {/* Shuffling Rules Checkboxes */}
            <div className="pt-2 border-t border-[#D9E2EF] dark:border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-[#17243A] dark:text-slate-200">
                Randomization & Shuffling Rules
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#D9E2EF] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="rounded text-[#2563EB] w-4 h-4"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#17243A] dark:text-white">
                      Shuffle Question Order
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                      Collision-free positions across versions A–D
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#D9E2EF] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="rounded text-[#2563EB] w-4 h-4"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#17243A] dark:text-white">
                      Shuffle Multiple-Choice Options
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                      Permutes A–B–C–D & tracks correct answer
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#64748B] dark:text-slate-400 mb-1">
                  Deterministic Random Seed (Optional, for repeatable audit generation):
                </label>
                <input
                  type="text"
                  placeholder="e.g. MIT-CSE-2026-SEE"
                  value={randomSeed}
                  onChange={(e) => setRandomSeed(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F5F7FB] dark:bg-slate-800 border border-[#D9E2EF] dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pool Summary & Generation Action */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#17243A] dark:text-white flex items-center gap-2 border-b border-[#D9E2EF] dark:border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-[#2563EB]" />
              <span>2. Question Bank Capacity</span>
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[#64748B] dark:text-slate-400">Total Pool Available:</span>
                <span className="font-bold text-[#17243A] dark:text-white">
                  {questionPool.length} Questions
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[#64748B] dark:text-slate-400">Total Required for Sets:</span>
                <span className="font-bold text-[#17243A] dark:text-white">
                  {capacityStatus.totalNeededAll} Questions
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[#64748B] dark:text-slate-400">Questions per Paper:</span>
                <span className="font-bold text-[#2563EB]">
                  {currentBlueprint.totalQuestions} Qs ({currentBlueprint.totalMarks} Marks)
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748B] dark:text-slate-400">Sets × Versions:</span>
                <span className="font-bold text-[#17243A] dark:text-white">
                  {setsCount} Sets × {versionsCount} Versions ({setsCount * versionsCount} Papers)
                </span>
              </div>
            </div>

            {/* Status indicator */}
            {capacityStatus.isSufficient ? (
              <div className="p-3 bg-[#12B76A]/10 border border-[#12B76A]/30 rounded-lg text-xs text-[#027A48] dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Question bank has sufficient capacity for {setsCount} complete disjoint sets!
                </span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Pool Deficit Detected:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {capacityStatus.checks
                    .filter((c) => !c.isSufficient)
                    .map((c) => (
                      <li key={c.module}>
                        Module {c.module}: has {c.available}, needs {c.totalNeeded} (+{c.deficit} more)
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Generation Button */}
            <button
              type="button"
              disabled={!capacityStatus.isSufficient || isGenerating}
              onClick={handleGenerate}
              className={`w-full py-3 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                capacityStatus.isSufficient && !isGenerating
                  ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer hover:shadow-md'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing Shuffling & Generation...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Question Papers & Variants</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sealed Generation Summary Section (Confidential — No Question Text / Options / Answer Keys Exposed) */}
      {generationResult && (
        <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          {/* Header & Publish Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D9E2EF] dark:border-slate-800 pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-[#12B76A]/10 text-[#027A48] border border-[#12B76A]/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Zero Overlap Confirmed
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Lock className="w-3 h-3" />
                  Sealed — Content Hidden
                </span>
                <span className="text-xs text-[#64748B] dark:text-slate-400">
                  {generationResult.sets.length} Disjoint Sets ·{' '}
                  {generationResult.totalUniqueQuestionsAllocated} Unique Questions Allocated
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#17243A] dark:text-white mt-1.5">
                Sealed Shuffled Sets Summary — {generationResult.subjectCode} ({generationResult.subjectName})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!selectedSubjectId || publishing}
                onClick={() => setPublishDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Publish & Send to CoE</span>
              </button>
            </div>
          </div>

          {/* Confidentiality Notice */}
          <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/60 border border-[#D9E2EF] dark:border-slate-700 flex items-start gap-3 text-xs text-[#475569] dark:text-slate-300">
            <Lock className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#17243A] dark:text-white">
                Examination Confidentiality Enforced:
              </span>{' '}
              Individual question texts, multiple-choice options, and answer keys are sealed after
              shuffling and are never displayed on screen. Only set counts, version metadata, and
              blueprint totals are shown prior to handoff to the Controller of Examinations (CoE).
            </div>
          </div>

          {/* High-Level Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/50 border border-[#D9E2EF] dark:border-slate-800">
              <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                Disjoint Sets
              </div>
              <div className="text-lg font-bold text-[#17243A] dark:text-white mt-0.5 tabular-nums">
                {generationResult.sets.length} Sets
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/50 border border-[#D9E2EF] dark:border-slate-800">
              <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                Versions per Set
              </div>
              <div className="text-lg font-bold text-[#17243A] dark:text-white mt-0.5 tabular-nums">
                {activeVersionLabels.length} ({activeVersionLabels[0]}–{activeVersionLabels[activeVersionLabels.length - 1]})
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/50 border border-[#D9E2EF] dark:border-slate-800">
              <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                Questions per Paper
              </div>
              <div className="text-lg font-bold text-[#2563EB] mt-0.5 tabular-nums">
                {generationResult.blueprint.totalQuestions} Qs
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/50 border border-[#D9E2EF] dark:border-slate-800">
              <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                Maximum Marks
              </div>
              <div className="text-lg font-bold text-[#17243A] dark:text-white mt-0.5 tabular-nums">
                {generationResult.blueprint.totalMarks} Marks
              </div>
            </div>
          </div>

          {/* Set Tabs (Set 1 .. Set N) */}
          <div className="flex items-center gap-2 border-b border-[#D9E2EF] dark:border-slate-800 pb-3 overflow-x-auto">
            {generationResult.sets.map((set, idx) => (
              <button
                key={set.setNumber}
                type="button"
                onClick={() => setActiveSetIndex(idx)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeSetIndex === idx
                    ? 'bg-[#17243A] text-white shadow-sm dark:bg-blue-600'
                    : 'bg-[#F5F7FB] dark:bg-slate-800 text-[#64748B] hover:text-[#17243A] dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{set.setTitle}</span>
                <span className="text-[10px] opacity-80">({set.totalQuestions} Qs)</span>
              </button>
            ))}
          </div>

          {/* Sealed Active Set Metadata & Version Badges */}
          {currentSet && (
            <div className="rounded-xl border border-[#D9E2EF] dark:border-slate-800 bg-[#F5F7FB]/60 dark:bg-slate-800/40 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#2563EB]" />
                    <span>
                      {currentSet.setTitle} — Sealed Question Package ({currentSet.totalQuestions} Questions · {generationResult.blueprint.totalMarks} Marks)
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                    Modules covered:{' '}
                    {generationResult.blueprint.selectedModules
                      .map((m) => `Module ${m} (${generationResult.blueprint.questionsPerModule[m] || 0} Qs)`)
                      .join(' · ')}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready to Publish to CoE
                </span>
              </div>

              {/* Version Badges (Version A - Version D) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {activeVersionLabels.map((vLabel) => {
                  const versionObj = currentSet.versions[vLabel];
                  const qCount = versionObj?.questions?.length ?? currentSet.totalQuestions;
                  return (
                    <div
                      key={vLabel}
                      className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17243A] dark:text-white">
                          <span className="px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-400">
                            Version {vLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                          {qCount} Qs · {generationResult.blueprint.totalMarks} Marks
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" />
                        Sealed
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Publishing */}
      <ConfirmDialog
        isOpen={publishDialogOpen}
        title="Publish Question Sets to Controller of Examinations"
        description={`Are you sure you want to finalize and publish these ${currentBlueprint.setsCount} disjoint question sets for ${activeSubject?.code || 'this subject'} to COE? Once published, COE can inspect and approve sets for examination cycles.`}
        confirmLabel={publishing ? 'Publishing...' : 'Confirm & Publish to COE'}
        cancelLabel="Cancel"
        isLoading={publishing}
        onConfirm={() => {
          void handlePublish();
        }}
        onCancel={() => setPublishDialogOpen(false)}
      />
    </div>
  );
};
