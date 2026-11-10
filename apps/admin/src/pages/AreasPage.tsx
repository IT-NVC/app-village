import { DeleteOutlined, EditOutlined, MessageOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORG_ROLE_LABEL, type OrgRole } from '@thon/shared';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';

import { useActivePeople, useAreas, useOrganizations, type Area, type Organization } from '@/lib/data';
import { errMsg, normalize } from '@/lib/format';
import { must, one, rows as list, supabase } from '@/lib/supabase';

type Member = { user_id: string; role: OrgRole; full_name: string; username: string | null };

/** Lỗi trùng khoá: nhóm chat đã tồn tại */
const friendly = (e: unknown) => {
  const m = errMsg(e);
  if (m.includes('duplicate key') && m.includes('chat_groups')) return 'Nhóm chat này đã được tạo trước đó.';
  if (m.includes('duplicate key')) return 'Tên này đã tồn tại.';
  if (m.includes('violates foreign key')) return 'Không xoá được vì còn dữ liệu liên quan.';
  return m;
};

export default function AreasPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: areas = [], isLoading: loadingAreas } = useAreas();
  const { data: orgs = [], isLoading: loadingOrgs } = useOrganizations();

  const [areaEdit, setAreaEdit] = useState<Area | 'new' | null>(null);
  const [orgEdit, setOrgEdit] = useState<Organization | 'new' | null>(null);
  const [membersOf, setMembersOf] = useState<Organization | null>(null);
  const [areaForm] = Form.useForm();
  const [orgForm] = Form.useForm();

  // Số người mỗi khu & số thành viên mỗi ban
  const { data: stats } = useQuery({
    queryKey: ['area-org-stats'],
    queryFn: async () => {
      const members = list(await supabase.from('org_members').select('org_id, role'));
      const memberCount = new Map<string, number>();
      for (const m of members) memberCount.set(m.org_id, (memberCount.get(m.org_id) ?? 0) + 1);
      const areaCount = new Map<string, number>();
      await Promise.all(
        areas.map(async (a) => {
          const { count } = await supabase.from('residents').select('id', { count: 'exact', head: true }).eq('area_id', a.id);
          areaCount.set(a.id, count ?? 0);
        }),
      );
      return { memberCount, areaCount };
    },
    enabled: areas.length > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['areas'] });
    qc.invalidateQueries({ queryKey: ['organizations'] });
    qc.invalidateQueries({ queryKey: ['area-org-stats'] });
  };

  const saveArea = useMutation({
    mutationFn: async (v: { name: string; description?: string; sort_order?: number }) => {
      const payload = { name: v.name.trim(), description: v.description?.trim() || null, sort_order: v.sort_order ?? 0 };
      if (areaEdit === 'new') must(await supabase.from('areas').insert(payload));
      else if (areaEdit) must(await supabase.from('areas').update(payload).eq('id', areaEdit.id));
    },
    onSuccess: () => {
      setAreaEdit(null);
      invalidate();
      message.success('Đã lưu khu');
    },
    onError: (e) => message.error(friendly(e)),
  });

  const saveOrg = useMutation({
    mutationFn: async (v: { name: string; area_id?: string | null; description?: string }) => {
      const payload = { name: v.name.trim(), area_id: v.area_id || null, description: v.description?.trim() || null };
      if (orgEdit === 'new') must(await supabase.from('organizations').insert(payload));
      else if (orgEdit) must(await supabase.from('organizations').update(payload).eq('id', orgEdit.id));
    },
    onSuccess: () => {
      setOrgEdit(null);
      invalidate();
      message.success('Đã lưu ban ngành');
    },
    onError: (e) => message.error(friendly(e)),
  });

  const del = useMutation({
    mutationFn: async (v: { table: 'areas' | 'organizations'; id: string }) =>
      must(await supabase.from(v.table).delete().eq('id', v.id)),
    onSuccess: () => {
      invalidate();
      message.success('Đã xoá');
    },
    onError: (e) => message.error(friendly(e)),
  });

  const createGroup = useMutation({
    mutationFn: async (v: { name: string; type: 'area' | 'org'; id: string }) =>
      must(
        await supabase.rpc('create_chat_group', {
          p_name: v.name,
          p_type: v.type,
          p_area_id: v.type === 'area' ? v.id : undefined,
          p_org_id: v.type === 'org' ? v.id : undefined,
        }),
      ),
    onSuccess: () => message.success('Đã tạo nhóm chat, thành viên được thêm tự động'),
    onError: (e) => message.error(friendly(e)),
  });

  const areaName = (id: string | null) => (id ? areas.find((a) => a.id === id)?.name ?? '' : 'Toàn thôn');

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={9}>
        <Card
          title="Khu vực"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { areaForm.resetFields(); setAreaEdit('new'); }}>
              Thêm khu
            </Button>
          }>
          <Table<Area>
            rowKey="id"
            size="middle"
            loading={loadingAreas}
            dataSource={areas}
            pagination={false}
            columns={[
              { title: 'Tên khu', dataIndex: 'name', render: (v) => <b>{v}</b> },
              { title: 'Nhân khẩu', render: (_, a) => stats?.areaCount.get(a.id) ?? '…' },
              {
                title: '',
                width: 130,
                render: (_, a) => (
                  <Space size={0}>
                    <Tooltip title="Tạo nhóm chat của khu">
                      <Button type="text" icon={<MessageOutlined />} loading={createGroup.isPending && createGroup.variables?.id === a.id}
                        onClick={() => createGroup.mutate({ name: `Nhóm ${a.name}`, type: 'area', id: a.id })} />
                    </Tooltip>
                    <Button type="text" icon={<EditOutlined />} onClick={() => { areaForm.setFieldsValue(a); setAreaEdit(a); }} />
                    <Popconfirm
                      title={`Xoá ${a.name}?`}
                      description="Ban ngành của khu cũng bị xoá. Nhân khẩu được giữ lại nhưng không còn thuộc khu nào."
                      okText="Xoá"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => del.mutate({ table: 'areas', id: a.id })}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} xl={15}>
        <Card
          title="Ban ngành đoàn thể"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { orgForm.resetFields(); setOrgEdit('new'); }}>
              Thêm ban ngành
            </Button>
          }>
          <Table<Organization>
            rowKey="id"
            size="middle"
            loading={loadingOrgs}
            dataSource={[...orgs].sort((a, b) => areaName(a.area_id).localeCompare(areaName(b.area_id), 'vi') || a.name.localeCompare(b.name, 'vi'))}
            pagination={false}
            columns={[
              { title: 'Tên', dataIndex: 'name', render: (v) => <b>{v}</b> },
              { title: 'Thuộc', render: (_, o) => <Tag color={o.area_id ? 'blue' : 'purple'}>{areaName(o.area_id)}</Tag> },
              { title: 'Thành viên', render: (_, o) => stats?.memberCount.get(o.id) ?? 0 },
              {
                title: '',
                width: 230,
                render: (_, o) => (
                  <Space size={0}>
                    <Button type="link" icon={<TeamOutlined />} onClick={() => setMembersOf(o)}>
                      Thành viên
                    </Button>
                    <Tooltip title="Tạo nhóm chat của ban">
                      <Button type="text" icon={<MessageOutlined />} loading={createGroup.isPending && createGroup.variables?.id === o.id}
                        onClick={() => createGroup.mutate({ name: o.name, type: 'org', id: o.id })} />
                    </Tooltip>
                    <Button type="text" icon={<EditOutlined />} onClick={() => { orgForm.setFieldsValue(o); setOrgEdit(o); }} />
                    <Popconfirm title={`Xoá ${o.name}?`} okText="Xoá" okButtonProps={{ danger: true }} onConfirm={() => del.mutate({ table: 'organizations', id: o.id })}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Col>

      <Modal title={areaEdit === 'new' ? 'Thêm khu' : 'Sửa khu'} open={!!areaEdit} onCancel={() => setAreaEdit(null)}
        onOk={() => areaForm.submit()} confirmLoading={saveArea.isPending} okText="Lưu">
        <Form form={areaForm} layout="vertical" onFinish={(v) => saveArea.mutate(v)}>
          <Form.Item name="name" label="Tên khu" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="VD: Khu A" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={orgEdit === 'new' ? 'Thêm ban ngành' : 'Sửa ban ngành'} open={!!orgEdit} onCancel={() => setOrgEdit(null)}
        onOk={() => orgForm.submit()} confirmLoading={saveOrg.isPending} okText="Lưu">
        <Form form={orgForm} layout="vertical" onFinish={(v) => saveOrg.mutate(v)}>
          <Form.Item name="name" label="Tên ban ngành" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="VD: Tổ đoàn A, Chi hội phụ nữ khu A" />
          </Form.Item>
          <Form.Item name="area_id" label="Thuộc khu" extra="Để trống nếu là ban ngành cấp toàn thôn">
            <Select allowClear placeholder="Toàn thôn" options={areas.map((a) => ({ value: a.id, label: a.name }))} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <MembersDrawer org={membersOf} onClose={() => setMembersOf(null)} />
    </Row>
  );
}

function MembersDrawer({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: people = [] } = useActivePeople();
  const [addUser, setAddUser] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<OrgRole>('thanh_vien');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', org?.id],
    enabled: !!org,
    queryFn: async (): Promise<Member[]> => {
      const rows = list(
        await supabase.from('org_members').select('user_id, role, profiles(username, residents(full_name))').eq('org_id', org!.id),
      );
      return rows
        .map((m) => {
          const p = one(m.profiles);
          return { user_id: m.user_id, role: m.role, username: p?.username ?? null, full_name: one(p?.residents)?.full_name ?? p?.username ?? '' };
        })
        .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'truong_ban' ? -1 : 1));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['org-members', org?.id] });
    qc.invalidateQueries({ queryKey: ['area-org-stats'] });
  };

  const setMember = useMutation({
    mutationFn: async (v: { user_id: string; role: OrgRole }) =>
      must(await supabase.rpc('set_org_member', { p_org_id: org!.id, p_user_id: v.user_id, p_role: v.role })),
    onSuccess: () => {
      setAddUser(null);
      refresh();
      message.success('Đã cập nhật');
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const removeMember = useMutation({
    mutationFn: async (user_id: string) => must(await supabase.rpc('remove_org_member', { p_org_id: org!.id, p_user_id: user_id })),
    onSuccess: () => {
      refresh();
      message.success('Đã gỡ khỏi ban');
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  return (
    <Drawer title={org ? `Thành viên: ${org.name}` : ''} open={!!org} onClose={onClose} size={560} destroyOnHidden>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Select
          showSearch={{ filterOption: (input, opt) => normalize(String(opt?.label ?? '')).includes(normalize(input)) }}
          placeholder="Tìm người để thêm…"
          style={{ flex: 1 }}
          value={addUser}
          onChange={setAddUser}
          options={people
            .filter((p) => !memberIds.has(p.id))
            .map((p) => ({ value: p.id, label: `${p.full_name}${p.area_name ? ` · ${p.area_name}` : ''}` }))}
        />
        <Select
          value={addRole}
          onChange={setAddRole}
          style={{ width: 130 }}
          options={Object.entries(ORG_ROLE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Button type="primary" disabled={!addUser} loading={setMember.isPending}
          onClick={() => addUser && setMember.mutate({ user_id: addUser, role: addRole })}>
          Thêm
        </Button>
      </Space.Compact>
      <Typography.Paragraph type="secondary">
        Chỉ thêm được người đã có tài khoản đang hoạt động. Thành viên tự vào nhóm chat của ban (nếu đã tạo).
      </Typography.Paragraph>
      <Table<Member>
        rowKey="user_id"
        size="small"
        loading={isLoading}
        dataSource={members}
        pagination={false}
        columns={[
          { title: 'Họ tên', dataIndex: 'full_name' },
          {
            title: 'Vai trò',
            render: (_, m) => (
              <Select
                size="small"
                value={m.role}
                style={{ width: 120 }}
                onChange={(role) => setMember.mutate({ user_id: m.user_id, role })}
                options={Object.entries(ORG_ROLE_LABEL).map(([value, label]) => ({ value, label }))}
              />
            ),
          },
          {
            title: '',
            width: 50,
            render: (_, m) => (
              <Popconfirm title={`Gỡ ${m.full_name} khỏi ban?`} okText="Gỡ" onConfirm={() => removeMember.mutate(m.user_id)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
