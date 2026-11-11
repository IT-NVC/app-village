import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, DateTimePick, FormSheet, ManageShell, RowCard, ToggleRow, refreshControl, useLoad } from '@/components/manage-kit';
import { Button, Card, Field, IconButton, Notice, PromptModal, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Shadow, Spacing } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fmtDateTime } from '@/lib/format';
import { friendlyError } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

async function load(id: string) {
  const [p, r, e] = await Promise.all([
    supabase.from('polls').select('id, title, description, allow_multiple, is_anonymous, vote_scope, closes_at, closed_at').eq('id', id).single(),
    supabase.rpc('poll_results', { p_poll_id: id }),
    supabase.rpc('poll_eligible_count', { p_poll_id: id }),
  ]);
  if (p.error) throw new Error(p.error.message);
  const voters = p.data.is_anonymous ? [] : ((await supabase.rpc('poll_voters', { p_poll_id: id })).data ?? []);
  return { poll: p.data, results: r.data ?? [], eligible: (e.data as number | null) ?? 0, voters };
}

export default function PollAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [closesAt, setClosesAt] = useState<Date | null>(null);
  const [reopen, setReopen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optPrompt, setOptPrompt] = useState<{ id: string | null; label: string } | null>(null);

  function openEdit() {
    const p = state.data?.poll;
    if (!p) return;
    setTitle(p.title);
    setDesc(p.description ?? '');
    setClosesAt(p.closes_at ? new Date(p.closes_at) : null);
    setReopen(false);
    setError(null);
    setEdit(true);
  }

  async function saveEdit() {
    if (!title.trim()) return setError('Vui lòng nhập câu hỏi.');
    setBusy(true);
    const { error: err } = await supabase.rpc('update_poll', {
      p_poll_id: id,
      p_title: title.trim(),
      p_description: desc.trim() || undefined,
      p_closes_at: closesAt ? closesAt.toISOString() : undefined,
      p_no_deadline: !closesAt,
      p_reopen: reopen,
    });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEdit(false);
    await state.reload();
  }

  async function saveOption(text: string) {
    const target = optPrompt;
    setOptPrompt(null);
    if (!target) return;
    const { error: err } = target.id
      ? await supabase.rpc('rename_poll_option', { p_option_id: target.id, p_label: text })
      : await supabase.rpc('add_poll_option', { p_poll_id: id, p_label: text });
    if (err) showInfo('Không lưu được', friendlyError(err.message));
    await state.reload();
  }

  function removeOption(o: { option_id: string; label: string }) {
    confirmAction(`Xoá phương án "${o.label}"?`, 'Chỉ xoá được phương án chưa có ai chọn, và phải còn ít nhất 2 phương án.', 'Xoá', async () => {
      const { error: err } = await supabase.rpc('delete_poll_option', { p_option_id: o.option_id });
      if (err) showInfo('Không xoá được', friendlyError(err.message));
      await state.reload();
    }, true);
  }

  function close() {
    confirmAction('Đóng khảo sát ngay?', 'Bà con sẽ không bỏ phiếu được nữa.', 'Đóng', async () => {
      const { error } = await supabase.rpc('close_poll', { p_poll_id: id });
      if (error) return showInfo('Không đóng được', error.message);
      await state.reload();
    });
  }
  function remove() {
    confirmAction('Xoá khảo sát này?', 'Toàn bộ phiếu bầu sẽ bị xoá.', 'Xoá', async () => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) return showInfo('Không xoá được', friendlyError(error.message));
      router.back();
    }, true);
  }

  return (
    <ManageShell title="Kết quả khảo sát" right={state.data ? <IconButton icon="create-outline" label="Sửa khảo sát" onPress={openEdit} /> : undefined}>
      <Async state={state}>
        {(d) => {
          const open = !d.poll.closed_at && (!d.poll.closes_at || new Date(d.poll.closes_at) > new Date());
          const total = d.results.reduce((n, r) => n + r.votes, 0);
          const max = Math.max(0, ...d.results.map((r) => r.votes));
          const voterCount = d.results[0]?.voters ?? 0;
          const unit = d.poll.vote_scope === 'household' ? 'hộ' : 'người';
          return (
            <ScrollPage header={null} refreshControl={refreshControl(state)}>
              <Card style={{ padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm }}>
                <Txt variant="title">{d.poll.title}</Txt>
                {d.poll.description ? <Txt variant="body" color={Colors.textSecondary}>{d.poll.description}</Txt> : null}
                <Txt variant="caption" color={open ? Colors.success : Colors.textMuted} style={{ fontFamily: Font.bold }}>
                  {open ? 'Đang mở' : 'Đã đóng'}
                  {d.poll.closes_at && open ? ` · hạn ${fmtDateTime(d.poll.closes_at)}` : ''}
                </Txt>
                <Txt variant="small" color={Colors.textSecondary}>
                  Tham gia: {voterCount}/{d.eligible || '?'} {unit}
                  {d.eligible ? ` (${Math.round((voterCount / d.eligible) * 100)}%)` : ''}
                </Txt>
              </Card>

              <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
                <Txt variant="subtitle">Kết quả</Txt>
                {d.results.map((r) => {
                  const pct = total ? Math.round((r.votes / total) * 100) : 0;
                  const lead = r.votes > 0 && r.votes === max;
                  return (
                    <View key={r.option_id} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Txt variant="bodyStrong" style={{ flex: 1 }}>{r.label}</Txt>
                        <Txt variant="bodyStrong" color={lead ? Colors.primaryText : Colors.textSecondary}>{r.votes} phiếu · {pct}%</Txt>
                        <IconButton icon="create-outline" label="Đổi tên phương án" size={36} color={Colors.primaryText} bg={Colors.primarySoft} onPress={() => setOptPrompt({ id: r.option_id, label: r.label })} />
                        <IconButton icon="trash-outline" label="Xoá phương án" size={36} color={Colors.danger} bg={Colors.dangerSoft} onPress={() => removeOption(r)} />
                      </View>
                      <View style={{ height: 14, borderRadius: 7, backgroundColor: Colors.divider, overflow: 'hidden' }}>
                        <View style={{ height: 14, width: `${pct}%`, backgroundColor: lead ? Colors.primary : '#9CCFB0' }} />
                      </View>
                    </View>
                  );
                })}
                <Button title="Thêm phương án" icon="add" variant="secondary" onPress={() => setOptPrompt({ id: null, label: '' })} />
              </Card>

              {d.poll.is_anonymous ? (
                <Notice tone="info" text="Khảo sát ẩn danh — không hiển thị ai chọn gì." />
              ) : (
                <>
                  <Txt variant="subtitle">Người đã bỏ phiếu ({new Set(d.voters.map((v) => v.user_id)).size})</Txt>
                  {d.voters.length === 0 ? (
                    <Txt variant="small" color={Colors.textMuted}>Chưa có ai bỏ phiếu.</Txt>
                  ) : (
                    d.voters.slice(0, 150).map((v) => (
                      <RowCard key={`${v.user_id}-${v.option_label}`}>
                        <View style={{ flex: 1 }}>
                          <Txt variant="bodyStrong">{v.full_name}</Txt>
                          <Txt variant="caption" color={Colors.textSecondary}>{v.area_name ?? ''}</Txt>
                        </View>
                        <Txt variant="label" color={Colors.primaryText}>{v.option_label}</Txt>
                      </RowCard>
                    ))
                  )}
                </>
              )}

              {open && <Button title="Đóng khảo sát ngay" icon="stop-circle" variant="secondary" onPress={close} />}
              <Button title="Xoá khảo sát" icon="trash" variant="dangerOutline" onPress={remove} />
            </ScrollPage>
          );
        }}
      </Async>
      <FormSheet visible={edit} title="Sửa khảo sát" onClose={() => setEdit(false)} onSave={saveEdit} saving={busy}>
        <Field label="Câu hỏi" value={title} onChangeText={setTitle} />
        <Field label="Mô tả" value={desc} onChangeText={setDesc} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />
        <DateTimePick label="Hạn chót" value={closesAt} onChange={setClosesAt} optional hint="Bỏ trống nếu không có hạn." />
        {state.data && (state.data.poll.closed_at || (state.data.poll.closes_at && new Date(state.data.poll.closes_at) <= new Date())) ? (
          <ToggleRow label="Mở lại khảo sát" value={reopen} onChange={setReopen} />
        ) : null}
        <Notice text={error} />
      </FormSheet>
      {optPrompt ? (
        <PromptModal visible title={optPrompt.id ? 'Đổi tên phương án' : 'Thêm phương án'} required initialValue={optPrompt.label} confirmText="Lưu" onCancel={() => setOptPrompt(null)} onConfirm={saveOption} />
      ) : null}
    </ManageShell>
  );
}
