import { useQuery } from '@tanstack/react-query';
import { ACCOUNT_STATUS_LABEL, LEADERSHIP_ROLE_LABEL, ORG_ROLE_LABEL } from '@thon/shared';
import { Card, Result, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { useActivePeople } from '@/lib/data';
import { fmtDateTime } from '@/lib/format';
import { must, supabase } from '@/lib/supabase';

type Log = { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; data: unknown; created_at: string };
type Row = Record<string, unknown>;

const ENTITY: Record<string, string> = {
  profiles: 'Tài khoản',
  org_members: 'Thành viên ban ngành',
  areas: 'Khu vực',
  organizations: 'Ban ngành',
  app_settings: 'Cài đặt',
  residents: 'Nhân khẩu',
  announcements: 'Thông báo',
};
const ACTION: Record<string, { label: string; color: string }> = {
  insert: { label: 'Thêm', color: 'green' },
  update: { label: 'Sửa', color: 'blue' },
  delete: { label: 'Xoá', color: 'red' },
  reset_password: { label: 'Đặt lại mật khẩu', color: 'orange' },
};

/** Diễn giải ngắn gọn thay đổi để cán bộ đọc được */
function describe(log: Log, nameOf: (id?: unknown) => string): string {
  const d = log.data as { old?: Row; new?: Row } & Row;
  if (log.entity === 'profiles' && d?.old && d?.new) {
    const parts: string[] = [];
    if (d.old.status !== d.new.status)
      parts.push(`trạng thái ${ACCOUNT_STATUS_LABEL[d.old.status as never] ?? d.old.status} → ${ACCOUNT_STATUS_LABEL[d.new.status as never] ?? d.new.status}`);
    if (d.old.leadership_role !== d.new.leadership_role)
      parts.push(`chức vụ ${LEADERSHIP_ROLE_LABEL[d.old.leadership_role as never] ?? 'không'} → ${LEADERSHIP_ROLE_LABEL[d.new.leadership_role as never] ?? 'không'}`);
    return `${nameOf(d.new.id)}: ${parts.join(', ')}`;
  }
  if (log.entity === 'profiles' && log.action === 'reset_password') return nameOf(log.entity_id);
  if (log.entity === 'org_members') {
    const r = (d?.new ?? d) as Row;
    return `${nameOf(r.user_id)}${r.role ? ` (${ORG_ROLE_LABEL[r.role as never]})` : ''}`;
  }
  if (log.entity === 'app_settings' && d?.new) return `${d.new.key} = ${JSON.stringify(d.new.value)}`;
  const r = (d?.new ?? d) as Row | undefined;
  return String(r?.name ?? r?.full_name ?? r?.title ?? '');
}

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { data: people = [] } = useActivePeople();
  const nameOf = (id?: unknown) => people.find((p) => p.id === id)?.full_name ?? (id ? `#${String(id).slice(0, 8)}` : 'Hệ thống');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      return { rows: must(res) as Log[], total: res.count ?? 0 };
    },
  });

  if (!isAdmin) return <Result status="403" title="Chỉ Bí thư / Trưởng thôn xem được nhật ký" />;

  return (
    <Card title="Nhật ký thao tác">
      <Table<Log>
        rowKey="id"
        size="middle"
        loading={isLoading}
        dataSource={data?.rows ?? []}
        scroll={{ x: 900 }}
        pagination={{ current: page, pageSize, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        expandable={{
          expandedRowRender: (l) => (
            <Typography.Paragraph>
              <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.data, null, 2)}</pre>
            </Typography.Paragraph>
          ),
          rowExpandable: (l) => !!l.data,
        }}
        columns={[
          { title: 'Thời gian', width: 150, render: (_, l) => fmtDateTime(l.created_at) },
          { title: 'Người thực hiện', width: 180, render: (_, l) => nameOf(l.actor_id) },
          { title: 'Thao tác', width: 150, render: (_, l) => <Tag color={ACTION[l.action]?.color}>{ACTION[l.action]?.label ?? l.action}</Tag> },
          { title: 'Đối tượng', width: 160, render: (_, l) => ENTITY[l.entity] ?? l.entity },
          { title: 'Chi tiết', render: (_, l) => describe(l, nameOf) },
        ]}
      />
    </Card>
  );
}
