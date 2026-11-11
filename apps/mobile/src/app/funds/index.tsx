import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Card, EmptyState, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { fetchFunds, vnd, vndShort, type FundSummary } from '@/lib/funds';

export default function FundsScreen() {
  const [funds, setFunds] = useState<FundSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchFunds().then(setFunds);
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Quỹ thôn" subtitle="Công khai thu chi" onBack={() => router.back()} />
      <FlatList
        data={funds ?? []}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[Colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              setFunds(await fetchFunds());
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          funds && funds.length > 0 ? (
            <Card style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', backgroundColor: Colors.primarySoft }}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.primaryText} />
              <Txt variant="small" color={Colors.primaryDark} style={{ flex: 1 }}>
                Mọi khoản thu chi đều công khai. Mọi chỉnh sửa của cán bộ đều được ghi lại.
              </Txt>
            </Card>
          ) : undefined
        }
        ListEmptyComponent={
          funds === null ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : (
            <EmptyState icon="wallet-outline" title="Chưa có quỹ nào" message="Các quỹ của thôn sẽ được công khai ở đây." />
          )
        }
        renderItem={({ item: f }) => {
          const pct = f.target_amount ? Math.min(100, Math.round((f.total_thu / f.target_amount) * 100)) : null;
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/funds/[id]', params: { id: f.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${f.name}, số dư ${vnd(f.balance)}`}
              style={({ pressed }) => [styles.card, !f.is_active && { opacity: 0.7 }, pressed && { opacity: 0.85 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Txt variant="subtitle" style={{ flex: 1 }} numberOfLines={2}>
                  {f.name}
                </Txt>
                {!f.is_active && (
                  <Txt variant="caption" color={Colors.textMuted}>
                    Đã kết thúc
                  </Txt>
                )}
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </View>
              <Txt variant="caption" color={Colors.textSecondary}>
                Số dư hiện tại
              </Txt>
              <Txt variant="hero" color={f.balance < 0 ? Colors.danger : Colors.primaryText}>
                {vnd(f.balance)}
              </Txt>
              <View style={styles.row}>
                <Stat icon="arrow-down-circle" color={Colors.success} label="Đã thu" value={vndShort(f.total_thu)} />
                <Stat icon="arrow-up-circle" color={Colors.danger} label="Đã chi" value={vndShort(f.total_chi)} />
                <Stat icon="home" color={Colors.info} label="Hộ góp" value={String(f.households)} />
              </View>
              {pct !== null && (
                <View style={{ gap: 4 }}>
                  <View style={styles.track}>
                    <View style={[styles.bar, { width: `${pct}%` }]} />
                  </View>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    Đã vận động {pct}% mục tiêu {vndShort(f.target_amount!)}
                  </Txt>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Stat({ icon, color, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Txt variant="caption" color={Colors.textSecondary}>
          {label}
        </Txt>
      </View>
      <Txt variant="bodyStrong" style={{ fontFamily: Font.bold }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6, ...Shadow.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.divider, overflow: 'hidden', marginTop: Spacing.sm },
  bar: { height: 10, borderRadius: 5, backgroundColor: Colors.primary },
});
