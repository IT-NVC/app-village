import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyState, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { fetchFund, vnd } from '@/lib/funds';

type Data = Awaited<ReturnType<typeof fetchFund>>;
const pad = (n: number) => String(n).padStart(2, '0');
const dmy = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${pad(day)}/${pad(m)}/${y}`;
};

export default function FundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'tx' | 'hh'>('tx');
  const [viewer, setViewer] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchFund(id).then(setData);
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/funds'));

  if (!data || !data.fund) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Quỹ thôn" onBack={back} />
        {data === null ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <EmptyState icon="wallet-outline" title="Không tìm thấy quỹ" />
        )}
      </View>
    );
  }

  const { fund, txs, contributions, receipts } = data;
  const mine = contributions.find((c) => c.is_mine);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title={fund.name} subtitle="Công khai thu chi" onBack={back} />
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[Colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              setData(await fetchFund(id));
              setRefreshing(false);
            }}
          />
        }>
        <Card style={styles.summary}>
          <Txt variant="caption" color={Colors.textSecondary}>
            Số dư hiện tại
          </Txt>
          <Txt variant="hero" color={fund.balance < 0 ? Colors.danger : Colors.primaryText}>
            {vnd(fund.balance)}
          </Txt>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={Colors.textSecondary}>
                Tổng thu
              </Txt>
              <Txt variant="bodyStrong" color={Colors.success}>
                + {vnd(fund.total_thu)}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={Colors.textSecondary}>
                Tổng chi
              </Txt>
              <Txt variant="bodyStrong" color={Colors.danger}>
                − {vnd(fund.total_chi)}
              </Txt>
            </View>
          </View>
          {fund.description ? (
            <Txt variant="small" color={Colors.textSecondary}>
              {fund.description}
            </Txt>
          ) : null}
        </Card>

        {mine && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.successSoft }}>
            <Ionicons name="heart" size={22} color={Colors.success} />
            <Txt variant="small" color={Colors.success} style={{ flex: 1 }}>
              Hộ của bạn đã đóng góp <Txt variant="small" color={Colors.success} style={{ fontFamily: Font.bold }}>{vnd(mine.total)}</Txt>. Cảm ơn gia đình!
            </Txt>
          </Card>
        )}

        <View style={styles.tabs}>
          {(
            [
              ['tx', `Thu chi (${txs.length})`],
              ['hh', `Hộ đóng góp (${contributions.length})`],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              style={[styles.tab, tab === k && styles.tabActive]}>
              <Txt variant="label" color={tab === k ? Colors.white : Colors.primaryText}>
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>

        {tab === 'tx' ? (
          txs.length === 0 ? (
            <EmptyState icon="receipt-outline" title="Chưa có khoản thu chi nào" />
          ) : (
            txs.map((t) => {
              const thu = t.kind === 'thu';
              const receipt = t.receipt_path ? receipts[t.receipt_path] : null;
              return (
                <View key={t.id} style={styles.tx}>
                  <Ionicons name={thu ? 'arrow-down-circle' : 'arrow-up-circle'} size={34} color={thu ? Colors.success : Colors.danger} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="bodyStrong">{t.description}</Txt>
                    {t.household_label || t.payer_name ? (
                      <Txt variant="small" color={Colors.textSecondary}>
                        {t.household_label ?? t.payer_name}
                      </Txt>
                    ) : null}
                    <Txt variant="caption" color={Colors.textMuted}>
                      {dmy(t.occurred_on)}
                    </Txt>
                    {receipt && (
                      <Pressable onPress={() => setViewer(receipt)} style={styles.receiptBtn} accessibilityLabel="Xem chứng từ">
                        <Ionicons name="document-attach" size={16} color={Colors.primaryText} />
                        <Txt variant="caption" color={Colors.primaryText} style={{ fontFamily: Font.semibold }}>
                          Xem chứng từ
                        </Txt>
                      </Pressable>
                    )}
                  </View>
                  <Txt variant="bodyStrong" color={thu ? Colors.success : Colors.danger} style={{ fontFamily: Font.bold }}>
                    {thu ? '+' : '−'} {vnd(t.amount)}
                  </Txt>
                </View>
              );
            })
          )
        ) : contributions.length === 0 ? (
          <EmptyState icon="home-outline" title="Chưa có hộ nào đóng góp" />
        ) : (
          contributions.map((c, i) => (
            <View key={c.household_id} style={[styles.tx, c.is_mine && { borderWidth: 2, borderColor: Colors.success }]}>
              <View style={styles.rank}>
                <Txt variant="caption" color={Colors.primaryText} style={{ fontFamily: Font.bold }}>
                  {i + 1}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">
                  Hộ {c.head_name}
                  {c.is_mine ? ' (hộ của bạn)' : ''}
                </Txt>
                <Txt variant="caption" color={Colors.textSecondary}>
                  {[c.area_name, c.code].filter(Boolean).join(' · ')}
                  {c.times > 1 ? ` · ${c.times} lần` : ''}
                </Txt>
              </View>
              <Txt variant="bodyStrong" color={Colors.success} style={{ fontFamily: Font.bold }}>
                {vnd(c.total)}
              </Txt>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)} accessibilityLabel="Đóng chứng từ">
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
          <Txt variant="small" color={Colors.white}>
            Chạm để đóng
          </Txt>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { padding: Spacing.lg, gap: Spacing.sm, ...Shadow.md },
  tabs: { flexDirection: 'row', gap: Spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.card,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rank: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
});
