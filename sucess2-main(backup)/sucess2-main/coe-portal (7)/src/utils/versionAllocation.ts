import {
  AnswerOption,
  GeneratedPaperVersion,
  QuestionSetMetadata,
  ScheduledExamination,
  StudentEligibilityRecord,
  StudentVersionAllocation,
  VersionDistributionCounts,
  VersionLetter,
} from '../types/examination';

export const PAPER_VERSIONS: readonly VersionLetter[] = ['A', 'B', 'C', 'D'] as const;
const OPTION_CHOICES: readonly AnswerOption[] = [
  'Option A',
  'Option B',
  'Option C',
  'Option D',
] as const;

/**
 * Cryptographically uniform integer in [0, maxExclusive) using rejection sampling
 * on Web Crypto CSPRNG (works in browsers and Node.js 19+).
 */
export function getSecureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`Invalid upper bound for CSPRNG: ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Web Crypto CSPRNG (crypto.getRandomValues) is unavailable.');
  }

  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const buf = new Uint32Array(1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    cryptoObj.getRandomValues(buf);
    const val = buf[0];
    if (val < limit) {
      return val % maxExclusive;
    }
  }
}

/**
 * Unbiased Fisher–Yates shuffle backed by CSPRNG.
 */
export function shuffleArrayCryptographic<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = getSecureRandomInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export interface SetIntegrityValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that a dynamically retrieved HOD numbered question set satisfies all integrity
 * and blueprint rules before Versions A–D generation or package preparation.
 */
export function validateNumberedQuestionSetIntegrity(
  questionSet: QuestionSetMetadata,
  exam: Pick<
    ScheduledExamination,
    'totalQuestions' | 'subjectCode' | 'questionBankRevisionId' | 'blueprintRevisionId'
  >
): SetIntegrityValidationResult {
  const errors: string[] = [];

  if (questionSet.isActive === false) {
    errors.push(`${questionSet.setNumber} (${questionSet.setId}) is inactive.`);
  }

  if (questionSet.publicationStatus === 'Superseded' || questionSet.supersededBySetId) {
    errors.push(
      `${questionSet.setNumber} (${questionSet.setId}) has been superseded by a newer HOD revision.`
    );
  } else if (questionSet.publicationStatus !== 'Published by HOD') {
    errors.push(
      `${questionSet.setNumber} (${questionSet.setId}) has not been published by the Department HOD.`
    );
  }

  if (questionSet.numberOfQuestions !== exam.totalQuestions) {
    errors.push(
      `Question count mismatch: ${questionSet.setNumber} contains ${questionSet.numberOfQuestions} questions, expected ${exam.totalQuestions} for ${exam.subjectCode}.`
    );
  }

  if (questionSet.moduleDistributionVerified === false) {
    errors.push(
      `${questionSet.setNumber} failed blueprint module-wise distribution verification.`
    );
  }

  if (
    exam.questionBankRevisionId &&
    questionSet.questionBankRevisionId &&
    questionSet.questionBankRevisionId !== exam.questionBankRevisionId
  ) {
    errors.push(
      `${questionSet.setNumber} question bank revision (${questionSet.questionBankRevisionId}) does not match examination revision (${exam.questionBankRevisionId}).`
    );
  }

  if (
    exam.blueprintRevisionId &&
    questionSet.blueprintRevisionId &&
    questionSet.blueprintRevisionId !== exam.blueprintRevisionId
  ) {
    errors.push(
      `${questionSet.setNumber} blueprint revision (${questionSet.blueprintRevisionId}) does not match examination blueprint (${exam.blueprintRevisionId}).`
    );
  }

  if (Array.isArray(questionSet.questionIds)) {
    const uniqueCount = new Set(questionSet.questionIds).size;
    if (uniqueCount !== questionSet.questionIds.length) {
      errors.push(`${questionSet.setNumber} contains duplicate Question IDs.`);
    }
    if (
      questionSet.questionIds.length > 0 &&
      questionSet.questionIds.length !== exam.totalQuestions
    ) {
      errors.push(
        `${questionSet.setNumber} Question ID list (${questionSet.questionIds.length}) does not match configured paper length (${exam.totalQuestions}).`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates deterministic question IDs for a numbered question set when no explicit QID list
 * was provided by an external Question Bank API.
 */
export function buildDefaultQuestionIdsForSet(
  subjectCode: string,
  setId: string,
  questionCount: number
): string[] {
  const cleanSetTag = setId.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  return Array.from({ length: questionCount }, (_, idx) => {
    const mod = Math.min(5, Math.floor((idx * 5) / Math.max(1, questionCount)) + 1);
    return `QID-${subjectCode}-${cleanSetTag}-M${mod}-${String(idx + 1).padStart(3, '0')}`;
  });
}

/**
 * Derives Versions A, B, C, and D from ONE selected published numbered set.
 * Each version contains the exact same underlying Question IDs, preserves stable Question IDs
 * across evaluation/correction, shuffles question order & option order, and remaps answer keys.
 */
export function generateVersionsADFromNumberedSet(params: {
  questionSet: QuestionSetMetadata;
  baseQuestionIds?: string[];
  baseAnswerKeyByQuestionId?: Record<string, AnswerOption>;
  generatedAt: string;
}): GeneratedPaperVersion[] {
  const { questionSet, generatedAt } = params;
  const questionIds =
    params.baseQuestionIds && params.baseQuestionIds.length > 0
      ? [...params.baseQuestionIds]
      : questionSet.questionIds && questionSet.questionIds.length > 0
        ? [...questionSet.questionIds]
        : buildDefaultQuestionIdsForSet(
            questionSet.subjectCode,
            questionSet.setId,
            questionSet.numberOfQuestions
          );

  const uniqueSet = new Set(questionIds);
  if (uniqueSet.size !== questionIds.length) {
    throw new Error(
      `Cannot generate Versions A–D: duplicate Question IDs found in ${questionSet.setNumber}.`
    );
  }

  const baseAnswerKey: Record<string, AnswerOption> = {};
  questionIds.forEach((qid, idx) => {
    baseAnswerKey[qid] =
      params.baseAnswerKeyByQuestionId?.[qid] || OPTION_CHOICES[idx % 4];
  });

  const qBankRev = questionSet.questionBankRevisionId || 'QB-REV-01';
  const bpRev = questionSet.blueprintRevisionId || 'BP-REV-01';

  return PAPER_VERSIONS.map((version) => {
    const shuffledQuestions = shuffleArrayCryptographic(questionIds);
    const optionOrdersByQuestionId: Record<string, AnswerOption[]> = {};
    const answerKeyByQuestionId: Record<string, AnswerOption> = {};

    shuffledQuestions.forEach((qid) => {
      const shuffledOptions = shuffleArrayCryptographic(OPTION_CHOICES);
      optionOrdersByQuestionId[qid] = shuffledOptions;
      const canonicalCorrect = baseAnswerKey[qid];
      const mappedIdx = shuffledOptions.indexOf(canonicalCorrect);
      answerKeyByQuestionId[qid] = OPTION_CHOICES[mappedIdx >= 0 ? mappedIdx : 0];
    });

    return {
      version,
      numberedSetId: questionSet.setId,
      numberedSetLabel: questionSet.setNumber,
      questionBankRevisionId: qBankRev,
      blueprintRevisionId: bpRev,
      generatedAt,
      questionOrder: shuffledQuestions,
      optionOrdersByQuestionId,
      answerKeyByQuestionId,
    };
  });
}

export function computeAggregateVersionCounts(
  allocations: readonly StudentVersionAllocation[]
): VersionDistributionCounts {
  const counts: VersionDistributionCounts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    total: 0,
  };
  allocations.forEach((alloc) => {
    if (alloc.superseded) return;
    counts[alloc.versionId] += 1;
    counts.total += 1;
  });
  return counts;
}

/**
 * Allocates Paper Versions A, B, C, and D across eligible students in a single sitting
 * using cryptographically randomised Fisher–Yates balancing strictly keyed to candidate
 * student identity (studentId + usn).
 *
 * Guarantees:
 * - Mathematically balanced counts: max(A,B,C,D) - min(A,B,C,D) <= 1
 *   (e.g., 60 students -> 15/15/15/15; 62 students -> 16/16/15/15).
 * - Zero dependence on PC numbers, seat indexes, USN last digits, or deterministic modulo.
 * - Zero duplicate allocations for any student in the sitting.
 */
export function allocateBalancedVersionsByUsn(params: {
  examinationId: string;
  sittingId: string;
  students: readonly Pick<StudentEligibilityRecord, 'studentId' | 'usn'>[];
  numberedSetId: string;
  allocationRevision?: number;
  assignedAt: string;
  status?: 'Assigned' | 'Reallocated';
}): {
  allocations: StudentVersionAllocation[];
  counts: VersionDistributionCounts;
} {
  const {
    examinationId,
    sittingId,
    students,
    numberedSetId,
    allocationRevision = 1,
    assignedAt,
    status = 'Assigned',
  } = params;

  const uniqueStudents: { studentId: string; usn: string }[] = [];
  const seenUsns = new Set<string>();
  students.forEach((st) => {
    if (!seenUsns.has(st.usn)) {
      seenUsns.add(st.usn);
      uniqueStudents.push({
        studentId: st.studentId || `STU-${st.usn}`,
        usn: st.usn,
      });
    }
  });

  const n = uniqueStudents.length;
  const baseCount = Math.floor(n / 4);
  const remainder = n % 4;

  // Pick which remainder version slots receive +1 randomly using CSPRNG
  const remainderVersionBonus = shuffleArrayCryptographic(PAPER_VERSIONS).slice(
    0,
    remainder
  );
  const bonusSet = new Set<VersionLetter>(remainderVersionBonus);

  const versionPool: VersionLetter[] = [];
  PAPER_VERSIONS.forEach((ver) => {
    const targetCount = baseCount + (bonusSet.has(ver) ? 1 : 0);
    for (let i = 0; i < targetCount; i += 1) {
      versionPool.push(ver);
    }
  });

  // Shuffle version pool AND student order independently using CSPRNG
  const randomizedVersions = shuffleArrayCryptographic(versionPool);
  const randomizedStudents = shuffleArrayCryptographic(uniqueStudents);

  const rawAllocations: StudentVersionAllocation[] = randomizedStudents.map(
    (st, idx) => ({
      examinationId,
      sittingId,
      studentId: st.studentId,
      usn: st.usn,
      numberedSetId,
      versionId: randomizedVersions[idx],
      allocationRevision,
      assignedAt,
      status,
    })
  );

  // Store canonically ordered by USN (assignment remains random & persistent)
  const allocations = rawAllocations.sort((a, b) => a.usn.localeCompare(b.usn));
  const counts = computeAggregateVersionCounts(allocations);

  return { allocations, counts };
}
