export type UserRole = 'PRINCIPAL' | 'HOD' | 'ADMIN';

export type ThemePreference = 'light' | 'dark';

export type AccountStatus = 'Active' | 'Inactive';

export type DepartmentStatus = 'Active' | 'Inactive' | 'Archived';

export type SubjectStatus = 'Active' | 'Archived' | 'Inactive';

export type QuestionStatus = 'Active' | 'Archived';

export type QuestionRevisionStatus = 'Draft' | 'Published' | 'Superseded';

export type StudentListStatus = 'Active' | 'Replaced' | 'Frozen by COE';

export type ExamLifecycleStatus =
  | 'Scheduled'
  | 'In Progress'
  | 'Exam Completed'
  | 'Cancelled';

export type LabReadinessStatus = 'Not Ready' | 'Ready' | 'Issue';

export type ResultStatusLifecycle =
  | 'Not Imported'
  | 'Awaiting COE Approval'
  | 'Correction Pending'
  | 'Released';

export type KeyCorrectionStatus =
  | 'Pending COE Review'
  | 'Approved & Recalculated'
  | 'Rejected';

export type AuditActorRole = 'PRINCIPAL' | 'HOD' | 'COE' | 'SYSTEM';

export type AuditCategory =
  | 'HOD_DEPARTMENT_CREATED'
  | 'HOD_UPDATED'
  | 'HOD_STATUS_CHANGED'
  | 'HOD_REPLACED'
  | 'SUBJECT_CREATED'
  | 'SUBJECT_UPDATED'
  | 'SUBJECT_ARCHIVED'
  | 'STUDENT_LIST_UPLOADED'
  | 'STUDENT_LIST_REPLACED'
  | 'STUDENT_RECORD_UPDATED'
  | 'QUESTION_UPLOADED'
  | 'QUESTION_PUBLISHED'
  | 'KEY_CORRECTION_REQUESTED'
  | 'KEY_CORRECTION_DECIDED'
  | 'EXAM_STATUS_UPDATED'
  | 'RESULT_IMPORTED_RELEASED'
  | 'REPORT_VIEWED_EXPORTED'
  | 'ACCOUNT_SECURITY_EVENT';

export interface AuthUser {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  username: string;
  role: UserRole;
  designation: string;
  departmentId?: string;
  departmentCode?: string;
  departmentName?: string;
  contactNumber?: string;
  lastLogin: string;
  themePreference: ThemePreference;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  identificationNumber: string;
  hodId?: string;
  hodName?: string;
  hodEmail?: string;
  status: DepartmentStatus;
  createdAt: string;
}

export interface HodAssignmentHistory {
  departmentId: string;
  departmentCode: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export interface HodAccountRecord {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  designation: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  status: AccountStatus;
  assignedAt: string;
  deactivatedAt?: string;
  assignmentHistory?: HodAssignmentHistory[];
}

export interface AcademicYear {
  id: string;
  label: string;
  isCurrent: boolean;
  status: 'Active' | 'Upcoming' | 'Archived';
}

export interface SemesterRecord {
  id: string;
  number: number;
  name: string;
  status: 'Active' | 'Upcoming' | 'Completed';
}

export interface DepartmentSectionConfig {
  id: string;
  departmentId: string;
  semesterNumber: number;
  name: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  academicYearId: string;
  moduleCount: number; // Flexible per subject
  applicableSections?: string[];
  status: SubjectStatus;
  hasDependentRecords: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleStudent {
  id: string;
  usn: string;
  studentName: string;
  dob: string; // YYYY-MM-DD (sensitive - shown only in Setup Class Student Lists)
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  section: string;
  academicYearId: string;
  isValid: boolean;
  validationErrors: string[];
}

export interface EnrolledStudentRecord {
  id: string;
  usn: string;
  studentName: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  section: string;
  academicYearId: string;
  enrollmentStatus: 'Enrolled' | 'Graduated' | 'Discontinued';
}

export interface StudentListRevision {
  id: string;
  departmentId: string;
  departmentCode: string;
  academicYearId: string;
  semesterNumber: number;
  section: string;
  revisionNumber: string;
  sourceType: 'EXCEL_UPLOAD' | 'MANUAL_ENTRY' | 'PDF_CONVERTED_EXCEL';
  fileName?: string;
  totalStudents: number;
  validCount: number;
  invalidCount: number;
  uploadedBy: string;
  uploadedAt: string;
  status: StudentListStatus;
  students: EligibleStudent[];
}

export type QuestionImageField =
  | 'QUESTION_TEXT'
  | 'OPTION_A'
  | 'OPTION_B'
  | 'OPTION_C'
  | 'OPTION_D';

export interface QuestionImageAsset {
  assetId: string;
  targetField: QuestionImageField;
  sequence: number;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  base64Data: string;
  altText?: string;
  pageNumber?: number;
  uncertainAssociation?: boolean;
  associationNote?: string;
  sha256?: string;
}

export interface QuestionItem {
  questionId: string; // Stable Question ID retained across revisions & A-D versions
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
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
}

export type ConversionLifecycleStatus =
  | 'WAITING_FOR_FILE'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'EXTRACTING_TEXT'
  | 'EXTRACTING_TABLES'
  | 'EXTRACTING_IMAGES'
  | 'IDENTIFYING_MODULES'
  | 'VALIDATION_PENDING'
  | 'VALIDATION_FAILED'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'READY_FOR_EXCEL_DOWNLOAD'
  | 'DOWNLOAD_FAILED'
  | 'BACKEND_UNAVAILABLE'
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_DOCUMENT'
  | 'PROCESSING_TIMEOUT'
  | 'MODULE_MISMATCH'
  | 'DEPARTMENT_MISMATCH'
  | 'SECTION_MISMATCH';

export interface ExtractedStudentPreviewRow {
  tempId: string;
  rowNumber: number;
  usn: string;
  studentName: string;
  dob: string;
  sourceSection?: string;
  confidence?: number;
  isValid: boolean;
  uncertain: boolean;
  errors: string[];
  invalidFields: {
    usn: boolean;
    studentName: boolean;
    dob: boolean;
  };
  suggestedCorrection?: string;
  note: string;
}

export interface StudentConversionSession {
  conversionId: string;
  hodUserId: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  section: string;
  originalFileName: string;
  fileType: 'PDF' | 'JPG' | 'JPEG' | 'PNG' | 'WEBP' | 'DOCX';
  status: ConversionLifecycleStatus;
  statusMessage: string;
  pageCount: number;
  metadataDetected?: {
    departmentCode?: string;
    semesterNumber?: number;
    section?: string;
    detectedSections?: string[];
  };
  contextMismatches: string[];
  sectionMetadataMissing: boolean;
  sectionConfirmed: boolean;
  records: ExtractedStudentPreviewRow[];
  validationErrors: {
    rowNumber: number;
    field: string;
    value: string;
    status: string;
    explanation: string;
    suggestedCorrection?: string;
  }[];
  downloadEligible: boolean;
  recommendedFileName: string;
  createdAt: string;
  expiresAt: string;
}

export interface DetectedModuleGroup {
  moduleNumber: number;
  pageStart: number;
  pageEnd: number;
  questionCount: number;
  validCount: number;
  invalidCount: number;
  needsModuleReviewCount: number;
  missingOrInvalidKeyCount: number;
  uncertainImageCount: number;
  issueCount: number;
  status: 'READY' | 'REVIEW_REQUIRED' | 'VALIDATION_FAILED';
  downloadEligible: boolean;
  recommendedFileName: string;
  downloadUrl: string;
  label: string;
}

export type CourseOutcomeDocumentStatus = 'Active' | 'Superseded';

export interface CourseOutcomeDocumentRevision {
  id: string;
  revisionNumber: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: 'application/pdf';
  uploadedBy: string;
  uploadedAt: string;
  status: CourseOutcomeDocumentStatus;
  coeAccessible: boolean;
  notes?: string;
}

export type ModuleDetectionSource =
  | 'QUESTION_LABEL'
  | 'HEADING'
  | 'PAGE_LABEL'
  | 'TOPIC'
  | 'MANUAL'
  | 'UNKNOWN';

export interface ExtractedQuestionPreviewRow {
  previewId: string; // Temporary identifier ONLY; permanent Question IDs generated solely on backend import
  rowNumber: number;
  questionNumber?: number | null;
  detectedModuleNumber?: number | null;
  assignedModuleNumber: number | null;
  moduleSource?: ModuleDetectionSource;
  pageNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string; // 'A'|'B'|'C'|'D' or '' if missing answer key
  answerKeyStatus: 'EXTRACTED' | 'MISSING' | 'INVALID';
  images: QuestionImageAsset[];
  confidence?: number;
  isValid: boolean;
  uncertain: boolean;
  uncertainModule: boolean;
  errors: string[];
  invalidFields: {
    moduleNumber: boolean;
    questionText: boolean;
    optionA: boolean;
    optionB: boolean;
    optionC: boolean;
    optionD: boolean;
    correctOption: boolean;
    images: boolean;
  };
  note: string;
}

export interface QuestionConversionSession {
  conversionId: string;
  hodUserId: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectModuleCount: number;
  originalFileName: string;
  fileType: 'PDF' | 'JPG' | 'JPEG' | 'PNG' | 'WEBP' | 'DOCX';
  status: ConversionLifecycleStatus;
  statusMessage: string;
  pageCount: number;
  multiModuleDetected: boolean;
  detectedModules: DetectedModuleGroup[];
  readyModuleCount: number;
  needsModuleReviewCount: number;
  totalImageCount: number;
  selectedPageRange?: string;
  unassignedImages: QuestionImageAsset[];
  records: ExtractedQuestionPreviewRow[];
  validationErrors: {
    rowNumber: number;
    previewId: string;
    field: string;
    explanation: string;
  }[];
  downloadEligible: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface PaperBlueprint {
  totalQuestions: number;
  moduleDistribution: Record<number, number>;
}

/**
 * Backend/COE-only representation of an individual numbered question set.
 * Must NEVER be returned through HOD-facing API endpoints or UI state.
 */
export interface NumberedQuestionSet {
  setNumber: number;
  totalQuestions: number;
  moduleCounts: Record<number, number>;
  questionIds: string[];
  previewQuestions: QuestionItem[];
}

export type SetAllocationLifecycleStatus = 'Generated' | 'Published' | 'Invalidated' | 'Superseded';

export interface InternalSetAllocationRecord {
  generationId: string;
  departmentId: string;
  semesterNumber: number;
  subjectId: string;
  questionBankRevisionId: string;
  blueprintRevisionId: string;
  blueprint: PaperBlueprint;
  generatedSetCount: number;
  numberedSets: NumberedQuestionSet[];
  status: SetAllocationLifecycleStatus;
  createdAt: string;
  publishedAt?: string;
}

/**
 * Confidentiality-safe HOD-facing status per generated numbered set (never contains Question IDs or content).
 */
export interface HodSetStatusItem {
  setNumber: number;
  totalQuestions: number;
  publicationStatus: 'Not Published' | 'Published' | 'Superseded';
}

export interface HodSetGenerationSummary {
  generationId: string;
  departmentId: string;
  semesterNumber: number;
  subjectId: string;
  questionBankRevisionId: string;
  blueprintRevisionId: string;
  generatedSetCount: number;
  questionsPerSet: number;
  moduleDistribution: Record<number, number>;
  totalUniqueQuestionsAllocated: number;
  overlapAcrossSets: 0;
  integrityVerified: boolean;
  publicationStatus: 'Not Published' | 'Published';
  setStatuses: HodSetStatusItem[];
}

export interface QuestionPublicationRevision {
  id: string;
  generationId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  semesterNumber: number;
  revisionNumber: string;
  questionBankRevisionId: string;
  blueprintRevisionId: string;
  blueprint: PaperBlueprint;
  poolQuestionCount: number;
  setsGeneratedCount: number;
  totalUniqueQuestionsAllocated: number;
  setStatuses: HodSetStatusItem[];
  status: QuestionRevisionStatus;
  publishedBy?: string;
  publishedAt?: string;
  notes?: string;
}

export interface ExamSitting {
  id: string;
  sittingLabel: 'Morning' | 'Afternoon';
  date: string;
  timeRange: string;
  assignedLab: string;
  assignedStudentCount: number;
  status: ExamLifecycleStatus;
}

export interface ExaminationRecord {
  id: string;
  departmentId: string;
  departmentCode: string;
  academicYearId: string;
  semesterNumber: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  participatingSections: string[];
  examDate: string;
  maxMarks: number;
  examStatus: ExamLifecycleStatus;
  labReadiness: LabReadinessStatus;
  resultStatus: ResultStatusLifecycle;
  sittings: ExamSitting[];
}

export interface KeyCorrectionRequest {
  id: string;
  examinationId: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  subjectCode: string;
  subjectName: string;
  questionId: string;
  questionText: string;
  existingCorrectOption: 'A' | 'B' | 'C' | 'D';
  proposedCorrectOption: 'A' | 'B' | 'C' | 'D';
  reason?: string;
  evidenceFileName?: string;
  requestedBy: string;
  requestedAt: string;
  status: KeyCorrectionStatus;
  coeDecisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface StudentExamResult {
  id: string;
  examinationId: string;
  academicYearId: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  originalSection: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  usn: string;
  studentName: string;
  maxMarks: number;
  marksObtained: number | null; // null if Absent
  percentage: number | null; // null if Absent
  attendance: 'Present' | 'Absent';
  resultOutcome: 'Pass' | 'Fail' | 'Absent';
  coeReleaseStatus: 'Pending Approval' | 'Released';
  releasedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmployeeId: string;
  actorRole: AuditActorRole;
  actionCategory: AuditCategory;
  activityDescription: string;
  departmentId?: string;
  departmentCode: string;
  subjectCode?: string;
  targetUsn?: string;
  status: 'Completed' | 'Verified' | 'Flagged';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}
