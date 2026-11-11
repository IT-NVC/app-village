import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, IconButton, PageHeader, Txt } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fmtDateTime } from '@/lib/format';
import { fetchNewsItem, type NewsItem } from '@/lib/news';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<NewsItem | null | undefined>(undefined);

  useEffect(() => {
    fetchNewsItem(id).then(setItem);
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/news'));

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Tin tức" onBack={back} />
        {item === undefined ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <EmptyState icon="newspaper-outline" title="Không tìm thấy tin" message="Tin có thể đã bị gỡ." />
        )}
      </View>
    );
  }

  // Chia đoạn theo dòng trống để dễ đọc
  const paragraphs = item.content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.card }}>
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xl }} showsVerticalScrollIndicator={false}>
        {item.cover_url ? (
          <Image source={{ uri: item.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, { height: insets.top + 64, backgroundColor: Colors.primary }]} />
        )}
        <View style={styles.body}>
          <Txt variant="hero" style={{ fontSize: 26, lineHeight: 34 }}>
            {item.title}
          </Txt>
          <Txt variant="caption" color={Colors.textMuted}>
            {fmtDateTime(item.published_at)}
          </Txt>
          {item.summary ? (
            <View style={styles.summary}>
              <Txt variant="bodyStrong" color={Colors.primaryDark} style={{ fontSize: 18, lineHeight: 28 }}>
                {item.summary}
              </Txt>
            </View>
          ) : null}
          {paragraphs.map((p, i) => (
            <Txt key={i} variant="body" selectable style={{ fontSize: 19, lineHeight: 31 }}>
              {p}
            </Txt>
          ))}
        </View>
      </ScrollView>
      {/* Nút quay lại nổi trên ảnh bìa */}
      <View style={[styles.back, { top: insets.top + Spacing.sm }]}>
        <IconButton icon="arrow-back" label="Quay lại" onPress={back} bg="rgba(0,0,0,0.35)" size={46} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 260, backgroundColor: Colors.divider },
  body: {
    marginTop: -Spacing.lg,
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summary: { borderLeftWidth: 4, borderLeftColor: Colors.primary, paddingLeft: Spacing.md },
  back: { position: 'absolute', left: Spacing.lg },
});
