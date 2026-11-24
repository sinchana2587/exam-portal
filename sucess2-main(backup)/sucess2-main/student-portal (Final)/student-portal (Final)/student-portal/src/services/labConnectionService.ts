import { SaveAnswerRequest } from '../types/examination';

const PENDING_RECOVERY_BUFFER_KEY = 'mitm_pending_unsynced_answers_v1';

/**
 * Lab Connection & Temporary Recovery Buffer Service
 * Maintains temporary recovery buffer ONLY for unsynchronized responses during LAN interruptions.
 * Never treats local browser storage as the authoritative examination record.
 */
export const labConnectionService = {
  loadPendingBuffer(usn: string, sessionId: string): Record<string, SaveAnswerRequest> {
    try {
      const raw = sessionStorage.getItem(
        `${PENDING_RECOVERY_BUFFER_KEY}_${usn}_${sessionId}`
      );
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, SaveAnswerRequest>;
    } catch {
      return {};
    }
  },

  savePendingBuffer(
    usn: string,
    sessionId: string,
    buffer: Record<string, SaveAnswerRequest>
  ): void {
    try {
      const key = `${PENDING_RECOVERY_BUFFER_KEY}_${usn}_${sessionId}`;
      if (Object.keys(buffer).length === 0) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, JSON.stringify(buffer));
      }
    } catch {
      // Ignore storage errors
    }
  },

  enqueuePendingAnswer(payload: SaveAnswerRequest): void {
    const buffer = this.loadPendingBuffer(payload.studentUsn, payload.sessionId);
    buffer[payload.questionId] = payload;
    this.savePendingBuffer(payload.studentUsn, payload.sessionId, buffer);
  },

  removePendingAnswer(usn: string, sessionId: string, questionId: string): void {
    const buffer = this.loadPendingBuffer(usn, sessionId);
    if (buffer[questionId]) {
      delete buffer[questionId];
      this.savePendingBuffer(usn, sessionId, buffer);
    }
  },

  clearAllPending(usn: string, sessionId: string): void {
    try {
      sessionStorage.removeItem(`${PENDING_RECOVERY_BUFFER_KEY}_${usn}_${sessionId}`);
    } catch {
      // Ignore
    }
  },
};
