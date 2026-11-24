import { API_CONFIG } from './apiConfig';

export interface CampusExamEvent {
  type: string;
  eventType?: string;
  payload?: any;
}

export type CampusExamRealtimeCallback = (event: CampusExamEvent) => void;

class RealtimeService {
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private listeners: Set<CampusExamRealtimeCallback> = new Set();

  public connect(token?: string) {
    if (this.eventSource) return;

    const base = API_CONFIG.baseUrl;
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${base}/events${tokenQuery}`;

    try {
      this.eventSource = new EventSource(url);

      const handleEvent = (data: any) => {
        const evt: CampusExamEvent = {
          type: data?.type || data?.eventType || 'UNKNOWN',
          eventType: data?.eventType || data?.type,
          payload: data,
        };
        // Dispatch window custom event so any page or component can listen
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('campus-exam-event', { detail: evt }));
        }
        // Notify direct listeners
        this.listeners.forEach((cb) => {
          try {
            cb(evt);
          } catch (e) {
            console.error('SSE listener error:', e);
          }
        });
      };

      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleEvent(data);
        } catch {
          // heartbeat
        }
      };

      [
        'QUESTION_SET_PUBLISHED',
        'EXAMINATION_SCHEDULED',
        'EXAMINATION_SCHEDULE_CONFIRMED',
        'EXAMINATION_SET_SELECTED',
        'EXAMINATION_UPDATED',
        'EXAMINATION_CANCELLED',
        'KEY_CORRECTION_SUBMITTED',
        'KEY_CORRECTION_DECIDED',
        'RESULTS_IMPORTED',
        'RESULTS_APPROVED',
        'RESULTS_RELEASED',
        'UNLOCK_CREDENTIAL_UPDATED',
        'CREDENTIAL_SYNCED',
        'SITTING_FINALIZED',
        'RESULT_PACKAGE_AVAILABLE',
        'STUDENT_LOGIN',
        'STUDENT_SUBMITTED',
      ].forEach((evtName) => {
        this.eventSource?.addEventListener(evtName, (e: any) => {
          try {
            const data = JSON.parse(e.data);
            handleEvent(data);
          } catch {
            handleEvent({ type: evtName });
          }
        });
      });

      this.eventSource.onerror = () => {
        this.disconnect();
        this.reconnectTimer = setTimeout(() => {
          this.connect(token);
        }, 5000);
      };
    } catch (err) {
      console.warn('Realtime SSE connection failed:', err);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  public subscribe(cb: CampusExamRealtimeCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const realtimeService = new RealtimeService();
