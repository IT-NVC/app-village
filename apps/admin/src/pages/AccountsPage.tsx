import { CrownOutlined, KeyOutlined, LockOutlined, MoreOutlined, UnlockOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCOUNT_STATUS_LABEL,
  LEADERSHIP_ROLE_LABEL,
  rankOf,
  type AccountStatus,
  type LeadershipRole,
} from '@thon/shared';
import { App, Button, Card, Dropdown, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { errMsg, fmtDate, normalize } from '@/lib/format';
import { fetchAll, must, one, supabase } from '@/lib/supabase';

type AccountRow = {
  id: string;
  username: string | null;
  status: AccountStatus;
  leadership_role: LeadershipRole | null;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  area_name: string | null;
};

const statusColor: Record<AccountStatus, string> = {
  active: 'green',
  pending: 'gold',
  unverified: 'default',
  rejected: 'red',
  locked: 'red',
};

/** Lấy thông báo lỗi từ Edge Function */
async function invokeError(error: unknown) {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    } catch {
      /* bỏ qua */
    }
  }
  return errMsg(error);
}

export default function AccountsPage() {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const { me, rank: myRank } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'leaders' | null>(null);
  const [roleTarget, setRoleTarget] = useState<AccountRow | null>(null);
  const [pwTarget, setPwTarget] = useState<AccountRow | null>(null);
  const [roleForm] = Form.useForm<{ role: LeadershipRole | 'none' }>();
  const [pwForm] = Form.useForm<{ password: string }>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async (): Promise<AccountRow[]> => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from('profiles')
          .select('id, username, status, leadership_role, created_at, residents(full_name, phone, areas(name))')
          .order('created_at', { ascending: false })
          .range(from, to),
      );
      return rows.map((p) => {
        const r = one(p.residents);
        return {
          id: p.id,
          username: p.username,
          status: p.status,
          leadership_role: p.leadership_role,
          created_at: p.created_at,
          full_name: r?.full_name ?? null,
          phone: r?.phone ?? null,
          area_name: one(r?.areas)?.name ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const q = normalize(search);
    return data
      .filter(
        (r) =>
          (!q || normalize(r.full_name ?? '').includes(q) || (r.username ?? '').includes(q) || (r.phone ?? '').includes(q)) &&
          (!statusFilter || (statusFilter === 'leaders' ? !!r.leadership_role : r.status === statusFilter)),
      )
      .sort((a, b) => rankOf(b.leadership_role) - rankOf(a.leadership_role));
  }, [data, search, statusFilter]);

  const done = (msg: string) => {
    message.success(msg);
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: ['active-people'] });
  };

  const setRole = useMutation({
    mutationFn: async (v: { id: string; role: LeadershipRole | null }) =>
      must(await supabase.rpc('set_leadership_role', { p_user_id: v.id, p_role: v.role as LeadershipRole })),
    onSuccess: () => {
      setRoleTarget(null);
      done('Đã cập nhật chức vụ');
    },
    onError: (e) => message.error(errMsg(e)),
  });

  const lock = useMutation({
    mutationFn: async (v: { id: string; locked: boolean }) =>
      must(await supabase.rpc('set_account_locked', { p_user_id: v.id, p_locked: v.locked })),
    onSuccess: (_d, v) => done(v.locked ? 'Đã khoá tài khoản' : 'Đã mở khoá'),
    onError: (e) => message.error(errMsg(e)),
  });

  const resetPw = useMutation({
    mutationFn: async (v: { id: string; password: string }) => {
      const { error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: v.id, new_password: v.password },
      });
      if (error) throw new Error(await invokeError(error));
    },
    onSuccess: () => {
      setPwTarget(null);
      message.success('Đã đặt lại mật khẩu. Hãy báo mật khẩu mới cho người dân.');
    },
    onError: (e) => message.error(errMsg(e)),
  });

  // Chức vụ được phép gán: Bí thư gán mọi chức vụ; người khác chỉ gán chức vụ thấp hơn mình
  const assignable = (Object.keys(LEADERSHIP_ROLE_LABEL) as LeadershipRole[]).filter(
    (r) => myRank >= 3 || rankOf(r) < myRank,
  );

  return (
    <Card title="Tài khoản & phân quyền">
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear placeholder="Tìm tên, username, SĐT" style={{ width: 260 }} onChange={(e) => setSearch(e.target.value)} />
        <Select
          allowClear
          placeholder="Tất cả trạng thái"
          style={{ width: 200 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v ?? null)}
          options={[
            { value: 'leaders', label: 'Cán bộ thôn' },
            ...Object.entries(ACCOUNT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
      </Space>

      <Table<AccountRow>
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 50, showTotal: (t) => `${t} tài khoản`, showSizeChanger: false }}
        columns={[
          {
            title: 'Họ tên',
            render: (_, r) => (
              <Space orientation="vertical" size={0}>
                <b>{r.full_name ?? <Typography.Text type="secondary">(chưa khai báo)</Typography.Text>}</b>
                <Typography.Text type="secondary">{r.username ? `@${r.username}` : 'Google'}</Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Chức vụ',
            render: (_, r) =>
              r.leadership_role ? (
                <Tag color="blue" icon={<CrownOutlined />}>{LEADERSHIP_ROLE_LABEL[r.leadership_role]}</Tag>
              ) : (
                <Typography.Text type="secondary">Người dân</Typography.Text>
              ),
          },
          { title: 'Trạng thái', render: (_, r) => <Tag color={statusColor[r.status]}>{ACCOUNT_STATUS_LABEL[r.status]}</Tag> },
          { title: 'Khu', dataIndex: 'area_name' },
          { title: 'SĐT', dataIndex: 'phone' },
          { title: 'Tạo ngày', render: (_, r) => fmtDate(r.created_at) },
          {
            title: '',
            width: 60,
            fixed: 'right',
            render: (_, r) => {
              const canManage = r.id !== me?.id && (myRank >= 3 || rankOf(r.leadership_role) < myRank);
              if (!canManage) return null;
              const items = [
                ...(myRank >= 2 && r.status === 'active'
                  ? [{ key: 'role', icon: <CrownOutlined />, label: 'Đặt chức vụ' }]
                  : []),
                ...(r.username ? [{ key: 'pw', icon: <KeyOutlined />, label: 'Đặt lại mật khẩu' }] : []),
                r.status === 'locked'
                  ? { key: 'unlock', icon: <UnlockOutlined />, label: 'Mở khoá' }
                  : { key: 'lock', icon: <LockOutlined />, label: 'Khoá tài khoản', danger: true },
              ];
              return (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items,
                    onClick: ({ key }) => {
                      if (key === 'role') {
                        roleForm.setFieldsValue({ role: r.leadership_role ?? 'none' });
                        setRoleTarget(r);
                      } else if (key === 'pw') {
                        pwForm.resetFields();
                        setPwTarget(r);
                      } else {
                        const locked = key === 'lock';
                        modal.confirm({
                          title: `${locked ? 'Khoá' : 'Mở khoá'} tài khoản ${r.full_name ?? r.username}?`,
                          content: locked ? 'Người này sẽ không dùng được app cho tới khi được mở khoá.' : undefined,
                          okButtonProps: { danger: locked },
                          onOk: () => lock.mutateAsync({ id: r.id, locked }),
                        });
                      }
                    },
                  }}>
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
              );
            },
          },
        ]}
      />

      <Modal
        title={`Chức vụ: ${roleTarget?.full_name ?? roleTarget?.username ?? ''}`}
        open={!!roleTarget}
        onCancel={() => setRoleTarget(null)}
        onOk={() => roleForm.submit()}
        confirmLoading={setRole.isPending}
        okText="Lưu">
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={(v) => roleTarget && setRole.mutate({ id: roleTarget.id, role: v.role === 'none' ? null : v.role })}>
          <Form.Item name="role" label="Chức vụ cán bộ thôn">
            <Select
              options={[
                { value: 'none', label: 'Không (người dân)' },
                ...assignable.map((r) => ({ value: r, label: LEADERSHIP_ROLE_LABEL[r] })),
              ]}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            Chức vụ trong ban ngành đoàn thể (trưởng ban, thành viên) được giao ở trang Khu vực & ban ngành.
          </Typography.Text>
        </Form>
      </Modal>

      <Modal
        title={`Đặt lại mật khẩu: ${pwTarget?.full_name ?? ''} (@${pwTarget?.username ?? ''})`}
        open={!!pwTarget}
        onCancel={() => setPwTarget(null)}
        onOk={() => pwForm.submit()}
        confirmLoading={resetPw.isPending}
        okText="Đặt lại">
        <Form form={pwForm} layout="vertical" onFinish={(v) => pwTarget && resetPw.mutate({ id: pwTarget.id, password: v.password })}>
          <Form.Item name="password" label="Mật khẩu mới" rules={[{ required: true, min: 6, message: 'Ít nhất 6 ký tự' }]}>
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
