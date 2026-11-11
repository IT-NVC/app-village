import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Choice, Field, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { dayTitle, fetchBusy, fetchVenues, shortWeekday, type Venue } from '@/lib/calendar';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

/** Khung giờ có sẵn — dễ chọn hơn đồng hồ cho người lớn tuổi */
const SLOTS = [
  { key: 'sang', label: 'Buổi sáng', time: '07:00 – 11:30', from: [7, 0], to: [11, 30] },
  { key: 'chieu', label: 'Buổi chiều', time: '13:30 – 17:30', from: [13, 30], to: [17, 30] },
  { key: 'toi', label: 'Buổi tối', time: '18:00 – 22:00', from: [18, 0], to: [22, 0] },
  { key: 'ca_ngay', label: 'Cả ngày', time: '07:00 – 22:00', from: [7, 0], to: [22, 0] },
] as const;

type Busy = { starts_at: string; ends_at: string };

const at = (day: Date, [h, m]: readonly [number, number]) => {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};
const overlaps = (a1: Date, a2: Date, busy: Busy[]) =>
  busy.some((b) => new Date(b.starts_at) < a2 && new Date(b.ends_at) > a1);

export default function NewBookingScreen() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]['key'] | null>(null);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // 30 ngày tới (bắt đầu từ hôm nay)
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, i) => new Date(start.getTime() + i * 86400e3));
  }, []);

  useEffect(() => {
    fetchVenues().then((v) => {
      setVenues(v);
      if (v.length === 1) setVenueId(v[0].id);
    });
  }, []);

  // Khung giờ bận của địa điểm trong ngày đã chọn
  useEffect(() => {
    if (!venueId || !day) return;
    let alive = true;
    fetchBusy(venueId, day).then((b) => alive && setBusy(b));
    return () => {
      alive = false;
    };
  }, [venueId, day]);

  async function submit() {
    if (!venueId || !day || !slot) return setError('Vui lòng chọn địa điểm, ngày và khung giờ.');
    if (purpose.trim().length < 3) return setError('Vui lòng ghi mục đích sử dụng.');
    const s = SLOTS.find((x) => x.key === slot)!;
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('request_booking', {
      p_venue_id: venueId,
      p_purpose: purpose.trim(),
      p_starts_at: at(day, s.from).toISOString(),
      p_ends_at: at(day, s.to).toISOString(),
    });
    setSending(false);
    if (err) return setError(err.message);
    notifyEvent('booking_new', data as string);
    router.back();
  }

  return (
    <ScrollPage header={<PageHeader title="Đặt lịch" subtitle="Cán bộ thôn sẽ duyệt yêu cầu" onBack={() => router.back()} />}>
      <Card style={styles.card}>
        {venues === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Choice
            label="1. Địa điểm"
            options={venues.map((v) => ({ value: v.id, label: v.name }))}
            value={venueId}
            onChange={(v) => {
              setVenueId(v);
              setSlot(null);
              setBusy(null);
            }}
          />
        )}
      </Card>

      <Card style={styles.card}>
        <Txt variant="label">2. Ngày</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
          {days.map((d) => {
            const selected = day?.getTime() === d.getTime();
            return (
              <Pressable
                key={d.getTime()}
                onPress={() => {
                  setDay(d);
                  setSlot(null);
                  setBusy(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={dayTitle(d)}
                style={[styles.day, selected && styles.daySelected]}>
                <Txt variant="caption" color={selected ? Colors.white : Colors.textSecondary}>
                  {shortWeekday(d)}
                </Txt>
                <Txt variant="title" color={selected ? Colors.white : Colors.text} style={{ fontSize: 22, lineHeight: 28 }}>
                  {d.getDate()}
                </Txt>
                <Txt variant="caption" color={selected ? Colors.white : Colors.textMuted} style={{ fontSize: 12, lineHeight: 16 }}>
                  Th{d.getMonth() + 1}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
        {day && (
          <Txt variant="small" color={Colors.primaryText}>
            {dayTitle(day)}
          </Txt>
        )}
      </Card>

      <Card style={styles.card}>
        <Txt variant="label">3. Khung giờ</Txt>
        {!venueId || !day ? (
          <Txt variant="small" color={Colors.textMuted}>
            Chọn địa điểm và ngày trước.
          </Txt>
        ) : busy === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          SLOTS.map((s) => {
            const from = at(day, s.from);
            const to = at(day, s.to);
            const taken = overlaps(from, to, busy);
            const passed = to <= new Date();
            const disabled = taken || passed;
            const selected = slot === s.key;
            return (
              <Pressable
                key={s.key}
                disabled={disabled}
                onPress={() => setSlot(s.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                style={[styles.slot, selected && styles.slotSelected, disabled && { opacity: 0.45 }]}>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={26}
                  color={selected ? Colors.primary : Colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{s.label}</Txt>
                  <Txt variant="small" color={Colors.textSecondary}>
                    {s.time}
                  </Txt>
                </View>
                {taken && (
                  <Txt variant="caption" color={Colors.danger} style={{ fontFamily: Font.bold }}>
                    Đã có người đặt
                  </Txt>
                )}
                {!taken && passed && (
                  <Txt variant="caption" color={Colors.textMuted}>
                    Đã qua
                  </Txt>
                )}
              </Pressable>
            );
          })
        )}
      </Card>

      <Card style={styles.card}>
        <Field
          label="4. Mục đích sử dụng"
          placeholder="VD: Tổ chức tiệc cưới, sinh hoạt câu lạc bộ dưỡng sinh…"
          value={purpose}
          onChangeText={setPurpose}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 14 }}
        />
      </Card>

      <Notice text={error} />
      <Button title="Gửi yêu cầu" icon="send" onPress={submit} loading={sending} />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm },
  day: {
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    backgroundColor: Colors.card,
  },
  daySelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.divider,
  },
  slotSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
});
