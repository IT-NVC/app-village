import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined, PushpinFilled, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@thon/shared';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { errMsg, fmtDateTime } from '@/lib/format';
import { compressImage } from '@/lib/image';
import { must, rows, supabase } from '@/lib/supabase';

type News = Tables<'news'>;

type FormValues = {
  title: string;
  summary?: string;
  content: string;
  cover_url?: string | null;
  is_published: boolean;
  is_pinned: boolean;
};

export default function NewsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { me } = useAuth();
  const [editing, setEditing] = useState<News | 'new' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const cover = Form.useWatch('cover_url', form);

  const { data = [], isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: async () =>
      rows(
        await supabase
          .from('news')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(300),
      ) as News[],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['news'] });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const existing = editing === 'new' ? null : editing;
      const payload = {
        title: v.title.trim(),
        summary: v.summary?.trim() || null,
        content: v.content.trim(),
        cover_url: v.cover_url || null,
        is_published: v.is_published,
        is_pinned: v.is_pinned,
        // Lần đầu đăng thì ghi thời điểm đăng; gỡ đăng thì giữ nguyên để đăng lại không đổi thứ tự cũ
        published_at: v.is_published ? (existing?.published_at ?? new Date().toISOString()) : (existing?.published_at ?? null),
      };
      if (!existing) must(await supabase.from('news').insert({ ...payload, author_id: me?.id ?? null }));
      else must(await supabase.from('news').update(payload).eq('id', existing.id));
    },
    onSuccess: (_d, v) => {
      message.success(v.is_published ? 'Đã đăng tin — người dân thấy ngay trên app' : 'Đã lưu bản nháp');
      setEditing(null);
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const quickUpdate = useMutation({
    mutationFn: async (v: { row: News; patch: Partial<News> }) => {
      const patch = { ...v.patch };
      if (patch.is_published && !v.row.published_at) patch.published_at = new Date().toISOString();
      must(await supabase.from('news').update(patch).eq('id', v.row.id));
    },
    onSuccess: refresh,
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('news').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá tin');
      refresh();
    },
    onError: (e) => message.error(errMsg(e)),
  });

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      must(await supabase.storage.from('news').upload(path, blob, { contentType: 'image/jpeg' }));
      const url = supabase.storage.from('news').getPublicUrl(path).data.publicUrl;
      form.setFieldValue('cover_url', url);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  function openEditor(n: News | 'new') {
    setEditing(n);
    form.resetFields();
    if (n === 'new') form.setFieldsValue({ is_published: true, is_pinned: false, cover_url: null });
    else
      form.setFieldsValue({
        title: n.title,
        summary: n.summary ?? undefined,
        content: n.content,
        cover_url: n.cover_url,
        is_published: n.is_published,
        is_pinned: n.is_pinned,
      });
  }

  return (
    <Card
      title="Tin tức"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor('new')}>
          Viết tin
        </Button>
      }>
      <Table<News>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 850 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Chưa có tin nào" /> }}
        columns={[
          {
            title: '',
            width: 96,
            render: (_, n) =>
              n.cover_url ? (
                <Image src={n.cover_url} width={80} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <div style={{ width: 80, height: 56, borderRadius: 6, background: '#eef2ef', display: 'grid', placeItems: 'center' }}>
                  <PictureOutlined style={{ color: '#a0aaa4' }} />
                </div>
              ),
          },
          {
            title: 'Tin',
            render: (_, n) => (
              <Space orientation="vertical" size={2}>
                <Space size={6}>
                  {n.is_pinned && <PushpinFilled style={{ color: '#B26A00' }} />}
                  <b>{n.title}</b>
                </Space>
                {n.summary && (
                  <Typography.Text type="secondary" ellipsis style={{ maxWidth: 440 }}>
                    {n.summary}
                  </Typography.Text>
                )}
              </Space>
            ),
          },
          {
            title: 'Trạng thái',
            width: 130,
            render: (_, n) => (n.is_published ? <Tag color="green">Đã đăng</Tag> : <Tag>Bản nháp</Tag>),
          },
          { title: 'Ngày đăng', width: 150, render: (_, n) => fmtDateTime(n.published_at) || '—' },
          {
            title: 'Đăng',
            width: 70,
            render: (_, n) => (
              <Switch size="small" checked={n.is_published} onChange={(v) => quickUpdate.mutate({ row: n, patch: { is_published: v } })} />
            ),
          },
          {
            title: 'Ghim',
            width: 70,
            render: (_, n) => (
              <Switch size="small" checked={n.is_pinned} onChange={(v) => quickUpdate.mutate({ row: n, patch: { is_pinned: v } })} />
            ),
          },
          {
            title: '',
            width: 90,
            fixed: 'right',
            render: (_, n) => (
              <Space size={0}>
                <Button type="text" icon={<EditOutlined />} onClick={() => openEditor(n)} />
                <Popconfirm title="Xoá tin này?" okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(n.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing === 'new' ? 'Viết tin mới' : 'Sửa tin'}
        open={!!editing}
        width={760}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        confirmLoading={save.isPending}
        okButtonProps={{ disabled: uploading }}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề' }]}>
            <Input maxLength={150} showCount placeholder="VD: Thôn tổ chức ra quân làm sạch đường làng" />
          </Form.Item>
          <Form.Item name="summary" label="Tóm tắt" extra="1–2 câu, hiện dưới tiêu đề trong danh sách tin.">
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Form.Item label="Ảnh bìa">
            <Space align="start" size={16}>
              {cover ? (
                <Image src={cover} width={200} height={130} style={{ objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 200, height: 130, borderRadius: 8, background: '#eef2ef', display: 'grid', placeItems: 'center' }}>
                  <PictureOutlined style={{ fontSize: 28, color: '#a0aaa4' }} />
                </div>
              )}
              <Space orientation="vertical">
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    uploadCover(file);
                    return false;
                  }}>
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    {cover ? 'Đổi ảnh' : 'Tải ảnh lên'}
                  </Button>
                </Upload>
                {cover && (
                  <Button type="link" danger style={{ padding: 0 }} onClick={() => form.setFieldValue('cover_url', null)}>
                    Bỏ ảnh
                  </Button>
                )}
                <Typography.Text type="secondary">Ảnh ngang đẹp nhất. Tự động thu nhỏ.</Typography.Text>
              </Space>
            </Space>
          </Form.Item>
          <Form.Item name="cover_url" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="content"
            label="Nội dung"
            rules={[{ required: true, whitespace: true, message: 'Nhập nội dung' }]}
            extra="Để một dòng trống giữa các đoạn văn.">
            <Input.TextArea rows={12} />
          </Form.Item>
          <Space size={32}>
            <Form.Item name="is_published" label="Đăng ngay" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item name="is_pinned" label="Ghim lên đầu" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
