import { LEADERSHIP_ROLE_LABEL, PRIORITY_LABEL, type LeadershipRole, type PriorityLevel } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Async, FormSheet, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { Button, Card, Choice, Field, IconButton, Notice, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fmtDateTime } from '@/lib/format';
import { friendlyError } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

const COLOR: Record<PriorityLevel, string> = { khan: Colors.danger, quan_trong: Colors.warning, thuong: Colors.primaryText };

async function load(id: string) {
  const [a, stats, unread, targets] = await Promise.all([
    supabase.from('announcements').select('id, title, content, priority, target_all, scheduled_at, profiles!announcements_sender_id_fkey(username, leadership_role, residents(full_name))').eq('id', id).single(),
    supabase.rpc('announcement_read_stats', { p_announcement: id }),
    supabase.rpc('announcement_unread_list', { p_announcement: id }),
    supabase.from('announcement_targets').select('areas(name), organizations(name)').eq('announcement_id', id),
  ]);
  if (a.error) throw new Error(a.error.message);
  const sender = one(a.data.profiles);
  return {
    a: a.data,
    sender: `${one(sender?.residents)?.full_name ?? sender?.username ?? 'Cán bộ thôn'}${sender?.leadership_role ? ` · ${LEADERSHIP_ROLE_LABEL[sender.leadership_role as LeadershipRole]}` : ''}`,
    stats: stats.data?.[0] ?? null,
    unread: unread.data ?? [],
    targets: (targets.data ?? []).map((t) => one(t.areas)?.name ?? one(t.organizations)?.name ?? '').filter(Boolean),
  };
}

export default function AnnouncementAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('thuong');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    const a = state.data?.a;
    if (!a) return;
    setTitle(a.title);
    setContent(a.content);
    setPriority(a.priority);
    setError(null);
    setEdit(true);
  }

  async function saveEdit() {
    if (!title.trim() || !content.trim()) return setError('Vui lòng nhập đủ tiêu đề và nội dung.');
    setBusy(true);
    const { error: err } = await supabase.from('announcements').update({ title: title.trim(), content: content.trim(), priority }).eq('id', id);
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEdit(false);
    await state.reload();
  }

  function remove() {
    confirmAction('Xoá thông báo này?', 'Người dân sẽ không còn thấy thông báo.', 'Xoá', async () => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) return showInfo('Không xoá được', friendlyError(error.message));
      router.back();
    }, true);
  }

  return (
    <ManageShell title="Chi tiết thông báo" right={state.data ? <IconButton icon="create-outline" label="Sửa thông báo" onPress={openEdit} /> : undefined}>
      <Async state={state}>
        {(d) => {
          const pct = d.stats?.total ? Math.round((d.stats.read_count / d.stats.total) * 100) : 0;
          return (
            <ScrollPage header={null}>
              <Card style={{ padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm }}>
                <Txt variant="caption" color={COLOR[d.a.priority]} style={{ fontFamily: Font.bold }}>
                  {PRIORITY_LABEL[d.a.priority].toUpperCase()}
                </Txt>
                <Txt variant="title">{d.a.title}</Txt>
                <Txt variant="caption" color={Colors.textMuted}>
                  {fmtDateTime(d.a.scheduled_at)} · {d.sender}
                </Txt>
                <Txt variant="small" color={Colors.textSecondary}>
                  Gửi tới: {d.a.target_all ? 'Toàn thôn' : d.targets.join(', ')}
                </Txt>
                <Txt variant="body" selectable style={{ marginTop: Spacing.xs }}>
                  {d.a.content}
                </Txt>
              </Card>

              <Card style={{ padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm }}>
                <Txt variant="subtitle">Đã đọc</Txt>
                <View style={{ height: 12, borderRadius: 6, backgroundColor: Colors.divider, overflow: 'hidden' }}>
                  <View style={{ height: 12, width: `${pct}%`, backgroundColor: Colors.primary }} />
                </View>
                <Txt variant="small" color={Colors.textSecondary}>
                  {d.stats ? `${d.stats.read_count}/${d.stats.total} người (${pct}%)` : '—'}
                </Txt>
              </Card>

              <Txt variant="subtitle">Chưa đọc ({d.unread.length}) — gọi điện nhắc nếu cần</Txt>
              {d.unread.length === 0 ? (
                <Notice tone="success" text="Tất cả đã đọc 🎉" />
              ) : (
                d.unread.slice(0, 100).map((u) => (
                  <RowCard key={u.user_id}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{u.full_name}</Txt>
                      <Txt variant="caption" color={Colors.textSecondary}>
                        {u.area_name ?? ''}
                      </Txt>
                    </View>
                    {u.phone ? (
                      <Pressable onPress={() => Linking.openURL(`tel:${u.phone}`)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: Radius.full, backgroundColor: Colors.primarySoft }}>
                        <Txt variant="label" color={Colors.primaryText}>
                          📞 {u.phone}
                        </Txt>
                      </Pressable>
                    ) : (
                      <Txt variant="caption" color={Colors.textMuted}>
                        Không có SĐT
                      </Txt>
                    )}
                  </RowCard>
                ))
              )}
              {d.unread.length > 100 && (
                <Txt variant="caption" color={Colors.textMuted} center>
                  Hiện 100 người đầu. Xem đầy đủ trên trang quản trị.
                </Txt>
              )}
              <Button title="Xoá thông báo" icon="trash" variant="dangerOutline" onPress={remove} />
            </ScrollPage>
          );
        }}
      </Async>
      <FormSheet visible={edit} title="Sửa thông báo" onClose={() => setEdit(false)} onSave={saveEdit} saving={busy}>
        <Field label="Tiêu đề" value={title} onChangeText={setTitle} />
        <Field label="Nội dung" value={content} onChangeText={setContent} multiline style={{ minHeight: 140, textAlignVertical: 'top' }} />
        <Choice label="Mức độ" options={(Object.keys(PRIORITY_LABEL) as PriorityLevel[]).map((k) => ({ value: k, label: PRIORITY_LABEL[k] }))} value={priority} onChange={setPriority} />
        <Notice tone="info" text="Chỉ sửa được nội dung. Người nhận không đổi và không gửi lại thông báo." />
        <Notice text={error} />
      </FormSheet>
    </ManageShell>
  );
}
