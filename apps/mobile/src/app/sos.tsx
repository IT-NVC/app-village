import { Ionicons } from '@expo/vector-icons';
import type { SosStatus } from '@thon/shared';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, Vibration, View } from 'react-native';

import { Card, GradientHeader, IconButton, IconCircle, Notice, ScrollPage, Txt, type IconName } from '@/components/ui';
import { Colors, Font, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const HOLD_MS = 3000;
const BUTTON = 220;

const REASONS: { key: string; label: string; icon: IconName }[] = [
  { key: 'Cháy nổ', label: 'Cháy nổ', icon: 'flame' },
  { key: 'Tai nạn', label: 'Tai nạn', icon: 'car' },
  { key: 'Ốm đau, cần cấp cứu', label: 'Cấp cứu', icon: 'medkit' },
  { key: 'Trộm cắp, an ninh', label: 'An ninh', icon: 'shield' },
  { key: 'Khác', label: 'Khác', icon: 'help-circle' },
];

const HOTLINES = [
  { phone: '113', label: 'Công an', icon: 'shield-checkmark' as IconName },
  { phone: '114', label: 'Cứu hoả', icon: 'flame' as IconName },
  { phone: '115', label: 'Cấp cứu', icon: 'medkit' as IconName },
];

type SosEvent = { id: string; status: SosStatus; created_at: string; message: string | null; latitude: number | null };
type Coords = { latitude: number; longitude: number };

const STEPS: { status: SosStatus; title: string }[] = [
  { status: 'dang_cho', title: 'Đã gửi tín hiệu tới cán bộ thôn' },
  { status: 'da_tiep_nhan', title: 'Cán bộ đã tiếp nhận, đang tới hỗ trợ' },
  { status: 'da_xu_ly', title: 'Đã xử lý xong' },
];
const ORDER: Record<SosStatus, number> = { dang_cho: 0, da_tiep_nhan: 1, da_xu_ly: 2 };

/** Lấy vị trí: thử vị trí hiện tại trong 8 giây, không được thì dùng vị trí gần nhất */
async function locate(): Promise<Coords | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 8000));
    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout,
    ]).catch(() => null);
    const pos = current ?? (await Location.getLastKnownPositionAsync().catch(() => null));
    return pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

export default function SosScreen() {
  const { me } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationOk, setLocationOk] = useState<boolean | null>(null);
  const [event, setEvent] = useState<SosEvent | null>(null);
  // Giữ một Animated.Value cố định suốt vòng đời màn hình
  const [progress] = useState(() => new Animated.Value(0));

  // Xin quyền vị trí ngay khi mở màn hình + tải tín hiệu gần nhất của mình
  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then((r) => setLocationOk(r.status === 'granted'))
      .catch(() => setLocationOk(false));
    if (!me) return;
    const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    supabase
      .from('sos_events')
      .select('id, status, created_at, message, latitude')
      .eq('user_id', me.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data && setEvent(data));
  }, [me]);

  // Theo dõi trạng thái xử lý theo thời gian thực
  useEffect(() => {
    if (!event?.id) return;
    const channel = supabase
      .channel(`sos-${event.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_events', filter: `id=eq.${event.id}` },
        (payload) => {
          const next = payload.new as SosEvent;
          setEvent((prev) => (prev ? { ...prev, status: next.status } : prev));
          if (next.status === 'da_tiep_nhan') Vibration.vibrate(400);
        },
      )
      .subscribe();
    // Dự phòng khi Realtime lỡ sự kiện: hỏi lại trạng thái mỗi 15 giây cho tới khi xử lý xong
    const timer = setInterval(async () => {
      const { data } = await supabase.from('sos_events').select('status').eq('id', event.id).maybeSingle();
      if (!data) return;
      setEvent((prev) => {
        if (!prev || prev.status === data.status) return prev;
        if (data.status === 'da_tiep_nhan') Vibration.vibrate(400);
        return { ...prev, status: data.status };
      });
      if (data.status === 'da_xu_ly') clearInterval(timer);
    }, 15_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [event?.id]);

  async function send() {
    if (!me) return;
    setSending(true);
    setError(null);
    Vibration.vibrate([0, 200, 100, 200]);
    const coords = await locate();
    const { data, error: err } = await supabase
      .from('sos_events')
      .insert({ user_id: me.id, latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null, message: reason })
      .select('id, status, created_at, message, latitude')
      .single();
    setSending(false);
    progress.setValue(0);
    if (err) {
      setError(err.message.includes('vừa gửi') ? err.message : `Gửi không thành công: ${err.message}. Hãy gọi trực tiếp số khẩn cấp bên dưới.`);
      return;
    }
    setEvent(data);
  }

  function onPressIn() {
    if (sending) return;
    setHolding(true);
    Vibration.vibrate(30);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: true }).start(
      ({ finished }) => {
        setHolding(false);
        if (finished) send();
      },
    );
  }

  function onPressOut() {
    if (sending) return;
    progress.stopAnimation((v) => {
      if (v < 1) {
        setHolding(false);
        Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      }
    });
  }

  const active = event && event.status !== 'da_xu_ly';
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] });

  return (
    <ScrollPage
      overlap={28}
      header={
        <GradientHeader colors={Gradients.danger} extraBottom={36}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <IconButton icon="close" label="Đóng" onPress={() => router.back()} size={44} />
            <View style={{ flex: 1 }}>
              <Txt variant="title" color={Colors.white}>
                Khẩn cấp
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.9)">
                Báo ngay cho cán bộ thôn
              </Txt>
            </View>
          </View>
        </GradientHeader>
      }>
      {active && (
        <Card style={[styles.card, { borderWidth: 2, borderColor: Colors.danger }]}>
          <Txt variant="subtitle">Tín hiệu của bạn · {timeAgo(event.created_at)}</Txt>
          {STEPS.map((s, i) => {
            const done = ORDER[event.status] >= i;
            return (
              <View key={s.status} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <IconCircle
                  icon={done ? 'checkmark' : 'ellipse-outline'}
                  size={36}
                  color={done ? Colors.white : Colors.textMuted}
                  bg={done ? Colors.success : Colors.divider}
                />
                <Txt variant="bodyStrong" color={done ? Colors.text : Colors.textMuted} style={{ flex: 1 }}>
                  {s.title}
                </Txt>
              </View>
            );
          })}
          <Txt variant="small" color={Colors.textSecondary}>
            Giữ máy bên mình. Nếu nguy hiểm đến tính mạng, hãy gọi ngay số khẩn cấp bên dưới.
          </Txt>
        </Card>
      )}

      <Card style={styles.card}>
        <Txt variant="subtitle">Chuyện gì đang xảy ra?</Txt>
        <Txt variant="small" color={Colors.textSecondary} style={{ marginTop: -6 }}>
          Không bắt buộc — chọn nhanh nếu được
        </Txt>
        <View style={styles.reasons}>
          {REASONS.map((r) => {
            const selected = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(selected ? null : r.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.reason, selected && styles.reasonSelected]}>
                <Ionicons name={r.icon} size={20} color={selected ? Colors.white : Colors.danger} />
                <Txt variant="caption" color={selected ? Colors.white : Colors.danger} style={{ fontFamily: Font.semibold }}>
                  {r.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Nút giữ 3 giây */}
      <View style={styles.holdArea}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel="Giữ 3 giây để gửi tín hiệu khẩn cấp"
          style={styles.holdOuter}>
          <View style={styles.holdButton}>
            <Animated.View style={[styles.holdFill, { transform: [{ scale }] }]} />
            <Ionicons name={sending ? 'radio' : 'alert'} size={64} color={Colors.white} />
            <Txt variant="subtitle" color={Colors.white} center style={{ fontFamily: Font.extrabold }}>
              {sending ? 'ĐANG GỬI…' : holding ? 'GIỮ TIẾP…' : 'GIỮ 3 GIÂY'}
            </Txt>
            {!sending && !holding && (
              <Txt variant="caption" color="rgba(255,255,255,0.9)" center>
                để gửi tín hiệu
              </Txt>
            )}
          </View>
        </Pressable>
        <Txt variant="small" color={Colors.textSecondary} center>
          {locationOk === false
            ? 'Chưa có quyền vị trí — tín hiệu vẫn gửi được nhưng không kèm vị trí.'
            : 'Tín hiệu gửi kèm vị trí của bạn tới Bí thư, Trưởng thôn và Phó thôn.'}
        </Txt>
      </View>

      <Notice text={error} />

      <Txt variant="subtitle">Gọi ngay</Txt>
      <View style={styles.hotlines}>
        {HOTLINES.map((h) => (
          <Pressable
            key={h.phone}
            onPress={() => Linking.openURL(`tel:${h.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`Gọi ${h.label} ${h.phone}`}
            style={({ pressed }) => [styles.hotline, pressed && { opacity: 0.8 }]}>
            <Ionicons name={h.icon} size={26} color={Colors.danger} />
            <Txt variant="title" color={Colors.danger}>
              {h.phone}
            </Txt>
            <Txt variant="caption" color={Colors.textSecondary}>
              {h.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.md },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: '#F3C2C2',
    backgroundColor: Colors.card,
  },
  reasonSelected: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  holdArea: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  holdOuter: {
    width: BUTTON + 36,
    height: BUTTON + 36,
    borderRadius: (BUTTON + 36) / 2,
    backgroundColor: Colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.lg,
  },
  holdFill: {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: '#8E1414',
  },
  hotlines: { flexDirection: 'row', gap: Spacing.md },
  hotline: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
});
