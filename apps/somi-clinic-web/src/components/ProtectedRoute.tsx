import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading)
    return (
      <Spin
        size="large"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      />
    );
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
