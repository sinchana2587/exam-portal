/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SecurityViolationType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'KEYBOARD_SHORTCUT'
  | 'DEVTOOLS_ATTEMPT'
  | 'CONTEXT_MENU'
  | 'CLIPBOARD_ACTION'
  | 'SIMULATED_VIOLATION';

export interface SecurityViolationInfo {
  type: SecurityViolationType;
  label: string;
  description: string;
  detectedAt: string;
  detectedAtMs: number;
}

export interface SecurityLockState {
  isLocked: boolean;
  violation: SecurityViolationInfo | null;
  violationCount: number;
  lockedAtMs: number | null;
  failedAttempts: number;
  maxAttempts: number;
  isPermanentlyLocked: boolean;
  resumptionCount: number;
  lastResumedAt: string | null;
  savedQuestionIndex: number;
  savedRemainingSeconds: number;
  savedAnswerCount: number;
}

export interface SecurityAuditLogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  studentUsn: string;
  studentName: string;
  examinationId: string;
  event: string;
  violationType?: SecurityViolationType;
  status: 'Locked' | 'Successful' | 'Failed' | 'Restored' | 'Permanent Lock';
  details: string;
  attemptNumber?: number;
  remainingSecondsAtEvent?: number;
  questionNumberAtEvent?: number;
}

