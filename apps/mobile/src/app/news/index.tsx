import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { NewsRow } from '@/components/news-card';
import { EmptyState, PageHeader } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { fetchNews, type NewsItem } from '@/lib/news';

export default function NewsListScreen() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNews().then(setItems);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Tin tức" subtitle="Tin hoạt động của thôn" onBack={() => router.back()} />
      <FlatList
        data={items ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[Colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              setItems(await fetchNews());
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : (
            <EmptyState icon="newspaper-outline" title="Chưa có tin tức" message="Tin hoạt động của thôn sẽ được đăng ở đây." />
          )
        }
        renderItem={({ item }) => <NewsRow item={item} />}
      />
    </View>
  );
}
