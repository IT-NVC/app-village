import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { AdminLayout } from '@/components/AdminLayout';
import { RequireLeader } from '@/components/RequireLeader';
import AccountsPage from '@/pages/AccountsPage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import AreasPage from '@/pages/AreasPage';
import AuditPage from '@/pages/AuditPage';
import CalendarPage from '@/pages/CalendarPage';
import ChatGroupsPage from '@/pages/ChatGroupsPage';
import DashboardPage from '@/pages/DashboardPage';
import NewsPage from '@/pages/NewsPage';
import PollsPage from '@/pages/PollsPage';
import PrintCodesPage from '@/pages/PrintCodesPage';
import ReportsPage from '@/pages/ReportsPage';
import ResidentsPage from '@/pages/ResidentsPage';
import SettingsPage from '@/pages/SettingsPage';
import SosPage from '@/pages/SosPage';

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
          { path: 'thong-bao', element: <AnnouncementsPage /> },
          { path: 'tin-tuc', element: <NewsPage /> },
          { path: 'nhom-chat', element: <ChatGroupsPage /> },
          { path: 'bieu-quyet', element: <PollsPage /> },
          { path: 'lich', element: <CalendarPage /> },
          { path: 'sos', element: <SosPage /> },
          { path: 'phan-anh', element: <ReportsPage /> },
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
