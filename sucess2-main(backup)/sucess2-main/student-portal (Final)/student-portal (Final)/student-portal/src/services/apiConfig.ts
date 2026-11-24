/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient, ApiClientError, RequestOptions } from '../api/client';

export type ApiMode = 'development' | 'integration';

export const LAB_API_BASE_URL: string = apiClient.getBaseUrl();

export const API_MODE: ApiMode =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_MODE === 'development'
    ? 'development'
    : 'integration';

export const API_TIMEOUT_MS: number = Number(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_TIMEOUT_MS) || 8000
);

export function getSavedSessionToken(): string | null {
  return apiClient.getStoredToken();
}

export function setSavedSessionToken(token: string | null): void {
  apiClient.setStoredToken(token);
}

// Backward-compatible alias for existing imports
export const LabServerApiError = ApiClientError;
export type LabServerApiError = ApiClientError;

/**
 * Reusable HTTP Request Client delegating to the unified ApiClient.
 */
export async function labHttpRequest<TResponse>(
  endpoint: string,
  options: RequestInit = {},
  sessionToken?: string | null
): Promise<TResponse> {
  const reqOptions: RequestOptions = {
    ...options,
    token: sessionToken,
  };
  return apiClient.request<TResponse>(endpoint, reqOptions);
}

/**
 * Health check helper to verify if the Lab Server is online
 */
export async function checkBackendHealth(): Promise<{ online: boolean; message: string }> {
  try {
    await apiClient.get('/api/health', { timeoutMs: 3000 });
    return {
      online: true,
      message: 'Local Lab Server is operational and connected over LAN.',
    };
  } catch (err) {
    return {
      online: false,
      message:
        err instanceof Error
          ? err.message
          : 'Unable to connect to local Lab Server.',
    };
  }
}
