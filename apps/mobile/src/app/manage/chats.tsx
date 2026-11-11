import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, PersonPicker, RowCard, useLoad } from '@/components/manage-kit';
import { Button, Field, IconButton, IconCircle, Notice, Txt, type IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import { friendlyError } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

type GroupType = 'area' | 'org' | 'custom';
const TYPE: Record<GroupType, { label: string; icon: IconName; color: string; bg: string }> = {
  area: { label: 'Nhóm khu', icon: 'location', color: Colors.primaryText, bg: Colors.primarySoft },
  org: { label: 'Ban ngành', icon: 'people', color: Colors.info, bg: Colors.infoSoft },
  custom: { label: 'Tuỳ chọn', icon: 'chatbubbles', color: Colors.purple, bg: Colors.purpleSoft },
};

async function load() {
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, name, type, last_message_at, chat_group_members(count)')
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type as GroupType,
    last_message_at: g.last_message_at,
    members: (Array.isArray(g.chat_group_members) ? g.chat_group_members[0]?.count : (g.chat_group_members as unknown as { count: number } | null)?.count) ?? 0,
  }));
}

export default function ChatsScreen() {
  const state = useLoad(load);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setError('Vui lòng nhập tên nhóm.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_chat_group', { p_name: name.trim(), p_type: 'custom', p_member_ids: members });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setOpen(false);
    setName('');
    setMembers([]);
    router.push({ pathname: '/manage/chat-admin/[id]', params: { id: data as string } });
  }

  return (
    <ManageShell title="Nhóm chat" right={<IconButton icon="add" label="Tạo nhóm" onPress={() => { setError(null); setOpen(true); }} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(g) => g.id}
            empty={{ icon: 'chatbubbles-outline', title: 'Chưa có nhóm nào', message: 'Nhóm khu / ban ngành tạo ở màn hình Khu vực và Ban ngành. Bấm + để tạo nhóm tuỳ chọn.' }}
            renderItem={(g) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/chat-admin/[id]', params: { id: g.id } })}>
                <IconCircle icon={TYPE[g.type].icon} color={TYPE[g.type].color} bg={TYPE[g.type].bg} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{g.name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {TYPE[g.type].label} · {g.members} thành viên · {g.last_message_at ? timeAgo(g.last_message_at) : 'chưa có tin'}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </RowCard>
            )}
          />
        )}
      </Async>

      <FormSheet visible={open} title="Tạo nhóm tuỳ chọn" onClose={() => setOpen(false)} onSave={create} saving={busy} saveText="Tạo nhóm">
        <Field label="Tên nhóm" placeholder="VD: Ban điều hành thôn" value={name} onChangeText={setName} />
        <Button title={members.length ? `Đã chọn ${members.length} người — chọn lại` : 'Chọn thành viên'} icon="people" variant="secondary" onPress={() => setPicker(true)} />
        <Txt variant="caption" color={Colors.textMuted}>
          Bạn tự động là quản trị nhóm.
        </Txt>
        <Notice text={error} />
      </FormSheet>
      <PersonPicker
        visible={picker}
        title="Chọn thành viên"
        onClose={() => setPicker(false)}
        onPick={(ids) => {
          setMembers(ids);
          setPicker(false);
        }}
      />
    </ManageShell>
  );
}
