import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState, IconCircle, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Gradients, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { CATEGORY_STYLE, REPORT_SELECT, STATUS_STYLE, signedUrls, type Report } from '@/lib/reports';
import { newChannel, supabase } from '@/lib/supabase';

export default function ReportsScreen() {
  const { me } = useAuth();
  const [items, setItems] = useState<Report[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .eq('reporter_id', me.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems(data ?? []);
    const firsts = (data ?? []).map((r) => r.images[0]).filter(Boolean);
    if (firsts.length) setThumbs(await signedUrls(firsts));
  }, [me]);

  // Tải lại mỗi khi quay về tab (vd. sau khi gửi phản ánh mới)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Cán bộ đổi trạng thái -> cập nhật ngay
  useEffect(() => {
    if (!me) return;
    const channel = newChannel('my-reports')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: `reporter_id=eq.${me.id}` }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, load]);

  const open = items?.filter((r) => r.status === 'moi' || r.status === 'dang_xu_ly').length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Phản ánh" subtitle={open ? `${open} phản ánh đang chờ xử lý` : 'Báo hỏng hóc, sự cố trong thôn'} />

      <FlatList
        data={items ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 }}
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
        }
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push('/report/new')}
            accessibilityRole="button"
            accessibilityLabel="Gửi phản ánh mới"
            style={({ pressed }) => [styles.newWrap, pressed && { transform: [{ scale: 0.98 }] }]}>
            <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.new}>
              <View style={styles.newIcon}>
                <Ionicons name="camera" size={30} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="subtitle" color={Colors.white}>
                  Gửi phản ánh mới
                </Txt>
                <Txt variant="small" color="rgba(255,255,255,0.9)">
                  Chụp ảnh sự cố, gửi thẳng tới Bí thư
                </Txt>
              </View>
              <Ionicons name="add-circle" size={32} color={Colors.white} />
            </LinearGradient>
          </Pressable>
        }
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : (
            <EmptyState
              icon="construct-outline"
              title="Chưa có phản ánh nào"
              message="Thấy đèn đường hỏng, đường hư, rác thải… hãy chụp ảnh và gửi để thôn xử lý."
            />
          )
        }
        renderItem={({ item }) => {
          const cat = CATEGORY_STYLE[item.category];
          const st = STATUS_STYLE[item.status];
          const thumb = item.images[0] && thumbs[item.images[0]];
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/report/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${st.label}`}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
              ) : (
                <IconCircle icon={cat.icon} color={cat.color} bg={cat.bg} size={64} />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="bodyStrong" numberOfLines={2}>
                  {item.title}
                </Txt>
                <Txt variant="caption" color={Colors.textMuted}>
                  {cat.label} · {timeAgo(item.created_at)}
                </Txt>
                <View style={[styles.status, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icon} size={14} color={st.color} />
                  <Txt variant="caption" color={st.color} style={{ fontFamily: Font.bold }}>
                    {st.label}
                  </Txt>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  newWrap: { borderRadius: Radius.lg, marginBottom: Spacing.xs, ...Shadow.md },
  new: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  newIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  thumb: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.divider },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
});
