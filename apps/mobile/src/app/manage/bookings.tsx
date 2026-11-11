import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Async, ManageList, ManageShell, PillTabs, RowCard, useLoad } from '@/components/manage-kit';
import { Button, PromptModal, Txt } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { dayTitle, hhmm } from '@/lib/calendar';
import { confirmAction, showInfo } from '@/lib/dialog';
import { one } from '@/lib/manage';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Filter = 'cho_duyet' | 'upcoming' | 'tu_choi' | 'da_huy';

type Row = {
  id: string;
  venue_id: string;
  venue: string;
  purpose: string;
  starts_at: string;
  ends_at: string;
  review_note: string | null;
  name: string;
  phone: string | null;
  area: string | null;
  conflict: boolean;
};

async function load(filter: Filter): Promise<Row[]> {
  let q = supabase
    .from('venue_bookings')
    .select('id, venue_id, purpose, starts_at, ends_at, review_note, venues(name), requester:profiles!venue_bookings_requester_id_fkey(username, residents(full_name, phone, areas(name)))')
    .order('starts_at')
    .limit(150);
  q = filter === 'upcoming' ? q.eq('status', 'da_duyet').gte('ends_at', new Date().toISOString()) : q.eq('status', filter);
  const [p, a] = await Promise.all([
    q,
    filter === 'cho_duyet'
      ? supabase.from('venue_bookings').select('venue_id, starts_at, ends_at').eq('status', 'da_duyet').gte('ends_at', new Date().toISOString())
      : Promise.resolve({ data: [] as { venue_id: string; starts_at: string; ends_at: string }[] }),
  ]);
  return (p.data ?? []).map((b) => {
    const u = one(b.requester);
    const r = one(u?.residents);
    return {
      id: b.id,
      venue_id: b.venue_id,
      venue: one(b.venues)?.name ?? '',
      purpose: b.purpose,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      review_note: b.review_note,
      name: r?.full_name ?? u?.username ?? '',
      phone: r?.phone ?? null,
      area: one(r?.areas)?.name ?? null,
      conflict: (a.data ?? []).some((x) => x.venue_id === b.venue_id && new Date(x.starts_at) < new Date(b.ends_at) && new Date(x.ends_at) > new Date(b.starts_at)),
    };
  });
}

export default function ManageBookingsScreen() {
  const [filter, setFilter] = useState<Filter>('cho_duyet');
  const state = useLoad(() => load(filter), filter);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ row: Row; approve: boolean } | null>(null);

  async function review(r: Row, approve: boolean, note: string) {
    setBusy(r.id);
    const { error } = await supabase.rpc('review_booking', { p_booking_id: r.id, p_approve: approve, p_note: note || undefined });
    setBusy(null);
    setDialog(null);
    if (error) return showInfo('Không thực hiện được', error.message);
    notifyEvent('booking_review', r.id);
    await state.reload();
  }

  function cancel(r: Row) {
    confirmAction('Huỷ lịch đã duyệt?', `${r.venue} · ${dayTitle(new Date(r.starts_at))} · ${r.name}`, 'Huỷ lịch', async () => {
      const { error } = await supabase.rpc('cancel_booking', { p_booking_id: r.id });
      if (error) return showInfo('Không huỷ được', error.message);
      await state.reload();
    }, true);
  }

  return (
    <ManageShell title="Đặt nhà văn hoá / sân">
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(r) => r.id}
            empty={{ icon: 'calendar-outline', title: 'Không có yêu cầu nào' }}
            header={
              <PillTabs<Filter>
                items={[
                  { key: 'cho_duyet', label: 'Chờ duyệt' },
                  { key: 'upcoming', label: 'Đã duyệt, sắp tới' },
                  { key: 'tu_choi', label: 'Từ chối' },
                  { key: 'da_huy', label: 'Đã huỷ' },
                ]}
                value={filter}
                onChange={setFilter}
              />
            }
            renderItem={(r) => (
              <RowCard style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <Txt variant="caption" color={Colors.primaryText}>
                  {r.venue}
                </Txt>
                <Txt variant="subtitle">{dayTitle(new Date(r.starts_at))}</Txt>
                <Txt variant="bodyStrong">
                  {hhmm(r.starts_at)} – {hhmm(r.ends_at)}
                </Txt>
                <Txt variant="body">{r.purpose}</Txt>
                <Txt variant="small" color={Colors.textSecondary}>
                  {[r.name, r.area].filter(Boolean).join(' · ')}
                </Txt>
                {r.review_note ? (
                  <Txt variant="small" color={Colors.textSecondary}>
                    Ghi chú: {r.review_note}
                  </Txt>
                ) : null}
                {r.phone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="call" size={18} color={Colors.primaryText} />
                    <Txt variant="label" color={Colors.primaryText}>
                      {r.phone}
                    </Txt>
                  </Pressable>
                )}
                {r.conflict && (
                  <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft }}>
                    <Ionicons name="warning" size={18} color={Colors.danger} />
                    <Txt variant="small" color={Colors.danger} style={{ flex: 1 }}>
                      Trùng giờ với lịch đã duyệt — không duyệt được. Hãy từ chối hoặc gọi người đặt để đổi giờ.
                    </Txt>
                  </View>
                )}
                {filter === 'cho_duyet' && (
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 4 }}>
                    <Button title="Từ chối" variant="dangerOutline" onPress={() => setDialog({ row: r, approve: false })} style={{ flex: 1 }} />
                    <Button title="Duyệt" icon="checkmark" disabled={r.conflict} loading={busy === r.id} onPress={() => setDialog({ row: r, approve: true })} style={{ flex: 1 }} />
                  </View>
                )}
                {filter === 'upcoming' && <Button title="Huỷ lịch này" variant="dangerOutline" icon="close-circle" onPress={() => cancel(r)} />}
              </RowCard>
            )}
          />
        )}
      </Async>
      <PromptModal
        visible={!!dialog}
        title={dialog?.approve ? 'Duyệt yêu cầu?' : 'Từ chối yêu cầu?'}
        message={dialog?.approve ? 'Ghi chú cho người đặt (không bắt buộc).' : 'Người đặt sẽ thấy lý do.'}
        placeholder={dialog?.approve ? 'VD: Nhớ dọn dẹp sau khi dùng' : 'VD: Trùng lịch họp thôn'}
        confirmText={dialog?.approve ? 'Duyệt' : 'Từ chối'}
        danger={!dialog?.approve}
        onCancel={() => setDialog(null)}
        onConfirm={(note) => (dialog ? review(dialog.row, dialog.approve, note) : undefined)}
      />
    </ManageShell>
  );
}
