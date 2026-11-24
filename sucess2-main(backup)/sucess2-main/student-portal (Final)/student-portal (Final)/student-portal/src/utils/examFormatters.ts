import {
  OptionKey,
  QuestionPaletteSummary,
  QuestionStatus,
  ServerAnswerRecord,
  StudentQuestion,
} from '../types/examination';

export function formatCountdownTime(totalSeconds: number): {
  hours: string;
  minutes: string;
  seconds: string;
  formatted: string;
  isLowTime: boolean;
  isCriticalTime: boolean;
} {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;

  const hours = String(hrs).padStart(2, '0');
  const minutes = String(mins).padStart(2, '0');
  const seconds = String(secs).padStart(2, '0');

  return {
    hours,
    minutes,
    seconds,
    formatted: `${hours}:${minutes}:${seconds}`,
    isLowTime: clamped > 0 && clamped <= 600, // <= 10 minutes
    isCriticalTime: clamped > 0 && clamped <= 180, // <= 3 minutes
  };
}

export function deriveQuestionStatus(
  record: ServerAnswerRecord | undefined
): QuestionStatus {
  if (!record || !record.visited) {
    return 'NOT_VISITED';
  }
  const hasAnswer = Boolean(record.selectedOption);
  if (hasAnswer && record.markedForReview) {
    return 'ANSWERED_AND_MARKED_FOR_REVIEW';
  }
  if (hasAnswer && !record.markedForReview) {
    return 'ANSWERED';
  }
  if (!hasAnswer && record.markedForReview) {
    return 'MARKED_FOR_REVIEW';
  }
  return 'NOT_ANSWERED';
}

export function computePaletteSummary(
  questions: StudentQuestion[],
  responses: Record<string, ServerAnswerRecord>
): QuestionPaletteSummary {
  let answered = 0;
  let notAnswered = 0;
  let markedForReview = 0;
  let answeredAndMarkedForReview = 0;
  let notVisited = 0;

  for (const q of questions) {
    const status = deriveQuestionStatus(responses[q.questionId]);
    switch (status) {
      case 'ANSWERED':
        answered++;
        break;
      case 'NOT_ANSWERED':
        notAnswered++;
        break;
      case 'MARKED_FOR_REVIEW':
        markedForReview++;
        break;
      case 'ANSWERED_AND_MARKED_FOR_REVIEW':
        answeredAndMarkedForReview++;
        break;
      case 'NOT_VISITED':
      default:
        notVisited++;
        break;
    }
  }

  const total = questions.length;
  const totalAnsweredEffective = answered + answeredAndMarkedForReview;
  const unansweredTotal = Math.max(0, total - totalAnsweredEffective);
  const reviewTotal = markedForReview + answeredAndMarkedForReview;

  return {
    total,
    answered: totalAnsweredEffective,
    notAnswered,
    markedForReview,
    answeredAndMarkedForReview,
    notVisited,
    unansweredTotal,
    reviewTotal,
  };
}

export function validateUsnInput(rawUsn: string): string | null {
  const trimmed = rawUsn.trim().toUpperCase();
  if (!trimmed) {
    return 'University Seat Number (USN) is required.';
  }
  const usnRegex = /^[1-9][A-Z]{2}\d{2}[A-Z]{2,3}\d{3}$/;
  if (!usnRegex.test(trimmed)) {
    return 'Enter a valid VTU/MIT Mysore USN format (for example, 4MH23CS001).';
  }
  return null;
}

export function normalizeDobInput(rawDob: string): string {
  const trimmed = rawDob.trim();
  if (!trimmed) return '';
  // Support DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  // Support YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

export function validateDobInput(rawDob: string): string | null {
  const trimmed = rawDob.trim();
  if (!trimmed) {
    return 'Date of Birth is required for roster verification.';
  }
  const normalized = normalizeDobInput(trimmed);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(normalized)) {
    return 'Enter Date of Birth in YYYY-MM-DD or DD-MM-YYYY format.';
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return 'Enter a valid calendar Date of Birth.';
  }
  return null;
}

export function formatDisplayNumber(num: number): string {
  return String(num).padStart(2, '0');
}

export function createInitialRecord(
  questionId: string,
  visited = false,
  selectedOption: OptionKey | null = null,
  markedForReview = false
): ServerAnswerRecord {
  return {
    questionId,
    selectedOption,
    markedForReview,
    visited,
    updatedAt: new Date().toISOString(),
  };
}
