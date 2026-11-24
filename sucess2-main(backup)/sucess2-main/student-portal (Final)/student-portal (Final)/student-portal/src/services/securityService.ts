/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SecurityAuditLogEntry,
  SecurityLockState,
  SecurityViolationInfo,
  SecurityViolationType,
} from '../types/security';
import { apiClient } from '../api/client';

export const INVIGILATOR_SECRET_PASSWORD = ''; // Deprecated: Authoritative COE-generated credential verification only
export const MAX_INVIGILATOR_ATTEMPTS = 3;

export interface AttemptScope {
  studentUsn?: string;
  examinationId?: string;
  sittingName?: string;
}

export function buildSecurityLockStateKey(scope?: AttemptScope): string | null {
  if (!scope || !scope.studentUsn || !scope.examinationId) {
    return null;
  }
  const cleanUsn = scope.studentUsn.trim().toUpperCase();
  const cleanExamId = scope.examinationId.trim();
  const rawSitting = scope.sittingName || 'SESSION';
  const cleanSitting = rawSitting.trim().toUpperCase().replace(/[\s\-_]+/g, '_');
  return `mitm_cbt_security_lock_${cleanExamId}_${cleanSitting}_${cleanUsn}`;
}

const SECURITY_LOCK_STATE_KEY = 'mitm_cbt_security_lock_state_v1';
const SECURITY_AUDIT_LOGS_KEY = 'mitm_cbt_security_audit_logs_v1';

const INITIAL_LOCK_STATE: SecurityLockState = {
  isLocked: false,
  violation: null,
  violationCount: 0,
  lockedAtMs: null,
  failedAttempts: 0,
  maxAttempts: MAX_INVIGILATOR_ATTEMPTS,
  isPermanentlyLocked: false,
  resumptionCount: 0,
  lastResumedAt: null,
  savedQuestionIndex: 0,
  savedRemainingSeconds: 7200,
  savedAnswerCount: 0,
};

export const securityService = {
  getLockState(scope?: AttemptScope): SecurityLockState {
    try {
      // Clean up deprecated unscoped storage key to prevent stale lock leaks across exams
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SECURITY_LOCK_STATE_KEY);
      }
      const key = buildSecurityLockStateKey(scope);
      if (!key) return { ...INITIAL_LOCK_STATE };
      const raw = localStorage.getItem(key);
      if (!raw) return { ...INITIAL_LOCK_STATE };
      return JSON.parse(raw) as SecurityLockState;
    } catch {
      return { ...INITIAL_LOCK_STATE };
    }
  },

  saveLockState(state: SecurityLockState, scope?: AttemptScope): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SECURITY_LOCK_STATE_KEY);
      }
      const key = buildSecurityLockStateKey(scope);
      if (key) {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch {
      // Ignore quota issues
    }
  },

  triggerLockdown(params: {
    violationType: SecurityViolationType;
    label: string;
    description: string;
    studentUsn: string;
    studentName: string;
    examinationId: string;
    sittingName?: string;
    currentQuestionIndex: number;
    remainingSeconds: number;
    answeredCount: number;
  }): SecurityLockState {
    const scope: AttemptScope = {
      studentUsn: params.studentUsn,
      examinationId: params.examinationId,
      sittingName: params.sittingName,
    };
    const current = this.getLockState(scope);

    if (current.isLocked) {
      return current;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const formattedTime = now.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const violation: SecurityViolationInfo = {
      type: params.violationType,
      label: params.label,
      description: params.description,
      detectedAt: formattedTime,
      detectedAtMs: nowMs,
    };

    const newViolationCount = current.violationCount + 1;

    const updatedState: SecurityLockState = {
      ...current,
      isLocked: true,
      violation,
      violationCount: newViolationCount,
      lockedAtMs: nowMs,
      savedQuestionIndex: params.currentQuestionIndex,
      savedRemainingSeconds: params.remainingSeconds,
      savedAnswerCount: params.answeredCount,
    };

    this.saveLockState(updatedState, scope);

    // Record Event 1: Malpractice / Violation Detected
    this.addAuditLog({
      studentUsn: params.studentUsn,
      studentName: params.studentName,
      examinationId: params.examinationId,
      event: `${params.label} detected`,
      violationType: params.violationType,
      status: 'Locked',
      details: `${params.description} (Incident #${newViolationCount}). Interface locked immediately.`,
      questionNumberAtEvent: params.currentQuestionIndex + 1,
      remainingSecondsAtEvent: params.remainingSeconds,
    });

    // Notify backend server asynchronously
    apiClient
      .post('/api/security/violation', {
        violationType: params.violationType,
        label: params.label,
        description: params.description,
        studentUsn: params.studentUsn,
        examinationId: params.examinationId,
        sittingName: params.sittingName,
        currentQuestionIndex: params.currentQuestionIndex,
        remainingSeconds: params.remainingSeconds,
        answeredCount: params.answeredCount,
      })
      .catch(() => {
        // Safe offline fallback
      });

    return updatedState;
  },

  async verifyInvigilatorPassword(params: {
    enteredPassword: string;
    studentUsn: string;
    studentName: string;
    examinationId: string;
    sittingName?: string;
  }): Promise<{ success: boolean; message: string; state: SecurityLockState }> {
    const scope: AttemptScope = {
      studentUsn: params.studentUsn,
      examinationId: params.examinationId,
      sittingName: params.sittingName,
    };
    const current = this.getLockState(scope);

    if (!current.isLocked) {
      return {
        success: true,
        message: 'Examination is already unlocked.',
        state: current,
      };
    }

    if (current.isPermanentlyLocked) {
      throw new Error(
        'Maximum authorization attempts exceeded (3/3). This session is permanently locked. Chief Invigilator / HOD administrative override required.'
      );
    }

    const trimmedPassword = params.enteredPassword.trim();
    if (!trimmedPassword) {
      throw new Error('Please enter the invigilator authorization password.');
    }

    // Authoritative backend verification against Lab Server
    try {
      const serverResponse = await apiClient.post<{
        success: boolean;
        message: string;
        state?: SecurityLockState;
        failedAttempts?: number;
        isPermanentlyLocked?: boolean;
      }>('/api/security/unlock', {
        enteredPassword: trimmedPassword,
        studentUsn: params.studentUsn,
        examinationId: params.examinationId,
        sittingName: params.sittingName,
      });

      if (serverResponse.success && serverResponse.state) {
        this.saveLockState(serverResponse.state, scope);
        this.addAuditLog({
          studentUsn: params.studentUsn,
          studentName: params.studentName,
          examinationId: params.examinationId,
          event: 'Invigilator password entered',
          status: 'Successful',
          details: serverResponse.message || 'Valid invigilator authorization password entered by proctor. Session unlocked.',
          attemptNumber: current.failedAttempts + 1,
          questionNumberAtEvent: current.savedQuestionIndex + 1,
          remainingSecondsAtEvent: current.savedRemainingSeconds,
        });
        return {
          success: true,
          message: serverResponse.message || 'Session unlocked successfully.',
          state: serverResponse.state,
        };
      } else {
        const newFailed = serverResponse.failedAttempts ?? (current.failedAttempts + 1);
        const isNowPermanent = serverResponse.isPermanentlyLocked ?? (newFailed >= MAX_INVIGILATOR_ATTEMPTS);
        const updatedState: SecurityLockState = {
          ...current,
          failedAttempts: newFailed,
          isPermanentlyLocked: isNowPermanent,
        };
        this.saveLockState(updatedState, scope);
        this.addAuditLog({
          studentUsn: params.studentUsn,
          studentName: params.studentName,
          examinationId: params.examinationId,
          event: 'Invigilator password attempt failed',
          status: isNowPermanent ? 'Permanent Lock' : 'Failed',
          details: serverResponse.message || `Invalid password entered (Attempt ${newFailed}/${MAX_INVIGILATOR_ATTEMPTS}).`,
          attemptNumber: newFailed,
          questionNumberAtEvent: current.savedQuestionIndex + 1,
          remainingSecondsAtEvent: current.savedRemainingSeconds,
        });
        return {
          success: false,
          message: serverResponse.message || `Invalid invigilator password. ${Math.max(0, MAX_INVIGILATOR_ATTEMPTS - newFailed)} attempt(s) remaining.`,
          state: updatedState,
        };
      }
    } catch (err: any) {
      // Differentiate network errors / timeouts from actual credential rejection
      const isNetwork =
        Boolean(err?.isNetworkError) ||
        Boolean(err?.isTimeout) ||
        err?.statusCode === 0 ||
        err?.name === 'TypeError' ||
        (typeof err?.message === 'string' &&
          (err.message.toLowerCase().includes('network') ||
            err.message.toLowerCase().includes('connect') ||
            err.message.toLowerCase().includes('timed out') ||
            err.message.toLowerCase().includes('reach')));

      if (isNetwork) {
        // Network failures MUST NOT increment failedAttempts or permanently lock students
        return {
          success: false,
          message:
            err?.message ||
            'Network connection error while contacting Lab Server. Attempt not counted. Please check connection and try again.',
          state: current,
        };
      }

      const newFailed = current.failedAttempts + 1;
      const isNowPermanent = newFailed >= MAX_INVIGILATOR_ATTEMPTS;
      const updatedState: SecurityLockState = {
        ...current,
        failedAttempts: newFailed,
        isPermanentlyLocked: isNowPermanent,
      };
      this.saveLockState(updatedState, scope);
      this.addAuditLog({
        studentUsn: params.studentUsn,
        studentName: params.studentName,
        examinationId: params.examinationId,
        event: 'Invigilator password attempt failed',
        status: isNowPermanent ? 'Permanent Lock' : 'Failed',
        details: err?.message || 'Invalid invigilator authorization password.',
        attemptNumber: newFailed,
        questionNumberAtEvent: current.savedQuestionIndex + 1,
        remainingSecondsAtEvent: current.savedRemainingSeconds,
      });
      return {
        success: false,
        message: err?.message || `Invalid invigilator password. ${Math.max(0, MAX_INVIGILATOR_ATTEMPTS - newFailed)} attempt(s) remaining.`,
        state: updatedState,
      };
    }
  },

  addAuditLog(entry: {
    studentUsn: string;
    studentName: string;
    examinationId: string;
    event: string;
    status: 'Locked' | 'Successful' | 'Failed' | 'Restored' | 'Permanent Lock';
    details: string;
    violationType?: SecurityViolationType;
    attemptNumber?: number;
    questionNumberAtEvent?: number;
    remainingSecondsAtEvent?: number;
  }): SecurityAuditLogEntry {
    const logs = this.getAuditLogs();
    const now = new Date();
    const formattedTime = now.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newLog: SecurityAuditLogEntry = {
      id: `SEC-LOG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formattedTime,
      timestampMs: now.getTime(),
      studentUsn: entry.studentUsn,
      studentName: entry.studentName,
      examinationId: entry.examinationId,
      event: entry.event,
      violationType: entry.violationType,
      status: entry.status,
      details: entry.details,
      attemptNumber: entry.attemptNumber,
      questionNumberAtEvent: entry.questionNumberAtEvent,
      remainingSecondsAtEvent: entry.remainingSecondsAtEvent,
    };

    logs.unshift(newLog);

    try {
      localStorage.setItem(SECURITY_AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch {
      // Ignore
    }

    return newLog;
  },

  getAuditLogs(): SecurityAuditLogEntry[] {
    try {
      const raw = localStorage.getItem(SECURITY_AUDIT_LOGS_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as SecurityAuditLogEntry[];
    } catch {
      return [];
    }
  },

  async fetchRemoteAuditLogs(): Promise<SecurityAuditLogEntry[]> {
    try {
      return await apiClient.get<SecurityAuditLogEntry[]>('/api/security/audit-logs');
    } catch {
      return this.getAuditLogs();
    }
  },
};
