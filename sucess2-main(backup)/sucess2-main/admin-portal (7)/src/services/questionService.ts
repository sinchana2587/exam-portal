import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError } from './apiClient';
import {
  AuthUser,
  HodSetGenerationSummary,
  NumberedQuestionSet,
  PaperBlueprint,
  QuestionImageAsset,
  QuestionItem,
  QuestionPublicationRevision,
  QuestionStatus,
  UserRole,
} from '../types';

export interface QuestionInputPayload {
  subjectId: string;
  moduleNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  questionImages?: QuestionImageAsset[];
  optionAImages?: QuestionImageAsset[];
  optionBImages?: QuestionImageAsset[];
  optionCImages?: QuestionImageAsset[];
  optionDImages?: QuestionImageAsset[];
}

export interface ModulePoolCheck {
  moduleNumber: number;
  requiredPerSet: number;
  availableCount: number;
  maxSetsSupported: number | null;
  /** Additional unique valid questions needed to form at least 1 complete set. */
  shortage: number;
  isSufficientForOneSet: boolean;
  isLimiting: boolean;
}

export interface DynamicCapacityEvaluation {
  isValid: boolean;
  totalPerSet: number;
  totalAvailablePool: number;
  maxCompleteSets: number;
  totalShortageForOneSet: number;
  limitingModuleNumbers: number[];
  limitingModuleLabel: string;
  moduleChecks: ModulePoolCheck[];
  shortages: {
    moduleNumber: number;
    requiredCount: number;
    availableCount: number;
    deficit: number;
  }[];
}

const inFlightGenerationLocks = new Set<string>();

function normalizeQuestionContent(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getOptionSignature(text: string, imgs?: QuestionImageAsset[]): string {
  const imgSig = (imgs || []).map((i) => i.sha256 || i.assetId).join(',');
  return `${text.trim().toLowerCase()}::${imgSig}`;
}

function isValidQuestionContent(q: QuestionItem): boolean {
  if (q.status !== 'Active') return false;
  const hasStem = Boolean(q.questionText.trim()) || (q.questionImages?.length || 0) > 0;
  if (!hasStem) return false;

  const opts: [string, QuestionImageAsset[] | undefined][] = [
    [q.optionA, q.optionAImages],
    [q.optionB, q.optionBImages],
    [q.optionC, q.optionCImages],
    [q.optionD, q.optionDImages],
  ];
  if (opts.some(([txt, imgs]) => !txt.trim() && (imgs?.length || 0) === 0)) return false;
  if (new Set(opts.map(([txt, imgs]) => getOptionSignature(txt, imgs))).size < 4) return false;
  return ['A', 'B', 'C', 'D'].includes(q.correctOption);
}

/**
 * Returns active, valid, content-unique questions for a given module so duplicate
 * question text records cannot inflate capacity or enter generated sets twice.
 */
function getUniqueValidModuleQuestions(
  activeQuestions: QuestionItem[],
  moduleNumber: number
): QuestionItem[] {
  const seenContent = new Set<string>();
  const seenIds = new Set<string>();
  const unique: QuestionItem[] = [];

  for (const q of activeQuestions) {
    if (q.moduleNumber !== moduleNumber || !isValidQuestionContent(q)) continue;
    if (seenIds.has(q.questionId)) continue;
    const stemImgSig = (q.questionImages || []).map((im) => im.sha256 || im.assetId).join(',');
    const normText = `${normalizeQuestionContent(q.questionText)}::${stemImgSig}`;
    if (seenContent.has(normText)) continue;
    seenIds.add(q.questionId);
    seenContent.add(normText);
    unique.push(q);
  }
  return unique;
}

function stableShortHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function computeQuestionBankRevisionId(activeQuestions: QuestionItem[]): string {
  const activeValid = activeQuestions
    .filter((q) => q.status === 'Active')
    .map((q) => `${q.questionId}:${q.moduleNumber}:${q.updatedAt}:${normalizeQuestionContent(q.questionText)}`)
    .sort()
    .join('|');
  return `QBR-${activeQuestions.filter((q) => q.status === 'Active').length}-${stableShortHash(activeValid)}`;
}

export function computeBlueprintRevisionId(
  moduleCount: number,
  moduleDistribution: Record<number, number>
): string {
  const counts: number[] = [];
  let total = 0;
  for (let m = 1; m <= moduleCount; m++) {
    const val = Math.max(0, Math.floor(Number(moduleDistribution[m]) || 0));
    counts.push(val);
    total += val;
  }
  return `BPR-${total}-${counts.join('-')}`;
}

/**
 * Calculates module-wise capacity and dynamic maximum number of complete, fully disjoint
 * numbered sets possible from the subject's active valid unique question pool:
 *   Module Set Capacity = floor(Available Valid Unique Questions / Required Per Set)
 *   Maximum Complete Sets = min across all configured modules with Required Per Set > 0
 */
export function evaluateDynamicSetCapacity(
  moduleCount: number,
  moduleDistribution: Record<number, number>,
  activeQuestions: QuestionItem[]
): DynamicCapacityEvaluation {
  const rawModuleData: {
    moduleNumber: number;
    requiredPerSet: number;
    availableCount: number;
    maxSetsSupported: number | null;
    shortage: number;
    isSufficientForOneSet: boolean;
  }[] = [];

  const shortages: DynamicCapacityEvaluation['shortages'] = [];
  let totalPerSet = 0;
  let totalAvailablePool = 0;
  let totalShortageForOneSet = 0;

  for (let mod = 1; mod <= moduleCount; mod++) {
    const reqPerSet = Math.max(0, Math.floor(Number(moduleDistribution[mod]) || 0));
    const uniqueValid = getUniqueValidModuleQuestions(activeQuestions, mod);
    const availableCount = uniqueValid.length;
    const maxSetsSupported = reqPerSet > 0 ? Math.floor(availableCount / reqPerSet) : null;
    const shortage = reqPerSet > 0 ? Math.max(0, reqPerSet - availableCount) : 0;
    const isSufficientForOneSet = shortage === 0;

    totalPerSet += reqPerSet;
    totalAvailablePool += availableCount;
    totalShortageForOneSet += shortage;

    rawModuleData.push({
      moduleNumber: mod,
      requiredPerSet: reqPerSet,
      availableCount,
      maxSetsSupported,
      shortage,
      isSufficientForOneSet,
    });

    if (shortage > 0) {
      shortages.push({
        moduleNumber: mod,
        requiredCount: reqPerSet,
        availableCount,
        deficit: shortage,
      });
    }
  }

  const positiveModules = rawModuleData.filter(
    (m) => m.requiredPerSet > 0 && m.maxSetsSupported !== null
  );

  const maxCompleteSets =
    positiveModules.length > 0
      ? Math.min(...positiveModules.map((m) => m.maxSetsSupported as number))
      : 0;

  const limitingModuleNumbers =
    positiveModules.length > 0
      ? positiveModules
          .filter((m) => m.maxSetsSupported === maxCompleteSets)
          .map((m) => m.moduleNumber)
      : [];

  let limitingModuleLabel = 'No modules configured';
  if (positiveModules.length > 0) {
    if (maxCompleteSets === 0) {
      const deficitDetails = positiveModules
        .filter((m) => m.shortage > 0)
        .map((m) => `Module ${m.moduleNumber} (needs ${m.shortage} more)`);
      limitingModuleLabel = deficitDetails.join(', ');
    } else if (limitingModuleNumbers.length === positiveModules.length) {
      limitingModuleLabel =
        positiveModules.length === 2
          ? `Both modules support ${maxCompleteSets}`
          : `All ${positiveModules.length} active modules support ${maxCompleteSets}`;
    } else {
      limitingModuleLabel = `${limitingModuleNumbers
        .map((m) => `Module ${m}`)
        .join(', ')} (supports ${maxCompleteSets} complete set${maxCompleteSets === 1 ? '' : 's'})`;
    }
  }

  const moduleChecks: ModulePoolCheck[] = rawModuleData.map((m) => ({
    ...m,
    isLimiting:
      m.requiredPerSet > 0 && limitingModuleNumbers.includes(m.moduleNumber),
  }));

  const isValid = totalPerSet > 0 && maxCompleteSets >= 1 && shortages.length === 0;

  return {
    isValid,
    totalPerSet,
    totalAvailablePool,
    maxCompleteSets,
    totalShortageForOneSet,
    limitingModuleNumbers,
    limitingModuleLabel,
    moduleChecks,
    shortages,
  };
}

export const questionService = {
  async getSubjectQuestions(subjectId: string, departmentId: string): Promise<QuestionItem[]> {
    if (!departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<QuestionItem[]>(
      `${API_ENDPOINTS.hod.questions}?subjectId=${encodeURIComponent(subjectId)}`
    );
    return res.data;
  },

  async getBlueprint(subjectId: string, departmentId: string): Promise<PaperBlueprint | null> {
    if (!departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<PaperBlueprint | null>(
      API_ENDPOINTS.hod.questionBlueprint(subjectId)
    );
    return res.data;
  },

  async saveBlueprint(
    subjectId: string,
    blueprint: PaperBlueprint,
    actor: AuthUser
  ): Promise<PaperBlueprint> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    const res = await apiRequest<PaperBlueprint>(
      API_ENDPOINTS.hod.questionBlueprint(subjectId),
      {
        method: 'POST',
        body: JSON.stringify(blueprint),
      }
    );
    return res.data;
  },

  async getPublicationHistory(
    subjectId: string,
    departmentId: string
  ): Promise<QuestionPublicationRevision[]> {
    if (!departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<QuestionPublicationRevision[]>(
      API_ENDPOINTS.hod.questionBlueprintSets(subjectId)
    );
    return res.data;
  },

  async addQuestion(payload: QuestionInputPayload, actor: AuthUser): Promise<QuestionItem> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    const opts: [string, QuestionImageAsset[] | undefined][] = [
      [payload.optionA.trim(), payload.optionAImages],
      [payload.optionB.trim(), payload.optionBImages],
      [payload.optionC.trim(), payload.optionCImages],
      [payload.optionD.trim(), payload.optionDImages],
    ];
    const hasStem = Boolean(payload.questionText.trim()) || (payload.questionImages?.length || 0) > 0;
    const distinctOptions = new Set(opts.map(([txt, imgs]) => getOptionSignature(txt, imgs)));
    if (!hasStem || opts.some(([txt, imgs]) => !txt && (imgs?.length || 0) === 0)) {
      throw new ApiClientError('Question text (or image) and all four options are required.', 400);
    }
    if (distinctOptions.size < 4) {
      throw new ApiClientError('All four options (A, B, C, D) must be distinct.', 400);
    }

    const res = await apiRequest<QuestionItem>(API_ENDPOINTS.hod.questions, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async bulkImportQuestions(
    subjectId: string,
    rows: Omit<QuestionInputPayload, 'subjectId'>[],
    sourceLabel: string,
    actor: AuthUser,
    selectedModuleNumber?: number
  ): Promise<{ importedCount: number; skippedDuplicates: number; assignedQuestionIds: string[] }> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    if (rows.length === 0) throw new ApiClientError('No valid question rows provided for import.', 400);

    // Enforce Strict Module-Wise Upload Rule only when a specific module is selected
    if (typeof selectedModuleNumber === 'number') {
      const targetMod = selectedModuleNumber;
      const mixedModules = new Set(rows.map((r) => r.moduleNumber));
      if (mixedModules.size > 1 || !mixedModules.has(targetMod)) {
        throw new ApiClientError(
          `Strict Module-Wise Rule: Every imported question in this batch must belong to Module ${targetMod}.`,
          400,
          'MODULE_MISMATCH'
        );
      }
    }

    const res = await apiRequest<{
      importedCount: number;
      skippedDuplicates: number;
      assignedQuestionIds?: string[];
    }>(API_ENDPOINTS.hod.questionBankImport, {
      method: 'POST',
      headers: {
        'x-hod-user-id': actor.id,
        'x-hod-department-id': actor.departmentId,
        'x-hod-department-code': actor.departmentCode || '',
      },
      body: JSON.stringify({
        subjectId,
        selectedModuleNumber: typeof selectedModuleNumber === 'number' ? selectedModuleNumber : undefined,
        rows,
        sourceLabel,
      }),
    });
    return {
      importedCount: res.data.importedCount,
      skippedDuplicates: res.data.skippedDuplicates || 0,
      assignedQuestionIds: res.data.assignedQuestionIds || [],
    };
  },

  async updateQuestion(
    questionId: string,
    payload: Omit<QuestionInputPayload, 'subjectId'>,
    actor: AuthUser
  ): Promise<QuestionItem> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    const opts: [string, QuestionImageAsset[] | undefined][] = [
      [payload.optionA.trim(), payload.optionAImages],
      [payload.optionB.trim(), payload.optionBImages],
      [payload.optionC.trim(), payload.optionCImages],
      [payload.optionD.trim(), payload.optionDImages],
    ];
    const hasStem = Boolean(payload.questionText.trim()) || (payload.questionImages?.length || 0) > 0;
    if (
      !hasStem ||
      opts.some(([txt, imgs]) => !txt && (imgs?.length || 0) === 0) ||
      new Set(opts.map(([txt, imgs]) => getOptionSignature(txt, imgs))).size < 4
    ) {
      throw new ApiClientError('Question content and 4 distinct options are required.', 400);
    }

    const res = await apiRequest<QuestionItem>(`${API_ENDPOINTS.hod.questions}/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async setQuestionStatus(
    questionId: string,
    status: QuestionStatus,
    actor: AuthUser
  ): Promise<QuestionItem> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    const res = await apiRequest<QuestionItem>(`${API_ENDPOINTS.hod.questions}/${questionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.data;
  },

  /**
   * Generates the maximum possible number of complete, strictly disjoint numbered sets
   * on the backend and returns ONLY an aggregate summary to HOD (never set contents or Question IDs).
   */
  async generateAvailableNumberedSets(
    subjectId: string,
    blueprint: PaperBlueprint,
    actor: AuthUser
  ): Promise<HodSetGenerationSummary> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);

    if (inFlightGenerationLocks.has(subjectId)) {
      throw new ApiClientError(
        'Question set generation is already in progress for this subject. Please wait.',
        409,
        'CONCURRENT_GENERATION_LOCK'
      );
    }

    inFlightGenerationLocks.add(subjectId);
    try {
      const res = await apiRequest<HodSetGenerationSummary>(
        API_ENDPOINTS.hod.questionBlueprintSets(subjectId),
        {
          method: 'POST',
          body: JSON.stringify(blueprint),
        }
      );
      return res.data;
    } finally {
      inFlightGenerationLocks.delete(subjectId);
    }
  },

  /**
   * Publishes the dynamically generated numbered sets referenced by `generationId` to COE.
   * Re-validates against current question bank revision, module counts, and strict zero-overlap.
   */
  async publishGeneratedSets(
    subjectId: string,
    generationId: string,
    notes: string,
    actor: AuthUser
  ): Promise<QuestionPublicationRevision> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    if (!generationId) {
      throw new ApiClientError('Generate available numbered sets before publishing.', 400);
    }

    const res = await apiRequest<QuestionPublicationRevision>(
      API_ENDPOINTS.hod.publishQuestionSets(subjectId),
      {
        method: 'POST',
        body: JSON.stringify({ generationId, notes }),
      }
    );
    return res.data;
  },

  /**
   * Authorized COE-only reader for published numbered set composition.
   * Explicitly denies HOD and PRINCIPAL access to enforce strict backend confidentiality.
   */
  async getAuthorizedCoePublishedSets(
    subjectId: string,
    callerRole: UserRole | 'COE'
  ): Promise<{
    revisionNumber: string;
    setsGeneratedCount: number;
    numberedSets: NumberedQuestionSet[];
  } | null> {
    if (callerRole !== 'COE') {
      throw new ApiClientError(
        'Forbidden: Generated question set composition and Question ID mappings are confidential and inaccessible to HOD/Principal roles.',
        403,
        'CONFIDENTIAL_SET_ACCESS_DENIED'
      );
    }

    const res = await apiRequest<{
      revisionNumber: string;
      setsGeneratedCount: number;
      numberedSets: NumberedQuestionSet[];
    } | null>(`${API_ENDPOINTS.hod.questionBlueprintSets(subjectId)}/coe-composition`);
    return res.data;
  },
};
