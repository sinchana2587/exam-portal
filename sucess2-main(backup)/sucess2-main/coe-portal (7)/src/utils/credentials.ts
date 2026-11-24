import {
  LocalUnlockVerificationLog,
  SessionUnlockCredential,
  SessionUnlockCredentialStatus,
  SessionUnlockVerifierMetadata,
  SittingName,
} from '../types/examination';

const CREDENTIAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CREDENTIAL_VERIFIER_ROUNDS = 600;

function getWebCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function' || !c.subtle) {
    throw new Error('Web Crypto API (CSPRNG + SubtleCrypto) is unavailable.');
  }
  return c;
}

export function generateRandomSaltHex(byteLength = 16): string {
  const cryptoObj = getWebCrypto();
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a high-entropy CSPRNG session-specific invigilator unlock credential.
 * Strictly NOT derived from examination name, subject code, date, time, USN, or PC number.
 */
export function generateSessionUnlockSecret(): string {
  const cryptoObj = getWebCrypto();
  const tokenLength = 12;
  const chars: string[] = [];
  const limit = 256 - (256 % CREDENTIAL_ALPHABET.length);
  const buf = new Uint8Array(1);

  while (chars.length < tokenLength) {
    cryptoObj.getRandomValues(buf);
    if (buf[0] < limit) {
      chars.push(CREDENTIAL_ALPHABET[buf[0] % CREDENTIAL_ALPHABET.length]);
    }
  }

  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars
    .slice(8, 12)
    .join('')}`;
}

export function maskCredentialSecret(): string {
  return '••••••••••••';
}

async function sha256Hex(input: string): Promise<string> {
  const cryptoObj = getWebCrypto();
  const data = new TextEncoder().encode(input);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives an iterated salted cryptographic verifier hash suitable for storage
 * in encrypted lab packages without ever storing or transmitting plaintext secrets.
 */
export async function deriveCredentialVerifier(
  secret: string,
  salt: string
): Promise<string> {
  const normalizedSecret = secret.trim().toUpperCase();
  let state = `${salt}::MITM-COE-KDF-V1::${normalizedSecret}`;
  for (let i = 0; i < CREDENTIAL_VERIFIER_ROUNDS; i += 1) {
    state = await sha256Hex(`${state}::${salt}::${i}`);
  }
  return state;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySecretWithSalt(
  candidateSecret: string,
  salt: string,
  expectedVerifierHash: string
): Promise<boolean> {
  if (!candidateSecret || !salt || !expectedVerifierHash) return false;
  const candidateHash = await deriveCredentialVerifier(candidateSecret, salt);
  return constantTimeEqual(candidateHash, expectedVerifierHash);
}

/**
 * Computes an explicit sitting expiry timestamp (scheduled start + duration + 30 min grace).
 */
export function computeSittingExpiryIso(
  examDate: string,
  startTime: string,
  durationMinutes: number,
  graceMinutes = 30
): string {
  const baseDate = new Date(`${examDate}T${startTime}:00`);
  if (Number.isNaN(baseDate.getTime())) {
    const fallback = new Date(Date.now() + (durationMinutes + graceMinutes) * 60_000);
    return fallback.toISOString();
  }
  const expiresMs =
    baseDate.getTime() + (Math.max(15, durationMinutes) + graceMinutes) * 60_000;
  return new Date(expiresMs).toISOString();
}

export function computeSittingValidFromIso(
  examDate: string,
  startTime: string,
  leadMinutes = 45
): string {
  const baseDate = new Date(`${examDate}T${startTime}:00`);
  if (Number.isNaN(baseDate.getTime())) {
    return new Date().toISOString();
  }
  return new Date(baseDate.getTime() - leadMinutes * 60_000).toISOString();
}

export function formatIstDisplayFromIso(isoOrDisplay?: string): string {
  if (!isoOrDisplay) return '—';
  if (isoOrDisplay.endsWith('IST')) return isoOrDisplay;
  const parsed = new Date(isoOrDisplay);
  if (Number.isNaN(parsed.getTime())) return isoOrDisplay;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
    parsed.getDate()
  ).padStart(2, '0')} ${String(parsed.getHours()).padStart(2, '0')}:${String(
    parsed.getMinutes()
  ).padStart(2, '0')} IST`;
}

export function resolveEffectiveCredentialStatus(
  cred: SessionUnlockCredential,
  nowMs = Date.now()
): SessionUnlockCredentialStatus {
  if (
    cred.status === 'Active' &&
    cred.expiresAt &&
    !Number.isNaN(Date.parse(cred.expiresAt)) &&
    nowMs > Date.parse(cred.expiresAt)
  ) {
    return 'Expired';
  }
  return cred.status;
}

export interface OfflineUnlockRateLimitState {
  failedAttemptsByKey: Record<string, { count: number; lockedUntilMs: number }>;
}

export interface OfflineUnlockVerificationParams {
  candidateSecret: string;
  examinationId: string;
  sittingId: string;
  sittingName?: SittingName;
  labId: string;
  pcId: string;
  studentUsn: string;
  invigilatorOperatorId: string;
  syncedVerifier: SessionUnlockVerifierMetadata;
  credentialStatus: SessionUnlockCredentialStatus;
  rateLimiter?: OfflineUnlockRateLimitState;
  maxFailedAttempts?: number;
  lockoutDurationMs?: number;
  nowMs?: number;
}

export interface OfflineUnlockVerificationResult {
  verified: boolean;
  reason: string;
  logEntry: LocalUnlockVerificationLog;
  attemptsRemaining?: number;
  rateLimited?: boolean;
}

/**
 * Offline Lab Server verification contract for an invigilator tab-switch unlock request.
 * Works completely without internet connectivity using the synced salted verifier & metadata.
 *
 * Security invariants enforced:
 * 1. Sitting-scoped only (examinationId + sittingId + labId must match exact verifier).
 * 2. Rejected if credential status is Not Generated, Revoked, Expired, or Synchronisation Failed.
 * 3. Strictly rejects permanent Lab Admin PC-Recovery credentials submitted as unlock codes.
 * 4. Enforces failed-attempt rate limiting per sitting + workstation/invigilator.
 * 5. Allows multiple legitimate suspicious-activity unlocks within the active sitting window.
 */
export async function verifyLocalUnlockCredentialOffline(
  params: OfflineUnlockVerificationParams
): Promise<OfflineUnlockVerificationResult> {
  const {
    candidateSecret,
    examinationId,
    sittingId,
    labId,
    pcId,
    studentUsn,
    invigilatorOperatorId,
    syncedVerifier,
    credentialStatus,
    rateLimiter,
    maxFailedAttempts = 5,
    lockoutDurationMs = 5 * 60_000,
    nowMs = Date.now(),
  } = params;

  const timestamp = formatIstDisplayFromIso(new Date(nowMs).toISOString());
  const rateKey = `${sittingId}::${invigilatorOperatorId}::${pcId}`;

  const fail = (reason: string, rateLimited = false, attemptsRemaining?: number) => {
    const logEntry: LocalUnlockVerificationLog = {
      id: `UNL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      examinationId,
      sittingId,
      labId,
      studentUsn,
      pcId,
      invigilatorOperatorId,
      credentialId: syncedVerifier?.credentialId,
      timestamp,
      verified: false,
      reason,
    };
    return {
      verified: false,
      reason,
      logEntry,
      attemptsRemaining,
      rateLimited,
    };
  };

  // Check rate limiter
  if (rateLimiter) {
    const rec = rateLimiter.failedAttemptsByKey[rateKey];
    if (rec && rec.lockedUntilMs > nowMs) {
      return fail(
        'Too many invalid unlock attempts. Verification temporarily rate-limited.',
        true,
        0
      );
    }
  }

  if (credentialStatus === 'Revoked') {
    return fail('Session unlock credential has been revoked by COE.');
  }
  if (credentialStatus === 'Not Generated') {
    return fail('No session unlock credential has been generated for this sitting.');
  }
  if (credentialStatus === 'Synchronisation Failed') {
    return fail('Lab Server unlock verifier is out of sync; resolve synchronisation before unlocking.');
  }

  // Enforce strict sitting + examination + lab scope
  if (
    syncedVerifier.examinationId !== examinationId ||
    syncedVerifier.sittingId !== sittingId ||
    syncedVerifier.labId !== labId
  ) {
    return fail(
      'Unlock credential scope mismatch: credential belongs to a different examination, sitting, or laboratory.'
    );
  }

  // Enforce expiry window
  const expiresMs = Date.parse(syncedVerifier.expiresAt);
  if (
    credentialStatus === 'Expired' ||
    (!Number.isNaN(expiresMs) && nowMs > expiresMs)
  ) {
    return fail('Session unlock credential has expired for this sitting.');
  }

  const matched = await verifySecretWithSalt(
    candidateSecret,
    syncedVerifier.salt,
    syncedVerifier.verifierHash
  );

  if (!matched) {
    let remaining: number | undefined;
    if (rateLimiter) {
      const prev = rateLimiter.failedAttemptsByKey[rateKey] || {
        count: 0,
        lockedUntilMs: 0,
      };
      const nextCount = prev.count + 1;
      const locked = nextCount >= maxFailedAttempts;
      rateLimiter.failedAttemptsByKey[rateKey] = {
        count: nextCount,
        lockedUntilMs: locked ? nowMs + lockoutDurationMs : 0,
      };
      remaining = Math.max(0, maxFailedAttempts - nextCount);
    }
    return fail(
      'Invalid session unlock credential. Multiple failed attempts are audited and rate-limited.',
      false,
      remaining
    );
  }

  if (rateLimiter && rateLimiter.failedAttemptsByKey[rateKey]) {
    delete rateLimiter.failedAttemptsByKey[rateKey];
  }

  return {
    verified: true,
    reason: 'Verified locally against synced session unlock verifier.',
    logEntry: {
      id: `UNL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      examinationId,
      sittingId,
      labId,
      studentUsn,
      pcId,
      invigilatorOperatorId,
      credentialId: syncedVerifier.credentialId,
      timestamp,
      verified: true,
      reason: 'Session unlock credential verified locally (offline-capable).',
    },
  };
}
