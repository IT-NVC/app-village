import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PhoneOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@thon/shared';
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { useAreas } from '@/lib/data';
import { errMsg, fmtDateTime } from '@/lib/format';
import { must, notify, one, rows, supabase } from '@/lib/supabase';

type EventCategory = Database['public']['Enums']['event_category'];
type BookingStatus = Database['public']['Enums']['booking_status'];
type EventRow = Database['public']['Tables']['events']['Row'];
type Venue = Database['public']['Tables']['venues']['Row'];

const CATEGORY: Record<EventCategory, { label: string; color: string }> = {
  hop: { label: 'Họp', color: 'blue' },
  van_hoa: { label: 'Văn hoá, lễ hội', color: 'magenta' },
  ve_sinh: { label: 'Vệ sinh môi trường', color: 'green' },
  y_te: { label: 'Y tế, tiêm chủng', color: 'red' },
  the_thao: { label: 'Thể thao', color: 'orange' },
  khac: { label: 'Khác', color: 'purple' },
};
const BOOKING: Record<BookingStatus, { label: string; color: string }> = {
  cho_duyet: { label: 'Chờ duyệt', color: 'gold' },
  da_duyet: { label: 'Đã duyệt', color: 'green' },
  tu_choi: { label: 'Từ chối', color: 'red' },
  da_huy: { label: 'Đã huỷ', color: 'default' },
};

const timeRange = (s: string, e: string | null) =>
  e && dayjs(e).isSame(dayjs(s), 'day') ? `${fmtDateTime(s)} – ${dayjs(e).format('HH:mm')}` : `${fmtDateTime(s)}${e ? ` – ${fmtDateTime(e)}` : ''}`;

export default function CalendarPage() {
  const { data: pending = 0 } = useQuery({
    queryKey: ['bookings-pending'],
    queryFn: async () =>
      (await supabase.from('venue_bookings').select('id', { count: 'exact', head: true }).eq('status', 'cho_duyet')).count ?? 0,
    refetchInterval: 60_000,
  });
  return (
    <Card title="Lịch thôn & đặt nhà văn hoá">
      <Tabs
        items={[
          {
            key: 'bookings',
            label: (
              <Space>
                Yêu cầu đặt lịch <Badge count={pending} />
              </Space>
            ),
            children: <BookingsTab />,
          },
          { key: 'events', label: 'Sự kiện', children: <EventsTab /> },
          { key: 'venues', label: 'Địa điểm', children: <VenuesTab /> },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Yêu cầu đặt lịch
// ---------------------------------------------------------------------------
type BookingRow = {
  id: string;
  purpose: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  review_note: string | null;
  venue_id: string;
  venue: string;
  requester: string;
  phone: string | null;
  area: string | null;
  conflict: boolean;
};

function BookingsTab() {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [status, setStatus] = useState<BookingStatus | 'upcoming'>('cho_duyet');

  const { data = [], isLoading } = useQuery({
    queryKey: ['bookings', status],
    refetchInterval: 60_000,
    queryFn: async (): Promise<BookingRow[]> => {
      let q = supabase
        .from('venue_bookings')
        .select(
          'id, purpose, starts_at, ends_at, status, review_note, venue_id, venues(name), requester:profiles!venue_bookings_requester_id_fkey(username, residents(full_name, phone, areas(name)))',
        )
        .order('starts_at')
        .limit(300);
      q = status === 'upcoming' ? q.eq('status', 'da_duyet').gte('ends_at', new Date().toISOString()) : q.eq('status', status);
      const list = rows(await q);
      // Lịch đã duyệt để cảnh báo trùng giờ cho các yêu cầu chờ duyệt
      const approved = status === 'cho_duyet'
        ? rows(await supabase.from('venue_bookings').select('venue_id, starts_at, ends_at').eq('status', 'da_duyet').gte('ends_at', new Date().toISOString()))
        : [];
      return list.map((b) => {
        const p = one(b.requester);
        const r = one(p?.residents);
        return {
          id: b.id,
          purpose: b.purpose,
          starts_at: b.starts_at,
          ends_at: b.ends_at,
          status: b.status,
          review_note: b.review_note,
          venue_id: b.venue_id,
          venue: one(b.venues)?.name ?? '',
          requester: r?.full_name ?? p?.username ?? '',
          phone: r?.phone ?? null,
          area: one(r?.areas)?.name ?? null,
          conflict: approved.some(
            (a) => a.venue_id === b.venue_id && new Date(a.starts_at) < new Date(b.ends_at) && new Date(a.ends_at) > new Date(b.starts_at),
          ),
        };
      });
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['bookings-pending'] });
  };

  const review = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; note?: string }) =>
      must(await supabase.rpc('review_booking', { p_booking_id: v.id, p_approve: v.approve, p_note: v.note })),
    onSuccess: (_d, v) => {
      notify('booking_review', v.id);
      message.success(v.approve ? 'Đã duyệt — người đặt sẽ được báo' : 'Đã từ chối');
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => must(await supabase.rpc('cancel_booking', { p_booking_id: id })),
    onSuccess: () => {
      message.success('Đã huỷ lịch');
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  function askNote(b: BookingRow, approve: boolean) {
    let note = '';
    modal.confirm({
      title: approve ? `Duyệt lịch của ${b.requester}?` : `Từ chối yêu cầu của ${b.requester}?`,
      content: (
        <Input.TextArea
          rows={3}
          placeholder={approve ? 'Ghi chú cho người đặt (không bắt buộc), VD: nhớ dọn dẹp sau khi dùng' : 'Lý do từ chối'}
          onChange={(e) => (note = e.target.value)}
        />
      ),
      okText: approve ? 'Duyệt' : 'Từ chối',
      okButtonProps: { danger: !approve },
      onOk: () => review.mutateAsync({ id: b.id, approve, note }),
    });
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Segmented
        value={status}
        onChange={(v) => setStatus(v as BookingStatus | 'upcoming')}
        options={[
          { value: 'cho_duyet', label: 'Chờ duyệt' },
          { value: 'upcoming', label: 'Đã duyệt, sắp tới' },
          { value: 'tu_choi', label: 'Từ chối' },
          { value: 'da_huy', label: 'Đã huỷ' },
        ]}
      />
      <Table<BookingRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Không có yêu cầu nào" /> }}
        columns={[
          {
            title: 'Thời gian',
            width: 210,
            render: (_, b) => (
              <Space orientation="vertical" size={0}>
                <b>{timeRange(b.starts_at, b.ends_at)}</b>
                <span>{b.venue}</span>
                {b.conflict && (
                  <Tag color="red" icon={<WarningOutlined />}>
                    Trùng lịch đã duyệt
                  </Tag>
                )}
              </Space>
            ),
          },
          { title: 'Mục đích', dataIndex: 'purpose' },
          {
            title: 'Người đặt',
            width: 190,
            render: (_, b) => (
              <Space orientation="vertical" size={0}>
                <span>{b.requester}</span>
                <Typography.Text type="secondary">{b.area}</Typography.Text>
                {b.phone && (
                  <a href={`tel:${b.phone}`}>
                    <PhoneOutlined /> {b.phone}
                  </a>
                )}
              </Space>
            ),
          },
          {
            title: 'Trạng thái',
            width: 150,
            render: (_, b) => (
              <Space orientation="vertical" size={0}>
                <Tag color={BOOKING[b.status].color}>{BOOKING[b.status].label}</Tag>
                {b.review_note && <Typography.Text type="secondary">{b.review_note}</Typography.Text>}
              </Space>
            ),
          },
          {
            title: '',
            width: 200,
            fixed: 'right',
            render: (_, b) =>
              b.status === 'cho_duyet' ? (
                <Space>
                  <Button type="primary" icon={<CheckOutlined />} disabled={b.conflict} onClick={() => askNote(b, true)}>
                    Duyệt
                  </Button>
                  <Button danger icon={<CloseOutlined />} onClick={() => askNote(b, false)}>
                    Từ chối
                  </Button>
                </Space>
              ) : b.status === 'da_duyet' ? (
                <Popconfirm title="Huỷ lịch đã duyệt này?" okText="Huỷ lịch" okButtonProps={{ danger: true }} onConfirm={() => cancel.mutate(b.id)}>
                  <Button danger>Huỷ lịch</Button>
                </Popconfirm>
              ) : null,
          },
        ]}
      />
    </Space>
  );
}

// ---------------------------------------------------------------------------
// Sự kiện
// ---------------------------------------------------------------------------
type EventForm = {
  title: string;
  category: EventCategory;
  location?: string;
  range: [Dayjs, Dayjs | null];
  area_id?: string | null;
  description?: string;
  push: boolean;
};

function EventsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { me } = useAuth();
  const { data: areas = [] } = useAreas();
  const [editing, setEditing] = useState<EventRow | 'new' | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [form] = Form.useForm<EventForm>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['events', showPast],
    queryFn: async () => {
      let q = supabase.from('events').select('*').order('starts_at', { ascending: !showPast }).limit(300);
      q = showPast ? q.lt('starts_at', new Date().toISOString()) : q.gte('starts_at', dayjs().startOf('day').toISOString());
      return rows(await q) as EventRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: EventForm) => {
      const payload = {
        title: v.title.trim(),
        category: v.category,
        location: v.location?.trim() || null,
        starts_at: v.range[0].toISOString(),
        ends_at: v.range[1] ? v.range[1].toISOString() : null,
        area_id: v.area_id || null,
        description: v.description?.trim() || null,
      };
      if (editing === 'new') {
        const created = must(await supabase.from('events').insert({ ...payload, created_by: me?.id ?? null }).select('id').single());
        if (v.push && created) notify('event', created.id);
      } else if (editing) {
        must(await supabase.from('events').update(payload).eq('id', editing.id));
      }
    },
    onSuccess: () => {
      message.success('Đã lưu sự kiện');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('events').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
    onError: (e) => message.error(errMsg(e)),
  });

  function open(e: EventRow | 'new') {
    setEditing(e);
    form.resetFields();
    if (e === 'new') form.setFieldsValue({ category: 'hop', push: true });
    else
      form.setFieldsValue({
        title: e.title,
        category: e.category,
        location: e.location ?? undefined,
        range: [dayjs(e.starts_at), e.ends_at ? dayjs(e.ends_at) : null],
        area_id: e.area_id,
        description: e.description ?? undefined,
        push: false,
      });
  }

  const areaName = (id: string | null) => (id ? areas.find((a) => a.id === id)?.name : null);

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>
          Thêm sự kiện
        </Button>
        <Switch checked={showPast} onChange={setShowPast} /> <span>Xem sự kiện đã qua</span>
      </Space>
      <Table<EventRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Chưa có sự kiện" /> }}
        columns={[
          { title: 'Thời gian', width: 230, render: (_, e) => <b>{timeRange(e.starts_at, e.ends_at)}</b> },
          {
            title: 'Sự kiện',
            render: (_, e) => (
              <Space orientation="vertical" size={2}>
                <b>{e.title}</b>
                <Space size={4}>
                  <Tag color={CATEGORY[e.category].color}>{CATEGORY[e.category].label}</Tag>
                  <Tag>{areaName(e.area_id) ?? 'Toàn thôn'}</Tag>
                </Space>
              </Space>
            ),
          },
          { title: 'Địa điểm', width: 180, dataIndex: 'location' },
          {
            title: '',
            width: 90,
            render: (_, e) => (
              <Space size={0}>
                <Button type="text" icon={<EditOutlined />} onClick={() => open(e)} />
                <Popconfirm title="Xoá sự kiện?" okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(e.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing === 'new' ? 'Thêm sự kiện' : 'Sửa sự kiện'}
        open={!!editing}
        width={640}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        confirmLoading={save.isPending}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
          <Form.Item name="title" label="Tên sự kiện" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="VD: Họp thôn quý IV" />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="category" label="Loại">
              <Select style={{ width: 200 }} options={Object.entries(CATEGORY).map(([value, c]) => ({ value, label: c.label }))} />
            </Form.Item>
            <Form.Item name="area_id" label="Dành cho">
              <Select allowClear placeholder="Toàn thôn" style={{ width: 200 }} options={areas.map((a) => ({ value: a.id, label: a.name }))} />
            </Form.Item>
          </Space>
          <Form.Item name="range" label="Thời gian (bắt đầu – kết thúc)" rules={[{ required: true, message: 'Chọn thời gian bắt đầu' }]}>
            <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" allowEmpty={[false, true]} />
          </Form.Item>
          <Form.Item name="location" label="Địa điểm">
            <Input placeholder="VD: Nhà văn hoá thôn" />
          </Form.Item>
          <Form.Item name="description" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
          {editing === 'new' && (
            <Form.Item name="push" valuePropName="checked">
              <Checkbox>Gửi thông báo đẩy tới người dân</Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Space>
  );
}

// ---------------------------------------------------------------------------
// Địa điểm
// ---------------------------------------------------------------------------
function VenuesTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Venue | 'new' | null>(null);
  const [form] = Form.useForm<{ name: string; description?: string; sort_order?: number; is_active: boolean }>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => rows(await supabase.from('venues').select('*').order('sort_order')) as Venue[],
  });

  const save = useMutation({
    mutationFn: async (v: { name: string; description?: string; sort_order?: number; is_active: boolean }) => {
      const payload = { name: v.name.trim(), description: v.description?.trim() || null, sort_order: v.sort_order ?? 0, is_active: v.is_active };
      if (editing === 'new') must(await supabase.from('venues').insert(payload));
      else if (editing) must(await supabase.from('venues').update(payload).eq('id', editing.id));
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['venues'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ is_active: true }); setEditing('new'); }}>
        Thêm địa điểm
      </Button>
      <Table<Venue>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        columns={[
          { title: 'Tên', render: (_, v) => <b>{v.name}</b> },
          { title: 'Mô tả', dataIndex: 'description' },
          { title: 'Cho đặt', width: 100, render: (_, v) => (v.is_active ? <Tag color="green">Có</Tag> : <Tag>Tạm ngưng</Tag>) },
          {
            title: '',
            width: 60,
            render: (_, v) => (
              <Button type="text" icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ ...v, description: v.description ?? undefined }); setEditing(v); }} />
            ),
          },
        ]}
      />
      <Modal title={editing === 'new' ? 'Thêm địa điểm' : 'Sửa địa điểm'} open={!!editing} onCancel={() => setEditing(null)} onOk={() => form.submit()} okText="Lưu" confirmLoading={save.isPending} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label="Tên" rules={[{ required: true, whitespace: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input />
          </Form.Item>
          <Space size={24}>
            <Form.Item name="sort_order" label="Thứ tự">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="is_active" label="Cho đặt lịch" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
