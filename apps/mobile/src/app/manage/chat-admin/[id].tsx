import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, PersonPicker, PillTabs, RowCard, ToggleRow, useLoad } from '@/components/manage-kit';
import { Avatar, Button, Card, IconButton, PromptModal, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fmtDateTime } from '@/lib/format';
import { friendlyError } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Member = { user_id: string; role: 'admin' | 'member'; is_muted: boolean; full_name: string; area: string | null };
type Msg = { id: string; content: string | null; image_path: string | null; deleted_at: string | null; created_at: string; sender: string };

async function load(id: string) {
  const [g, m, msgs] = await Promise.all([
    supabase.from('chat_groups').select('id, name, type').eq('id', id).single(),
    supabase.from('chat_group_members').select('user_id, role, is_muted, profiles(username, residents(full_name, areas(name)))').eq('group_id', id),
    supabase.from('messages').select('id, content, image_path, deleted_at, created_at, profiles(username, residents(full_name))').eq('group_id', id).order('created_at', { ascending: false }).limit(60),
  ]);
  if (g.error) throw new Error(g.error.message);
  const members: Member[] = (m.data ?? [])
    .map((x) => {
      const p = one(x.profiles);
      const r = one(p?.residents);
      return { user_id: x.user_id, role: x.role, is_muted: x.is_muted, full_name: r?.full_name ?? p?.username ?? '', area: one(r?.areas)?.name ?? null };
    })
    .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'admin' ? -1 : 1));
  const messages: Msg[] = (msgs.data ?? []).map((x) => {
    const p = one(x.profiles);
    return { id: x.id, content: x.content, image_path: x.image_path, deleted_at: x.deleted_at, created_at: x.created_at, sender: one(p?.residents)?.full_name ?? p?.username ?? '' };
  });
  return { group: g.data, members, messages };
}

export default function ChatAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  const [tab, setTab] = useState<'members' | 'messages'>('members');
  const [picker, setPicker] = useState(false);
  const [renaming, setRenaming] = useState(false);

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await fn();
    if (error) showInfo('Không thực hiện được', friendlyError(error.message));
    await state.reload();
  }

  function deleteGroup(name: string) {
    confirmAction(`Xoá nhóm "${name}"?`, 'Toàn bộ tin nhắn của nhóm sẽ bị xoá vĩnh viễn.', 'Xoá', async () => {
      const { error } = await supabase.from('chat_groups').delete().eq('id', id);
      if (error) return showInfo('Không xoá được', friendlyError(error.message));
      router.back();
    }, true);
  }

  return (
    <ManageShell title={state.data?.group.name ?? 'Nhóm chat'} subtitle={state.data ? `${state.data.members.length} thành viên` : undefined} right={state.data ? <IconButton icon="create-outline" label="Đổi tên nhóm" onPress={() => setRenaming(true)} /> : undefined}>
      <Async state={state}>
        {(d) => {
          const custom = d.group.type === 'custom';
          return (
            <>
              <View style={{ paddingTop: 12 }}>
                <PillTabs<'members' | 'messages'>
                  items={[
                    { key: 'members', label: `Thành viên (${d.members.length})` },
                    { key: 'messages', label: 'Tin nhắn gần đây' },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </View>
              {tab === 'members' ? (
                <ManageList
                  state={state}
                  data={d.members}
                  keyOf={(m) => m.user_id}
                  empty={{ icon: 'people-outline', title: 'Chưa có thành viên' }}
                  header={
                    <>
                      {custom ? (
                        <Button title="Thêm người vào nhóm" icon="person-add" onPress={() => setPicker(true)} />
                      ) : (
                        <Card style={{ backgroundColor: Colors.primarySoft }}>
                          <Txt variant="small" color={Colors.primaryDark}>
                            Thành viên nhóm {d.group.type === 'area' ? 'khu' : 'ban ngành'} tự cập nhật theo danh sách. Ở đây chỉ chỉnh quyền và khoá chat.
                          </Txt>
                        </Card>
                      )}
                      <Button title="Xoá nhóm" icon="trash" variant="dangerOutline" onPress={() => deleteGroup(d.group.name)} />
                    </>
                  }
                  renderItem={(m) => (
                    <RowCard style={{ flexWrap: 'wrap' }}>
                      <Avatar name={m.full_name} size={44} />
                      <View style={{ flex: 1, minWidth: 140 }}>
                        <Txt variant="bodyStrong">{m.full_name}</Txt>
                        {m.area ? (
                          <Txt variant="caption" color={Colors.textSecondary}>
                            {m.area}
                          </Txt>
                        ) : null}
                      </View>
                      {custom && <IconButton icon="close" label="Xoá khỏi nhóm" color={Colors.danger} bg={Colors.dangerSoft} size={40} onPress={() => act(() => supabase.rpc('remove_group_member', { p_group_id: id, p_user_id: m.user_id }))} />}
                      <View style={{ width: '100%' }}>
                        <ToggleRow label="Quản trị nhóm" value={m.role === 'admin'} onChange={(v) => act(() => supabase.rpc('update_group_member', { p_group_id: id, p_user_id: m.user_id, p_role: v ? 'admin' : 'member' }))} />
                        <ToggleRow label="Khoá chat (chỉ đọc)" value={m.is_muted} onChange={(v) => act(() => supabase.rpc('update_group_member', { p_group_id: id, p_user_id: m.user_id, p_is_muted: v }))} />
                      </View>
                    </RowCard>
                  )}
                />
              ) : (
                <ManageList
                  state={state}
                  data={d.messages}
                  keyOf={(m) => m.id}
                  empty={{ icon: 'chatbubble-outline', title: 'Chưa có tin nhắn' }}
                  renderItem={(m) => (
                    <RowCard>
                      <View style={{ flex: 1 }}>
                        <Txt variant="caption" color={Colors.textMuted}>
                          {m.sender} · {fmtDateTime(m.created_at)}
                        </Txt>
                        {m.deleted_at ? (
                          <Txt variant="small" color={Colors.textMuted} style={{ fontStyle: 'italic' }}>
                            Đã thu hồi
                          </Txt>
                        ) : (
                          <Txt variant="body">
                            {m.image_path ? '📷 ' : ''}
                            {m.content}
                          </Txt>
                        )}
                      </View>
                      {!m.deleted_at && (
                        <IconButton
                          icon="trash-outline"
                          label="Thu hồi tin nhắn"
                          color={Colors.danger}
                          bg={Colors.dangerSoft}
                          size={40}
                          onPress={() => confirmAction('Thu hồi tin nhắn?', 'Mọi người sẽ thấy "Tin nhắn đã thu hồi".', 'Thu hồi', () => act(() => supabase.rpc('delete_message', { p_message_id: m.id })), true)}
                        />
                      )}
                    </RowCard>
                  )}
                />
              )}
              <PersonPicker
                visible={picker}
                title="Thêm vào nhóm"
                exclude={d.members.map((m) => m.user_id)}
                onClose={() => setPicker(false)}
                onPick={async (ids) => {
                  await act(() => supabase.rpc('add_group_members', { p_group_id: id, p_user_ids: ids }));
                  setPicker(false);
                }}
              />
            </>
          );
        }}
      </Async>
      {renaming && state.data ? (
        <PromptModal
          visible
          title="Đổi tên nhóm"
          required
          initialValue={state.data.group.name}
          confirmText="Lưu"
          onCancel={() => setRenaming(false)}
          onConfirm={async (text) => {
            setRenaming(false);
            await act(() => supabase.from('chat_groups').update({ name: text.trim() }).eq('id', id));
          }}
        />
      ) : null}
    </ManageShell>
  );
}
