import React from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ThemeProvider } from './hooks/useTheme';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { UserRole } from './types';
import { PrincipalLayout } from './layouts/PrincipalLayout';
import { HodLayout } from './layouts/HodLayout';
import { LoginPage } from './pages/LoginPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';

// Principal Pages
import { PrincipalDashboardPage } from './pages/principal/PrincipalDashboardPage';
import { HodManagementPage } from './pages/principal/HodManagementPage';
import { InstitutionReportsPage } from './pages/principal/InstitutionReportsPage';
import { AuditLogsPage } from './pages/principal/AuditLogsPage';

// HOD Pages
import { HodDashboardPage } from './pages/hod/HodDashboardPage';
import { SetupClassPage } from './pages/hod/SetupClassPage';
import { QuestionsPage } from './pages/hod/QuestionsPage';
import { ConverterPage } from './pages/hod/ConverterPage';
import { HodExamStatusPage } from './pages/hod/HodExamStatusPage';
import { DepartmentResultsPage } from './pages/hod/DepartmentResultsPage';

const RoleGuard: React.FC<{
  allowedRole: UserRole;
  children: React.ReactNode;
}> = ({ allowedRole, children }) => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Guard against invalid/corrupted role identifiers (0, '0', undefined, or unexpected)
  if (
    !user.role ||
    (user.role as any) === 0 ||
    (user.role as any) === '0' ||
    !['PRINCIPAL', 'HOD', 'COE'].includes(user.role)
  ) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#B42318]/10 text-[#B42318] dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#17243A] dark:text-white">
            Access Restricted – Invalid Session Role
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
            Your signed-in role (<strong>{String(user.role || 'UNKNOWN')}</strong>) is not recognized. Please sign in again.
          </p>
          <div className="pt-2">
            <button
              onClick={() => logout()}
              className="inline-block px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-md cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== allowedRole) {
    const returnPath =
      user.role === 'PRINCIPAL'
        ? '/admin/principal/dashboard'
        : user.role === 'HOD'
        ? '/admin/hod/dashboard'
        : null;
    return (
      <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-[#D9E2EF] dark:border-slate-800 p-6 space-y-4 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#B42318]/10 text-[#B42318] dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#17243A] dark:text-white">
            Access Restricted – Role Permission Boundary
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
            Your signed-in role (<strong>{user.role}</strong>) is not authorized to access this portal module.
            {user.role === 'COE' && (
              <span className="block mt-1 text-[#B42318] dark:text-red-400 font-medium">
                COE accounts must access the Controller of Examinations Portal.
              </span>
            )}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            {returnPath && (
              <Link
                to={returnPath}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-md text-center"
              >
                Return to Authorized Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#17243A] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#D9E2EF] dark:border-slate-700 rounded-md cursor-pointer"
            >
              Sign Out & Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (
    !user ||
    !user.role ||
    (user.role as any) === 0 ||
    (user.role as any) === '0' ||
    !['PRINCIPAL', 'HOD'].includes(user.role)
  ) {
    return <Navigate to="/admin/login" replace />;
  }
  return (
    <Navigate
      to={user.role === 'PRINCIPAL' ? '/admin/principal/dashboard' : '/admin/hod/dashboard'}
      replace
    />
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/admin" element={<RootRedirect />} />
            <Route path="/admin/login" element={<LoginPage />} />

            {/* PRINCIPAL PORTAL ROUTES */}
            <Route
              path="/admin/principal"
              element={
                <RoleGuard allowedRole="PRINCIPAL">
                  <PrincipalLayout />
                </RoleGuard>
              }
            >
              <Route index element={<Navigate to="/admin/principal/dashboard" replace />} />
              <Route path="dashboard" element={<PrincipalDashboardPage />} />
              <Route path="hod-management" element={<HodManagementPage />} />
              <Route path="reports" element={<InstitutionReportsPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="profile-settings" element={<ProfileSettingsPage />} />
            </Route>

            {/* HOD PORTAL ROUTES */}
            <Route
              path="/admin/hod"
              element={
                <RoleGuard allowedRole="HOD">
                  <HodLayout />
                </RoleGuard>
              }
            >
              <Route index element={<Navigate to="/admin/hod/dashboard" replace />} />
              <Route path="dashboard" element={<HodDashboardPage />} />
              <Route path="setup-class" element={<SetupClassPage />} />
              <Route path="questions" element={<QuestionsPage />} />
              <Route path="converter" element={<ConverterPage />} />
              <Route
                path="key-correction"
                element={<Navigate to="/admin/hod/questions?tab=key-correction" replace />}
              />
              <Route path="exam-status" element={<HodExamStatusPage />} />
              <Route path="results" element={<DepartmentResultsPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="profile-settings" element={<ProfileSettingsPage />} />
            </Route>

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
