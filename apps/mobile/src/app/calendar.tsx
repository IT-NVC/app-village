import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, IconCircle, PageHeader, SectionTitle, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  BOOKING_STATUS,
  dayTitle,
  fetchAgenda,
  fetchMyBookings,
  hhmm,
  type AgendaItem,
  type MyBooking,
} from '@/lib/calendar';
import { confirmAction, showInfo } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

export default function CalendarScreen() {
  const { me } = useAuth();
  const [agenda, setAgenda] = useState<AgendaItem[] | null>(null);
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const [a, m] = await Promise.all([fetchAgenda(), fetchMyBookings(me.id)]);
    setAgenda(a);
    setMine(m);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Gom theo ngày
  const days: { date: Date; items: AgendaItem[] }[] = [];
  for (const it of agenda ?? []) {
    const d = new Date(it.starts_at);
    d.setHours(0, 0, 0, 0);
    const last = days[days.length - 1];
    if (last && last.date.getTime() === d.getTime()) last.items.push(it);
    else days.push({ date: d, items: [it] });
  }

  function cancel(b: MyBooking) {
    confirmAction('Huỷ lịch đặt?', `${b.venue} · ${dayTitle(new Date(b.starts_at))}`, 'Huỷ lịch', async () => {
      const { error } = await supabase.rpc('cancel_booking', { p_booking_id: b.id });
      if (error) showInfo('Không huỷ được', error.message);
      load();
    }, true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Lịch thôn" subtitle="Sự kiện và lịch nhà văn hoá" onBack={() => router.back()} />
      {agenda === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[Colors.primary]}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }>
          <Button title="Đặt nhà văn hoá / sân thể thao" icon="add-circle" onPress={() => router.push('/booking/new')} />

          {mine.filter((b) => b.status !== 'da_huy').length > 0 && (
            <>
              <SectionTitle title="Lịch đặt của tôi" />
              {mine
                .filter((b) => b.status !== 'da_huy')
                .map((b) => {
                  const st = BOOKING_STATUS[b.status];
                  const canCancel = (b.status === 'cho_duyet' || b.status === 'da_duyet') && new Date(b.ends_at) > new Date();
                  return (
                    <Card key={b.id} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        <Txt variant="bodyStrong" style={{ flex: 1 }}>
                          {b.venue}
                        </Txt>
                        <View style={[styles.badge, { backgroundColor: st.bg }]}>
                          <Txt variant="caption" color={st.color} style={{ fontFamily: Font.bold }}>
                            {st.label}
                          </Txt>
                        </View>
                      </View>
                      <Txt variant="small" color={Colors.textSecondary}>
                        {dayTitle(new Date(b.starts_at))} · {hhmm(b.starts_at)}–{hhmm(b.ends_at)}
                      </Txt>
                      <Txt variant="small">{b.purpose}</Txt>
                      {b.review_note ? (
                        <Txt variant="small" color={st.color}>
                          Cán bộ: {b.review_note}
                        </Txt>
                      ) : null}
                      {canCancel && (
                        <Pressable onPress={() => cancel(b)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
                          <Txt variant="label" color={Colors.danger}>
                            Huỷ lịch
                          </Txt>
                        </Pressable>
                      )}
                    </Card>
                  );
                })}
            </>
          )}

          <SectionTitle title="Sắp diễn ra" />
          {days.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Chưa có lịch nào" message="Lịch họp, lễ hội, thu gom rác… của thôn sẽ hiện ở đây." />
          ) : (
            days.map((d) => (
              <View key={d.date.toISOString()} style={{ gap: Spacing.sm }}>
                <Txt variant="label" color={Colors.primaryText}>
                  {dayTitle(d.date)}
                </Txt>
                {d.items.map((it) => (
                  <View key={it.key} style={[styles.item, it.kind === 'booking' && { opacity: 0.85 }]}>
                    <View style={styles.time}>
                      <Txt variant="bodyStrong">{hhmm(it.starts_at)}</Txt>
                      {it.ends_at ? (
                        <Txt variant="caption" color={Colors.textMuted}>
                          {hhmm(it.ends_at)}
                        </Txt>
                      ) : null}
                    </View>
                    <View style={[styles.bar, { backgroundColor: it.color }]} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="bodyStrong">{it.title}</Txt>
                      {it.location && it.kind === 'event' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="location-outline" size={15} color={Colors.textSecondary} />
                          <Txt variant="small" color={Colors.textSecondary}>
                            {it.location}
                          </Txt>
                        </View>
                      ) : null}
                      {it.detail ? (
                        <Txt variant="small" color={Colors.textSecondary} numberOfLines={3}>
                          {it.detail}
                        </Txt>
                      ) : null}
                    </View>
                    <IconCircle icon={it.icon} color={it.color} bg={it.bg} size={40} />
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  time: { width: 52, alignItems: 'center' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
