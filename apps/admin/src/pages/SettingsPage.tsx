import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@thon/shared';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/format';
import { must, mustOne, supabase } from '@/lib/supabase';

type Contact = Tables<'contacts'>;

const CATEGORY: Record<string, { label: string; color: string }> = {
  khan_cap: { label: 'Khẩn cấp', color: 'red' },
  can_bo: { label: 'Cán bộ thôn', color: 'blue' },
  y_te: { label: 'Y tế', color: 'green' },
  dich_vu: { label: 'Dịch vụ', color: 'default' },
};

export default function SettingsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [form] = Form.useForm();

  const { data: requireApproval, isLoading: loadingSetting } = useQuery({
    queryKey: ['setting', 'require_approval'],
    queryFn: async () =>
      Boolean(mustOne(await supabase.from('app_settings').select('value').eq('key', 'require_approval').single()).value),
  });

  const toggle = useMutation({
    mutationFn: async (value: boolean) =>
      must(await supabase.from('app_settings').update({ value }).eq('key', 'require_approval').select().single()),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['setting', 'require_approval'] });
      message.success(v ? 'Đã BẬT chế độ chờ duyệt' : 'Đã TẮT chế độ chờ duyệt');
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => must(await supabase.from('contacts').select('*').order('sort_order')) as Contact[],
  });

  const save = useMutation({
    mutationFn: async (v: Pick<Contact, 'name' | 'title' | 'phone' | 'category' | 'sort_order'>) => {
      const payload = { ...v, phone: v.phone.replace(/\s/g, ''), title: v.title || null };
      if (editing === 'new') must(await supabase.from('contacts').insert(payload));
      else if (editing) must(await supabase.from('contacts').update(payload).eq('id', editing.id));
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['contacts'] });
      message.success('Đã lưu');
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('contacts').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card title="Đăng ký tài khoản">
        <Space align="start" size={16}>
          <Switch
            checked={requireApproval}
            loading={loadingSetting || toggle.isPending}
            disabled={!isAdmin}
            onChange={(v) => toggle.mutate(v)}
          />
          <div>
            <Typography.Text strong>Chế độ chờ duyệt</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              <b>Bật:</b> người dân tự khai báo phải chờ cán bộ duyệt mới dùng được app.
              <br />
              <b>Tắt:</b> tự khai báo xong là dùng được ngay. Người có mã kích hoạt luôn vào được ngay.
              {!isAdmin && (
                <>
                  <br />
                  <i>Chỉ Bí thư / Trưởng thôn được thay đổi.</i>
                </>
              )}
            </Typography.Paragraph>
          </div>
        </Space>
      </Card>

      <Card
        title="Danh bạ hiển thị trong app"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ category: 'can_bo', sort_order: 10 }); setEditing('new'); }}>
            Thêm số
          </Button>
        }>
        <Table<Contact>
          rowKey="id"
          size="middle"
          loading={isLoading}
          dataSource={contacts}
          pagination={false}
          columns={[
            { title: 'Tên', dataIndex: 'name', render: (v) => <b>{v}</b> },
            { title: 'Chức danh / mô tả', dataIndex: 'title' },
            { title: 'Số điện thoại', dataIndex: 'phone' },
            { title: 'Nhóm', render: (_, c) => <Tag color={CATEGORY[c.category]?.color}>{CATEGORY[c.category]?.label ?? c.category}</Tag> },
            { title: 'Thứ tự', dataIndex: 'sort_order', width: 80 },
            {
              title: '',
              width: 100,
              render: (_, c) => (
                <Space size={0}>
                  <Button type="text" icon={<EditOutlined />} onClick={() => { form.setFieldsValue(c); setEditing(c); }} />
                  <Popconfirm title={`Xoá ${c.name}?`} okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(c.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title={editing === 'new' ? 'Thêm số điện thoại' : 'Sửa'} open={!!editing} onCancel={() => setEditing(null)}
        onOk={() => form.submit()} confirmLoading={save.isPending} okText="Lưu">
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label="Tên" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="VD: Ông Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="title" label="Chức danh / mô tả">
            <Input placeholder="VD: Bí thư chi bộ, Trạm y tế xã" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, pattern: /^[0-9+\s]{3,15}$/, message: 'Số điện thoại không hợp lệ' }]}>
            <Input />
          </Form.Item>
          <Space>
            <Form.Item name="category" label="Nhóm">
              <Select style={{ width: 160 }} options={Object.entries(CATEGORY).map(([value, c]) => ({ value, label: c.label }))} />
            </Form.Item>
            <Form.Item name="sort_order" label="Thứ tự">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
