import { Button, Card, Flex, Result, Spin } from 'antd';
import { Outlet } from 'react-router';

import { useAuth } from '@/lib/auth';
import LoginPage from '@/pages/LoginPage';

/** Chỉ cán bộ thôn (Phó thôn trở lên, đang hoạt động) được vào trang quản trị */
export function RequireLeader() {
  const { loading, session, rank, signOut } = useAuth();

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (!session) return <LoginPage />;
  if (rank < 1) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Card>
          <Result
            status="403"
            title="Không có quyền truy cập"
            subTitle="Trang quản trị chỉ dành cho Bí thư, Trưởng thôn và Phó thôn."
            extra={<Button onClick={signOut}>Đăng xuất</Button>}
          />
        </Card>
      </Flex>
    );
  }
  return <Outlet />;
}
