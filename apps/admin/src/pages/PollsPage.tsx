import { DeleteOutlined, MinusCircleOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@thon/shared';
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
import { must, notify, rows, supabase } from '@/lib/supabase';

type Poll = Database['public']['Tables']['polls']['Row'];
type Result = Database['public']['Functions']['poll_results']['Returns'][number];
type Row = Poll & { voters: number; eligible: number };

const isOpen = (p: Poll) => !p.closed_at && (!p.closes_at || dayjs(p.closes_at).isAfter(dayjs()));

type FormValues = {
  title: string;
  description?: string;
  options: string[];
  allow_multiple: boolean;
  is_anonymous: boolean;
  vote_scope: 'person' | 'household';
  mode: 'all' | 'custom';
  area_ids?: string[];
  org_ids?: string[];
  closes_at?: Dayjs;
};

async function loadPolls(): Promise<Row[]> {
  const polls = rows(await supabase.from('polls').select('*').order('created_at', { ascending: false }).limit(200)) as Poll[];
  return Promise.all(
    polls.map(async (p) => {
      const [r, e] = await Promise.all([
        supabase.rpc('poll_results', { p_poll_id: p.id }),
        supabase.rpc('poll_eligible_count', { p_poll_id: p.id }),
      ]);
      return { ...p, voters: r.data?.[0]?.voters ?? 0, eligible: (e.data as number | null) ?? 0 };
    }),
  );
}

export default function PollsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: areas = [] } = useAreas();
  const { data: orgs = [] } = useOrganizations();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [form] = Form.useForm<FormValues>();
  const mode = Form.useWatch('mode', form);

  const { data = [], isLoading } = useQuery({ queryKey: ['polls'], queryFn: loadPolls, refetchInterval: 60_000 });

  const create = useMutation({
    mutationFn: async (v: FormValues) =>
      must(
        await supabase.rpc('create_poll', {
          p_title: v.title,
          p_description: v.description,
          p_options: v.options,
          p_allow_multiple: v.allow_multiple,
          p_is_anonymous: v.is_anonymous,
          p_vote_scope: v.vote_scope,
          p_closes_at: v.closes_at ? v.closes_at.toISOString() : undefined,
          p_target_all: v.mode === 'all',
          p_area_ids: v.mode === 'all' ? [] : (v.area_ids ?? []),
          p_org_ids: v.mode === 'all' ? [] : (v.org_ids ?? []),
        }),
      ),
    onSuccess: (id) => {
      if (id) notify('poll', id as string);
      message.success('Đã tạo khảo sát — bà con thấy ngay trên app');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('polls').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá khảo sát');
      qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Card
      title="Khảo sát / Biểu quyết"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ options: ['', ''], allow_multiple: false, is_anonymous: false, vote_scope: 'person', mode: 'all' });
            setOpen(true);
          }}>
          Tạo khảo sát
        </Button>
      }>
      <Table<Row>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Chưa có khảo sát nào" /> }}
        onRow={(r) => ({ onClick: () => setViewing(r), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Câu hỏi',
            render: (_, p) => (
              <Space orientation="vertical" size={2}>
                <b>{p.title}</b>
                <Space size={4} wrap>
                  {isOpen(p) ? <Tag color="green">Đang mở</Tag> : <Tag>Đã đóng</Tag>}
                  {p.vote_scope === 'household' && <Tag color="gold">Mỗi hộ 1 phiếu</Tag>}
                  {p.is_anonymous && <Tag color="purple">Ẩn danh</Tag>}
                  {p.allow_multiple && <Tag color="blue">Chọn nhiều</Tag>}
                </Space>
              </Space>
            ),
          },
          {
            title: 'Tham gia',
            width: 200,
            render: (_, p) => (
              <Space orientation="vertical" size={0} style={{ width: '100%' }}>
                <Progress percent={p.eligible ? Math.round((p.voters / p.eligible) * 100) : 0} size="small" strokeColor="#3BA56A" />
                <Typography.Text type="secondary">
                  {p.voters}/{p.eligible} {p.vote_scope === 'household' ? 'hộ' : 'người'}
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Thời hạn',
            width: 160,
            render: (_, p) => (p.closed_at ? `Đóng ${fmtDateTime(p.closed_at)}` : p.closes_at ? fmtDateTime(p.closes_at) : 'Không thời hạn'),
          },
          {
            title: '',
            width: 60,
            render: (_, p) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Popconfirm title="Xoá khảo sát này?" description="Toàn bộ phiếu bầu sẽ bị xoá." okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(p.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      <Modal
        title="Tạo khảo sát"
        open={open}
        width={680}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Tạo và gửi"
        confirmLoading={create.isPending}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)} requiredMark={false}>
          <Form.Item name="title" label="Câu hỏi" rules={[{ required: true, whitespace: true, message: 'Nhập câu hỏi' }]}>
            <Input placeholder="VD: Bà con có đồng ý góp tiền bê tông hoá ngõ 3 không?" maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="description" label="Giải thích thêm">
            <Input.TextArea rows={3} placeholder="Kinh phí dự kiến, mức đóng góp mỗi hộ, thời gian thi công…" />
          </Form.Item>
          <Form.List
            name="options"
            rules={[{ validator: async (_, v: string[]) => ((v ?? []).filter((x) => x?.trim()).length >= 2 ? undefined : Promise.reject(new Error('Cần ít nhất 2 phương án'))) }]}>
            {(fields, { add, remove: rm }, { errors }) => (
              <Form.Item label="Phương án">
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {fields.map((f, i) => (
                    <Space key={f.key} style={{ display: 'flex' }} align="baseline">
                      <Form.Item {...f} noStyle>
                        <Input placeholder={`Phương án ${i + 1}`} style={{ width: 480 }} />
                      </Form.Item>
                      {fields.length > 2 && <MinusCircleOutlined onClick={() => rm(f.name)} style={{ color: '#999' }} />}
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add('')} disabled={fields.length >= 10}>
                    Thêm phương án
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Space>
              </Form.Item>
            )}
          </Form.List>
          <Form.Item name="vote_scope" label="Tính phiếu theo">
            <Radio.Group
              options={[
                { value: 'person', label: 'Mỗi người 1 phiếu' },
                { value: 'household', label: 'Mỗi hộ 1 phiếu (người đầu tiên trong hộ bỏ phiếu)' },
              ]}
            />
          </Form.Item>
          <Space size={24}>
            <Form.Item name="allow_multiple" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Cho chọn nhiều phương án</Checkbox>
            </Form.Item>
            <Form.Item name="is_anonymous" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Ẩn danh (cán bộ không xem được ai chọn gì)</Checkbox>
            </Form.Item>
          </Space>
          <Form.Item name="closes_at" label="Hạn chót (để trống = không thời hạn)">
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" disabledDate={(d) => d.isBefore(dayjs(), 'day')} style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="mode" label="Ai được tham gia">
            <Radio.Group options={[{ value: 'all', label: 'Toàn thôn' }, { value: 'custom', label: 'Chọn khu / ban ngành' }]} />
          </Form.Item>
          {mode === 'custom' && (
            <Space style={{ display: 'flex' }} align="start">
              <Form.Item name="area_ids" label="Khu">
                <Select mode="multiple" allowClear style={{ width: 280 }} options={areas.map((a) => ({ value: a.id, label: a.name }))} />
              </Form.Item>
              <Form.Item name="org_ids" label="Ban ngành">
                <Select mode="multiple" allowClear style={{ width: 280 }} options={orgs.map((o) => ({ value: o.id, label: o.name }))} />
              </Form.Item>
            </Space>
          )}
        </Form>
      </Modal>

      <PollDrawer row={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

function PollDrawer({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: results = [] } = useQuery({
    queryKey: ['poll-results', row?.id],
    enabled: !!row,
    refetchInterval: 15_000,
    queryFn: async () => rows(await supabase.rpc('poll_results', { p_poll_id: row!.id })) as Result[],
  });
  const { data: voters = [] } = useQuery({
    queryKey: ['poll-voters', row?.id],
    enabled: !!row && !row.is_anonymous,
    queryFn: async () => rows(await supabase.rpc('poll_voters', { p_poll_id: row!.id })),
  });

  const close = useMutation({
    mutationFn: async () => must(await supabase.rpc('close_poll', { p_poll_id: row!.id })),
    onSuccess: () => {
      message.success('Đã đóng khảo sát');
      qc.invalidateQueries({ queryKey: ['polls'] });
      onClose();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const total = results.reduce((n, r) => n + r.votes, 0);
  const max = Math.max(0, ...results.map((r) => r.votes));

  return (
    <Drawer
      title={row?.title}
      open={!!row}
      onClose={onClose}
      size={640}
      destroyOnHidden
      extra={
        row && isOpen(row) ? (
          <Popconfirm title="Đóng khảo sát ngay?" description="Bà con sẽ không bỏ phiếu được nữa." okText="Đóng" onConfirm={() => close.mutate()}>
            <Button danger icon={<StopOutlined />}>
              Đóng khảo sát
            </Button>
          </Popconfirm>
        ) : null
      }>
      {row && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {row.description && <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.description}</Typography.Paragraph>}
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Trạng thái">{isOpen(row) ? <Tag color="green">Đang mở</Tag> : <Tag>Đã đóng</Tag>}</Descriptions.Item>
            <Descriptions.Item label="Tham gia">
              {results[0]?.voters ?? 0}/{row.eligible} {row.vote_scope === 'household' ? 'hộ' : 'người'}
            </Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Kết quả
          </Typography.Title>
          {results.map((r) => (
            <div key={r.option_id}>
              <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{r.label}</b>
                <span>{r.votes} phiếu</span>
              </Space>
              <Progress
                percent={total ? Math.round((r.votes / total) * 100) : 0}
                strokeColor={r.votes > 0 && r.votes === max ? '#3BA56A' : '#9CCFB0'}
              />
            </div>
          ))}
          {row.is_anonymous ? (
            <Typography.Text type="secondary">Khảo sát ẩn danh — không hiển thị ai chọn gì.</Typography.Text>
          ) : (
            <>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Người đã bỏ phiếu ({new Set(voters.map((v) => v.user_id)).size})
              </Typography.Title>
              <Table
                rowKey={(v) => `${v.user_id}-${v.option_label}`}
                size="small"
                dataSource={voters}
                pagination={{ pageSize: 50, hideOnSinglePage: true }}
                columns={[
                  { title: 'Họ tên', dataIndex: 'full_name' },
                  { title: 'Khu', dataIndex: 'area_name', width: 90 },
                  { title: 'Chọn', dataIndex: 'option_label' },
                  { title: 'Lúc', width: 140, render: (_, v) => fmtDateTime(v.voted_at) },
                ]}
              />
            </>
          )}
        </Space>
      )}
    </Drawer>
  );
}
