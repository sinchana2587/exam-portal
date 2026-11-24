/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudentExamRecoveryState =
  | 'ACTIVE'
  | 'INTERRUPTED'
  | 'RECOVERY_PENDING'
  | 'RECOVERY_COMPLETED'
  | 'SUBMITTED';

export interface EmergencyRecoveryCredentials {
  recoveryId: string;
  recoveryKey: string;
}

export interface EmergencyRecoveryConfig {
  enabled: boolean;
  recoveryId: string;
  recoveryKey: string;
  lastRotatedAt?: string;
  rotatedBy?: string;
}

/**
 * Unique, one-time re-login authorization token generated upon Lab Instructor approval.
 */
export interface ReLoginAuthorisationToken {
  tokenId: string; // e.g. "REL-AUTH-2026-4MH25CS149-XXXX"
  studentUsn: string;
  studentName: string;
  assignedSystemId: string;
  targetSystemId: string;
  examinationSessionStatus: 'ACTIVE' | 'INTERRUPTED' | 'LOCKED' | 'COMPLETED';
  reloginRequestStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'CONSUMED' | 'EXPIRED';
  instructorAuthorisation: string; // e.g. "EMGR-LOGIN-01 (Lab Instructor)"
  reason: string; // e.g. "Terminal Hardware Crash on LAB01-PC-03"
  authorisedAt: string;
  expiresAt: string;
  consumedAt?: string;
  isOneTimeUsed: boolean;
}

/**
 * Permanent examination login registry record maintained in backend database.
 */
export interface StudentLoginRegistryRecord {
  usn: string;
  studentName: string;
  assignedSystemId: string;
  hasLoggedInOnce: boolean;
  sessionActive: boolean;
  firstLoggedInAt?: string;
  lastLoginAt?: string;
  examinationSessionStatus: 'ACTIVE' | 'INTERRUPTED' | 'LOCKED' | 'COMPLETED';
  reloginRequestStatus: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'CONSUMED';
  activeTokenId?: string;
  instructorAuthorisation?: string;
  approvalReason?: string;
  approvalTimestamp?: string;
  tokenExpiresAt?: string;
  previousSystemId?: string;
  reloginSystemId?: string;
}

export interface RecoveryAuthorisation {
  authorisationId: string;
  studentUsn: string;
  studentName: string;
  previousSystemId: string;
  newSystemId?: string;
  authorisedBy: string;
  authorisedAt: string;
  expiresAt: string;
  status: 'PENDING' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  consumedAt?: string;
}

export interface SessionTransferRecord {
  transferId: string;
  studentUsn: string;
  studentName: string;
  examinationId: string;
  previousSystemId: string;
  newSystemId: string;
  authorisedAt: string;
  reloginAt: string;
  authorisedBy: string;
  lastSavedQuestionIndex: number;
  answersRecoveredCount: number;
  remainingSeconds: number;
  status: 'SUCCESS' | 'REVOKED';
}

export interface RecoveryAuditLog {
  logId: string;
  timestamp: string;
  action:
    | 'INSTRUCTOR_LOGIN'
    | 'RELOGIN_APPROVED'
    | 'RELOGIN_CONSUMED'
    | 'RECOVERY_AUTHORISED'
    | 'RECOVERY_CANCELLED'
    | 'RECOVERY_CONSUMED'
    | 'COE_CONFIG_UPDATE'
    | 'KEY_ROTATION'
    | 'SYSTEM_CRASH_REPORTED'
    | 'UNAUTHORISED_RELOGIN_BLOCKED'
    | 'TEST_MODE_ACTIVATED';
  actor: string;
  details: string;
  targetUsn?: string;
  systemId?: string;
}

export interface StudentRecoveryOverview {
  usn: string;
  studentName: string;
  department: string;
  laboratory: string;
  examination: string;
  status: 'Active' | 'Interrupted' | 'Recovery Pending' | 'Submitted';
  currentQuestion: number;
  totalQuestions: number;
  answeredCount: number;
  lastSaved: string;
  previousSystemId: string;
  currentSystemId: string;
  reloginSystemId?: string;
  recoveryStatus:
    | 'Available'
    | 'Pending Authorisation'
    | 'Already Recovered'
    | 'Not Applicable (Submitted)';
  canAuthorise: boolean;
}
