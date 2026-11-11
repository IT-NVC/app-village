import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { EmptyState, IconCircle, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { deadlineText, fetchPolls, isOpen, type Poll } from '@/lib/polls';

export default function PollsScreen() {
  const { me } = useAuth();
  const [data, setData] = useState<{ polls: Poll[]; voted: Set<string> } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tải lại mỗi khi quay về màn hình (vd. vừa bỏ phiếu xong)
  useFocusEffect(
    useCallback(() => {
      if (me) fetchPolls(me.id).then(setData);
    }, [me]),
  );

  const open = data?.polls.filter(isOpen) ?? [];
  const closed = data?.polls.filter((p) => !isOpen(p)) ?? [];
  const sections = [
    ...(open.length ? [{ title: 'Đang lấy ý kiến', data: open }] : []),
    ...(closed.length ? [{ title: 'Đã kết thúc', data: closed }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Biểu quyết" subtitle="Ý kiến của bà con về việc chung" onBack={() => router.back()} />
      {data === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[Colors.primary]}
              onRefresh={async () => {
                if (!me) return;
                setRefreshing(true);
                setData(await fetchPolls(me.id));
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState icon="stats-chart-outline" title="Chưa có khảo sát nào" message="Khi thôn cần lấy ý kiến, khảo sát sẽ hiện ở đây." />
          }
          renderSectionHeader={({ section }) => (
            <Txt variant="subtitle" style={{ marginTop: Spacing.sm }}>
              {section.title}
            </Txt>
          )}
          renderItem={({ item: p }) => {
            const openNow = isOpen(p);
            const voted = data.voted.has(p.id);
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/polls/[id]', params: { id: p.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
                <IconCircle
                  icon={voted ? 'checkmark-done' : openNow ? 'hand-left' : 'stats-chart'}
                  color={voted ? Colors.success : openNow ? Colors.warning : Colors.textSecondary}
                  bg={voted ? Colors.successSoft : openNow ? Colors.warningSoft : Colors.divider}
                  size={52}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="bodyStrong" numberOfLines={3}>
                    {p.title}
                  </Txt>
                  <View style={styles.meta}>
                    <Txt variant="caption" color={Colors.textMuted}>
                      {deadlineText(p)}
                    </Txt>
                    {p.vote_scope === 'household' && (
                      <Txt variant="caption" color={Colors.textMuted}>
                        · Mỗi hộ 1 phiếu
                      </Txt>
                    )}
                  </View>
                  {openNow && (
                    <Txt variant="caption" color={voted ? Colors.success : Colors.warning} style={{ fontFamily: Font.bold }}>
                      {voted ? 'Bạn đã bỏ phiếu' : 'Chưa bỏ phiếu — bấm để tham gia'}
                    </Txt>
                  )}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  meta: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
});
