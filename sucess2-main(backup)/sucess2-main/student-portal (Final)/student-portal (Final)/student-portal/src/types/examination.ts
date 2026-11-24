export type ExamAvailabilityState =
  | 'NOT_STARTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'UNAUTHORIZED'
  | 'SCHEDULED_WAITING';

export type PaperVersion = 'A' | 'B' | 'C' | 'D';

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type QuestionStatus =
  | 'NOT_VISITED'
  | 'NOT_ANSWERED'
  | 'ANSWERED'
  | 'MARKED_FOR_REVIEW'
  | 'ANSWERED_AND_MARKED_FOR_REVIEW';

export type SaveAckStatus =
  | 'IDLE'
  | 'SAVING'
  | 'SAVED'
  | 'CONNECTION_INTERRUPTED'
  | 'RECONNECTING'
  | 'SAVE_FAILED';

export type LabConnectionState =
  | 'CONNECTED'
  | 'SYNCHRONIZING'
  | 'TEMPORARILY_DISCONNECTED'
  | 'RECONNECTING'
  | 'SUBMISSION_PENDING';

export interface StudentLoginRequest {
  usn: string;
  dateOfBirth: string;
  workstationId?: string;
}

export interface StudentIdentity {
  usn: string;
  fullName: string;
  department: string;
  semester: string;
  section: string;
  assignedWorkstationId: string;
  assignedVersion: PaperVersion;
  sessionToken: string;
  dateOfBirth?: string;
}

export interface ExaminationSessionInfo {
  examinationId: string;
  sessionId: string;
  cycleName: string;
  examinationType: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  semester: string;
  section: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  sessionSlot: string;
  sittingName?: string;
  sittingCode?: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  marksPerCorrect: number;
  negativeMarkingPerWrong: number;
  laboratoryName: string;
  availabilityState: ExamAvailabilityState;
  availabilityMessage: string;
  instructionsAvailable: boolean;
  selectedPaperLabel: string;
  assignedVersion: PaperVersion;
  workstationId: string;
}

export interface StudentLoginResponse {
  authenticated: boolean;
  student: StudentIdentity;
  examSession: ExaminationSessionInfo;
  serverTimestampMs: number;
}

export interface ExaminationInstructions {
  examinationId: string;
  sessionId: string;
  institutionName: string;
  subjectCode: string;
  subjectName: string;
  examinationType: string;
  /** ISO date string for the scheduled exam date (e.g. "2026-11-16") */
  scheduledDate: string;
  /** Alias for scheduledDate — populated when the backend sends 'examDate' */
  examDate?: string;
  startTime: string;
  endTime: string;
  sessionSlot: string;
  laboratoryName: string;
  durationMinutes: number;
  /** Alias for durationMinutes — populated when backend sends 'duration' in minutes */
  duration?: number;
  totalQuestions: number;
  totalMarks: number;
  marksPerCorrect: number;
  /** Alias for marksPerCorrect — populated when backend sends 'marksPerQuestion' */
  marksPerQuestion?: number;
  negativeMarkingPerWrong: number;
  /** Populated from COE scheduling — present in exam session but may also appear in instructions */
  semester?: string;
  /** Populated from COE scheduling — present in exam session but may also appear in instructions */
  department?: string;
  generalRules: string[];
  navigationRules: string[];
  answerModificationRules: string[];
  submissionAndAutoSubmitRules: string[];
}

export interface StudentQuestionOption {
  optionKey: OptionKey;
  optionId: string;
  text: string;
}

/**
 * StudentQuestion deliberately excludes any answer key or evaluation metadata.
 * The Lab Server never sends correct answers to student browsers.
 */
export interface StudentQuestion {
  questionId: string;
  displayNumber: number;
  moduleNumber: number;
  moduleTitle: string;
  questionText: string;
  codeSnippet?: string;
  options: StudentQuestionOption[];
}

export interface AssignedQuestionPaperResponse {
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  workstationId: string;
  selectedPaperLabel: string;
  assignedVersion: PaperVersion;
  totalQuestions: number;
  questions: StudentQuestion[];
}

export interface ServerAnswerRecord {
  questionId: string;
  selectedOption: OptionKey | null;
  markedForReview: boolean;
  visited: boolean;
  updatedAt: string;
}

export interface SaveAnswerRequest {
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  questionId: string;
  selectedOption: OptionKey | null;
  markedForReview: boolean;
  visited: boolean;
  assignedVersion: PaperVersion;
  clientSequence: number;
}

export interface SaveAnswerResponse {
  acknowledged: boolean;
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  questionId: string;
  selectedOption: OptionKey | null;
  markedForReview: boolean;
  visited: boolean;
  assignedVersion: PaperVersion;
  savedAt: string;
  serverTimestampMs: number;
  remainingSeconds: number;
}

export interface ExamSubmissionReceipt {
  confirmationReference: string;
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  studentName: string;
  department: string;
  semester: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  examinationType: string;
  assignedWorkstationId: string;
  submittedAt: string;
  submissionTrigger: 'MANUAL' | 'AUTO_TIMER_EXPIRED';
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
}

export interface ExamRuntimeStateResponse {
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  assignedVersion: PaperVersion;
  workstationId: string;
  instructionsConfirmed: boolean;
  examStarted: boolean;
  submitted: boolean;
  serverTimestampMs: number;
  examExpiresAtMs: number;
  remainingSeconds: number;
  responses: Record<string, ServerAnswerRecord>;
  submissionReceipt?: ExamSubmissionReceipt;
}

export interface StartExamRequest {
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  instructionsConfirmed: boolean;
}

export interface SubmitExamRequest {
  examinationId: string;
  sessionId: string;
  studentUsn: string;
  assignedVersion: PaperVersion;
  submissionTrigger: 'MANUAL' | 'AUTO_TIMER_EXPIRED';
}

export interface SubmitExamResponse {
  submitted: boolean;
  locked: boolean;
  receipt: ExamSubmissionReceipt;
}

export interface QuestionPaletteSummary {
  total: number;
  answered: number;
  notAnswered: number;
  markedForReview: number;
  answeredAndMarkedForReview: number;
  notVisited: number;
  unansweredTotal: number;
  reviewTotal: number;
}
