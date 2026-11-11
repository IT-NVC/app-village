import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { PRIORITY_STYLE, type Announcement } from '@/lib/announcements';
import { timeAgo } from '@/lib/format';

/** Thẻ thông báo trong danh sách (tab Thông báo, trang chủ) */
export function AnnouncementCard({ item, compact }: { item: Announcement; compact?: boolean }) {
  const p = PRIORITY_STYLE[item.priority];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/announcement/[id]', params: { id: item.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Chưa đọc. '}${p.label}. ${item.title}`}
      style={({ pressed }) => [styles.card, !item.read && styles.cardUnread, pressed && { opacity: 0.85 }]}>
      <View style={[styles.stripe, { backgroundColor: p.color }]} />
      <View style={[styles.icon, { backgroundColor: p.bg }]}>
        <Ionicons name={p.icon} size={24} color={p.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.metaRow}>
          {item.priority !== 'thuong' && (
            <Txt variant="caption" color={p.color} style={{ fontFamily: Font.bold }}>
              {p.label.toUpperCase()} ·{' '}
            </Txt>
          )}
          <Txt variant="caption" color={Colors.textMuted}>
            {timeAgo(item.scheduled_at)}
          </Txt>
          {!item.read && <View style={styles.dot} />}
        </View>
        <Txt variant="bodyStrong" numberOfLines={2} style={!item.read && { fontFamily: Font.bold }}>
          {item.title}
        </Txt>
        {!compact && (
          <Txt variant="small" color={Colors.textSecondary} numberOfLines={2}>
            {item.content}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    paddingLeft: Spacing.md + 4,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardUnread: { backgroundColor: '#FBFEFC' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger, marginLeft: 8 },
});
