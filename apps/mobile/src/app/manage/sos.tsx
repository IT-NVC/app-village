import { Ionicons } from '@expo/vector-icons';
import type { SosStatus } from '@thon/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Vibration, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, EmptyState, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { showInfo } from '@/lib/dialog';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { one, useRank } from '@/lib/manage';
import { notifyEvent } from '@/lib/push';
import { newChannel, supabase } from '@/lib/supabase';

type Row = {
  id: string;
  status: SosStatus;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  name: string;
  phone: string | null;
  area: string | null;
  handler: string | null;
};

async function fetchSos(): Promise<Row[]> {
  const since = new Date(Date.now() - 3 * 86400e3).toISOString();
  const { data } = await supabase
    .from('sos_events')
    .select(
      'id, status, message, latitude, longitude, created_at, sender:profiles!sos_events_user_id_fkey(username, residents(full_name, phone, areas(name))), handler:profiles!sos_events_handled_by_fkey(username, residents(full_name))',
    )
    .or(`status.neq.da_xu_ly,created_at.gte.${since}`)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((e) => {
    const s = one(e.sender);
    const r = one(s?.residents);
    const h = one(e.handler);
    return {
      id: e.id,
      status: e.status,
      message: e.message,
      latitude: e.latitude,
      longitude: e.longitude,
      created_at: e.created_at,
      name: r?.full_name ?? s?.username ?? 'Người dân',
      phone: r?.phone ?? null,
      area: one(r?.areas)?.name ?? null,
      handler: one(h?.residents)?.full_name ?? h?.username ?? null,
    };
  });
}

const STATUS: Record<SosStatus, { label: string; color: string; bg: string }> = {
  dang_cho: { label: 'ĐANG CHỜ', color: Colors.white, bg: Colors.danger },
  da_tiep_nhan: { label: 'Đã tiếp nhận', color: Colors.warning, bg: Colors.warningSoft },
  da_xu_ly: { label: 'Đã xử lý', color: Colors.success, bg: Colors.successSoft },
};

export default function ManageSosScreen() {
  const rank = useRank();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => fetchSos().then(setRows), []);

  useEffect(() => {
    fetchSos().then(setRows);
    const channel = newChannel('manage-sos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_events' }, () => {
        Vibration.vibrate([0, 500, 200, 500]);
        fetchSos().then(setRows);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_events' }, () => fetchSos().then(setRows))
      .subscribe();
    const timer = setInterval(() => fetchSos().then(setRows), 20_000); // dự phòng khi Realtime lỡ sự kiện
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  async function handle(r: Row, status: SosStatus) {
    setBusy(r.id);
    const { error } = await supabase.rpc('handle_sos', { p_sos_id: r.id, p_status: status });
    setBusy(null);
    if (error) return showInfo('Không thực hiện được', error.message);
    notifyEvent('sos_update', r.id);
    load();
  }

  if (rank < 1) return <Forbidden />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Khẩn cấp (SOS)" subtitle="Tín hiệu 3 ngày gần nhất" onBack={() => router.back()} />
      {rows === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[Colors.primary]} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {rows.length === 0 ? (
            <EmptyState icon="shield-checkmark-outline" title="Không có tín hiệu khẩn cấp" message="Khi người dân bấm SOS, máy sẽ rung và tín hiệu hiện ở đây." />
          ) : (
            rows.map((r) => {
              const st = STATUS[r.status];
              const waiting = r.status === 'dang_cho';
              return (
                <Card key={r.id} style={[styles.card, waiting && { borderWidth: 2, borderColor: Colors.danger }]}>
                  <View style={styles.top}>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Txt variant="caption" color={st.color} style={{ fontFamily: Font.bold }}>
                        {st.label}
                      </Txt>
                    </View>
                    <Txt variant="caption" color={Colors.textMuted}>
                      {timeAgo(r.created_at)} · {fmtDateTime(r.created_at)}
                    </Txt>
                  </View>
                  <Txt variant="title">{r.name}</Txt>
                  <Txt variant="body" color={Colors.textSecondary}>
                    {[r.area, r.message ?? 'Không ghi sự việc'].filter(Boolean).join(' · ')}
                  </Txt>
                  {r.handler && r.status !== 'dang_cho' && (
                    <Txt variant="small" color={Colors.textSecondary}>
                      Người xử lý: {r.handler}
                    </Txt>
                  )}
                  <View style={styles.actions}>
                    <Action
                      icon="call"
                      label={r.phone ? 'Gọi điện' : 'Không có SĐT'}
                      disabled={!r.phone}
                      onPress={() => Linking.openURL(`tel:${r.phone}`)}
                    />
                    <Action
                      icon="map"
                      label={r.latitude != null ? 'Xem bản đồ' : 'Không có vị trí'}
                      disabled={r.latitude == null}
                      onPress={() => Linking.openURL(`https://www.google.com/maps?q=${r.latitude},${r.longitude}`)}
                    />
                  </View>
                  {r.status === 'dang_cho' && (
                    <Button title="Tiếp nhận" icon="hand-right" variant="danger" loading={busy === r.id} onPress={() => handle(r, 'da_tiep_nhan')} />
                  )}
                  {r.status === 'da_tiep_nhan' && (
                    <Button title="Đã xử lý xong" icon="checkmark-done" loading={busy === r.id} onPress={() => handle(r, 'da_xu_ly')} />
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, disabled && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={22} color={Colors.primaryText} />
      <Txt variant="label" color={Colors.primaryText}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm, ...Shadow.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.xs },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.card,
  },
});

