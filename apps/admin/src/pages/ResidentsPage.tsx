import { DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_STATUS_LABEL, GENDER_LABEL, type AccountStatus } from '@thon/shared';
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { ImportResidentsModal } from '@/components/ImportResidentsModal';
import { useAreas } from '@/lib/data';
import { errMsg, fmtDate, normalize } from '@/lib/format';
import { ensureHousehold } from '@/lib/households';
import { fetchAll, must, one, supabase } from '@/lib/supabase';

type ResidentRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: 'nam' | 'nu' | 'khac' | null;
  phone: string | null;
  note: string | null;
  area_id: string | null;
  area_name: string | null;
  household_code: string | null;
  activation_code: string | null;
  activation_expires_at: string | null;
  source: string;
  account: { id: string; status: AccountStatus; username: string | null } | null;
};

async function loadResidents(): Promise<ResidentRow[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('residents')
      .select(
        'id, full_name, birth_date, gender, phone, note, area_id, activation_code, activation_expires_at, source, areas(name), households(code), profiles(id, status, username)',
      )
      .order('full_name')
      .range(from, to),
  );
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    birth_date: r.birth_date,
    gender: r.gender,
    phone: r.phone,
    note: r.note,
    area_id: r.area_id,
    area_name: one(r.areas)?.name ?? null,
    household_code: one(r.households)?.code ?? null,
    activation_code: r.activation_code,
    activation_expires_at: r.activation_expires_at,
    source: r.source,
    account: one(r.profiles),
  }));
}

type FormValues = {
  full_name: string;
  birth_date?: Dayjs | null;
  gender?: 'nam' | 'nu' | 'khac' | null;
  phone?: string;
  area_id: string;
  household_code?: string;
  note?: string;
};

const statusColor: Record<AccountStatus, string> = {
  active: 'green',
  pending: 'gold',
  unverified: 'default',
  rejected: 'red',
  locked: 'red',
};

export default function ResidentsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: areas = [] } = useAreas();
  const { data = [], isLoading } = useQuery({ queryKey: ['residents'], queryFn: loadResidents });

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<'all' | 'has' | 'none'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ResidentRow | 'new' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const filtered = useMemo(() => {
    const q = normalize(search);
    return data.filter(
      (r) =>
        (!q || normalize(r.full_name).includes(q) || (r.phone ?? '').includes(q) || (r.household_code ?? '').toLowerCase().includes(q)) &&
        (!areaFilter || r.area_id === areaFilter) &&
        (accountFilter === 'all' || (accountFilter === 'has' ? !!r.account : !r.account)),
    );
  }, [data, search, areaFilter, accountFilter]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['residents'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const household_id = await ensureHousehold(v.household_code, v.full_name, v.area_id);
      const payload = {
        full_name: v.full_name.trim().replace(/\s+/g, ' '),
        birth_date: v.birth_date ? v.birth_date.format('YYYY-MM-DD') : null,
        gender: v.gender ?? null,
        phone: v.phone?.replace(/\s/g, '') || null,
        area_id: v.area_id,
        household_id,
        note: v.note?.trim() || null,
      };
      if (editing === 'new') must(await supabase.from('residents').insert({ ...payload, source: 'import' }));
      else if (editing) must(await supabase.from('residents').update(payload).eq('id', editing.id));
    },
    onSuccess: () => {
      message.success(editing === 'new' ? 'Đã thêm nhân khẩu, đã có mã kích hoạt' : 'Đã lưu');
      setEditing(null);
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const regen = useMutation({
    mutationFn: async (id: string) => must(await supabase.rpc('regenerate_activation_code', { p_resident_id: id })),
    onSuccess: (code) => {
      message.success(`Mã mới: ${code}`);
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('residents').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá');
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  function openForm(r: ResidentRow | 'new') {
    setEditing(r);
    form.resetFields();
    if (r !== 'new') {
      form.setFieldsValue({
        full_name: r.full_name,
        birth_date: r.birth_date ? dayjs(r.birth_date) : null,
        gender: r.gender,
        phone: r.phone ?? undefined,
        area_id: r.area_id ?? undefined,
        household_code: r.household_code ?? undefined,
        note: r.note ?? undefined,
      });
    } else if (areaFilter) {
      form.setFieldsValue({ area_id: areaFilter });
    }
  }

  function printCodes(ids: string[]) {
    if (ids.length === 0) return message.info('Không có ai cần in mã');
    navigate('/in-ma', { state: { ids } });
  }

  const printable = filtered.filter((r) => !r.account && r.activation_code);

  return (
    <Card
      title="Nhân khẩu"
      extra={
        <Space wrap>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Nhập từ Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm('new')}>
            Thêm người
          </Button>
        </Space>
      }>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Tìm tên, SĐT, mã hộ"
          style={{ width: 260 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Tất cả khu"
          style={{ width: 160 }}
          value={areaFilter}
          onChange={(v) => setAreaFilter(v ?? null)}
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
        />
        <Select
          style={{ width: 200 }}
          value={accountFilter}
          onChange={setAccountFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'has', label: 'Đã có tài khoản' },
            { value: 'none', label: 'Chưa có tài khoản' },
          ]}
        />
        <Button
          icon={<PrinterOutlined />}
          onClick={() =>
            printCodes(
              selected.length
                ? data.filter((r) => selected.includes(r.id) && !r.account && r.activation_code).map((r) => r.id)
                : printable.map((r) => r.id),
            )
          }>
          {selected.length ? `In mã ${selected.length} người đã chọn` : `In mã kích hoạt (${printable.length})`}
        </Button>
      </Space>

      <Table<ResidentRow>
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        size="middle"
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 50, showTotal: (t) => `${t} người`, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as string[]) }}
        columns={[
          { title: 'Họ tên', dataIndex: 'full_name', render: (v) => <b>{v}</b> },
          { title: 'Khu', dataIndex: 'area_name', width: 100 },
          { title: 'Ngày sinh', width: 110, render: (_, r) => fmtDate(r.birth_date) },
          { title: 'Giới tính', width: 90, render: (_, r) => (r.gender ? GENDER_LABEL[r.gender] : '') },
          { title: 'SĐT', dataIndex: 'phone', width: 120 },
          { title: 'Mã hộ', dataIndex: 'household_code', width: 100 },
          {
            title: 'Tài khoản / Mã kích hoạt',
            width: 230,
            render: (_, r) =>
              r.account ? (
                <Space size={4}>
                  <Tag color={statusColor[r.account.status]}>{ACCOUNT_STATUS_LABEL[r.account.status]}</Tag>
                  {r.account.username && <Typography.Text type="secondary">@{r.account.username}</Typography.Text>}
                </Space>
              ) : r.activation_code ? (
                <Tooltip title={`Hết hạn ${fmtDate(r.activation_expires_at)}`}>
                  <Typography.Text code copyable style={{ fontSize: 15 }}>
                    {r.activation_code}
                  </Typography.Text>
                </Tooltip>
              ) : (
                <Tag>Chưa có mã</Tag>
              ),
          },
          {
            title: '',
            width: 130,
            fixed: 'right',
            render: (_, r) => (
              <Space size={0}>
                <Tooltip title="Sửa">
                  <Button type="text" icon={<EditOutlined />} onClick={() => openForm(r)} />
                </Tooltip>
                {!r.account && (
                  <Tooltip title="Cấp lại mã kích hoạt">
                    <Button type="text" icon={<ReloadOutlined />} onClick={() => regen.mutate(r.id)} />
                  </Tooltip>
                )}
                {!r.account && (
                  <Popconfirm title={`Xoá ${r.full_name}?`} okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(r.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing === 'new' ? 'Thêm nhân khẩu' : `Sửa: ${editing?.full_name ?? ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        confirmLoading={save.isPending}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="area_id" label="Khu" rules={[{ required: true, message: 'Chọn khu' }]}>
            <Select options={areas.map((a) => ({ value: a.id, label: a.name }))} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="birth_date" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs())} />
            </Form.Item>
            <Form.Item name="gender" label="Giới tính">
              <Select allowClear style={{ width: 120 }} options={Object.entries(GENDER_LABEL).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          </Space>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ pattern: /^0\d{9,10}$/, message: 'SĐT gồm 10–11 số, bắt đầu bằng 0' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="household_code" label="Mã hộ" extra="Người cùng mã hộ thuộc cùng một hộ gia đình. Mã mới sẽ tạo hộ mới.">
            <Input style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <ImportResidentsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </Card>
  );
}
