import { ACCOUNT_STATUS_LABEL, LEADERSHIP_ROLE_LABEL, rankOf, type AccountStatus, type LeadershipRole } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Async, ManageShell, useLoad } from '@/components/manage-kit';
import { Avatar, Button, Card, Choice, Notice, PromptModal, ScrollPage, Txt } from '@/components/ui';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/dialog';
import { functionError, manageAccount } from '@/lib/manage-data';
import { one, useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Account = {
  id: string;
  username: string | null;
  status: AccountStatus;
  role: LeadershipRole | null;
  reject_reason: string | null;
  resident_id: string | null;
  full_name: string | null;
  phone: string | null;
  area_name: string | null;
};

async function load(id: string): Promise<Account> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, status, leadership_role, reject_reason, resident_id, residents(full_name, phone, areas(name))')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const r = one(data.residents);
  return {
    id: data.id,
    username: data.username,
    status: data.status,
    role: data.leadership_role,
    reject_reason: data.reject_reason,
    resident_id: data.resident_id,
    full_name: r?.full_name ?? null,
    phone: r?.phone ?? null,
    area_name: one(r?.areas)?.name ?? null,
  };
}

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  return (
    <ManageShell title="Tài khoản">
      <Async state={state}>{(a) => <Detail account={a} onChanged={state.reload} />}</Async>
    </ManageShell>
  );
}

function Detail({ account: a, onChanged }: { account: Account; onChanged: () => Promise<void> }) {
  const { me } = useAuth();
  const myRank = useRank();
  const [role, setRole] = useState<LeadershipRole | 'none'>(a.role ?? 'none');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  // Cùng quy tắc như trang web: không thao tác với người ngang / cao hơn mình (trừ Bí thư)
  const canManage = a.id !== me?.id && (myRank >= 3 || rankOf(a.role) < myRank);
  const assignable = (Object.keys(LEADERSHIP_ROLE_LABEL) as LeadershipRole[]).filter((r) => myRank >= 3 || rankOf(r) < myRank);

  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(key);
    setMsg(null);
    const { error } = await fn();
    setBusy(null);
    if (error) return setMsg({ tone: 'danger', text: error.message });
    setMsg({ tone: 'success', text: ok });
    await onChanged();
  }

  async function resetPassword(password: string) {
    if (password.length < 6) {
      setMsg({ tone: 'danger', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      setPwOpen(false);
      return;
    }
    const { error } = await supabase.functions.invoke('admin-reset-password', { body: { user_id: a.id, new_password: password } });
    setPwOpen(false);
    setMsg(error ? { tone: 'danger', text: await functionError(error) } : { tone: 'success', text: 'Đã đặt lại mật khẩu. Hãy báo mật khẩu mới cho người dân.' });
  }

  const locked = a.status === 'locked';

  function deleteAccount() {
    confirmAction(
      `Xoá hẳn tài khoản ${a.full_name ?? a.username}?`,
      'Toàn bộ phản ánh, phiếu bầu và dữ liệu của tài khoản này cũng bị xoá. Nhân khẩu được giữ lại và được cấp mã kích hoạt mới. Nếu chỉ muốn tạm ngừng, hãy dùng "Khoá tài khoản".',
      'Xoá tài khoản',
      async () => {
        setBusy('delete');
        const err = await manageAccount({ action: 'delete', user_id: a.id });
        setBusy(null);
        if (err) return setMsg({ tone: 'danger', text: err });
        router.back();
      },
      true,
    );
  }

  return (
    <ScrollPage header={null}>
      <Card style={{ padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center', ...Shadow.sm }}>
        <Avatar name={a.full_name ?? a.username} size={72} />
        <Txt variant="title" center>
          {a.full_name ?? '(chưa khai báo)'}
        </Txt>
        <Txt variant="small" color={Colors.textSecondary} center>
          {[a.username ? `@${a.username}` : 'Đăng nhập Google', a.area_name].filter(Boolean).join(' · ')}
        </Txt>
        <Txt variant="bodyStrong" color={a.status === 'active' ? Colors.success : Colors.warning}>
          {ACCOUNT_STATUS_LABEL[a.status]}
          {a.role ? ` · ${LEADERSHIP_ROLE_LABEL[a.role]}` : ''}
        </Txt>
        {a.status === 'rejected' && a.reject_reason ? (
          <Txt variant="small" color={Colors.danger} center>
            Lý do từ chối: {a.reject_reason}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' }}>
          {a.phone ? <Button title="Gọi điện" icon="call" variant="secondary" onPress={() => Linking.openURL(`tel:${a.phone}`)} style={{ flex: 1 }} /> : null}
          {a.resident_id ? <Button title="Hồ sơ" icon="document-text" variant="secondary" onPress={() => router.push({ pathname: '/manage/resident/[id]', params: { id: a.resident_id! } })} style={{ flex: 1 }} /> : null}
        </View>
      </Card>

      {msg && <Notice tone={msg.tone} text={msg.text} />}

      {a.status === 'pending' && (
        <Card style={{ padding: Spacing.lg, gap: Spacing.sm }}>
          <Txt variant="subtitle">Đang chờ duyệt</Txt>
          <Button title="Duyệt tài khoản" icon="checkmark" loading={busy === 'approve'} onPress={() => run('approve', () => supabase.rpc('review_account', { p_user_id: a.id, p_approve: true }), 'Đã duyệt tài khoản.')} />
        </Card>
      )}

      {!canManage ? (
        <Notice tone="info" text={a.id === me?.id ? 'Đây là tài khoản của bạn.' : 'Bạn không thể thao tác với người có chức vụ ngang hoặc cao hơn mình.'} />
      ) : (
        <>
          {myRank >= 2 && a.status === 'active' && (
            <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
              <Choice<LeadershipRole | 'none'>
                label="Chức vụ cán bộ thôn"
                options={[{ value: 'none', label: 'Người dân' }, ...assignable.map((r) => ({ value: r, label: LEADERSHIP_ROLE_LABEL[r] }))]}
                value={role}
                onChange={setRole}
              />
              <Txt variant="caption" color={Colors.textSecondary}>
                Trưởng ban, thành viên ban ngành giao ở màn hình Ban ngành đoàn thể.
              </Txt>
              <Button
                title="Lưu chức vụ"
                icon="ribbon"
                disabled={role === (a.role ?? 'none')}
                loading={busy === 'role'}
                onPress={() => run('role', () => supabase.rpc('set_leadership_role', { p_user_id: a.id, p_role: (role === 'none' ? null : role) as LeadershipRole }), 'Đã cập nhật chức vụ.')}
              />
            </Card>
          )}

          <Card style={{ padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm }}>
            <Txt variant="subtitle">Thao tác khác</Txt>
            {a.username ? <Button title="Đặt lại mật khẩu" icon="key" variant="secondary" onPress={() => setPwOpen(true)} /> : <Txt variant="small" color={Colors.textMuted}>Tài khoản Google không có mật khẩu để đặt lại.</Txt>}
            <Button
              title={locked ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}
              icon={locked ? 'lock-open' : 'lock-closed'}
              variant={locked ? 'secondary' : 'dangerOutline'}
              loading={busy === 'lock'}
              onPress={() =>
                confirmAction(
                  `${locked ? 'Mở khoá' : 'Khoá'} tài khoản ${a.full_name ?? a.username}?`,
                  locked ? '' : 'Người này sẽ không dùng được app cho tới khi được mở khoá.',
                  locked ? 'Mở khoá' : 'Khoá',
                  () => run('lock', () => supabase.rpc('set_account_locked', { p_user_id: a.id, p_locked: !locked }), locked ? 'Đã mở khoá.' : 'Đã khoá tài khoản.'),
                  !locked,
                )
              }
            />
            {myRank >= 2 && <Button title="Xoá hẳn tài khoản" icon="trash" variant="dangerOutline" loading={busy === 'delete'} onPress={deleteAccount} />}
          </Card>
        </>
      )}

      <PromptModal
        visible={pwOpen}
        title="Đặt lại mật khẩu"
        message={`Nhập mật khẩu mới cho ${a.full_name ?? a.username} (ít nhất 6 ký tự). Hãy báo mật khẩu này cho người dân.`}
        placeholder="Mật khẩu mới"
        confirmText="Đặt lại"
        required
        onCancel={() => setPwOpen(false)}
        onConfirm={resetPassword}
      />
    </ScrollPage>
  );
}
