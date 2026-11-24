import { ApiResponse } from '../types';
import { API_CONFIG } from './apiConfig';

const TOKEN_STORAGE_KEY = 'mit_mysore_auth_token';

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 500, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMsOverride?: number
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let abortedByCaller = false;

  const onExternalAbort = () => {
    abortedByCaller = true;
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      throw new ApiClientError('Request cancelled due to newer selection.', 499, 'REQUEST_ABORTED');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeoutMs = timeoutMsOverride ?? API_CONFIG.requestTimeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      setAuthToken(null);
      if (unauthorizedHandler) unauthorizedHandler();
      throw new ApiClientError(
        'Your institutional session has expired. Please sign in again.',
        401,
        'SESSION_EXPIRED'
      );
    }

    if (response.status === 403) {
      throw new ApiClientError(
        'Permission denied. Your role or department scope is not authorized for this action.',
        403,
        'FORBIDDEN'
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : null;

    if (!response.ok) {
      const isUnavailableStatus =
        response.status === 502 || response.status === 503 || response.status === 504;
      throw new ApiClientError(
        payload?.message ||
          (isUnavailableStatus
            ? 'Backend unavailable: Central backend API service is unreachable.'
            : `Server returned status ${response.status}`),
        response.status,
        payload?.code || (isUnavailableStatus ? 'BACKEND_UNAVAILABLE' : 'REQUEST_FAILED'),
        payload?.data ?? payload?.details
      );
    }

    if (!payload) {
      throw new ApiClientError(
        'Backend unavailable: Expected JSON response from the backend REST API.',
        503,
        'BACKEND_UNAVAILABLE'
      );
    }

    return {
      success: true,
      data: payload.data ?? payload,
      message: payload.message,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (abortedByCaller || externalSignal?.aborted) {
        throw new ApiClientError('Request cancelled due to newer selection.', 499, 'REQUEST_ABORTED');
      }
      throw new ApiClientError(
        'Processing timed out while waiting for the backend service.',
        408,
        'PROCESSING_TIMEOUT'
      );
    }
    throw new ApiClientError(
      err instanceof Error
        ? `Backend unavailable: ${err.message}`
        : 'Backend unavailable: Unable to reach the MIT Mysore backend service.',
      0,
      'BACKEND_UNAVAILABLE'
    );
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function apiDownloadBlob(
  path: string,
  fallbackFileName: string,
  options: RequestInit = {}
): Promise<{ blob: Blob; fileName: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(API_CONFIG.requestTimeoutMs, 60000));
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      setAuthToken(null);
      if (unauthorizedHandler) unauthorizedHandler();
      throw new ApiClientError(
        'Your institutional session has expired. Please sign in again.',
        401,
        'SESSION_EXPIRED'
      );
    }

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      throw new ApiClientError(
        payload?.message || `Excel download failed (HTTP ${response.status}).`,
        response.status,
        payload?.code || 'DOWNLOAD_FAILED'
      );
    }

    const disposition = response.headers.get('content-disposition') || '';
    const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
    const fileName = nameMatch ? nameMatch[1] : fallbackFileName;
    const blob = await response.blob();
    return { blob, fileName };
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError('Excel download timed out.', 408, 'PROCESSING_TIMEOUT');
    }
    throw new ApiClientError(
      err instanceof Error ? `Download failed: ${err.message}` : 'Excel download failed.',
      0,
      'BACKEND_UNAVAILABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}
