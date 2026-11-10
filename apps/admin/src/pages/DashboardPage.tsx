import { AlertOutlined, SolutionOutlined, TeamOutlined, ToolOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

async function count(
  table: 'profiles' | 'residents' | 'reports' | 'sos_events',
  apply: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const { count: c, error } = await apply(supabase.from(table).select('id', { count: 'exact', head: true }));
  if (error) throw new Error(error.message);
  return (c as number) ?? 0;
}

export default function DashboardPage() {
  const { isAdmin, me } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [pending, active, residents, noAccount, reports, sos] = await Promise.all([
        count('profiles', (q) => q.eq('status', 'pending')),
        count('profiles', (q) => q.eq('status', 'active')),
        count('residents', (q) => q),
        count('residents', (q) => q.not('activation_code', 'is', null)),
        count('reports', (q) => q.in('status', ['moi', 'dang_xu_ly'])),
        count('sos_events', (q) => q.eq('status', 'dang_cho')),
      ]);
      return { pending, active, residents, noAccount, reports, sos };
    },
    refetchInterval: 60_000,
  });

  const tiles: { title: string; value?: number; icon: ReactNode; color: string; to?: string; hidden?: boolean }[] = [
    { title: 'Tài khoản chờ duyệt', value: data?.pending, icon: <SolutionOutlined />, color: '#B26A00', to: '/duyet' },
    { title: 'Tài khoản đang hoạt động', value: data?.active, icon: <UserOutlined />, color: '#2E7D32', to: '/tai-khoan' },
    { title: 'Nhân khẩu trong hệ thống', value: data?.residents, icon: <TeamOutlined />, color: '#1F7A45', to: '/nhan-khau' },
    { title: 'Nhân khẩu chưa kích hoạt', value: data?.noAccount, icon: <KeyOutlined />, color: '#555B66', to: '/nhan-khau' },
    { title: 'Phản ánh chưa xử lý xong', value: data?.reports, icon: <ToolOutlined />, color: '#6A1B9A', hidden: !isAdmin },
    { title: 'Tín hiệu SOS đang chờ', value: data?.sos, icon: <AlertOutlined />, color: '#C62828' },
  ];

  return (
    <>
      <Typography.Title level={3}>Xin chào, {me?.full_name ?? me?.username}</Typography.Title>
      <Row gutter={[16, 16]}>
        {tiles
          .filter((t) => !t.hidden)
          .map((t) => (
            <Col xs={24} sm={12} xl={8} key={t.title}>
              <Card hoverable={!!t.to} onClick={() => t.to && navigate(t.to)} loading={isLoading}>
                <Statistic
                  title={t.title}
                  value={t.value ?? 0}
                  prefix={<span style={{ color: t.color, marginRight: 8 }}>{t.icon}</span>}
                  styles={{ content: { color: t.color, fontWeight: 600 } }}
                />
              </Card>
            </Col>
          ))}
      </Row>
    </>
  );
}
