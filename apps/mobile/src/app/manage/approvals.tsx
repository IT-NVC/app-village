import { Ionicons } from '@expo/vector-icons';
import { GENDER_LABEL } from '@thon/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, EmptyState, PageHeader, PromptModal, Txt } from '@/components/ui';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { showInfo } from '@/lib/dialog';
import { timeAgo } from '@/lib/format';
import { one, useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Row = {
  id: string;
  username: string | null;
  created_at: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  gender: 'nam' | 'nu' | 'khac' | null;
  area: string | null;
  household: string | null;
  note: string | null;
  duplicates: number;
};

async function fetchPending(): Promise<Row[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, created_at, residents(full_name, phone, birth_date, gender, note, areas(name), households(code, head_name))')
    .eq('status', 'pending')
    .order('created_at');
  const rows = await Promise.all(
    (data ?? []).map(async (p) => {
      const r = one(p.residents);
      const hh = one(r?.households);
      // Dò trùng tên với nhân khẩu cán bộ đã nhập sẵn (chưa có tài khoản)
      const { count } = r?.full_name
        ? await supabase
            .from('residents')
            .select('id', { count: 'exact', head: true })
            .ilike('full_name', r.full_name)
            .eq('source', 'import')
            .not('activation_code', 'is', null)
        : { count: 0 };
      return {
        id: p.id,
        username: p.username,
        created_at: p.created_at,
        full_name: r?.full_name ?? '(không có tên)',
        phone: r?.phone ?? null,
        birth_date: r?.birth_date ?? null,
        gender: r?.gender ?? null,
        area: one(r?.areas)?.name ?? null,
        household: hh ? `${hh.code ?? ''}${hh.head_name ? ` (chủ hộ ${hh.head_name})` : ''}`.trim() : null,
        note: r?.note ?? null,
        duplicates: count ?? 0,
      };
    }),
  );
  return rows;
}

const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : null);

export default function ManageApprovalsScreen() {
  const rank = useRank();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPending().then(setRows);
  }, []);
  const load = useCallback(() => fetchPending().then(setRows), []);

  async function review(r: Row, approve: boolean, reason?: string) {
    setBusy(r.id);
    const { error } = await supabase.rpc('review_account', { p_user_id: r.id, p_approve: approve, p_reason: reason || undefined });
    setBusy(null);
    if (error) return showInfo('Không thực hiện được', error.message);
    setRejecting(null);
    load();
  }

  if (rank < 1) return <Forbidden />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Duyệt tài khoản" subtitle={rows ? `${rows.length} người đang chờ` : undefined} onBack={() => router.back()} />
      {rows === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[Colors.primary]} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {rows.length === 0 ? (
            <EmptyState icon="checkmark-done-circle-outline" title="Không có ai chờ duyệt" />
          ) : (
            rows.map((r) => (
              <Card key={r.id} style={styles.card}>
                <Txt variant="title">{r.full_name}</Txt>
                <Txt variant="caption" color={Colors.textMuted}>
                  {r.username ? `@${r.username}` : 'Đăng nhập Google'} · gửi {timeAgo(r.created_at)}
                </Txt>
                {r.duplicates > 0 && (
                  <View style={styles.warn}>
                    <Ionicons name="warning" size={18} color={Colors.warning} />
                    <Txt variant="small" color={Colors.warning} style={{ flex: 1 }}>
                      Trùng tên với {r.duplicates} nhân khẩu đã nhập sẵn. Nên từ chối và đưa mã kích hoạt để tránh trùng hồ sơ.
                    </Txt>
                  </View>
                )}
                <Info icon="location-outline" text={r.area} />
                <Info icon="calendar-outline" text={[dmy(r.birth_date), r.gender ? GENDER_LABEL[r.gender] : null].filter(Boolean).join(' · ') || null} />
                <Info icon="home-outline" text={r.household} />
                <Info icon="document-text-outline" text={r.note} />
                {r.phone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)} style={styles.phone} accessibilityRole="button">
                    <Ionicons name="call" size={18} color={Colors.primaryText} />
                    <Txt variant="label" color={Colors.primaryText}>
                      {r.phone}
                    </Txt>
                  </Pressable>
                )}
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                  <Button title="Từ chối" variant="dangerOutline" onPress={() => setRejecting(r)} style={{ flex: 1 }} />
                  <Button title="Duyệt" icon="checkmark" loading={busy === r.id} onPress={() => review(r, true)} style={{ flex: 1 }} />
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
      <PromptModal
        visible={!!rejecting}
        title={`Từ chối ${rejecting?.full_name ?? ''}?`}
        message="Người dân sẽ thấy lý do và có thể nhập mã kích hoạt hoặc khai báo lại."
        placeholder="VD: Đã có trong danh sách, vui lòng liên hệ cán bộ để lấy mã kích hoạt"
        confirmText="Từ chối"
        danger
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => (rejecting ? review(rejecting, false, reason) : undefined)}
      />
    </View>
  );
}

function Info({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Txt variant="small" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm },
  warn: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.warningSoft },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
});
