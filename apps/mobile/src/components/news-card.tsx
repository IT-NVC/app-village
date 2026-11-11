import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { Colors, Font, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import type { NewsItem } from '@/lib/news';

const open = (id: string) => router.push({ pathname: '/news/[id]', params: { id } });

/** Ảnh bìa; tin không có ảnh thì hiện nền gradient + icon */
function Cover({ url, style }: { url: string | null; style: object }) {
  if (url) return <Image source={{ uri: url }} style={style} contentFit="cover" transition={200} />;
  return (
    <LinearGradient colors={Gradients.primary} style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="newspaper-outline" size={40} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  );
}

/** Thẻ lớn dùng trong dải cuộn ngang ở trang chủ */
export function NewsSlide({ item, width }: { item: NewsItem; width: number }) {
  return (
    <Pressable
      onPress={() => open(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Tin tức: ${item.title}`}
      style={({ pressed }) => [styles.slide, { width }, pressed && { opacity: 0.9 }]}>
      <Cover url={item.cover_url} style={styles.slideCover} />
      <View style={{ padding: Spacing.md, gap: 4 }}>
        {item.is_pinned && <Pinned />}
        <Txt variant="bodyStrong" numberOfLines={2}>
          {item.title}
        </Txt>
        <Txt variant="caption" color={Colors.textMuted}>
          {timeAgo(item.published_at)}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Dòng tin trong trang danh sách */
export function NewsRow({ item }: { item: NewsItem }) {
  return (
    <Pressable
      onPress={() => open(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Tin tức: ${item.title}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <Cover url={item.cover_url} style={styles.rowCover} />
      <View style={{ padding: Spacing.md, gap: 4 }}>
        {item.is_pinned && <Pinned />}
        <Txt variant="subtitle" numberOfLines={2}>
          {item.title}
        </Txt>
        {item.summary ? (
          <Txt variant="small" color={Colors.textSecondary} numberOfLines={3}>
            {item.summary}
          </Txt>
        ) : null}
        <Txt variant="caption" color={Colors.textMuted}>
          {timeAgo(item.published_at)}
        </Txt>
      </View>
    </Pressable>
  );
}

function Pinned() {
  return (
    <View style={styles.pinned}>
      <Ionicons name="pin" size={13} color={Colors.warning} />
      <Txt variant="caption" color={Colors.warning} style={{ fontFamily: Font.bold, fontSize: 12, lineHeight: 16 }}>
        TIN NỔI BẬT
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: Colors.card, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  slideCover: { width: '100%', height: 140, backgroundColor: Colors.divider },
  row: { backgroundColor: Colors.card, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  rowCover: { width: '100%', height: 180, backgroundColor: Colors.divider },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
