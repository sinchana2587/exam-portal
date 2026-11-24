/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EmergencyRecoveryConfig,
  EmergencyRecoveryCredentials,
  ReLoginAuthorisationToken,
  RecoveryAuditLog,
  RecoveryAuthorisation,
  SessionTransferRecord,
  StudentLoginRegistryRecord,
  StudentRecoveryOverview,
} from '../types/recovery';
import { apiClient } from '../api/client';

// FIXED RECOVERY CREDENTIALS - EXACT AS SPECIFIED BY COE
export const FIXED_RECOVERY_CREDENTIALS: EmergencyRecoveryCredentials = {
  recoveryId: 'EMGR-LOGIN-01',
  recoveryKey: 'ProTick-0011',
};

// Master COE Console Credentials - opens on any PC during exam
export const LAB_COE_CREDENTIALS = {
  id: 'LAB@0987',
  password: 'lab.2587',
};

// Alternative instructor credentials for convenience
export const LAB_INSTRUCTOR_CREDENTIALS = {
  id: 'lab',
  password: 'lab@123',
};

const STORAGE_KEYS = {
  CONFIG: 'mitm_coe_recovery_config_v1',
  AUTHORISATIONS: 'mitm_recovery_authorisations_v1',
  TRANSFERS: 'mitm_session_transfers_v1',
  AUDIT_LOGS: 'mitm_recovery_audit_logs_v1',
  INSTRUCTOR_TOKEN: 'mitm_emgr_instructor_token_v1',
  INTERRUPTED_USNS: 'mitm_interrupted_students_v1',
  CLIENT_SYSTEM_ID: 'mitm_client_system_id_v1',
  LOGIN_REGISTRY: 'mitm_student_login_registry_v1',
  REL_TOKENS: 'mitm_relogin_tokens_v1',
};

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    sessionStorage.setItem(key, serialized);
  } catch {
    // Ignore storage quota issues
  }
}

const DEFAULT_CONFIG: EmergencyRecoveryConfig = {
  enabled: true,
  recoveryId: LAB_COE_CREDENTIALS.id,
  recoveryKey: LAB_COE_CREDENTIALS.password,
  lastRotatedAt: '2026-11-12T09:00:00.000Z',
  rotatedBy: 'COE Administration (MIT Mysore)',
};

export interface StudentReLoginItem {
  studentUsn: string;
  studentName: string;
  assignedSystemId: string;
  reloginSystemId?: string;
  examinationSessionStatus: 'ACTIVE' | 'INTERRUPTED' | 'LOCKED' | 'COMPLETED';
  reloginRequestStatus: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'CONSUMED';
  instructorAuthorisation: string;
  dateTime: string;
  canApprove: boolean;
  activeTokenId?: string;
}

export const emergencyRecoveryService = {
  getClientSystemId(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CLIENT_SYSTEM_ID);
      if (!stored || stored === 'SYS-001' || stored === 'LAB01-PC-03') {
        const generated = 'PC-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        localStorage.setItem(STORAGE_KEYS.CLIENT_SYSTEM_ID, generated);
        return generated;
      }
      return stored;
    } catch {
      return 'PC-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    }
  },

  setClientSystemId(systemId: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENT_SYSTEM_ID, systemId);
    } catch {
      // Ignore
    }
  },

  isInstructorCredentialId(id: string): boolean {
    const normalized = id.trim().toUpperCase();
    return (
      normalized === LAB_COE_CREDENTIALS.id ||
      normalized === FIXED_RECOVERY_CREDENTIALS.recoveryId ||
      id.trim().toLowerCase() === LAB_INSTRUCTOR_CREDENTIALS.id
    );
  },

  async loginInstructor(credentials: EmergencyRecoveryCredentials): Promise<{
    authenticated: boolean;
    token: string;
    instructor: { recoveryId: string; name: string };
  }> {
    const normalizedId = credentials.recoveryId.trim().toUpperCase();
    const normalizedKey = credentials.recoveryKey.trim();

    // 1. Try real backend endpoint first
    try {
      const res = await apiClient.post<{
        authenticated: boolean;
        token: string;
        instructor: { recoveryId: string; name: string };
      }>('/api/instructor/login', {
        recoveryId: normalizedId,
        recoveryKey: normalizedKey,
      });

      if (res.authenticated && res.token) {
        sessionStorage.setItem(STORAGE_KEYS.INSTRUCTOR_TOKEN, res.token);
        localStorage.setItem(STORAGE_KEYS.INSTRUCTOR_TOKEN, res.token);
        return res;
      }
    } catch {
      // Backend is unreachable; fallback to offline verification for lab continuity
    }

    // 2. Offline fallback verification
    const config = this.getLocalCoeConfig();
    const isValidLabCoe =
      normalizedId === LAB_COE_CREDENTIALS.id &&
      normalizedKey.toLowerCase() === LAB_COE_CREDENTIALS.password.toLowerCase();
    const isValidFixed =
      normalizedId === FIXED_RECOVERY_CREDENTIALS.recoveryId &&
      normalizedKey === FIXED_RECOVERY_CREDENTIALS.recoveryKey;
    const isValidConfigured =
      normalizedId === config.recoveryId.toUpperCase() &&
      normalizedKey === config.recoveryKey;
    const isValidAlt =
      credentials.recoveryId.trim().toLowerCase() === LAB_INSTRUCTOR_CREDENTIALS.id &&
      credentials.recoveryKey.trim() === LAB_INSTRUCTOR_CREDENTIALS.password;

    if (!isValidLabCoe && !isValidFixed && !isValidConfigured && !isValidAlt) {
      throw new Error(
        'Invalid COE Emergency Recovery Credentials. Access Denied by Security Subsystem.'
      );
    }

    const token = `INSTR-AUTH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEYS.INSTRUCTOR_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.INSTRUCTOR_TOKEN, token);

    return {
      authenticated: true,
      token,
      instructor: {
        recoveryId: normalizedId,
        name: normalizedId === 'LAB@0987' ? 'COE Lab Administrator' : 'COE Emergency Recovery Invigilator',
      },
    };
  },

  async logoutInstructor(): Promise<void> {
    try {
      await apiClient.post('/api/instructor/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      sessionStorage.removeItem(STORAGE_KEYS.INSTRUCTOR_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.INSTRUCTOR_TOKEN);
    }
  },

  isInstructorAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(
        sessionStorage.getItem(STORAGE_KEYS.INSTRUCTOR_TOKEN) ||
          localStorage.getItem(STORAGE_KEYS.INSTRUCTOR_TOKEN)
      );
    } catch {
      return false;
    }
  },

  async getStudentReLoginAuthorisationList(): Promise<StudentReLoginItem[]> {
    try {
      return await apiClient.get<StudentReLoginItem[]>('/api/recovery/relogin-authorisations');
    } catch {
      return this.getLocalStudentReLoginList();
    }
  },

  async approveStudentReLogin(params: {
    usn: string;
    reason: string;
    instructorId?: string;
  }): Promise<ReLoginAuthorisationToken> {
    try {
      return await apiClient.post<ReLoginAuthorisationToken>(
        '/api/recovery/relogin-authorisations/approve',
        params
      );
    } catch {
      return this.approveStudentReLoginLocal(params);
    }
  },

  async consumeRecoveryAuthorisation(
    usn: string,
    newSystemId = 'LAB01-PC-07'
  ): Promise<SessionTransferRecord> {
    try {
      return await apiClient.post<SessionTransferRecord>(
        '/api/recovery/relogin-authorisations/consume',
        { usn, newSystemId }
      );
    } catch {
      return this.consumeReLoginTokenLocal(usn, newSystemId);
    }
  },

  async getAllStudentRecoveryRecords(params?: {
    search?: string;
    department?: string;
    status?: string;
    laboratory?: string;
  }): Promise<StudentRecoveryOverview[]> {
    try {
      return await apiClient.get<StudentRecoveryOverview[]>('/api/recovery/overview', {
        params,
      });
    } catch {
      return this.getLocalStudentRecoveryRecords();
    }
  },

  async getTransferHistory(): Promise<SessionTransferRecord[]> {
    try {
      return await apiClient.get<SessionTransferRecord[]>('/api/recovery/transfers');
    } catch {
      return getStorageItem<SessionTransferRecord[]>(STORAGE_KEYS.TRANSFERS, []);
    }
  },

  async getAuditLogs(): Promise<RecoveryAuditLog[]> {
    try {
      return await apiClient.get<RecoveryAuditLog[]>('/api/recovery/audit-logs');
    } catch {
      return getStorageItem<RecoveryAuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    }
  },

  async getCoeConfig(): Promise<EmergencyRecoveryConfig> {
    try {
      return await apiClient.get<EmergencyRecoveryConfig>('/api/recovery/config');
    } catch {
      return this.getLocalCoeConfig();
    }
  },

  async updateCoeConfig(
    updates: Partial<EmergencyRecoveryConfig>
  ): Promise<EmergencyRecoveryConfig> {
    try {
      return await apiClient.put<EmergencyRecoveryConfig>('/api/recovery/config', updates);
    } catch {
      const current = this.getLocalCoeConfig();
      const updated: EmergencyRecoveryConfig = {
        ...current,
        ...updates,
        lastRotatedAt: updates.recoveryKey ? new Date().toISOString() : current.lastRotatedAt,
      };
      setStorageItem(STORAGE_KEYS.CONFIG, updated);
      return updated;
    }
  },

  async clearAllRecoveryData(): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.post<{ success: boolean; message: string }>('/api/recovery/fresh-start');
    } catch {
      [
        STORAGE_KEYS.LOGIN_REGISTRY,
        STORAGE_KEYS.REL_TOKENS,
        STORAGE_KEYS.TRANSFERS,
        STORAGE_KEYS.AUTHORISATIONS,
        STORAGE_KEYS.INTERRUPTED_USNS,
        STORAGE_KEYS.INSTRUCTOR_TOKEN,
      ].forEach((key) => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch {
          // Ignore
        }
      });
      return { success: true, message: 'All local session recovery data cleared.' };
    }
  },

  simulateCrash(usn: string): void {
    const normalized = usn.trim().toUpperCase();
    const registry = this.getLoginRegistry();
    const studentName = registry[normalized]?.studentName || 'Student';
    const systemId = this.getClientSystemId() || 'LAB01-PC-03';

    if (registry[normalized]) {
      registry[normalized].examinationSessionStatus = 'INTERRUPTED';
      registry[normalized].reloginRequestStatus = 'PENDING_APPROVAL';
      registry[normalized].sessionActive = false;
      registry[normalized].hasLoggedInOnce = true;
    } else {
      registry[normalized] = {
        usn: normalized,
        studentName,
        assignedSystemId: systemId,
        hasLoggedInOnce: true,
        sessionActive: false,
        firstLoggedInAt: new Date().toLocaleString('en-IN'),
        lastLoginAt: new Date().toLocaleString('en-IN'),
        examinationSessionStatus: 'INTERRUPTED',
        reloginRequestStatus: 'PENDING_APPROVAL',
      };
    }

    this.saveLoginRegistry(registry);
  },

  getPendingRecoveryAuthorisation(usn: string): RecoveryAuthorisation | null {
    const tokens = this.getReLoginTokens();
    const normalized = usn.trim().toUpperCase();

    const match = tokens.find(
      (t) =>
        t.studentUsn === normalized &&
        t.reloginRequestStatus === 'APPROVED' &&
        !t.isOneTimeUsed &&
        new Date(t.expiresAt).getTime() > Date.now()
    );

    if (!match) return null;

    return {
      authorisationId: match.tokenId,
      studentUsn: match.studentUsn,
      studentName: match.studentName,
      previousSystemId: match.assignedSystemId,
      newSystemId: match.targetSystemId,
      authorisedBy: match.instructorAuthorisation,
      authorisedAt: match.authorisedAt,
      expiresAt: match.expiresAt,
      status: 'PENDING',
    };
  },

  recordStudentExit(usn: string): void {
    const registry = this.getLoginRegistry();
    const normalized = usn.trim().toUpperCase();
    if (registry[normalized]) {
      registry[normalized].sessionActive = false;
      this.saveLoginRegistry(registry);
    }
  },

  // -------------------------------------------------------------
  // Internal Offline Fallback Helpers
  // -------------------------------------------------------------
  getLocalCoeConfig(): EmergencyRecoveryConfig {
    return getStorageItem<EmergencyRecoveryConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  },

  getLoginRegistry(): Record<string, StudentLoginRegistryRecord> {
    return getStorageItem<Record<string, StudentLoginRegistryRecord>>(
      STORAGE_KEYS.LOGIN_REGISTRY,
      {}
    );
  },

  saveLoginRegistry(registry: Record<string, StudentLoginRegistryRecord>): void {
    setStorageItem(STORAGE_KEYS.LOGIN_REGISTRY, registry);
  },

  getReLoginTokens(): ReLoginAuthorisationToken[] {
    return getStorageItem<ReLoginAuthorisationToken[]>(STORAGE_KEYS.REL_TOKENS, []);
  },

  saveReLoginTokens(tokens: ReLoginAuthorisationToken[]): void {
    setStorageItem(STORAGE_KEYS.REL_TOKENS, tokens);
  },

  getLocalStudentReLoginList(): StudentReLoginItem[] {
    const registry = this.getLoginRegistry();
    const tokens = this.getReLoginTokens();
    const transfers = getStorageItem<SessionTransferRecord[]>(STORAGE_KEYS.TRANSFERS, []);
    const list = Object.values(registry);
    if (list.length === 0) return [];

    return list.map((reg) => {
      const activeToken = tokens.find(
        (t) =>
          t.studentUsn === reg.usn &&
          t.reloginRequestStatus === 'APPROVED' &&
          !t.isOneTimeUsed &&
          new Date(t.expiresAt).getTime() > Date.now()
      );
      const transfer = transfers.find((t) => t.studentUsn === reg.usn);

      const sessionStatus = reg.examinationSessionStatus || 'ACTIVE';
      const reqStatus = activeToken
        ? 'APPROVED'
        : transfer
        ? 'CONSUMED'
        : (reg.reloginRequestStatus || 'NONE');

      const reloginSystemId =
        transfer?.newSystemId ||
        (reg.reloginRequestStatus === 'CONSUMED' && reg.reloginSystemId
          ? reg.reloginSystemId
          : undefined);

      const loggedInSystemId =
        transfer?.previousSystemId ||
        reg.previousSystemId ||
        reg.assignedSystemId ||
        'LAB01-PC-03';

      const instructorAuth = transfer || (reg.reloginRequestStatus === 'CONSUMED' && reloginSystemId)
        ? `${transfer?.authorisedBy || reg.instructorAuthorisation?.split(' ')[0] || FIXED_RECOVERY_CREDENTIALS.recoveryId} (Re-logged on ${reloginSystemId})`
        : activeToken
        ? `${activeToken.instructorAuthorisation || 'EMGR-LOGIN-01 (Permission Granted - Any Available PC)'}`
        : sessionStatus === 'INTERRUPTED'
        ? 'Pending Lab Instructor Review'
        : 'Verified';

      return {
        studentUsn: reg.usn,
        studentName: reg.studentName,
        assignedSystemId: loggedInSystemId,
        reloginSystemId,
        examinationSessionStatus: sessionStatus,
        reloginRequestStatus: reqStatus,
        instructorAuthorisation: instructorAuth,
        dateTime: activeToken?.authorisedAt || transfer?.reloginAt || reg.lastLoginAt || new Date().toLocaleString(),
        canApprove: sessionStatus !== 'COMPLETED',
        activeTokenId: activeToken?.tokenId,
      };
    });
  },

  getLocalStudentRecoveryRecords(): StudentRecoveryOverview[] {
    const registry = this.getLoginRegistry();
    const list = Object.values(registry);
    if (list.length === 0) return [];

    return list.map((reg) => {
      const isInterrupted = reg.examinationSessionStatus === 'INTERRUPTED';
      const isSubmitted = reg.examinationSessionStatus === 'COMPLETED';
      return {
        usn: reg.usn,
        studentName: reg.studentName,
        department: 'Computer Science & Engineering',
        laboratory: 'CSE Examination Lab 1',
        examination: 'BCS501 – Operating Systems',
        status: isInterrupted
          ? 'Interrupted'
          : isSubmitted
          ? 'Submitted'
          : reg.reloginRequestStatus === 'APPROVED'
          ? 'Recovery Pending'
          : 'Active',
        currentQuestion: 1,
        totalQuestions: 30,
        answeredCount: 0,
        lastSaved: reg.lastLoginAt || new Date().toLocaleTimeString(),
        previousSystemId: reg.assignedSystemId || 'LAB01-PC-03',
        currentSystemId: reg.assignedSystemId || 'LAB01-PC-03',
        recoveryStatus: isInterrupted
          ? 'Available'
          : reg.reloginRequestStatus === 'APPROVED'
          ? 'Pending Authorisation'
          : isSubmitted
          ? 'Not Applicable (Submitted)'
          : 'Already Recovered',
        canAuthorise: isInterrupted,
      };
    });
  },

  approveStudentReLoginLocal(params: {
    usn: string;
    reason: string;
    instructorId?: string;
  }): ReLoginAuthorisationToken {
    const normalized = params.usn.trim().toUpperCase();
    const registry = this.getLoginRegistry();
    const studentName = registry[normalized]?.studentName || 'Student';
    const assignedSystemId = registry[normalized]?.assignedSystemId || 'LAB01-PC-03';
    const instructor = params.instructorId || FIXED_RECOVERY_CREDENTIALS.recoveryId;

    const token: ReLoginAuthorisationToken = {
      tokenId: `REL-AUTH-2026-${normalized}-${Date.now().toString(36).toUpperCase()}`,
      studentUsn: normalized,
      studentName,
      assignedSystemId,
      targetSystemId: 'Any Available PC',
      examinationSessionStatus: 'INTERRUPTED',
      reloginRequestStatus: 'APPROVED',
      instructorAuthorisation: `${instructor} (Lab Instructor)`,
      reason: params.reason,
      authorisedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      isOneTimeUsed: false,
    };

    const tokens = this.getReLoginTokens().filter((t) => t.studentUsn !== normalized);
    tokens.push(token);
    this.saveReLoginTokens(tokens);

    return token;
  },

  consumeReLoginTokenLocal(
    usn: string,
    newSystemId: string
  ): SessionTransferRecord {
    const normalized = usn.trim().toUpperCase();
    const registry = this.getLoginRegistry();
    const previousSystemId = registry[normalized]?.assignedSystemId || 'LAB01-PC-03';

    const transferRecord: SessionTransferRecord = {
      transferId: `TRF-${Date.now().toString(36).toUpperCase()}`,
      studentUsn: normalized,
      studentName: registry[normalized]?.studentName || 'Student',
      examinationId: 'EXAM-2026-BCS501',
      previousSystemId,
      newSystemId,
      authorisedAt: new Date().toISOString(),
      reloginAt: new Date().toISOString(),
      authorisedBy: FIXED_RECOVERY_CREDENTIALS.recoveryId,
      lastSavedQuestionIndex: 0,
      answersRecoveredCount: 0,
      remainingSeconds: 2700,
      status: 'SUCCESS',
    };

    const transfers = getStorageItem<SessionTransferRecord[]>(STORAGE_KEYS.TRANSFERS, []);
    transfers.unshift(transferRecord);
    setStorageItem(STORAGE_KEYS.TRANSFERS, transfers);

    return transferRecord;
  },
};
