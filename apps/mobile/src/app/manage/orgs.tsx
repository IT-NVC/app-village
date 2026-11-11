import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { Choice, Field, IconButton, IconCircle, Notice, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { fetchAreas, fetchOrgs, friendlyError, type Org } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

async function load() {
  const [orgs, areas, members] = await Promise.all([fetchOrgs(), fetchAreas(), supabase.from('org_members').select('org_id')]);
  const counts = new Map<string, number>();
  for (const m of members.data ?? []) counts.set(m.org_id, (counts.get(m.org_id) ?? 0) + 1);
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const rows = orgs
    .map((o) => ({ ...o, area_name: o.area_id ? (areaName.get(o.area_id) ?? '') : 'Toàn thôn', members: counts.get(o.id) ?? 0 }))
    .sort((a, b) => a.area_name.localeCompare(b.area_name, 'vi') || a.name.localeCompare(b.name, 'vi'));
  return { rows, areas };
}

const WHOLE = 'whole';

export default function OrgsScreen() {
  const state = useLoad(load);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState<string>(WHOLE);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setError('Vui lòng nhập tên ban ngành.');
    setBusy(true);
    setError(null);
    const payload: Pick<Org, 'name' | 'area_id' | 'description'> = { name: name.trim(), area_id: areaId === WHOLE ? null : areaId, description: desc.trim() || null };
    const { data, error: err } = await supabase.from('organizations').insert(payload).select('id').single();
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setOpen(false);
    setName('');
    setDesc('');
    router.push({ pathname: '/manage/org/[id]', params: { id: data.id } });
  }

  return (
    <ManageShell title="Ban ngành đoàn thể" right={<IconButton icon="add" label="Thêm ban ngành" onPress={() => { setError(null); setOpen(true); }} />}>
      <Async state={state}>
        {(d) => (
          <ManageList
            state={state}
            data={d.rows}
            keyOf={(o) => o.id}
            empty={{ icon: 'people-outline', title: 'Chưa có ban ngành nào', message: 'Ví dụ: Tổ đoàn A, Chi hội phụ nữ khu A.' }}
            renderItem={(o) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/org/[id]', params: { id: o.id } })}>
                <IconCircle icon="people" color={Colors.info} bg={Colors.infoSoft} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{o.name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {o.area_name} · {o.members} thành viên
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </RowCard>
            )}
          />
        )}
      </Async>

      <FormSheet visible={open} title="Thêm ban ngành" onClose={() => setOpen(false)} onSave={create} saving={busy} saveText="Tạo">
        <Field label="Tên ban ngành" placeholder="VD: Tổ đoàn A" value={name} onChangeText={setName} />
        <Choice<string>
          label="Thuộc khu"
          options={[{ value: WHOLE, label: 'Toàn thôn' }, ...(state.data?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))]}
          value={areaId}
          onChange={setAreaId}
        />
        <Field label="Mô tả" value={desc} onChangeText={setDesc} />
        <Notice text={error} />
      </FormSheet>
    </ManageShell>
  );
}
