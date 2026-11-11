import { DeleteOutlined, MessageOutlined, PlusOutlined, StopOutlined, UserAddOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import { useActivePeople } from '@/lib/data';
import { errMsg, fmtDateTime, normalize } from '@/lib/format';
import { must, one, rows, supabase } from '@/lib/supabase';

type GroupType = 'area' | 'org' | 'custom';
const TYPE_TAG: Record<GroupType, { label: string; color: string }> = {
  area: { label: 'Nhóm khu', color: 'green' },
  org: { label: 'Ban ngành', color: 'blue' },
  custom: { label: 'Tuỳ chọn', color: 'purple' },
};

type GroupRow = {
  id: string;
  name: string;
  type: GroupType;
  last_message_at: string | null;
  member_count: number;
};

export default function ChatGroupsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: people = [] } = useActivePeople();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<GroupRow | null>(null);
  const [form] = Form.useForm<{ name: string; members: string[] }>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['chat-groups'],
    queryFn: async (): Promise<GroupRow[]> =>
      rows(
        await supabase
          .from('chat_groups')
          .select('id, name, type, last_message_at, chat_group_members(count)')
          .order('last_message_at', { ascending: false, nullsFirst: false }),
      ).map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        last_message_at: g.last_message_at,
        member_count: (one(g.chat_group_members as unknown as { count: number }[]) ?? { count: 0 }).count,
      })),
  });

  const create = useMutation({
    mutationFn: async (v: { name: string; members: string[] }) =>
      must(await supabase.rpc('create_chat_group', { p_name: v.name.trim(), p_type: 'custom', p_member_ids: v.members ?? [] })),
    onSuccess: () => {
      message.success('Đã tạo nhóm');
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => must(await supabase.from('chat_groups').delete().eq('id', id)),
    onSuccess: () => {
      message.success('Đã xoá nhóm');
      qc.invalidateQueries({ queryKey: ['chat-groups'] });
    },
    onError: (e) => message.error(errMsg(e)),
  });

  return (
    <Card
      title="Nhóm chat"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreating(true); }}>
          Tạo nhóm tuỳ chọn
        </Button>
      }>
      <Typography.Paragraph type="secondary">
        Nhóm <b>khu</b> và nhóm <b>ban ngành</b> được tạo ở trang "Khu vực & ban ngành" và tự cập nhật thành viên. Nhóm{' '}
        <b>tuỳ chọn</b> (ví dụ: Ban điều hành thôn) thì chọn thành viên thủ công.
      </Typography.Paragraph>
      <Table<GroupRow>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        locale={{ emptyText: <Empty description="Chưa có nhóm nào" /> }}
        onRow={(g) => ({ onClick: () => setSelected(g), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Tên nhóm', render: (_, g) => <b>{g.name}</b> },
          { title: 'Loại', width: 120, render: (_, g) => <Tag color={TYPE_TAG[g.type].color}>{TYPE_TAG[g.type].label}</Tag> },
          { title: 'Thành viên', width: 110, dataIndex: 'member_count' },
          {
            title: 'Hoạt động gần nhất',
            width: 180,
            render: (_, g) => (g.last_message_at ? dayjs(g.last_message_at).fromNow() : <Typography.Text type="secondary">Chưa có tin</Typography.Text>),
          },
          {
            title: '',
            width: 60,
            render: (_, g) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Popconfirm
                  title={`Xoá nhóm "${g.name}"?`}
                  description="Toàn bộ tin nhắn của nhóm sẽ bị xoá vĩnh viễn."
                  okText="Xoá"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove.mutate(g.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      <Modal
        title="Tạo nhóm tuỳ chọn"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() => form.submit()}
        okText="Tạo nhóm"
        confirmLoading={create.isPending}
        destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)} requiredMark={false}>
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true, whitespace: true, message: 'Nhập tên nhóm' }]}>
            <Input placeholder="VD: Ban điều hành thôn" />
          </Form.Item>
          <Form.Item name="members" label="Thành viên" extra="Bạn sẽ tự động là quản trị nhóm.">
            <Select
              mode="multiple"
              placeholder="Tìm và chọn người…"
              showSearch={{ filterOption: (input, opt) => normalize(String(opt?.label ?? '')).includes(normalize(input)) }}
              options={people.map((p) => ({ value: p.id, label: `${p.full_name}${p.area_name ? ` · ${p.area_name}` : ''}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <GroupDrawer group={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

type MemberRow = { user_id: string; role: 'admin' | 'member'; is_muted: boolean; full_name: string; area: string | null };

function GroupDrawer({ group, onClose }: { group: GroupRow | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: people = [] } = useActivePeople();
  const [adding, setAdding] = useState<string[]>([]);

  const membersKey = ['chat-group-members', group?.id];
  const { data: members = [], isLoading } = useQuery({
    queryKey: membersKey,
    enabled: !!group,
    queryFn: async (): Promise<MemberRow[]> =>
      rows(
        await supabase
          .from('chat_group_members')
          .select('user_id, role, is_muted, profiles(username, residents(full_name, areas(name)))')
          .eq('group_id', group!.id),
      )
        .map((m) => {
          const p = one(m.profiles);
          const r = one(p?.residents);
          return {
            user_id: m.user_id,
            role: m.role,
            is_muted: m.is_muted,
            full_name: r?.full_name ?? p?.username ?? '',
            area: one(r?.areas)?.name ?? null,
          };
        })
        .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'admin' ? -1 : 1)),
  });

  const { data: recent = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['chat-group-messages', group?.id],
    enabled: !!group,
    queryFn: async () =>
      rows(
        await supabase
          .from('messages')
          .select('id, sender_id, content, image_path, deleted_at, created_at, profiles(username, residents(full_name))')
          .eq('group_id', group!.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ),
  });

  const nameById = useMemo(() => new Map(members.map((m) => [m.user_id, m.full_name])), [members]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: membersKey });
    qc.invalidateQueries({ queryKey: ['chat-groups'] });
  };

  const run = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e) => message.error(errMsg(e)),
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const custom = group?.type === 'custom';

  return (
    <Drawer title={group?.name} open={!!group} onClose={onClose} size={680} destroyOnHidden>
      {group && (
        <Tabs
          items={[
            {
              key: 'members',
              label: `Thành viên (${members.length})`,
              children: (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  {custom ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Select
                        mode="multiple"
                        style={{ flex: 1 }}
                        placeholder="Thêm người vào nhóm…"
                        value={adding}
                        onChange={setAdding}
                        showSearch={{ filterOption: (input, opt) => normalize(String(opt?.label ?? '')).includes(normalize(input)) }}
                        options={people
                          .filter((p) => !memberIds.has(p.id))
                          .map((p) => ({ value: p.id, label: `${p.full_name}${p.area_name ? ` · ${p.area_name}` : ''}` }))}
                      />
                      <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        disabled={adding.length === 0}
                        onClick={() =>
                          run.mutate(() => supabase.rpc('add_group_members', { p_group_id: group.id, p_user_ids: adding }), {
                            onSuccess: () => setAdding([]),
                          })
                        }>
                        Thêm
                      </Button>
                    </Space.Compact>
                  ) : (
                    <Typography.Text type="secondary">
                      Thành viên tự cập nhật theo {group.type === 'area' ? 'khu' : 'ban ngành'}. Ở đây chỉ chỉnh quyền và khoá chat.
                    </Typography.Text>
                  )}
                  <Table<MemberRow>
                    rowKey="user_id"
                    size="small"
                    loading={isLoading}
                    dataSource={members}
                    pagination={{ pageSize: 50, hideOnSinglePage: true }}
                    columns={[
                      {
                        title: 'Họ tên',
                        render: (_, m) => (
                          <Space orientation="vertical" size={0}>
                            <span>{m.full_name}</span>
                            {m.area && <Typography.Text type="secondary">{m.area}</Typography.Text>}
                          </Space>
                        ),
                      },
                      {
                        title: 'Quản trị',
                        width: 90,
                        render: (_, m) => (
                          <Switch
                            size="small"
                            checked={m.role === 'admin'}
                            onChange={(v) =>
                              run.mutate(() =>
                                supabase.rpc('update_group_member', { p_group_id: group.id, p_user_id: m.user_id, p_role: v ? 'admin' : 'member' }),
                              )
                            }
                          />
                        ),
                      },
                      {
                        title: 'Khoá chat',
                        width: 90,
                        render: (_, m) => (
                          <Switch
                            size="small"
                            checked={m.is_muted}
                            onChange={(v) =>
                              run.mutate(() =>
                                supabase.rpc('update_group_member', { p_group_id: group.id, p_user_id: m.user_id, p_is_muted: v }),
                              )
                            }
                          />
                        ),
                      },
                      ...(custom
                        ? [
                            {
                              title: '',
                              width: 50,
                              render: (_: unknown, m: MemberRow) => (
                                <Popconfirm
                                  title={`Xoá ${m.full_name} khỏi nhóm?`}
                                  okText="Xoá"
                                  onConfirm={() =>
                                    run.mutate(() => supabase.rpc('remove_group_member', { p_group_id: group.id, p_user_id: m.user_id }))
                                  }>
                                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                </Popconfirm>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: 'messages',
              label: (
                <span>
                  <MessageOutlined /> Tin nhắn gần đây
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  loading={loadingMsgs}
                  dataSource={recent}
                  pagination={{ pageSize: 30, hideOnSinglePage: true }}
                  locale={{ emptyText: 'Chưa có tin nhắn' }}
                  columns={[
                    { title: 'Lúc', width: 130, render: (_, m) => fmtDateTime(m.created_at) },
                    {
                      title: 'Người gửi',
                      width: 160,
                      render: (_, m) => {
                        const p = one(m.profiles);
                        return nameById.get(m.sender_id ?? '') ?? one(p?.residents)?.full_name ?? p?.username ?? '';
                      },
                    },
                    {
                      title: 'Nội dung',
                      render: (_, m) =>
                        m.deleted_at ? (
                          <Typography.Text type="secondary" italic>
                            Đã thu hồi
                          </Typography.Text>
                        ) : (
                          <span>
                            {m.image_path ? '📷 ' : ''}
                            {m.content}
                          </span>
                        ),
                    },
                    {
                      title: '',
                      width: 50,
                      render: (_, m) =>
                        !m.deleted_at && (
                          <Popconfirm
                            title="Thu hồi tin nhắn này?"
                            description="Mọi người sẽ thấy 'Tin nhắn đã thu hồi'."
                            okText="Thu hồi"
                            okButtonProps={{ danger: true }}
                            onConfirm={() =>
                              run.mutate(() => supabase.rpc('delete_message', { p_message_id: m.id }), {
                                onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-group-messages', group.id] }),
                              })
                            }>
                            <Button type="text" danger size="small" icon={<StopOutlined />} />
                          </Popconfirm>
                        ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}
