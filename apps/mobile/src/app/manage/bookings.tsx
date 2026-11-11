import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, EmptyState, PageHeader, PromptModal, Txt } from '@/components/ui';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { dayTitle, hhmm } from '@/lib/calendar';
import { showInfo } from '@/lib/dialog';
import { one, useRank } from '@/lib/manage';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Row = {
  id: string;
  venue_id: string;
  venue: string;
  purpose: string;
  starts_at: string;
  ends_at: string;
  name: string;
  phone: string | null;
  area: string | null;
  conflict: boolean;
};

async function fetchPending(): Promise<Row[]> {
  const [p, a] = await Promise.all([
    supabase
      .from('venue_bookings')
      .select('id, venue_id, purpose, starts_at, ends_at, venues(name), requester:profiles!venue_bookings_requester_id_fkey(username, residents(full_name, phone, areas(name)))')
      .eq('status', 'cho_duyet')
      .order('starts_at'),
    supabase.from('venue_bookings').select('venue_id, starts_at, ends_at').eq('status', 'da_duyet').gte('ends_at', new Date().toISOString()),
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
      name: r?.full_name ?? u?.username ?? '',
      phone: r?.phone ?? null,
      area: one(r?.areas)?.name ?? null,
      conflict: (a.data ?? []).some(
        (x) => x.venue_id === b.venue_id && new Date(x.starts_at) < new Date(b.ends_at) && new Date(x.ends_at) > new Date(b.starts_at),
      ),
    };
  });
}

export default function ManageBookingsScreen() {
  const rank = useRank();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ row: Row; approve: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPending().then(setRows);
  }, []);
  const load = useCallback(() => fetchPending().then(setRows), []);

  async function review(r: Row, approve: boolean, note: string) {
    setBusy(r.id);
    const { error } = await supabase.rpc('review_booking', { p_booking_id: r.id, p_approve: approve, p_note: note || undefined });
    setBusy(null);
    setDialog(null);
    if (error) return showInfo('Không thực hiện được', error.message);
    notifyEvent('booking_review', r.id);
    load();
  }

  if (rank < 1) return <Forbidden />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Duyệt đặt lịch" subtitle={rows ? `${rows.length} yêu cầu đang chờ` : undefined} onBack={() => router.back()} />
      {rows === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[Colors.primary]} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {rows.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Không có yêu cầu nào chờ duyệt" />
          ) : (
            rows.map((r) => (
              <Card key={r.id} style={{ padding: Spacing.lg, gap: 6, ...Shadow.sm }}>
                <Txt variant="caption" color={Colors.primaryText}>
                  {r.venue}
                </Txt>
                <Txt variant="title" style={{ fontSize: 21, lineHeight: 28 }}>
                  {dayTitle(new Date(r.starts_at))}
                </Txt>
                <Txt variant="bodyStrong">
                  {hhmm(r.starts_at)} – {hhmm(r.ends_at)}
                </Txt>
                <Txt variant="body">{r.purpose}</Txt>
                <Txt variant="small" color={Colors.textSecondary}>
                  {[r.name, r.area].filter(Boolean).join(' · ')}
                </Txt>
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
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                  <Button title="Từ chối" variant="dangerOutline" onPress={() => setDialog({ row: r, approve: false })} style={{ flex: 1 }} />
                  <Button
                    title="Duyệt"
                    icon="checkmark"
                    disabled={r.conflict}
                    loading={busy === r.id}
                    onPress={() => setDialog({ row: r, approve: true })}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
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
    </View>
  );
}
