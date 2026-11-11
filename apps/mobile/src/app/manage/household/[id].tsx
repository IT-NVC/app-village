import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, ResidentPicker, RowCard, useLoad } from '@/components/manage-kit';
import { Avatar, Button, Choice, Field, IconButton, Notice, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fetchAreas, friendlyError } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

async function load(id: string) {
  const [h, m, areas] = await Promise.all([
    supabase.from('households').select('id, code, head_name, area_id, areas(name)').eq('id', id).single(),
    supabase.from('residents').select('id, full_name, phone, areas(name)').eq('household_id', id).order('full_name'),
    fetchAreas(),
  ]);
  if (h.error) throw new Error(h.error.message);
  return {
    household: { id: h.data.id, code: h.data.code, head_name: h.data.head_name, area_id: h.data.area_id, area_name: one(h.data.areas)?.name ?? null },
    members: (m.data ?? []).map((r) => ({ id: r.id, full_name: r.full_name, phone: r.phone, area_name: one(r.areas)?.name ?? null })),
    areas,
  };
}

export default function HouseholdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  const [picker, setPicker] = useState(false);
  const [edit, setEdit] = useState(false);
  const [code, setCode] = useState('');
  const [head, setHead] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const h = state.data?.household;

  function openEdit() {
    if (!h) return;
    setCode(h.code ?? '');
    setHead(h.head_name);
    setAreaId(h.area_id);
    setError(null);
    setEdit(true);
  }

  async function saveEdit() {
    if (!head.trim()) return setError('Vui lòng nhập tên chủ hộ.');
    setBusy(true);
    const { error: err } = await supabase.from('households').update({ code: code.trim().toUpperCase() || null, head_name: head.trim(), area_id: areaId }).eq('id', id);
    setBusy(false);
    if (err) return setError(err.message.includes('duplicate') ? 'Mã hộ này đã có. Vui lòng chọn mã khác.' : friendlyError(err.message));
    setEdit(false);
    await state.reload();
  }

  async function add(ids: string[]) {
    const { error: err } = await supabase.from('residents').update({ household_id: id }).in('id', ids);
    if (err) showInfo('Không thêm được', friendlyError(err.message));
    setPicker(false);
    await state.reload();
  }

  function removeMember(m: { id: string; full_name: string }) {
    confirmAction(`Bỏ ${m.full_name} khỏi hộ?`, 'Nhân khẩu vẫn còn trong danh sách, chỉ không thuộc hộ này nữa.', 'Bỏ khỏi hộ', async () => {
      const { error: err } = await supabase.from('residents').update({ household_id: null }).eq('id', m.id);
      if (err) showInfo('Không thực hiện được', friendlyError(err.message));
      await state.reload();
    }, true);
  }

  function removeHousehold() {
    confirmAction(`Xoá hộ ${h?.head_name}?`, 'Các thành viên vẫn còn trong danh sách nhân khẩu, chỉ không thuộc hộ nào. Số liệu đóng góp quỹ của hộ sẽ không còn gắn với hộ.', 'Xoá hộ', async () => {
      const { error: err } = await supabase.from('households').delete().eq('id', id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  return (
    <ManageShell title={h ? `Hộ ${h.head_name}` : 'Hộ gia đình'} subtitle={h ? [h.code, h.area_name].filter(Boolean).join(' · ') : undefined} right={h ? <IconButton icon="create-outline" label="Sửa hộ" onPress={openEdit} /> : undefined}>
      <Async state={state}>
        {(d) => (
          <>
            <ManageList
              state={state}
              data={d.members}
              keyOf={(m) => m.id}
              empty={{ icon: 'person-add-outline', title: 'Hộ chưa có thành viên', message: 'Bấm "Thêm thành viên" để gắn nhân khẩu vào hộ này.' }}
              header={
                <>
                  <Button title="Thêm thành viên" icon="person-add" onPress={() => setPicker(true)} />
                  <Button title="Xoá hộ này" icon="trash" variant="dangerOutline" onPress={removeHousehold} />
                </>
              }
              renderItem={(m) => (
                <RowCard onPress={() => router.push({ pathname: '/manage/resident/[id]', params: { id: m.id } })}>
                  <Avatar name={m.full_name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{m.full_name}</Txt>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      {[m.area_name, m.phone].filter(Boolean).join(' · ')}
                    </Txt>
                  </View>
                  <IconButton icon="close" label="Bỏ khỏi hộ" color={Colors.danger} bg={Colors.dangerSoft} size={40} onPress={() => removeMember(m)} />
                </RowCard>
              )}
            />
            <ResidentPicker visible={picker} title="Thêm vào hộ" exclude={d.members.map((m) => m.id)} onClose={() => setPicker(false)} onPick={add} />
            <FormSheet visible={edit} title="Sửa hộ gia đình" onClose={() => setEdit(false)} onSave={saveEdit} saving={busy}>
              <Field label="Tên chủ hộ" value={head} onChangeText={setHead} autoCapitalize="words" />
              <Field label="Mã hộ" value={code} onChangeText={setCode} autoCapitalize="characters" />
              <Choice label="Khu" options={d.areas.map((a) => ({ value: a.id, label: a.name }))} value={areaId} onChange={setAreaId} />
              <Notice text={error} />
            </FormSheet>
          </>
        )}
      </Async>
    </ManageShell>
  );
}
