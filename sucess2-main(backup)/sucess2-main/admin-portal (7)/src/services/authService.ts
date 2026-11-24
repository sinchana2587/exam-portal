import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError, getAuthToken, setAuthToken } from './apiClient';
import { AuthUser, ThemePreference } from '../types';

const SESSION_KEY = 'mit_mysore_auth_session';
const LEGACY_MOCK_DB_KEY = 'mit_mysore_ems_dev_db_v4';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const normalizedUsername = credentials.username.trim().toLowerCase();
    const rawPassword = credentials.password;

    if (!normalizedUsername || !rawPassword) {
      throw new ApiClientError('Username and password are required.', 400, 'VALIDATION_ERROR');
    }

    const response = await apiRequest<AuthResponse>(API_ENDPOINTS.auth.login, {
      method: 'POST',
      body: JSON.stringify({ username: normalizedUsername, password: rawPassword }),
    });
    setAuthToken(response.data.token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(response.data.user));
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest(API_ENDPOINTS.auth.logout, { method: 'POST' });
    } catch {
      // Clear local session regardless of logout network failure
    }
    setAuthToken(null);
    sessionStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser(): AuthUser | null {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LEGACY_MOCK_DB_KEY);
      }
      const token = getAuthToken();
      if (!token || token.startsWith('dev-session-')) {
        setAuthToken(null);
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthUser;
      if (
        !parsed ||
        !parsed.role ||
        (parsed.role as any) === 0 ||
        (parsed.role as any) === '0' ||
        !['PRINCIPAL', 'HOD', 'COE'].includes(parsed.role)
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  async updateContactNumber(_userId: string, contactNumber: string): Promise<AuthUser> {
    const cleaned = contactNumber.trim();
    if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(cleaned)) {
      throw new ApiClientError(
        'Enter a valid 10-digit Indian mobile contact number.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const res = await apiRequest<AuthUser>(API_ENDPOINTS.auth.updateProfile, {
      method: 'PATCH',
      body: JSON.stringify({ contactNumber: cleaned }),
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(res.data));
    return res.data;
  },

  async changePassword(_userId: string, payload: ChangePasswordPayload): Promise<{ message: string }> {
    const { currentPassword, newPassword } = payload;
    if (!currentPassword || !newPassword) {
      throw new ApiClientError('All password fields are required.', 400, 'VALIDATION_ERROR');
    }
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      throw new ApiClientError(
        'New password must be at least 8 characters and include uppercase, lowercase, digit, and special character.',
        400,
        'PASSWORD_POLICY_ERROR'
      );
    }
    if (currentPassword === newPassword) {
      throw new ApiClientError(
        'New password must be different from your current password.',
        400,
        'PASSWORD_REUSE_ERROR'
      );
    }

    const res = await apiRequest<{ message: string }>(API_ENDPOINTS.auth.changePassword, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateThemePreference(_userId: string, theme: ThemePreference): Promise<AuthUser | null> {
    const current = this.getCurrentUser();
    try {
      const res = await apiRequest<any>(API_ENDPOINTS.auth.updateThemePreference, {
        method: 'PATCH',
        body: JSON.stringify({ themePreference: theme }),
      });
      const serverUser = (res?.data && typeof res.data === 'object' && res.data.role) ? res.data : null;
      const updated: AuthUser = {
        ...(current || ({} as AuthUser)),
        ...(serverUser || {}),
        themePreference: theme,
      };
      if (
        updated.id &&
        updated.role &&
        (updated.role as any) !== 0 &&
        (updated.role as any) !== '0' &&
        ['PRINCIPAL', 'HOD', 'COE'].includes(updated.role)
      ) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      }
      return updated;
    } catch {
      if (
        current &&
        current.role &&
        (current.role as any) !== 0 &&
        (current.role as any) !== '0' &&
        ['PRINCIPAL', 'HOD', 'COE'].includes(current.role)
      ) {
        const updated: AuthUser = { ...current, themePreference: theme };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        return updated;
      }
      return null;
    }
  },
};
