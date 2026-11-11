import { DeleteOutlined, EyeOutlined, PhoneOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PRIORITY_LABEL, type PriorityLevel } from '@thon/shared';
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';

import { useAreas, useOrganizations } from '@/lib/data';
import { errMsg, fmtDateTime } from '@/lib/format';
import { must, notify, one, rows, supabase } from '@/lib/supabase';

const PRIORITY_COLOR: Record<PriorityLevel, string> = { khan: 'red', quan_trong: 'orange', thuong: 'green' };

type Row = {
  id: string;
  title: string;
  content: string;
  priority: PriorityLevel;
  target_all: boolean;
  scheduled_at: string;
  sender: string;
  targets: string[];
  stats?: { total: number; read_count: number };
};

type FormValues = {
  title: string;
  content: string;
  priority: PriorityLevel;
  mode: 'all' | 'custom';
  area_ids?: string[];
  org_ids?: string[];
  schedule?: boolean;
  scheduled_at?: Dayjs;
};

async function loadAnnouncements(): Promise<Row[]> {
  const data = rows(
    await supabase
      .from('announcements')
      .select(
        'id, title, content, priority, target_all, scheduled_at, profiles!announcements_sender_id_fkey(username, residents(full_name)), announcement_targets(areas(name), organizations(name))',
      )
      .order('scheduled_at', { ascending: false })
      .limit(200),
  );
  const list: Row[] = data.map((a) => {
    const p = one(a.profiles);
    return {
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      target_all: a.target_all,
      scheduled_at: a.scheduled_at,
      sender: one(p?.residents)?.full_name ?? p?.username ?? '',
      targets: (a.announcement_targets ?? []).map((t) => one(t.areas)?.name ?? one(t.organizations)?.name ?? '').filter(Boolean),
    };
  });
  // Thống kê đã đọc cho 30 thông báo gần nhất
  await Promise.all(
    list.slice(0, 30).map(async (r) => {
      const { data: s } = await supabase.rpc('announcement_read_stats', { p_announcement: r.id });
      if (s?.[0]) r.stats = s[0];
    }),
  );
  return list;
}

export default function AnnouncementsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: areas = [] } = useAreas();
  const { data: orgs = [] } = useOrganizations();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [form] = Form.useForm<FormValues>();
  const mode = Form.useWatch('mode', form);
  const schedule = Form.useWatch('schedule', form);

  const { data = [], isLoading } = useQuery({ queryKey: ['announcements'], queryFn: loadAnnouncements });

  const send = useMutation({
    mutationFn: async (v: FormValues) =>
      must(
        await supabase.rpc('send_announcement', {
          p_title: v.title.trim(),
          p_content: v.content.trim(),
          p_priority: v.priority,
          p_target_all: v.mode === 'all',
          p_area_ids: v.mode === 'all' ? [] : (v.area_ids ?? []),
          p_org_ids: v.mode === 'all' ? [] : (v.org_ids ?? []),
          p_scheduled_at: v.schedule && v.scheduled_at ? v.scheduled_at.toISOString() : undefined,
        }),
      ),
    onSuccess: (id, v) => {
      message.success(v.schedule ? 'Đã hẹn giờ gửi thông báo' : 'Đã gửi thông báo');
      if (!v.schedule && id) notify('announcement', id as string);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('announcements').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá thông báo');
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name;

  return (
    <Card
      title="Thông báo"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ priority: 'thuong', mode: 'all' });
            setOpen(true);
          }}>
          Soạn thông báo
        </Button>
      }>
      <Table<Row>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Chưa có thông báo nào" /> }}
        columns={[
          {
            title: 'Thông báo',
            render: (_, r) => (
              <Space orientation="vertical" size={2}>
                <Space size={6}>
                  <Tag color={PRIORITY_COLOR[r.priority]}>{PRIORITY_LABEL[r.priority]}</Tag>
                  {dayjs(r.scheduled_at).isAfter(dayjs()) && <Tag color="purple">Hẹn giờ</Tag>}
                </Space>
                <b>{r.title}</b>
                <Typography.Text type="secondary" ellipsis style={{ maxWidth: 420 }}>
                  {r.content}
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Gửi tới',
            width: 180,
            render: (_, r) => (r.target_all ? <Tag color="blue">Toàn thôn</Tag> : r.targets.map((t) => <Tag key={t}>{t}</Tag>)),
          },
          { title: 'Thời gian', width: 150, render: (_, r) => fmtDateTime(r.scheduled_at) },
          {
            title: 'Đã đọc',
            width: 160,
            render: (_, r) =>
              r.stats ? (
                <Space orientation="vertical" size={0} style={{ width: '100%' }}>
                  <Progress
                    percent={r.stats.total ? Math.round((r.stats.read_count / r.stats.total) * 100) : 0}
                    size="small"
                    strokeColor="#3BA56A"
                  />
                  <Typography.Text type="secondary">
                    {r.stats.read_count}/{r.stats.total} người
                  </Typography.Text>
                </Space>
              ) : (
                '—'
              ),
          },
          { title: 'Người gửi', width: 150, dataIndex: 'sender' },
          {
            title: '',
            width: 100,
            fixed: 'right',
            render: (_, r) => (
              <Space size={0}>
                <Button type="text" icon={<EyeOutlined />} onClick={() => setViewing(r)} />
                <Popconfirm
                  title="Xoá thông báo này?"
                  description="Người dân sẽ không còn thấy thông báo."
                  okText="Xoá"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove.mutate(r.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Soạn thông báo"
        open={open}
        width={640}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={schedule ? 'Hẹn giờ gửi' : 'Gửi ngay'}
        okButtonProps={{ icon: <SendOutlined /> }}
        confirmLoading={send.isPending}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => send.mutate(v)} requiredMark={false}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="VD: Họp thôn tối thứ Bảy" maxLength={150} showCount />
          </Form.Item>
          <Form.Item name="content" label="Nội dung" rules={[{ required: true, whitespace: true, message: 'Nhập nội dung' }]}>
            <Input.TextArea rows={6} placeholder="Viết ngắn gọn, rõ ràng: thời gian, địa điểm, việc cần làm…" />
          </Form.Item>
          <Form.Item name="priority" label="Mức độ">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={(Object.keys(PRIORITY_LABEL) as PriorityLevel[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Form.Item>
          <Form.Item name="mode" label="Gửi tới">
            <Radio.Group
              options={[
                { value: 'all', label: 'Toàn thôn' },
                { value: 'custom', label: 'Chọn khu / ban ngành' },
              ]}
            />
          </Form.Item>
          {mode === 'custom' && (
            <>
              <Form.Item name="area_ids" label="Khu">
                <Select mode="multiple" allowClear placeholder="Chọn khu" options={areas.map((a) => ({ value: a.id, label: a.name }))} />
              </Form.Item>
              <Form.Item
                name="org_ids"
                label="Ban ngành"
                rules={[
                  {
                    validator: (_, v) =>
                      (v?.length ?? 0) > 0 || (form.getFieldValue('area_ids')?.length ?? 0) > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error('Chọn ít nhất một khu hoặc ban ngành')),
                  },
                ]}>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Chọn ban ngành"
                  options={orgs.map((o) => ({ value: o.id, label: `${o.name}${o.area_id ? ` (${areaName(o.area_id)})` : ''}` }))}
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="schedule" valuePropName="checked" style={{ marginBottom: schedule ? 8 : 0 }}>
            <Checkbox>Hẹn giờ gửi</Checkbox>
          </Form.Item>
          {schedule && (
            <Form.Item name="scheduled_at" rules={[{ required: true, message: 'Chọn thời điểm gửi' }]}>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                style={{ width: 240 }}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <AnnouncementDrawer row={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

function AnnouncementDrawer({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { data: unread = [], isLoading } = useQuery({
    queryKey: ['announcement-unread', row?.id],
    enabled: !!row,
    queryFn: async () => rows(await supabase.rpc('announcement_unread_list', { p_announcement: row!.id })),
  });

  return (
    <Drawer title={row?.title} open={!!row} onClose={onClose} size={620} destroyOnHidden>
      {row && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Mức độ">
              <Tag color={PRIORITY_COLOR[row.priority]}>{PRIORITY_LABEL[row.priority]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Gửi tới">{row.target_all ? 'Toàn thôn' : row.targets.join(', ')}</Descriptions.Item>
            <Descriptions.Item label="Thời gian">{fmtDateTime(row.scheduled_at)}</Descriptions.Item>
            <Descriptions.Item label="Người gửi">{row.sender}</Descriptions.Item>
          </Descriptions>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f6f8f7', padding: 12, borderRadius: 8 }}>
            {row.content}
          </Typography.Paragraph>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Chưa đọc ({unread.length}) — gọi điện nhắc nếu cần
          </Typography.Title>
          <Table
            rowKey="user_id"
            size="small"
            loading={isLoading}
            dataSource={unread}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            locale={{ emptyText: 'Tất cả đã đọc 🎉' }}
            columns={[
              { title: 'Họ tên', dataIndex: 'full_name' },
              { title: 'Khu', dataIndex: 'area_name', width: 90 },
              {
                title: 'SĐT',
                width: 140,
                render: (_, u) =>
                  u.phone ? (
                    <a href={`tel:${u.phone}`}>
                      <PhoneOutlined /> {u.phone}
                    </a>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ),
              },
            ]}
          />
        </Space>
      )}
    </Drawer>
  );
}
