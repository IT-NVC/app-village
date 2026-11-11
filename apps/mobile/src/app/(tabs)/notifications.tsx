import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AnnouncementCard } from '@/components/announcement-card';
import { EmptyState, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/lib/announcements';

type Filter = 'all' | 'unread' | 'khan';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'khan', label: 'Khẩn' },
];

export default function NotificationsScreen() {
  const { items, loading, unreadCount, refresh, markAllRead } = useAnnouncements();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const data = useMemo(
    () =>
      items.filter((a) => (filter === 'unread' ? !a.read : filter === 'khan' ? a.priority === 'khan' : true)),
    [items, filter],
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader
        title="Thông báo"
        subtitle={unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
      />

      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.filter, active && styles.filterActive]}>
                <Txt variant="caption" color={active ? Colors.white : Colors.primaryText} style={{ fontFamily: Font.semibold }}>
                  {f.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} hitSlop={10} accessibilityRole="button">
            <Txt variant="caption" color={Colors.primaryText} style={{ fontFamily: Font.semibold }}>
              Đọc hết
            </Txt>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[Colors.primary]}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title={filter === 'all' ? 'Chưa có thông báo' : 'Không có thông báo phù hợp'}
              message={filter === 'all' ? 'Khi thôn gửi thông báo, bạn sẽ thấy ở đây.' : undefined}
            />
          }
          renderItem={({ item }) => <AnnouncementCard item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  filters: { flexDirection: 'row', gap: Spacing.sm },
  filter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
