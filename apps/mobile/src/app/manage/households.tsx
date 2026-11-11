import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, PillTabs, RowCard, SearchBox, useLoad } from '@/components/manage-kit';
import { Choice, Field, IconButton, IconCircle, Notice, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { fetchAllRows, fetchAreas, friendlyError, norm } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

async function load() {
  const [households, members, areas] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('households').select('id, code, head_name, area_id, areas(name)').order('head_name').range(from, to)),
    fetchAllRows((from, to) => supabase.from('residents').select('household_id').not('household_id', 'is', null).range(from, to)),
    fetchAreas(),
  ]);
  const counts = new Map<string, number>();
  for (const m of members) if (m.household_id) counts.set(m.household_id, (counts.get(m.household_id) ?? 0) + 1);
  return {
    areas,
    rows: households.map((h) => ({ id: h.id, code: h.code, head_name: h.head_name, area_id: h.area_id, area_name: one(h.areas)?.name ?? null, members: counts.get(h.id) ?? 0 })),
  };
}

export default function HouseholdsScreen() {
  const state = useLoad(load);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('all');
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [head, setHead] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const k = norm(q);
    return (state.data?.rows ?? []).filter((h) => (!k || norm(h.head_name).includes(k) || (h.code ?? '').toLowerCase().includes(k)) && (area === 'all' || h.area_id === area));
  }, [state.data, q, area]);

  async function create() {
    if (!head.trim()) return setError('Vui lòng nhập tên chủ hộ.');
    if (!areaId) return setError('Vui lòng chọn khu.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.from('households').insert({ code: code.trim().toUpperCase() || null, head_name: head.trim(), area_id: areaId }).select('id').single();
    setBusy(false);
    if (err) return setError(err.message.includes('duplicate') ? 'Mã hộ này đã có. Vui lòng chọn mã khác.' : friendlyError(err.message));
    setOpen(false);
    setCode('');
    setHead('');
    router.push({ pathname: '/manage/household/[id]', params: { id: data.id } });
  }

  return (
    <ManageShell
      title="Hộ gia đình"
      subtitle={state.data ? `${shown.length}/${state.data.rows.length} hộ` : undefined}
      right={<IconButton icon="add" label="Thêm hộ" onPress={() => { setError(null); setOpen(true); }} />}>
      <Async state={state}>
        {(d) => (
          <ManageList
            state={state}
            data={shown}
            keyOf={(h) => h.id}
            empty={{ icon: 'home-outline', title: 'Không có hộ nào', message: 'Bấm dấu + để thêm hộ gia đình. Gắn thành viên vào hộ ở màn hình chi tiết.' }}
            header={
              <>
                <SearchBox value={q} onChange={setQ} placeholder="Tên chủ hộ hoặc mã hộ" />
                <PillTabs items={[{ key: 'all', label: 'Mọi khu' }, ...d.areas.map((a) => ({ key: a.id, label: a.name }))]} value={area} onChange={setArea} />
              </>
            }
            renderItem={(h) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/household/[id]', params: { id: h.id } })}>
                <IconCircle icon="home" color={Colors.primaryText} bg={Colors.primarySoft} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">Hộ {h.head_name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {[h.code, h.area_name, `${h.members} người`].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </RowCard>
            )}
          />
        )}
      </Async>

      <FormSheet visible={open} title="Thêm hộ gia đình" onClose={() => setOpen(false)} onSave={create} saving={busy} saveText="Tạo hộ">
        <Field label="Tên chủ hộ" value={head} onChangeText={setHead} autoCapitalize="words" />
        <Field label="Mã hộ (không bắt buộc)" hint="Ví dụ HA001. Dùng để gộp thành viên vào cùng hộ khi nhập danh sách." value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Choice label="Khu" options={(state.data?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))} value={areaId} onChange={setAreaId} />
        <Notice text={error} />
      </FormSheet>
    </ManageShell>
  );
}
