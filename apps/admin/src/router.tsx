import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { AdminLayout } from '@/components/AdminLayout';
import { RequireLeader } from '@/components/RequireLeader';
import AccountsPage from '@/pages/AccountsPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import AreasPage from '@/pages/AreasPage';
import AuditPage from '@/pages/AuditPage';
import DashboardPage from '@/pages/DashboardPage';
import PrintCodesPage from '@/pages/PrintCodesPage';
import ResidentsPage from '@/pages/ResidentsPage';
import SettingsPage from '@/pages/SettingsPage';

const router = createBrowserRouter([
  {
    element: <RequireLeader />,
    children: [
      { path: '/in-ma', element: <PrintCodesPage /> },
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'duyet', element: <ApprovalsPage /> },
          { path: 'nhan-khau', element: <ResidentsPage /> },
          { path: 'tai-khoan', element: <AccountsPage /> },
          { path: 'khu-vuc', element: <AreasPage /> },
          { path: 'cai-dat', element: <SettingsPage /> },
          { path: 'nhat-ky', element: <AuditPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
