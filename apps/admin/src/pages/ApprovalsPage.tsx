import { CheckOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GENDER_LABEL } from '@thon/shared';
import { App, Button, Card, Empty, Input, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';

import { errMsg, fmtDate, fmtDateTime, normalize } from '@/lib/format';
import { fetchAll, must, one, rows, supabase } from '@/lib/supabase';

type PendingRow = {
  id: string;
  username: string | null;
  created_at: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  gender: 'nam' | 'nu' | 'khac' | null;
  note: string | null;
  area: string | null;
  household: string | null;
  /** Nhân khẩu nhập sẵn có thể trùng */
  matches: { full_name: string; birth_date: string | null; area: string | null }[];
};

export default function ApprovalsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<PendingRow | null>(null);
  const [reason, setReason] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['pending'],
    queryFn: async (): Promise<PendingRow[]> => {
      const profiles = rows(
        await supabase
          .from('profiles')
          .select(
            'id, username, created_at, residents(full_name, phone, birth_date, gender, note, areas(name), households(code, head_name))',
          )
          .eq('status', 'pending')
          .order('created_at'),
      );
      // Nhân khẩu cán bộ đã nhập nhưng chưa có tài khoản -> dò trùng tên
      const imported = await fetchAll((from, to) =>
        supabase
          .from('residents')
          .select('full_name, birth_date, areas(name)')
          .eq('source', 'import')
          .not('activation_code', 'is', null)
          .range(from, to),
      );
      const byName = new Map<string, typeof imported>();
      for (const r of imported) {
        const k = normalize(r.full_name);
        byName.set(k, [...(byName.get(k) ?? []), r]);
      }
      return profiles.map((p) => {
        const r = one(p.residents);
        const hh = one(r?.households);
        return {
          id: p.id,
          username: p.username,
          created_at: p.created_at,
          full_name: r?.full_name ?? '(không có tên)',
          phone: r?.phone ?? null,
          birth_date: r?.birth_date ?? null,
          gender: r?.gender ?? null,
          note: r?.note ?? null,
          area: one(r?.areas)?.name ?? null,
          household: hh ? `${hh.code ?? ''} ${hh.head_name ? `(chủ hộ ${hh.head_name})` : ''}`.trim() : null,
          matches: (byName.get(normalize(r?.full_name ?? '')) ?? []).map((m) => ({
            full_name: m.full_name,
            birth_date: m.birth_date,
            area: one(m.areas)?.name ?? null,
          })),
        };
      });
    },
  });

  const review = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; reason?: string }) =>
      must(await supabase.rpc('review_account', { p_user_id: v.id, p_approve: v.approve, p_reason: v.reason })),
    onSuccess: (_d, v) => {
      message.success(v.approve ? 'Đã duyệt tài khoản' : 'Đã từ chối');
      qc.invalidateQueries({ queryKey: ['pending'] });
      qc.invalidateQueries({ queryKey: ['pending-count'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Card title="Tài khoản chờ duyệt">
      <Typography.Paragraph type="secondary">
        Người dân tự khai báo thông tin khi chưa có mã kích hoạt. Hãy kiểm tra đúng là người trong thôn trước khi duyệt.
        Nếu người đó đã có trong danh sách nhân khẩu nhập sẵn, nên <b>từ chối</b> và đưa mã kích hoạt cho họ để tránh trùng hồ sơ.
      </Typography.Paragraph>
      <Table<PendingRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        locale={{ emptyText: <Empty description="Không có tài khoản nào chờ duyệt" /> }}
        scroll={{ x: 900 }}
        columns={[
          {
            title: 'Họ tên',
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <b>{r.full_name}</b>
                <Typography.Text type="secondary">{r.username ? `@${r.username}` : 'Đăng nhập Google'}</Typography.Text>
                {r.matches.length > 0 && (
                  <Tooltip
                    title={r.matches.map((m) => `${m.full_name} · ${fmtDate(m.birth_date) || 'không rõ ngày sinh'} · ${m.area ?? ''}`).join('\n')}>
                    <Tag color="warning" icon={<WarningOutlined />}>
                      Có thể trùng {r.matches.length} nhân khẩu đã nhập
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            ),
          },
          { title: 'Khu', dataIndex: 'area' },
          { title: 'SĐT', dataIndex: 'phone' },
          { title: 'Ngày sinh', render: (_, r) => fmtDate(r.birth_date) },
          { title: 'Giới tính', render: (_, r) => (r.gender ? GENDER_LABEL[r.gender] : '') },
          { title: 'Hộ', dataIndex: 'household' },
          { title: 'Gửi lúc', render: (_, r) => fmtDateTime(r.created_at) },
          {
            title: '',
            fixed: 'right',
            render: (_, r) => (
              <Space>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={review.isPending && review.variables?.id === r.id && review.variables.approve}
                  onClick={() => review.mutate({ id: r.id, approve: true })}>
                  Duyệt
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => { setReason(''); setRejecting(r); }}>
                  Từ chối
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={`Từ chối: ${rejecting?.full_name ?? ''}`}
        open={!!rejecting}
        okText="Từ chối"
        okButtonProps={{ danger: true, loading: review.isPending }}
        onCancel={() => setRejecting(null)}
        onOk={async () => {
          if (!rejecting) return;
          await review.mutateAsync({ id: rejecting.id, approve: false, reason: reason.trim() || undefined });
          setRejecting(null);
        }}>
        <Typography.Paragraph>Người dân sẽ thấy lý do này và có thể nhập mã kích hoạt hoặc khai báo lại.</Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="VD: Đã có trong danh sách nhân khẩu, vui lòng liên hệ cán bộ để lấy mã kích hoạt"
        />
      </Modal>
    </Card>
  );
}
