/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ExaminationProvider } from './hooks/useExaminationStore';
import { COEPortalLayout } from './layouts/COEPortalLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulingPage } from './pages/SchedulingPage';
import { SessionMonitoringPage } from './pages/SessionMonitoringPage';
import { ResultImportPage } from './pages/ResultImportPage';
import { ResultApprovalPage } from './pages/ResultApprovalPage';
import { CourseOutcomesPage } from './pages/CourseOutcomesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <ExaminationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<COEPortalLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="schedule" element={<SchedulingPage />} />
            <Route path="monitoring" element={<SessionMonitoringPage />} />
            <Route path="results/import" element={<ResultImportPage />} />
            <Route path="results/approval" element={<ResultApprovalPage />} />
            <Route path="course-outcomes" element={<CourseOutcomesPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ExaminationProvider>
  );
}
