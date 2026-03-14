import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { somiTheme } from './theme/themeConfig';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import PatientListPage from './pages/PatientListPage';
import PatientDetailPage from './pages/PatientDetailPage';
import ExerciseListPage from './pages/ExerciseListPage';
import ExerciseFormPage from './pages/ExerciseFormPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import PlanBuilderPage from './pages/PlanBuilderPage';
import InboxPage from './pages/InboxPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminTaxonomyPage from './pages/AdminTaxonomyPage';
import AdminAuditPage from './pages/AdminAuditPage';

export default function App() {
  return (
    <ConfigProvider theme={somiTheme}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/patients" replace />} />
                <Route path="/patients" element={<PatientListPage />} />
                <Route path="/patients/:patientId" element={<PatientDetailPage />} />
                <Route path="/patients/:patientId/plan/new" element={<PlanBuilderPage />} />
                <Route path="/patients/:patientId/plan/:planId/edit" element={<PlanBuilderPage />} />
                <Route path="/exercises" element={<ExerciseListPage />} />
                <Route path="/exercises/new" element={<ExerciseFormPage />} />
                <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
                <Route path="/exercises/:exerciseId/edit" element={<ExerciseFormPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/taxonomy" element={<AdminTaxonomyPage />} />
                <Route path="/admin/audit" element={<AdminAuditPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
