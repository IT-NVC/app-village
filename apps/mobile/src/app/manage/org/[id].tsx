import { ORG_ROLE_LABEL, type OrgRole } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, PersonPicker, RowCard, useLoad } from '@/components/manage-kit';
import { Avatar, Button, Choice, Field, IconButton, Notice, Txt } from '@/components/ui';
import { Colors, Font } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fetchAreas, friendlyError, type Area } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Member = { user_id: string; role: OrgRole; full_name: string };

async function load(id: string) {
  const [org, members, areas] = await Promise.all([
    supabase.from('organizations').select('id, name, area_id, description').eq('id', id).single(),
    supabase.from('org_members').select('user_id, role, profiles(username, residents(full_name))').eq('org_id', id),
    fetchAreas(),
  ]);
  if (org.error) throw new Error(org.error.message);
  const list: Member[] = (members.data ?? [])
    .map((m) => {
      const p = one(m.profiles);
      return { user_id: m.user_id, role: m.role, full_name: one(p?.residents)?.full_name ?? p?.username ?? '' };
    })
    .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'truong_ban' ? -1 : 1));
  return { org: org.data, members: list, areas };
}

const WHOLE = 'whole';

export default function OrgScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  const [picker, setPicker] = useState(false);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState(WHOLE);
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openEdit(o: { name: string; area_id: string | null; description: string | null }) {
    setName(o.name);
    setAreaId(o.area_id ?? WHOLE);
    setDesc(o.description ?? '');
    setError(null);
    setEdit(true);
  }

  async function saveEdit() {
    if (!name.trim()) return setError('Vui lòng nhập tên.');
    setBusy(true);
    const { error: err } = await supabase.from('organizations').update({ name: name.trim(), area_id: areaId === WHOLE ? null : areaId, description: desc.trim() || null }).eq('id', id);
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEdit(false);
    await state.reload();
  }

  async function setRole(m: Member, role: OrgRole) {
    const { error: err } = await supabase.rpc('set_org_member', { p_org_id: id, p_user_id: m.user_id, p_role: role });
    if (err) showInfo('Không thực hiện được', err.message);
    await state.reload();
  }

  async function add(ids: string[]) {
    for (const uid of ids) {
      const { error: err } = await supabase.rpc('set_org_member', { p_org_id: id, p_user_id: uid, p_role: 'thanh_vien' });
      if (err) {
        showInfo('Không thêm được', err.message);
        break;
      }
    }
    setPicker(false);
    await state.reload();
  }

  function removeMember(m: Member) {
    confirmAction(`Gỡ ${m.full_name} khỏi ban?`, 'Người này cũng tự rời nhóm chat của ban.', 'Gỡ', async () => {
      const { error: err } = await supabase.rpc('remove_org_member', { p_org_id: id, p_user_id: m.user_id });
      if (err) showInfo('Không thực hiện được', err.message);
      await state.reload();
    }, true);
  }

  async function createGroup(name: string) {
    const { error: err } = await supabase.rpc('create_chat_group', { p_name: name, p_type: 'org', p_org_id: id });
    showInfo(err ? 'Không tạo được nhóm' : 'Đã tạo nhóm chat', err ? friendlyError(err.message) : 'Thành viên ban được thêm vào nhóm tự động.');
  }

  function removeOrg(name: string) {
    confirmAction(`Xoá ban ngành "${name}"?`, 'Thành viên và nhóm chat của ban cũng bị xoá.', 'Xoá', async () => {
      const { error: err } = await supabase.from('organizations').delete().eq('id', id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  const o = state.data?.org;
  return (
    <ManageShell
      title={o?.name ?? 'Ban ngành'}
      right={o ? <IconButton icon="create-outline" label="Sửa ban ngành" onPress={() => openEdit(o)} /> : undefined}>
      <Async state={state}>
        {(d) => (
          <>
            <ManageList
              state={state}
              data={d.members}
              keyOf={(m) => m.user_id}
              empty={{ icon: 'person-add-outline', title: 'Chưa có thành viên', message: 'Bấm "Thêm thành viên" bên dưới. Chỉ thêm được người đã có tài khoản hoạt động.' }}
              header={
                <>
                  <Button title="Thêm thành viên" icon="person-add" onPress={() => setPicker(true)} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Tạo nhóm chat" icon="chatbubbles" variant="secondary" onPress={() => createGroup(d.org.name)} style={{ flex: 1 }} />
                    <Button title="Xoá ban" icon="trash" variant="dangerOutline" onPress={() => removeOrg(d.org.name)} style={{ flex: 1 }} />
                  </View>
                </>
              }
              renderItem={(m) => (
                <RowCard>
                  <Avatar name={m.full_name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{m.full_name}</Txt>
                    <Txt variant="caption" color={m.role === 'truong_ban' ? Colors.primaryText : Colors.textSecondary} style={{ fontFamily: m.role === 'truong_ban' ? Font.bold : Font.regular }}>
                      {ORG_ROLE_LABEL[m.role]}
                    </Txt>
                  </View>
                  <IconButton
                    icon={m.role === 'truong_ban' ? 'star' : 'star-outline'}
                    label={m.role === 'truong_ban' ? 'Bỏ chức trưởng ban' : 'Giao làm trưởng ban'}
                    color={Colors.warning}
                    bg={Colors.warningSoft}
                    size={44}
                    onPress={() => setRole(m, m.role === 'truong_ban' ? 'thanh_vien' : 'truong_ban')}
                  />
                  <IconButton icon="close" label="Gỡ khỏi ban" color={Colors.danger} bg={Colors.dangerSoft} size={44} onPress={() => removeMember(m)} />
                </RowCard>
              )}
            />
            <PersonPicker visible={picker} title="Thêm thành viên" exclude={d.members.map((m) => m.user_id)} onClose={() => setPicker(false)} onPick={add} />
            <FormSheet visible={edit} title="Sửa ban ngành" onClose={() => setEdit(false)} onSave={saveEdit} saving={busy}>
              <Field label="Tên ban ngành" value={name} onChangeText={setName} />
              <Choice<string> label="Thuộc khu" options={[{ value: WHOLE, label: 'Toàn thôn' }, ...d.areas.map((a: Area) => ({ value: a.id, label: a.name }))]} value={areaId} onChange={setAreaId} />
              <Field label="Mô tả" value={desc} onChangeText={setDesc} />
              <Notice text={error} />
            </FormSheet>
          </>
        )}
      </Async>
    </ManageShell>
  );
}
