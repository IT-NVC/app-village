import { Ionicons } from '@expo/vector-icons';
import type { ReportStatus } from '@thon/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { EmptyState, IconCircle, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import { one, useRank } from '@/lib/manage';
import { CATEGORY_STYLE, STATUS_STYLE, signedUrls, type Report } from '@/lib/reports';
import { supabase } from '@/lib/supabase';

type Row = Pick<Report, 'id' | 'category' | 'title' | 'images' | 'status' | 'created_at'> & { reporter: string; area: string | null };
type Filter = ReportStatus | 'open';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Cần xử lý' },
  { key: 'hoan_thanh', label: 'Đã xong' },
  { key: 'tu_choi', label: 'Từ chối' },
];

async function fetchReports(filter: Filter): Promise<{ rows: Row[]; thumbs: Record<string, string> }> {
  let q = supabase
    .from('reports')
    .select('id, category, title, images, status, created_at, reporter:profiles!reports_reporter_id_fkey(username, residents(full_name, areas(name)))')
    .order('created_at', { ascending: filter !== 'open' ? false : true })
    .limit(100);
  q = filter === 'open' ? q.in('status', ['moi', 'dang_xu_ly']) : q.eq('status', filter);
  const { data } = await q;
  const rows = (data ?? []).map((r) => {
    const p = one(r.reporter);
    const res = one(p?.residents);
    return { ...r, reporter: res?.full_name ?? p?.username ?? '', area: one(res?.areas)?.name ?? null };
  });
  const thumbs = await signedUrls(rows.map((r) => r.images[0]).filter(Boolean));
  return { rows, thumbs };
}

export default function ManageReportsScreen() {
  const rank = useRank();
  const [filter, setFilter] = useState<Filter>('open');
  const [data, setData] = useState<{ rows: Row[]; thumbs: Record<string, string> } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchReports(filter).then(setData);
    }, [filter]),
  );

  if (rank < 2) return <Forbidden message="Phản ánh do Bí thư / Trưởng thôn xử lý." />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Phản ánh" subtitle="Cũ nhất ở trên — xử lý theo thứ tự" onBack={() => router.back()} />
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => {
              setData(null);
              setFilter(f.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f.key }}
            style={[styles.filter, filter === f.key && styles.filterActive]}>
            <Txt variant="caption" color={filter === f.key ? Colors.white : Colors.primaryText} style={{ fontFamily: Font.semibold }}>
              {f.label}
            </Txt>
          </Pressable>
        ))}
      </View>
      {data === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={data.rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[Colors.primary]} onRefresh={async () => { setRefreshing(true); setData(await fetchReports(filter)); setRefreshing(false); }} />}
          ListEmptyComponent={<EmptyState icon="checkmark-done-circle-outline" title="Không có phản ánh nào" />}
          renderItem={({ item }) => {
            const cat = CATEGORY_STYLE[item.category];
            const st = STATUS_STYLE[item.status];
            const thumb = item.images[0] && data.thumbs[item.images[0]];
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/manage/report/[id]', params: { id: item.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
                {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" /> : <IconCircle icon={cat.icon} color={cat.color} bg={cat.bg} size={60} />}
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt variant="bodyStrong" numberOfLines={2}>
                    {item.title}
                  </Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {[item.reporter, item.area].filter(Boolean).join(' · ')} · {timeAgo(item.created_at)}
                  </Txt>
                  <View style={[styles.status, { backgroundColor: st.bg }]}>
                    <Txt variant="caption" color={st.color} style={{ fontFamily: Font.bold, fontSize: 12, lineHeight: 16 }}>
                      {st.label}
                    </Txt>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  filter: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primaryBorder, backgroundColor: Colors.card },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  thumb: { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Colors.divider },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
});
