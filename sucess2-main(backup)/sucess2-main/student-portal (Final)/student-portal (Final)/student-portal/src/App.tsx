/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { ExamSessionProvider } from './hooks/useExamSession';
import { StudentSessionLoader } from './layouts/StudentRouteGuard';
import { StudentLoginPage } from './pages/login/StudentLoginPage';
import { InstructorLoginPage } from './pages/login/InstructorLoginPage';
import { ExamInstructionsPage } from './pages/instructions/ExamInstructionsPage';
import { ExaminationInterfacePage } from './pages/examination/ExaminationInterfacePage';
import { ExamSubmissionPage } from './pages/submission/ExamSubmissionPage';
import { ExamCompletionPage } from './pages/submission/ExamCompletionPage';
import { EmergencyRecoveryDashboard } from './pages/recovery/EmergencyRecoveryDashboard';
import { emergencyRecoveryService } from './services/emergencyRecoveryService';

/**
 * Route guard enforcing that only authenticated instructors can enter /recovery/dashboard.
 * Unauthenticated users are redirected to /instructor/login.
 */
const InstructorRouteGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (!emergencyRecoveryService.isInstructorAuthenticated()) {
    return <Navigate to="/instructor/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <ExamSessionProvider>
        <StudentSessionLoader>
          <Routes>
            <Route path="/" element={<Navigate to="/student/login" replace />} />
            <Route path="/student/login" element={<StudentLoginPage />} />

            {/* INSTRUCTOR / EMERGENCY RECOVERY AUTHENTICATION */}
            <Route path="/instructor/login" element={<InstructorLoginPage />} />
            <Route
              path="/instructor"
              element={<Navigate to="/instructor/login" replace />}
            />

            {/* STUDENT EXAMINATION WORKFLOW */}
            <Route
              path="/student/instructions"
              element={<ExamInstructionsPage />}
            />
            <Route
              path="/student/examination"
              element={<ExaminationInterfacePage />}
            />
            <Route
              path="/student/submission"
              element={<ExamSubmissionPage />}
            />
            <Route
              path="/student/completion"
              element={<ExamCompletionPage />}
            />

            {/* PROTECTED EMERGENCY RECOVERY DASHBOARD */}
            <Route
              path="/recovery/dashboard"
              element={
                <InstructorRouteGuard>
                  <EmergencyRecoveryDashboard />
                </InstructorRouteGuard>
              }
            />
            <Route
              path="/recovery"
              element={<Navigate to="/recovery/dashboard" replace />}
            />

            <Route
              path="*"
              element={<Navigate to="/student/login" replace />}
            />
          </Routes>
        </StudentSessionLoader>
      </ExamSessionProvider>
    </BrowserRouter>
  );
}
