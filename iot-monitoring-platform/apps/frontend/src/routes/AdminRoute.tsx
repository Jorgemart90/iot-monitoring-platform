import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

export function AdminRoute() {
  const { user } = useAuth();
  return user?.role === UserRole.ADMIN ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
