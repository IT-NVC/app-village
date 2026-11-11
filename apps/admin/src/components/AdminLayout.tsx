import {
  ApartmentOutlined,
  CommentOutlined,
  BarChartOutlined,
  AuditOutlined,
  AlertOutlined,
  DashboardOutlined,
  NotificationOutlined,
  ReadOutlined,
  ToolOutlined,
  LogoutOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { LEADERSHIP_ROLE_LABEL } from '@thon/shared';
import { Badge, Button, Flex, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/lib/auth';
import { useNewReportsCount, usePendingCount, useSosPendingCount } from '@/lib/data';
import { SosAlerter } from '@/components/SosAlerter';

export function AdminLayout() {
  const { me, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: pending = 0 } = usePendingCount();
  const { data: sosPending = 0 } = useSosPendingCount();
  const { data: newReports = 0 } = useNewReportsCount(isAdmin);

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
    {
      key: '/duyet',
      icon: <SolutionOutlined />,
      label: (
        <Flex justify="space-between" align="center">
          Duyệt tài khoản <Badge count={pending} />
        </Flex>
      ),
    },
    {
      key: '/sos',
      icon: <AlertOutlined />,
      label: (
        <Flex justify="space-between" align="center">
          Khẩn cấp (SOS) <Badge count={sosPending} />
        </Flex>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: '/phan-anh',
            icon: <ToolOutlined />,
            label: (
              <Flex justify="space-between" align="center">
                Phản ánh <Badge count={newReports} color="#1E63B8" />
              </Flex>
            ),
          },
        ]
      : []),
    { key: '/thong-bao', icon: <NotificationOutlined />, label: 'Thông báo' },
    { key: '/tin-tuc', icon: <ReadOutlined />, label: 'Tin tức' },
    { key: '/nhom-chat', icon: <CommentOutlined />, label: 'Nhóm chat' },
    { key: '/bieu-quyet', icon: <BarChartOutlined />, label: 'Biểu quyết' },
    { key: '/nhan-khau', icon: <TeamOutlined />, label: 'Nhân khẩu' },
    { key: '/tai-khoan', icon: <UserSwitchOutlined />, label: 'Tài khoản & phân quyền' },
    { key: '/khu-vuc', icon: <ApartmentOutlined />, label: 'Khu vực & ban ngành' },
    { key: '/cai-dat', icon: <SettingOutlined />, label: 'Cài đặt & danh bạ' },
    ...(isAdmin ? [{ key: '/nhat-ky', icon: <AuditOutlined />, label: 'Nhật ký thao tác' }] : []),
  ];

  return (
    <Layout style={{ minHeight: '100%' }}>
      <SosAlerter />
      <Layout.Sider width={250} theme="light" breakpoint="lg" collapsedWidth={0} style={{ borderRight: '1px solid #eee' }}>
        <div style={{ padding: '20px 20px 12px' }}>
          <Typography.Title level={4} style={{ margin: 0, color: '#1F7A45' }}>
            Thôn Thống Nhất
          </Typography.Title>
          <Typography.Text type="secondary">Xã Sóc Sơn</Typography.Text>
        </div>
        <Menu mode="inline" selectedKeys={[pathname]} items={items} onClick={(e) => navigate(e.key)} style={{ border: 0 }} />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingInline: 24, borderBottom: '1px solid #eee' }}>
          <Typography.Text>
            <b>{me?.full_name ?? me?.username}</b>
            {me?.leadership_role && <Typography.Text type="secondary"> · {LEADERSHIP_ROLE_LABEL[me.leadership_role]}</Typography.Text>}
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={signOut}>
            Đăng xuất
          </Button>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
