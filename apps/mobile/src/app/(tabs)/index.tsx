import { Ionicons } from '@expo/vector-icons';
import { LEADERSHIP_ROLE_LABEL } from '@thon/shared';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Card,
  Chip,
  GradientHeader,
  IconButton,
  IconCircle,
  ListRow,
  ScrollPage,
  SectionTitle,
  Txt,
  type IconName,
} from '@/components/ui';
import { Colors, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { confirmAction, showInfo } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

type Contact = { id: string; name: string; title: string | null; phone: string; category: string };

const CONTACT_STYLE: Record<string, { icon: IconName; color: string; bg: string }> = {
  khan_cap: { icon: 'alert-circle', color: Colors.danger, bg: Colors.dangerSoft },
  y_te: { icon: 'medkit', color: Colors.success, bg: Colors.successSoft },
  can_bo: { icon: 'person', color: Colors.info, bg: Colors.infoSoft },
  dich_vu: { icon: 'construct', color: Colors.warning, bg: Colors.warningSoft },
};

const TILES: { icon: IconName; label: string; desc: string; to: Href; color: string; bg: string }[] = [
  { icon: 'notifications', label: 'Thông báo', desc: 'Tin từ thôn', to: '/notifications', color: Colors.warning, bg: Colors.warningSoft },
  { icon: 'construct', label: 'Phản ánh', desc: 'Báo sự cố', to: '/reports', color: Colors.purple, bg: Colors.purpleSoft },
  { icon: 'chatbubbles', label: 'Tin nhắn', desc: 'Nhóm của bạn', to: '/chat', color: Colors.info, bg: Colors.infoSoft },
  { icon: 'person-circle', label: 'Cá nhân', desc: 'Thông tin của bạn', to: '/profile', color: Colors.primaryText, bg: Colors.primarySoft },
];

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function today() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}

async function fetchContacts(): Promise<Contact[]> {
  const { data } = await supabase.from('contacts').select('id, name, title, phone, category').order('sort_order');
  return data ?? [];
}

export default function HomeScreen() {
  const { me } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchContacts().then(setContacts);
  }, []);

  const call = (c: Contact) => confirmAction(`Gọi ${c.name}?`, c.phone, 'Gọi', () => Linking.openURL(`tel:${c.phone}`));

  return (
    <ScrollPage
      overlap={44}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          colors={[Colors.primary]}
          onRefresh={async () => {
            setRefreshing(true);
            setContacts(await fetchContacts());
            setRefreshing(false);
          }}
        />
      }
      header={
        <GradientHeader extraBottom={52}>
          <View style={styles.headerTop}>
            <Avatar name={me?.full_name} light size={54} />
            <View style={{ flex: 1 }}>
              <Txt variant="small" color="rgba(255,255,255,0.88)">
                {greeting()},
              </Txt>
              <Txt variant="title" color={Colors.white} numberOfLines={1}>
                {me?.full_name ?? 'bà con'}
              </Txt>
            </View>
            <IconButton icon="notifications-outline" label="Thông báo" onPress={() => router.navigate('/notifications')} />
          </View>
          <View style={styles.chips}>
            <Chip light icon="calendar-outline" text={today()} />
            {me?.area_name ? <Chip light icon="location-outline" text={me.area_name} /> : null}
            {me?.leadership_role ? <Chip light icon="ribbon-outline" text={LEADERSHIP_ROLE_LABEL[me.leadership_role]} /> : null}
          </View>
        </GradientHeader>
      }>
      {/* Nút khẩn cấp: logic giữ 3 giây + gửi vị trí sẽ làm ở giai đoạn sau */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Khẩn cấp, báo ngay cho cán bộ thôn"
        onPress={() => showInfo('Khẩn cấp', 'Tính năng gửi tín hiệu khẩn cấp đang được xây dựng.')}
        style={({ pressed }) => [styles.sosWrap, pressed && { transform: [{ scale: 0.98 }] }]}>
        <LinearGradient colors={Gradients.danger} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sos}>
          <View style={styles.sosIcon}>
            <Ionicons name="alert" size={34} color={Colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="title" color={Colors.white}>
              KHẨN CẤP
            </Txt>
            <Txt variant="small" color="rgba(255,255,255,0.92)">
              Báo ngay cho cán bộ thôn
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={28} color={Colors.white} />
        </LinearGradient>
      </Pressable>

      <SectionTitle title="Tiện ích" />
      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable
            key={t.label}
            onPress={() => router.navigate(t.to)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
            <IconCircle icon={t.icon} color={t.color} bg={t.bg} size={56} />
            <View>
              <Txt variant="bodyStrong">{t.label}</Txt>
              <Txt variant="caption" color={Colors.textSecondary}>
                {t.desc}
              </Txt>
            </View>
          </Pressable>
        ))}
      </View>

      <SectionTitle title="Danh bạ khẩn cấp" />
      <Card style={{ paddingVertical: Spacing.xs }}>
        {contacts.length === 0 ? (
          <Txt variant="small" color={Colors.textSecondary} style={{ paddingVertical: Spacing.md }}>
            Chưa có số điện thoại nào.
          </Txt>
        ) : (
          contacts.map((c, i) => {
            const s = CONTACT_STYLE[c.category] ?? CONTACT_STYLE.can_bo;
            return (
              <ListRow
                key={c.id}
                icon={s.icon}
                iconColor={s.color}
                iconBg={s.bg}
                title={c.name}
                subtitle={c.title ? `${c.title} · ${c.phone}` : c.phone}
                divider={i < contacts.length - 1}
                onPress={() => call(c)}
                right={
                  <View style={styles.callBtn}>
                    <Ionicons name="call" size={22} color={Colors.white} />
                  </View>
                }
              />
            );
          })
        )}
      </Card>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  sosWrap: { borderRadius: Radius.lg, ...Shadow.md },
  sos: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg },
  sosIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
