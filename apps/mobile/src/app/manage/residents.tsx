import { Ionicons } from '@expo/vector-icons';
import { ACCOUNT_STATUS_LABEL, type AccountStatus } from '@thon/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, PillTabs, RowCard, SearchBox, useLoad } from '@/components/manage-kit';
import { Avatar, IconButton, Txt } from '@/components/ui';
import { Colors, Font } from '@/constants/theme';
import { fetchAllRows, fetchAreas, norm } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  area_id: string | null;
  area_name: string | null;
  household_code: string | null;
  activation_code: string | null;
  account: { id: string; status: AccountStatus } | null;
};

async function load() {
  const [rows, areas] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('residents')
        .select('id, full_name, phone, area_id, activation_code, areas(name), households(code), profiles(id, status)')
        .order('full_name')
        .range(from, to),
    ),
    fetchAreas(),
  ]);
  const list: Row[] = rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    area_id: r.area_id,
    area_name: one(r.areas)?.name ?? null,
    household_code: one(r.households)?.code ?? null,
    activation_code: r.activation_code,
    account: one(r.profiles),
  }));
  return { list, areas };
}

type Acc = 'all' | 'has' | 'none';

export default function ResidentsScreen() {
  const state = useLoad(load);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('all');
  const [acc, setAcc] = useState<Acc>('all');

  const shown = useMemo(() => {
    const k = norm(q);
    return (state.data?.list ?? []).filter(
      (r) =>
        (!k || norm(r.full_name).includes(k) || (r.phone ?? '').includes(k) || (r.household_code ?? '').toLowerCase().includes(k)) &&
        (area === 'all' || r.area_id === area) &&
        (acc === 'all' || (acc === 'has' ? !!r.account : !r.account)),
    );
  }, [state.data, q, area, acc]);

  return (
    <ManageShell
      title="Nhân khẩu"
      subtitle={state.data ? `${shown.length}/${state.data.list.length} người` : undefined}
      right={<IconButton icon="add" label="Thêm người" onPress={() => router.push({ pathname: '/manage/resident/[id]', params: { id: 'new' } })} />}>
      <Async state={state}>
        {(d) => (
          <ManageList
            state={state}
            data={shown}
            keyOf={(r) => r.id}
            empty={{ icon: 'people-outline', title: 'Không có ai', message: q ? 'Thử gõ tên khác.' : 'Bấm dấu + để thêm nhân khẩu. Nhập hàng loạt từ Excel làm trên trang quản trị.' }}
            header={
              <>
                <SearchBox value={q} onChange={setQ} placeholder="Tên, số điện thoại, mã hộ" />
                <PillTabs items={[{ key: 'all', label: 'Mọi khu' }, ...d.areas.map((a) => ({ key: a.id, label: a.name }))]} value={area} onChange={setArea} />
                <PillTabs
                  items={[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'has', label: 'Đã có tài khoản' },
                    { key: 'none', label: 'Chưa có tài khoản' },
                  ]}
                  value={acc}
                  onChange={setAcc}
                />
              </>
            }
            renderItem={(r) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/resident/[id]', params: { id: r.id } })}>
                <Avatar name={r.full_name} size={46} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{r.full_name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {[r.area_name, r.phone, r.household_code && `Hộ ${r.household_code}`].filter(Boolean).join(' · ') || 'Chưa có thông tin'}
                  </Txt>
                </View>
                {r.account ? (
                  <Txt variant="caption" color={r.account.status === 'active' ? Colors.success : Colors.warning} style={{ fontFamily: Font.bold }}>
                    {ACCOUNT_STATUS_LABEL[r.account.status]}
                  </Txt>
                ) : r.activation_code ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="key" size={14} color={Colors.textSecondary} />
                    <Txt variant="caption" color={Colors.textSecondary} style={{ fontFamily: Font.bold }}>
                      {r.activation_code}
                    </Txt>
                  </View>
                ) : null}
              </RowCard>
            )}
          />
        )}
      </Async>
    </ManageShell>
  );
}
