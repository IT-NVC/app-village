import { EnvironmentOutlined, PhoneOutlined, PictureOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REPORT_CATEGORY_LABEL,
  REPORT_STATUS_LABEL,
  type ReportCategory,
  type ReportStatus,
} from '@thon/shared';
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Image,
  Input,
  Rate,
  Result,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { errMsg, fmtDateTime } from '@/lib/format';
import { must, notify, one, rows, supabase } from '@/lib/supabase';

const BUCKET = 'report-images';

const STATUS_COLOR: Record<ReportStatus, string> = {
  moi: 'blue',
  dang_xu_ly: 'orange',
  hoan_thanh: 'green',
  tu_choi: 'red',
};

type ReportRow = {
  id: string;
  category: ReportCategory;
  title: string;
  description: string | null;
  images: string[];
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  status: ReportStatus;
  rating: number | null;
  rating_comment: string | null;
  created_at: string;
  reporter: string;
  phone: string | null;
  area: string | null;
  thumb?: string;
};

async function loadReports(status: ReportStatus | 'all', category: ReportCategory | null): Promise<ReportRow[]> {
  let q = supabase
    .from('reports')
    .select(
      'id, category, title, description, images, latitude, longitude, address_text, status, rating, rating_comment, created_at, reporter:profiles!reports_reporter_id_fkey(username, residents(full_name, phone, areas(name)))',
    )
    .order('created_at', { ascending: false })
    .limit(300);
  if (status !== 'all') q = q.eq('status', status);
  if (category) q = q.eq('category', category);
  const list: ReportRow[] = rows(await q).map((r) => {
    const p = one(r.reporter);
    const res = one(p?.residents);
    return {
      id: r.id,
      category: r.category,
      title: r.title,
      description: r.description,
      images: r.images,
      latitude: r.latitude,
      longitude: r.longitude,
      address_text: r.address_text,
      status: r.status,
      rating: r.rating,
      rating_comment: r.rating_comment,
      created_at: r.created_at,
      reporter: res?.full_name ?? p?.username ?? '(không rõ)',
      phone: res?.phone ?? null,
      area: one(res?.areas)?.name ?? null,
    };
  });
  // Ảnh thu nhỏ: link có hạn 1 giờ (kho ảnh riêng tư)
  const firsts = list.map((r) => r.images[0]).filter(Boolean);
  if (firsts.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(firsts, 3600);
    const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    for (const r of list) if (r.images[0]) r.thumb = map.get(r.images[0]) ?? undefined;
  }
  return list;
}

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<ReportStatus | 'all'>('moi');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [selected, setSelected] = useState<ReportRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['reports', status, category],
    queryFn: () => loadReports(status, category),
    refetchInterval: 60_000,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <Result status="403" title="Chỉ Bí thư / Trưởng thôn xử lý phản ánh" />;
  }

  return (
    <Card
      title="Phản ánh của người dân"
      extra={
        <Space wrap>
          <Select
            allowClear
            placeholder="Tất cả loại"
            style={{ width: 190 }}
            value={category}
            onChange={(v) => setCategory(v ?? null)}
            options={Object.entries(REPORT_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as ReportStatus | 'all')}
            options={[
              ...(Object.keys(REPORT_STATUS_LABEL) as ReportStatus[]).map((s) => ({ value: s, label: REPORT_STATUS_LABEL[s] })),
              { value: 'all', label: 'Tất cả' },
            ]}
          />
        </Space>
      }>
      <Table<ReportRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 950 }}
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Không có phản ánh nào" /> }}
        onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: '',
            width: 76,
            render: (_, r) =>
              r.thumb ? (
                <img src={r.thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#eef2ef', display: 'grid', placeItems: 'center' }}>
                  <PictureOutlined style={{ color: '#a0aaa4', fontSize: 20 }} />
                </div>
              ),
          },
          {
            title: 'Phản ánh',
            render: (_, r) => (
              <Space orientation="vertical" size={2}>
                <b>{r.title}</b>
                <Tag>{REPORT_CATEGORY_LABEL[r.category]}</Tag>
              </Space>
            ),
          },
          {
            title: 'Người gửi',
            width: 200,
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <span>{r.reporter}</span>
                <Typography.Text type="secondary">
                  {[r.area, r.phone].filter(Boolean).join(' · ')}
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Gửi lúc',
            width: 150,
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <span>{dayjs(r.created_at).fromNow()}</span>
                <Typography.Text type="secondary">{fmtDateTime(r.created_at)}</Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Trạng thái',
            width: 150,
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <Tag color={STATUS_COLOR[r.status]}>{REPORT_STATUS_LABEL[r.status]}</Tag>
                {r.rating ? <Rate disabled value={r.rating} style={{ fontSize: 12 }} /> : null}
              </Space>
            ),
          },
        ]}
      />
      <ReportDrawer report={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

function ReportDrawer({ report, onClose }: { report: ReportRow | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<{ status: ReportStatus; note?: string }>();

  const { data: detail } = useQuery({
    queryKey: ['report-detail', report?.id],
    enabled: !!report,
    queryFn: async () => {
      const [updates, signed] = await Promise.all([
        supabase
          .from('report_updates')
          .select('id, status, note, created_at, actor:profiles!report_updates_actor_id_fkey(username, residents(full_name))')
          .eq('report_id', report!.id)
          .order('created_at'),
        report!.images.length
          ? supabase.storage.from(BUCKET).createSignedUrls(report!.images, 3600)
          : Promise.resolve({ data: [] as { signedUrl: string }[] }),
      ]);
      return {
        updates: rows(updates).map((u) => {
          const a = one(u.actor);
          return { ...u, actor: one(a?.residents)?.full_name ?? a?.username ?? '' };
        }),
        urls: (signed.data ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u),
      };
    },
  });

  const update = useMutation({
    mutationFn: async (v: { status: ReportStatus; note?: string }) =>
      must(
        await supabase.rpc('update_report_status', {
          p_report_id: report!.id,
          p_status: v.status,
          p_note: v.note?.trim() || undefined,
        }),
      ),
    onSuccess: () => {
      notify('report_update', report!.id);
      message.success('Đã cập nhật — người dân sẽ thấy ngay trên app');
      form.resetFields(['note']);
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['report-detail', report?.id] });
      qc.invalidateQueries({ queryKey: ['reports-new'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const nextStatus: ReportStatus | undefined =
    report?.status === 'moi' ? 'dang_xu_ly' : report?.status === 'dang_xu_ly' ? 'hoan_thanh' : undefined;

  return (
    <Drawer
      title={report?.title}
      open={!!report}
      onClose={onClose}
      size={640}
      destroyOnHidden
      afterOpenChange={(o) => o && report && form.setFieldsValue({ status: nextStatus ?? report.status })}>
      {report && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Loại">{REPORT_CATEGORY_LABEL[report.category]}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={STATUS_COLOR[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Người gửi">
              {report.reporter}
              {report.area ? ` · ${report.area}` : ''}
              {report.phone && (
                <>
                  {' · '}
                  <a href={`tel:${report.phone}`}>
                    <PhoneOutlined /> {report.phone}
                  </a>
                </>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Gửi lúc">{fmtDateTime(report.created_at)}</Descriptions.Item>
            <Descriptions.Item label="Vị trí">
              <Space orientation="vertical" size={0}>
                {report.address_text && <span>{report.address_text}</span>}
                {report.latitude != null ? (
                  <a href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`} target="_blank" rel="noreferrer">
                    <EnvironmentOutlined /> Xem trên bản đồ
                  </a>
                ) : (
                  !report.address_text && <Typography.Text type="secondary">Không có</Typography.Text>
                )}
              </Space>
            </Descriptions.Item>
            {report.rating ? (
              <Descriptions.Item label="Đánh giá">
                <Rate disabled value={report.rating} /> {report.rating_comment}
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          {report.description && (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f6f8f7', padding: 12, borderRadius: 8, margin: 0 }}>
              {report.description}
            </Typography.Paragraph>
          )}

          {(detail?.urls.length ?? 0) > 0 && (
            <Image.PreviewGroup>
              <Space wrap>
                {detail!.urls.map((u) => (
                  <Image key={u} src={u} width={170} height={170} style={{ objectFit: 'cover', borderRadius: 8 }} />
                ))}
              </Space>
            </Image.PreviewGroup>
          )}

          <Typography.Title level={5} style={{ margin: 0 }}>
            Tiến trình
          </Typography.Title>
          <Timeline
            items={(detail?.updates ?? []).map((u) => ({
              color: STATUS_COLOR[u.status],
              content: (
                <>
                  <b>{REPORT_STATUS_LABEL[u.status]}</b> · {fmtDateTime(u.created_at)}
                  {u.actor && <Typography.Text type="secondary"> · {u.actor}</Typography.Text>}
                  {u.note && <div>{u.note}</div>}
                </>
              ),
            }))}
          />

          <Card size="small" title="Cập nhật xử lý" style={{ background: '#fafcfb' }}>
            <Form form={form} layout="vertical" onFinish={(v) => update.mutate(v)}>
              <Form.Item name="status" label="Trạng thái mới" rules={[{ required: true }]}>
                <Select options={(Object.keys(REPORT_STATUS_LABEL) as ReportStatus[]).map((s) => ({ value: s, label: REPORT_STATUS_LABEL[s] }))} />
              </Form.Item>
              <Form.Item name="note" label="Ghi chú gửi người dân" extra="Người dân sẽ đọc được ghi chú này trong app.">
                <Input.TextArea rows={3} placeholder="VD: Đã báo điện lực, dự kiến sửa trong 2 ngày" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={update.isPending}>
                Cập nhật
              </Button>
            </Form>
          </Card>
        </Space>
      )}
    </Drawer>
  );
}
