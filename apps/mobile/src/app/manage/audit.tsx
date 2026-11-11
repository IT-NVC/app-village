import { ACCOUNT_STATUS_LABEL, LEADERSHIP_ROLE_LABEL, ORG_ROLE_LABEL } from '@thon/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { ManageShell, RowCard } from '@/components/manage-kit';
import { Button, EmptyState, Txt } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;
type Log = { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; data: unknown; created_at: string };

const ENTITY: Record<string, string> = {
  profiles: 'Tài khoản',
  org_members: 'Thành viên ban ngành',
  areas: 'Khu vực',
  organizations: 'Ban ngành',
  app_settings: 'Cài đặt',
  residents: 'Nhân khẩu',
  announcements: 'Thông báo',
  funds: 'Quỹ',
  fund_transactions: 'Thu chi quỹ',
  events: 'Sự kiện',
  venue_bookings: 'Đặt lịch',
  polls: 'Khảo sát',
};
const ACTION: Record<string, { label: string; color: string }> = {
  insert: { label: 'Thêm', color: Colors.success },
  update: { label: 'Sửa', color: Colors.info },
  delete: { label: 'Xoá', color: Colors.danger },
  reset_password: { label: 'Đặt lại mật khẩu', color: Colors.warning },
};
const PAGE = 40;

const vndText = (n: unknown) => `${Number(n).toLocaleString('vi-VN')} đ`;

/** Diễn giải ngắn gọn để cán bộ đọc được */
function describe(log: Log, nameOf: (id?: unknown) => string): string {
  const d = log.data as ({ old?: Row; new?: Row } & Row) | null;
  if (!d) return '';
  if (log.entity === 'profiles' && d.old && d.new) {
    const parts: string[] = [];
    if (d.old.status !== d.new.status) parts.push(`trạng thái ${ACCOUNT_STATUS_LABEL[d.old.status as never] ?? d.old.status} → ${ACCOUNT_STATUS_LABEL[d.new.status as never] ?? d.new.status}`);
    if (d.old.leadership_role !== d.new.leadership_role)
      parts.push(`chức vụ ${LEADERSHIP_ROLE_LABEL[d.old.leadership_role as never] ?? 'không'} → ${LEADERSHIP_ROLE_LABEL[d.new.leadership_role as never] ?? 'không'}`);
    return `${nameOf(d.new.id)}: ${parts.join(', ')}`;
  }
  if (log.entity === 'profiles' && log.action === 'reset_password') return nameOf(log.entity_id);
  if (log.entity === 'org_members') {
    const r = (d.new ?? d) as Row;
    return `${nameOf(r.user_id)}${r.role ? ` (${ORG_ROLE_LABEL[r.role as never]})` : ''}`;
  }
  if (log.entity === 'app_settings' && d.new) return `${d.new.key} = ${JSON.stringify(d.new.value)}`;
  if (log.entity === 'fund_transactions') {
    const r = (d.new ?? d) as Row;
    const o = d.old as Row | undefined;
    const base = `${r.kind === 'thu' ? 'Thu' : 'Chi'} ${vndText(r.amount)} — ${r.description ?? ''}`;
    return o && o.amount !== r.amount ? `${base} (trước đó ${vndText(o.amount)})` : base;
  }
  const r = (d.new ?? d) as Row;
  return String(r.name ?? r.full_name ?? r.title ?? r.purpose ?? '');
}

async function fetchPage(from: number): Promise<{ rows: Log[]; total: number }> {
  const res = await supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
  if (res.error) throw new Error(res.error.message);
  return { rows: res.data as Log[], total: res.count ?? 0 };
}

export default function AuditScreen() {
  const [rows, setRows] = useState<Log[] | null>(null);
  const [total, setTotal] = useState(0);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadNames = useCallback(async (logs: Log[]) => {
    const ids = [...new Set(logs.flatMap((l) => [l.actor_id, ...(l.entity === 'profiles' ? [l.entity_id] : [])]).filter((x): x is string => !!x))];
    if (ids.length === 0) return;
    const { data } = await supabase.from('member_directory').select('id, full_name').in('id', ids);
    setNames((prev) => ({ ...prev, ...Object.fromEntries((data ?? []).map((p) => [p.id!, p.full_name ?? ''])) }));
  }, []);

  useEffect(() => {
    fetchPage(0)
      .then(({ rows: r, total: t }) => {
        setRows(r);
        setTotal(t);
        loadNames(r);
      })
      .catch(() => setFailed(true));
  }, [loadNames]);

  async function more() {
    if (!rows || loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    const { rows: r } = await fetchPage(rows.length);
    setRows((prev) => [...(prev ?? []), ...r]);
    loadNames(r);
    setLoadingMore(false);
  }

  async function refresh() {
    setRefreshing(true);
    const { rows: r, total: t } = await fetchPage(0);
    setRows(r);
    setTotal(t);
    loadNames(r);
    setRefreshing(false);
  }

  const nameOf = (id?: unknown) => (id ? (names[String(id)] ?? `#${String(id).slice(0, 8)}`) : 'Hệ thống');

  return (
    <ManageShell title="Nhật ký thao tác" subtitle={rows ? `${total} bản ghi` : undefined} minRank={2}>
      {rows === null ? (
        failed ? <EmptyState icon="cloud-offline-outline" title="Không tải được nhật ký" /> : <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Chưa có bản ghi nào" />}
          ListFooterComponent={rows.length < total ? <Button title={loadingMore ? 'Đang tải…' : 'Tải thêm'} variant="secondary" onPress={more} loading={loadingMore} /> : undefined}
          renderItem={({ item: l }) => {
            const a = ACTION[l.action] ?? { label: l.action, color: Colors.textSecondary };
            return (
              <RowCard style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Txt variant="caption" color={a.color} style={{ fontFamily: Font.bold }}>
                    {a.label.toUpperCase()} · {ENTITY[l.entity] ?? l.entity}
                  </Txt>
                  <Txt variant="caption" color={Colors.textMuted}>
                    {fmtDateTime(l.created_at)}
                  </Txt>
                </View>
                <Txt variant="body">{describe(l, nameOf) || '—'}</Txt>
                <Txt variant="caption" color={Colors.textSecondary}>
                  Người thực hiện: {nameOf(l.actor_id)}
                </Txt>
              </RowCard>
            );
          }}
        />
      )}
    </ManageShell>
  );
}
