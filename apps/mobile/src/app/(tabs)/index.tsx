import { Ionicons } from '@expo/vector-icons';
import { LEADERSHIP_ROLE_LABEL } from '@thon/shared';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

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
import { AnnouncementCard } from '@/components/announcement-card';
import { NewsSlide } from '@/components/news-card';
import { Colors, Font, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/lib/announcements';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/dialog';
import { fetchNews, type NewsItem } from '@/lib/news';
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
  { icon: 'hand-left', label: 'Biểu quyết', desc: 'Góp ý việc chung', to: '/polls', color: '#C2185B', bg: '#FCE4EC' },
  { icon: 'newspaper', label: 'Tin tức', desc: 'Hoạt động của thôn', to: '/news', color: Colors.primaryText, bg: Colors.primarySoft },
  { icon: 'calendar', label: 'Lịch thôn', desc: 'Lịch họp, đặt nhà văn hoá', to: '/calendar', color: '#00796B', bg: '#E0F2F1' },
  { icon: 'wallet', label: 'Quỹ thôn', desc: 'Công khai thu chi', to: '/funds', color: '#5D4037', bg: '#EFEBE9' },
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
  const { items, unreadCount, refresh: refreshAnnouncements } = useAnnouncements();
  const latest = items.slice(0, 3);
  const urgent = items.find((a) => a.priority === 'khan' && !a.read);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const { width } = useWindowDimensions();
  const slideWidth = Math.min(width * 0.78, 340);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchContacts().then(setContacts);
    fetchNews(6).then(setNews);
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
            const [c, n] = await Promise.all([fetchContacts(), fetchNews(6), refreshAnnouncements()]);
            setContacts(c);
            setNews(n);
            setRefreshing(false);
          }}
        />
      }
      header={
        <GradientHeader extraBottom={52}>
          <View style={styles.headerTop}>
            <Avatar name={me?.full_name} url={me?.avatar_url} light size={54} />
            <View style={{ flex: 1 }}>
              <Txt variant="small" color="rgba(255,255,255,0.88)">
                {greeting()},
              </Txt>
              <Txt variant="title" color={Colors.white} numberOfLines={1}>
                {me?.full_name ?? 'bà con'}
              </Txt>
            </View>
            <View>
              <IconButton
                icon="notifications-outline"
                label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
                onPress={() => router.navigate('/notifications')}
              />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Txt variant="caption" color={Colors.white} style={{ fontFamily: Font.bold, fontSize: 12, lineHeight: 16 }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Txt>
                </View>
              )}
            </View>
          </View>
          <View style={styles.chips}>
            <Chip light icon="calendar-outline" text={today()} />
            {me?.area_name ? <Chip light icon="location-outline" text={me.area_name} /> : null}
            {me?.leadership_role ? <Chip light icon="ribbon-outline" text={LEADERSHIP_ROLE_LABEL[me.leadership_role]} /> : null}
          </View>
        </GradientHeader>
      }>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Khẩn cấp, báo ngay cho cán bộ thôn"
        onPress={() => router.push('/sos')}
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

      {urgent && (
        <Pressable
          onPress={() => router.push({ pathname: '/announcement/[id]', params: { id: urgent.id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.urgent, pressed && { opacity: 0.85 }]}>
          <Ionicons name="megaphone" size={26} color={Colors.danger} />
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={Colors.danger} style={{ fontFamily: Font.bold }}>
              THÔNG BÁO KHẨN
            </Txt>
            <Txt variant="bodyStrong" numberOfLines={2}>
              {urgent.title}
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.danger} />
        </Pressable>
      )}

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

      {news.length > 0 && (
        <>
          <SectionTitle
            title="Tin tức của thôn"
            action={
              <Pressable onPress={() => router.push('/news')} hitSlop={10} accessibilityRole="link">
                <Txt variant="label" color={Colors.primaryText}>
                  Xem tất cả
                </Txt>
              </Pressable>
            }
          />
          {/* Dải cuộn ngang tràn ra hai mép màn hình */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={slideWidth + Spacing.md}
            decelerationRate="fast"
            style={{ marginHorizontal: -Spacing.lg }}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: 4 }}>
            {news.map((n) => (
              <NewsSlide key={n.id} item={n} width={slideWidth} />
            ))}
          </ScrollView>
        </>
      )}

      <SectionTitle
        title="Thông báo mới"
        action={
          <Pressable onPress={() => router.navigate('/notifications')} hitSlop={10} accessibilityRole="link">
            <Txt variant="label" color={Colors.primaryText}>
              Xem tất cả
            </Txt>
          </Pressable>
        }
      />
      {latest.length === 0 ? (
        <Card>
          <Txt variant="small" color={Colors.textSecondary} style={{ paddingVertical: Spacing.sm }}>
            Chưa có thông báo nào.
          </Txt>
        </Card>
      ) : (
        latest.map((a) => <AnnouncementCard key={a.id} item={a} compact />)
      )}

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
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dangerSoft,
    borderWidth: 1.5,
    borderColor: '#F3C2C2',
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
