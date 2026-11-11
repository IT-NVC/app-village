import { CheckOutlined, EnvironmentOutlined, PhoneOutlined, SoundOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SOS_STATUS_LABEL, type SosStatus } from '@thon/shared';
import { App, Button, Card, Empty, Segmented, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import { errMsg, fmtDateTime } from '@/lib/format';
import { must, notify, one, rows, supabase } from '@/lib/supabase';

const STATUS_COLOR: Record<SosStatus, string> = { dang_cho: 'red', da_tiep_nhan: 'orange', da_xu_ly: 'green' };

type SosRow = {
  id: string;
  created_at: string;
  status: SosStatus;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  handled_at: string | null;
  full_name: string;
  phone: string | null;
  area: string | null;
  handler: string | null;
};

async function loadSos(filter: SosStatus | 'all'): Promise<SosRow[]> {
  let q = supabase
    .from('sos_events')
    .select(
      'id, created_at, status, message, latitude, longitude, handled_at, sender:profiles!sos_events_user_id_fkey(username, residents(full_name, phone, areas(name))), handler:profiles!sos_events_handled_by_fkey(username, residents(full_name))',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (filter !== 'all') q = q.eq('status', filter);
  return rows(await q).map((e) => {
    const s = one(e.sender);
    const r = one(s?.residents);
    const h = one(e.handler);
    return {
      id: e.id,
      created_at: e.created_at,
      status: e.status,
      message: e.message,
      latitude: e.latitude,
      longitude: e.longitude,
      handled_at: e.handled_at,
      full_name: r?.full_name ?? s?.username ?? '(không rõ)',
      phone: r?.phone ?? null,
      area: one(r?.areas)?.name ?? null,
      handler: one(h?.residents)?.full_name ?? h?.username ?? null,
    };
  });
}

export default function SosPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<SosStatus | 'all'>('dang_cho');

  const { data = [], isLoading } = useQuery({
    queryKey: ['sos', filter],
    queryFn: () => loadSos(filter),
    refetchInterval: 30_000,
  });

  const handle = useMutation({
    mutationFn: async (v: { id: string; status: SosStatus }) =>
      must(await supabase.rpc('handle_sos', { p_sos_id: v.id, p_status: v.status })),
    onSuccess: (_d, v) => {
      notify('sos_update', v.id);
      message.success(v.status === 'da_tiep_nhan' ? 'Đã tiếp nhận — người dân sẽ thấy ngay trên app' : 'Đã đánh dấu xử lý xong');
      qc.invalidateQueries({ queryKey: ['sos'] });
      qc.invalidateQueries({ queryKey: ['sos-pending'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Card
      title={
        <Space>
          <SoundOutlined style={{ color: '#D32F2F' }} />
          Tín hiệu khẩn cấp (SOS)
        </Space>
      }
      extra={
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as SosStatus | 'all')}
          options={[
            { value: 'dang_cho', label: 'Đang chờ' },
            { value: 'da_tiep_nhan', label: 'Đã tiếp nhận' },
            { value: 'da_xu_ly', label: 'Đã xử lý' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
      }>
      <Typography.Paragraph type="secondary">
        Khi có tín hiệu mới, trang quản trị sẽ <b>kêu chuông và hiện cảnh báo</b> dù bạn đang ở trang nào. Bấm
        "Tiếp nhận" để người dân biết đã có người hỗ trợ.
      </Typography.Paragraph>
      <Table<SosRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description={filter === 'dang_cho' ? 'Không có tín hiệu nào đang chờ' : 'Không có dữ liệu'} /> }}
        rowClassName={(r) => (r.status === 'dang_cho' ? 'sos-row-pending' : '')}
        columns={[
          {
            title: 'Thời gian',
            width: 150,
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <b>{dayjs(r.created_at).fromNow()}</b>
                <Typography.Text type="secondary">{fmtDateTime(r.created_at)}</Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Người gửi',
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <b>{r.full_name}</b>
                <Typography.Text type="secondary">{r.area ?? ''}</Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Liên hệ',
            width: 150,
            render: (_, r) =>
              r.phone ? (
                <a href={`tel:${r.phone}`}>
                  <PhoneOutlined /> {r.phone}
                </a>
              ) : (
                <Typography.Text type="secondary">Không có SĐT</Typography.Text>
              ),
          },
          { title: 'Sự việc', width: 170, render: (_, r) => r.message ?? <Typography.Text type="secondary">Không ghi</Typography.Text> },
          {
            title: 'Vị trí',
            width: 140,
            render: (_, r) =>
              r.latitude != null && r.longitude != null ? (
                <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">
                  <EnvironmentOutlined /> Xem bản đồ
                </a>
              ) : (
                <Typography.Text type="secondary">Không có</Typography.Text>
              ),
          },
          {
            title: 'Trạng thái',
            width: 170,
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <Tag color={STATUS_COLOR[r.status]}>{SOS_STATUS_LABEL[r.status]}</Tag>
                {r.handler && <Typography.Text type="secondary">{r.handler}</Typography.Text>}
              </Space>
            ),
          },
          {
            title: '',
            width: 150,
            fixed: 'right',
            render: (_, r) =>
              r.status === 'dang_cho' ? (
                <Button type="primary" danger loading={handle.isPending && handle.variables?.id === r.id}
                  onClick={() => handle.mutate({ id: r.id, status: 'da_tiep_nhan' })}>
                  Tiếp nhận
                </Button>
              ) : r.status === 'da_tiep_nhan' ? (
                <Button icon={<CheckOutlined />} loading={handle.isPending && handle.variables?.id === r.id}
                  onClick={() => handle.mutate({ id: r.id, status: 'da_xu_ly' })}>
                  Đã xử lý xong
                </Button>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}
