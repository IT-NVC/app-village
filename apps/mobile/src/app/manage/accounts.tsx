import { ACCOUNT_STATUS_LABEL, LEADERSHIP_ROLE_LABEL, rankOf, type AccountStatus, type LeadershipRole } from '@thon/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, PillTabs, RowCard, SearchBox, useLoad } from '@/components/manage-kit';
import { Avatar, Txt } from '@/components/ui';
import { Colors, Font } from '@/constants/theme';
import { fetchAllRows, norm } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Row = {
  id: string;
  username: string | null;
  status: AccountStatus;
  role: LeadershipRole | null;
  full_name: string | null;
  phone: string | null;
  area_name: string | null;
};

async function load(): Promise<Row[]> {
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from('profiles')
      .select('id, username, status, leadership_role, residents(full_name, phone, areas(name))')
      .order('created_at', { ascending: false })
      .range(from, to),
  );
  return rows
    .map((p) => {
      const r = one(p.residents);
      return { id: p.id, username: p.username, status: p.status, role: p.leadership_role, full_name: r?.full_name ?? null, phone: r?.phone ?? null, area_name: one(r?.areas)?.name ?? null };
    })
    .sort((a, b) => rankOf(b.role) - rankOf(a.role));
}

type Filter = 'all' | 'leaders' | AccountStatus;
const STATUS_COLOR: Record<AccountStatus, string> = {
  active: Colors.success,
  pending: Colors.warning,
  unverified: Colors.textMuted,
  rejected: Colors.danger,
  locked: Colors.danger,
};

export default function AccountsScreen() {
  const state = useLoad(load);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(() => {
    const k = norm(q);
    return (state.data ?? []).filter(
      (r) =>
        (!k || norm(r.full_name ?? '').includes(k) || (r.username ?? '').includes(k) || (r.phone ?? '').includes(k)) &&
        (filter === 'all' || (filter === 'leaders' ? !!r.role : r.status === filter)),
    );
  }, [state.data, q, filter]);

  return (
    <ManageShell title="Tài khoản & phân quyền" subtitle={state.data ? `${shown.length}/${state.data.length} tài khoản` : undefined}>
      <Async state={state}>
        {() => (
          <ManageList
            state={state}
            data={shown}
            keyOf={(r) => r.id}
            empty={{ icon: 'person-circle-outline', title: 'Không có tài khoản nào' }}
            header={
              <>
                <SearchBox value={q} onChange={setQ} placeholder="Tên, tên đăng nhập, số điện thoại" />
                <PillTabs
                  items={[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'leaders', label: 'Cán bộ thôn' },
                    { key: 'pending', label: 'Chờ duyệt' },
                    { key: 'active', label: 'Hoạt động' },
                    { key: 'unverified', label: 'Chưa kích hoạt' },
                    { key: 'locked', label: 'Đã khoá' },
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
              </>
            }
            renderItem={(r) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/account/[id]', params: { id: r.id } })}>
                <Avatar name={r.full_name ?? r.username} size={46} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{r.full_name ?? '(chưa khai báo)'}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {[r.username ? `@${r.username}` : 'Google', r.area_name, r.role && LEADERSHIP_ROLE_LABEL[r.role]].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
                <Txt variant="caption" color={STATUS_COLOR[r.status]} style={{ fontFamily: Font.bold }}>
                  {ACCOUNT_STATUS_LABEL[r.status]}
                </Txt>
              </RowCard>
            )}
          />
        )}
      </Async>
    </ManageShell>
  );
}
