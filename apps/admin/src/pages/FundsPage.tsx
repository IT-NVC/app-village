import { DeleteOutlined, DownloadOutlined, EditOutlined, PaperClipOutlined, PhoneOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@thon/shared';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import Papa from 'papaparse';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { useAreas } from '@/lib/data';
import { errMsg, normalize } from '@/lib/format';
import { compressImage } from '@/lib/image';
import { must, rows, supabase } from '@/lib/supabase';

type Fns = Database['public']['Functions'];
type Fund = Fns['fund_summaries']['Returns'][number];
type Tx = Fns['fund_transactions_view']['Returns'][number];
const BUCKET = 'fund-receipts';

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;
const moneyFormatter = (v?: string | number) => (v === undefined || v === '' ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
const moneyParser = (v?: string) => Number((v ?? '').replace(/\./g, '').replace(/\D/g, '')) || 0;

export default function FundsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Fund | 'new' | null>(null);
  const [selected, setSelected] = useState<Fund | null>(null);
  const [form] = Form.useForm<{ name: string; description?: string; target_amount?: number | null; is_active: boolean }>();
  const { me } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ['funds'],
    queryFn: async () => rows(await supabase.rpc('fund_summaries')) as Fund[],
  });

  const save = useMutation({
    mutationFn: async (v: { name: string; description?: string; target_amount?: number | null; is_active: boolean }) => {
      const payload = { name: v.name.trim(), description: v.description?.trim() || null, target_amount: v.target_amount || null, is_active: v.is_active };
      if (editing === 'new') must(await supabase.from('funds').insert({ ...payload, created_by: me?.id ?? null }));
      else if (editing) must(await supabase.from('funds').update(payload).eq('id', editing.id));
    },
    onSuccess: () => {
      message.success('Đã lưu quỹ');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['funds'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('funds').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá quỹ');
      qc.invalidateQueries({ queryKey: ['funds'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Card
      title="Quỹ thôn — công khai thu chi"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ is_active: true }); setEditing('new'); }}>
          Tạo quỹ
        </Button>
      }>
      <Typography.Paragraph type="secondary">
        Mọi người dân đều xem được số dư, từng khoản thu chi, ảnh chứng từ và danh sách hộ đã đóng góp trên app. Mọi thêm / sửa / xoá đều được
        ghi vào <b>Nhật ký thao tác</b>.
      </Typography.Paragraph>
      <Table<Fund>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        locale={{ emptyText: <Empty description="Chưa có quỹ nào" /> }}
        onRow={(f) => ({ onClick: () => setSelected(f), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Quỹ',
            render: (_, f) => (
              <Space orientation="vertical" size={2}>
                <b>{f.name}</b>
                {!f.is_active && <Tag>Đã kết thúc</Tag>}
              </Space>
            ),
          },
          { title: 'Tổng thu', width: 150, render: (_, f) => <Typography.Text type="success">{vnd(f.total_thu)}</Typography.Text> },
          { title: 'Tổng chi', width: 150, render: (_, f) => <Typography.Text type="danger">{vnd(f.total_chi)}</Typography.Text> },
          { title: 'Số dư', width: 160, render: (_, f) => <b>{vnd(f.balance)}</b> },
          {
            title: 'Mục tiêu',
            width: 180,
            render: (_, f) =>
              f.target_amount ? (
                <Progress percent={Math.min(100, Math.round((f.total_thu / f.target_amount) * 100))} size="small" strokeColor="#3BA56A" />
              ) : (
                '—'
              ),
          },
          { title: 'Hộ góp', width: 80, dataIndex: 'households' },
          {
            title: '',
            width: 90,
            render: (_, f) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    form.setFieldsValue({ name: f.name, description: f.description ?? undefined, target_amount: f.target_amount, is_active: f.is_active });
                    setEditing(f);
                  }}
                />
                <Popconfirm
                  title={`Xoá quỹ "${f.name}"?`}
                  description="Toàn bộ thu chi của quỹ sẽ bị xoá. Chỉ nên xoá quỹ tạo nhầm."
                  okText="Xoá"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove.mutate(f.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      <Modal title={editing === 'new' ? 'Tạo quỹ' : 'Sửa quỹ'} open={!!editing} onCancel={() => setEditing(null)} onOk={() => form.submit()} okText="Lưu" confirmLoading={save.isPending} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
          <Form.Item name="name" label="Tên quỹ" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="VD: Quỹ bê tông hoá ngõ 3, Quỹ khuyến học" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mục đích, mức đóng góp đề nghị mỗi hộ…" />
          </Form.Item>
          <Form.Item name="target_amount" label="Mục tiêu vận động (không bắt buộc)">
            <InputNumber<number> style={{ width: 240 }} min={0} step={1000000} formatter={moneyFormatter} parser={moneyParser} addonAfter="đ" />
          </Form.Item>
          <Form.Item name="is_active" label="Đang hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <FundDrawer fund={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

type TxForm = {
  kind: 'thu' | 'chi';
  amount: number;
  occurred_on: Dayjs;
  description: string;
  household_id?: string | null;
  payer_name?: string;
  receipt_path?: string | null;
};

function FundDrawer({ fund, onClose }: { fund: Fund | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { me } = useAuth();
  const { data: areas = [] } = useAreas();
  const [editing, setEditing] = useState<Tx | 'new' | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm<TxForm>();
  const kind = Form.useWatch('kind', form);
  const receipt = Form.useWatch('receipt_path', form);

  const enabled = !!fund;
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ['fund-tx', fund?.id],
    enabled,
    queryFn: async () => rows(await supabase.rpc('fund_transactions_view', { p_fund_id: fund!.id })) as Tx[],
  });
  const { data: receiptUrls = {} } = useQuery({
    queryKey: ['fund-receipts', fund?.id, txs.length],
    enabled: enabled && txs.some((t) => t.receipt_path),
    queryFn: async () => {
      const paths = txs.map((t) => t.receipt_path).filter((p): p is string => !!p);
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      return Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl]));
    },
  });
  const { data: contribs = [] } = useQuery({
    queryKey: ['fund-contrib', fund?.id],
    enabled,
    queryFn: async () => rows(await supabase.rpc('fund_household_contributions', { p_fund_id: fund!.id })),
  });
  const { data: missing = [] } = useQuery({
    queryKey: ['fund-missing', fund?.id, areaFilter],
    enabled,
    queryFn: async () => rows(await supabase.rpc('fund_missing_households', { p_fund_id: fund!.id, p_area_id: areaFilter ?? undefined })),
  });
  const { data: households = [] } = useQuery({
    queryKey: ['household-options'],
    enabled,
    queryFn: async () => rows(await supabase.rpc('household_options')),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['fund-tx', fund?.id] });
    qc.invalidateQueries({ queryKey: ['fund-contrib', fund?.id] });
    qc.invalidateQueries({ queryKey: ['fund-missing', fund?.id] });
    qc.invalidateQueries({ queryKey: ['funds'] });
  };

  const save = useMutation({
    mutationFn: async (v: TxForm) => {
      const payload = {
        kind: v.kind,
        amount: v.amount,
        occurred_on: v.occurred_on.format('YYYY-MM-DD'),
        description: v.description.trim(),
        household_id: v.kind === 'thu' ? v.household_id || null : null,
        payer_name: v.payer_name?.trim() || null,
        receipt_path: v.receipt_path || null,
      };
      if (editing === 'new') must(await supabase.from('fund_transactions').insert({ ...payload, fund_id: fund!.id, created_by: me!.id }));
      else if (editing) must(await supabase.from('fund_transactions').update(payload).eq('id', editing.id));
    },
    onSuccess: () => {
      message.success('Đã lưu');
      setEditing(null);
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('fund_transactions').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá (nhật ký vẫn lưu lại)');
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const blob = await compressImage(file, 1800);
      const path = `${fund!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      must(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
      form.setFieldValue('receipt_path', path);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  function open(t: Tx | 'new') {
    setEditing(t);
    form.resetFields();
    if (t === 'new') form.setFieldsValue({ kind: 'thu', occurred_on: dayjs(), receipt_path: null });
    else
      form.setFieldsValue({
        kind: t.kind,
        amount: t.amount,
        occurred_on: dayjs(t.occurred_on),
        description: t.description,
        household_id: t.household_id,
        payer_name: t.payer_name ?? undefined,
        receipt_path: t.receipt_path,
      });
  }

  function exportCsv() {
    const csv =
      '﻿' +
      Papa.unparse([
        ['Ngày', 'Loại', 'Số tiền (đ)', 'Nội dung', 'Hộ / Người nộp'],
        ...txs.map((t) => [dayjs(t.occurred_on).format('DD/MM/YYYY'), t.kind === 'thu' ? 'Thu' : 'Chi', t.kind === 'thu' ? t.amount : -t.amount, t.description, t.household_label ?? t.payer_name ?? '']),
        [],
        ['', 'Tổng thu', fund?.total_thu],
        ['', 'Tổng chi', fund?.total_chi],
        ['', 'Số dư', fund?.balance],
      ]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${normalize(fund?.name ?? 'quy').replace(/\s+/g, '-')}-${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Drawer title={fund?.name} open={!!fund} onClose={onClose} size={900} destroyOnHidden>
      {fund && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="Tổng thu" value={fund.total_thu} suffix="đ" groupSeparator="." styles={{ content: { color: '#2E7D32' } }} />
            </Col>
            <Col span={8}>
              <Statistic title="Tổng chi" value={fund.total_chi} suffix="đ" groupSeparator="." styles={{ content: { color: '#D32F2F' } }} />
            </Col>
            <Col span={8}>
              <Statistic title="Số dư" value={fund.balance} suffix="đ" groupSeparator="." styles={{ content: { fontWeight: 700 } }} />
            </Col>
          </Row>
          <Tabs
            items={[
              {
                key: 'tx',
                label: `Thu chi (${txs.length})`,
                children: (
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>
                        Ghi thu / chi
                      </Button>
                      <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={txs.length === 0}>
                        Xuất Excel (CSV) để in công khai
                      </Button>
                    </Space>
                    <Table<Tx>
                      rowKey="id"
                      size="small"
                      loading={isLoading}
                      dataSource={txs}
                      pagination={{ pageSize: 50, hideOnSinglePage: true }}
                      columns={[
                        { title: 'Ngày', width: 100, render: (_, t) => dayjs(t.occurred_on).format('DD/MM/YYYY') },
                        {
                          title: 'Số tiền',
                          width: 150,
                          render: (_, t) => (
                            <Typography.Text type={t.kind === 'thu' ? 'success' : 'danger'} strong>
                              {t.kind === 'thu' ? '+' : '−'} {vnd(t.amount)}
                            </Typography.Text>
                          ),
                        },
                        {
                          title: 'Nội dung',
                          render: (_, t) => (
                            <Space orientation="vertical" size={0}>
                              <span>{t.description}</span>
                              {(t.household_label || t.payer_name) && <Typography.Text type="secondary">{t.household_label ?? t.payer_name}</Typography.Text>}
                            </Space>
                          ),
                        },
                        {
                          title: 'Chứng từ',
                          width: 90,
                          render: (_, t) =>
                            t.receipt_path && receiptUrls[t.receipt_path] ? (
                              <Image src={receiptUrls[t.receipt_path]} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />
                            ) : null,
                        },
                        {
                          title: '',
                          width: 90,
                          render: (_, t) => (
                            <Space size={0}>
                              <Button type="text" icon={<EditOutlined />} onClick={() => open(t)} />
                              <Popconfirm title="Xoá khoản này?" description="Nhật ký vẫn lưu lại khoản đã xoá." okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(t.id)}>
                                <Button type="text" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Space>
                ),
              },
              {
                key: 'contrib',
                label: `Hộ đã đóng góp (${contribs.length})`,
                children: (
                  <Table
                    rowKey="household_id"
                    size="small"
                    dataSource={contribs}
                    pagination={{ pageSize: 50, hideOnSinglePage: true }}
                    columns={[
                      { title: 'Chủ hộ', render: (_, c) => <b>{c.head_name}</b> },
                      { title: 'Mã hộ', dataIndex: 'code', width: 100 },
                      { title: 'Khu', dataIndex: 'area_name', width: 100 },
                      { title: 'Số lần', dataIndex: 'times', width: 80 },
                      { title: 'Tổng', width: 150, render: (_, c) => <b>{vnd(c.total)}</b> },
                    ]}
                  />
                ),
              },
              {
                key: 'missing',
                label: `Chưa đóng góp (${missing.length})`,
                children: (
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Space>
                      <Typography.Text type="secondary">Chỉ cán bộ thấy danh sách này — dùng để đi vận động.</Typography.Text>
                      <Select allowClear placeholder="Tất cả khu" style={{ width: 160 }} value={areaFilter} onChange={(v) => setAreaFilter(v ?? null)} options={areas.map((a) => ({ value: a.id, label: a.name }))} />
                    </Space>
                    <Table
                      rowKey="household_id"
                      size="small"
                      dataSource={missing}
                      pagination={{ pageSize: 50, hideOnSinglePage: true }}
                      columns={[
                        { title: 'Chủ hộ', render: (_, h) => <b>{h.head_name}</b> },
                        { title: 'Mã hộ', dataIndex: 'code', width: 100 },
                        { title: 'Khu', dataIndex: 'area_name', width: 100 },
                        {
                          title: 'Liên hệ',
                          width: 150,
                          render: (_, h) =>
                            h.phone ? (
                              <a href={`tel:${h.phone}`}>
                                <PhoneOutlined /> {h.phone}
                              </a>
                            ) : (
                              <Typography.Text type="secondary">—</Typography.Text>
                            ),
                        },
                      ]}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}

      <Modal
        title={editing === 'new' ? 'Ghi thu / chi' : 'Sửa khoản thu chi'}
        open={!!editing}
        width={600}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        confirmLoading={save.isPending}
        okButtonProps={{ disabled: uploading }}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
          <Form.Item name="kind" label="Loại">
            <Radio.Group optionType="button" buttonStyle="solid" options={[{ value: 'thu', label: 'Khoản thu' }, { value: 'chi', label: 'Khoản chi' }]} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="amount" label="Số tiền" rules={[{ required: true, type: 'number', min: 1, message: 'Nhập số tiền' }]}>
              <InputNumber<number> style={{ width: 220 }} min={1} step={10000} formatter={moneyFormatter} parser={moneyParser} addonAfter="đ" />
            </Form.Item>
            <Form.Item name="occurred_on" label="Ngày" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs())} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Nội dung" rules={[{ required: true, whitespace: true, message: 'Nhập nội dung' }]}>
            <Input placeholder={kind === 'chi' ? 'VD: Mua 50 bao xi măng' : 'VD: Đóng góp làm đường đợt 1'} />
          </Form.Item>
          {kind === 'thu' && (
            <Form.Item name="household_id" label="Hộ đóng góp" extra="Chọn hộ để hiện trong danh sách hộ đã đóng góp.">
              <Select
                allowClear
                placeholder="Tìm theo tên chủ hộ, mã hộ…"
                showSearch={{ filterOption: (input, opt) => normalize(String(opt?.label ?? '')).includes(normalize(input)) }}
                options={households.map((h) => ({ value: h.id, label: `${h.head_name}${h.code ? ` (${h.code})` : ''}${h.area_name ? ` · ${h.area_name}` : ''}` }))}
              />
            </Form.Item>
          )}
          <Form.Item name="payer_name" label={kind === 'chi' ? 'Người nhận / nơi bán' : 'Người nộp (nếu không thuộc hộ nào)'}>
            <Input />
          </Form.Item>
          <Form.Item label="Ảnh chứng từ (phiếu thu, hoá đơn)">
            <Space>
              <Upload accept="image/*" showUploadList={false} beforeUpload={(f) => { upload(f); return false; }}>
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {receipt ? 'Đổi ảnh' : 'Tải ảnh lên'}
                </Button>
              </Upload>
              {receipt && (
                <>
                  <Tag icon={<PaperClipOutlined />} color="green">
                    Đã đính kèm
                  </Tag>
                  <Button type="link" danger onClick={() => form.setFieldValue('receipt_path', null)}>
                    Bỏ ảnh
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
          <Form.Item name="receipt_path" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}
