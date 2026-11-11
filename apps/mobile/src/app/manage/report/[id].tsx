import { Ionicons } from '@expo/vector-icons';
import type { ReportStatus } from '@thon/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, Choice, EmptyState, IconCircle, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { one, useRank } from '@/lib/manage';
import { notifyEvent } from '@/lib/push';
import { CATEGORY_STYLE, REPORT_SELECT, STATUS_STYLE, signedUrls, type Report } from '@/lib/reports';
import { supabase } from '@/lib/supabase';

type Update = { id: string; status: ReportStatus; note: string | null; created_at: string; actor: string | null };
type Reporter = { name: string; phone: string | null; area: string | null };

async function fetchDetail(id: string) {
  const [r, u, who] = await Promise.all([
    supabase.from('reports').select(REPORT_SELECT).eq('id', id).maybeSingle(),
    supabase
      .from('report_updates')
      .select('id, status, note, created_at, actor:profiles!report_updates_actor_id_fkey(username, residents(full_name))')
      .eq('report_id', id)
      .order('created_at'),
    supabase
      .from('reports')
      .select('reporter:profiles!reports_reporter_id_fkey(username, residents(full_name, phone, areas(name)))')
      .eq('id', id)
      .maybeSingle(),
  ]);
  const p = one(who.data?.reporter);
  const res = one(p?.residents);
  return {
    report: (r.data ?? null) as Report | null,
    updates: (u.data ?? []).map((x) => {
      const a = one(x.actor);
      return { id: x.id, status: x.status, note: x.note, created_at: x.created_at, actor: one(a?.residents)?.full_name ?? a?.username ?? null };
    }) as Update[],
    reporter: { name: res?.full_name ?? p?.username ?? '', phone: res?.phone ?? null, area: one(res?.areas)?.name ?? null } as Reporter,
    urls: r.data?.images.length ? await signedUrls(r.data.images) : {},
  };
}

const NEXT: Record<ReportStatus, ReportStatus> = { moi: 'dang_xu_ly', dang_xu_ly: 'hoan_thanh', hoan_thanh: 'hoan_thanh', tu_choi: 'tu_choi' };

export default function ManageReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rank = useRank();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDetail>> | null>(null);
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    fetchDetail(id).then((d) => {
      setData(d);
      if (d.report) setStatus(NEXT[d.report.status]);
    });
  }, [id]);

  if (rank < 2) return <Forbidden message="Phản ánh do Bí thư / Trưởng thôn xử lý." />;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/manage/reports'));

  if (!data || !data.report) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Phản ánh" onBack={back} />
        {data === null ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} /> : <EmptyState icon="document-outline" title="Không tìm thấy phản ánh" />}
      </View>
    );
  }
  const { report, updates, reporter, urls } = data;
  const cat = CATEGORY_STYLE[report.category];
  const st = STATUS_STYLE[report.status];

  function remove() {
    confirmAction('Xoá phản ánh này?', 'Xoá cả ảnh đính kèm và lịch sử xử lý. Không khôi phục được. Chỉ dùng cho phản ánh spam hoặc gửi nhầm.', 'Xoá', async () => {
      if (report.images.length) await supabase.storage.from('report-images').remove(report.images);
      const { error: err } = await supabase.from('reports').delete().eq('id', id);
      if (err) return showInfo('Không xoá được', err.message);
      back();
    }, true);
  }

  async function save() {
    if (!status) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('update_report_status', { p_report_id: report!.id, p_status: status, p_note: note.trim() || undefined });
    setBusy(false);
    if (err) return setError(err.message);
    notifyEvent('report_update', report!.id);
    router.back();
  }

  return (
    <ScrollPage header={<PageHeader title="Xử lý phản ánh" subtitle={`${cat.label} · ${timeAgo(report.created_at)}`} onBack={back} />}>
      <Card style={styles.card}>
        <View style={[styles.pill, { backgroundColor: st.bg }]}>
          <Ionicons name={st.icon} size={16} color={st.color} />
          <Txt variant="caption" color={st.color} style={{ fontFamily: Font.bold }}>
            {st.label}
          </Txt>
        </View>
        <Txt variant="title">{report.title}</Txt>
        {report.description ? <Txt variant="body">{report.description}</Txt> : null}
        {report.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {report.images.map((p) => (
              <Pressable key={p} onPress={() => urls[p] && setViewer(urls[p])}>
                <Image source={urls[p] ? { uri: urls[p] } : undefined} style={styles.photo} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Quick icon="call" label={reporter.phone ? 'Gọi người gửi' : 'Không có SĐT'} disabled={!reporter.phone} onPress={() => Linking.openURL(`tel:${reporter.phone}`)} />
          <Quick
            icon="map"
            label={report.latitude != null ? 'Xem bản đồ' : 'Không có vị trí'}
            disabled={report.latitude == null}
            onPress={() => Linking.openURL(`https://www.google.com/maps?q=${report.latitude},${report.longitude}`)}
          />
        </View>
        <Txt variant="small" color={Colors.textSecondary}>
          {[reporter.name, reporter.area, report.address_text].filter(Boolean).join(' · ')}
        </Txt>
      </Card>

      <Card style={styles.card}>
        <Txt variant="subtitle">Cập nhật xử lý</Txt>
        <Choice<ReportStatus>
          label="Trạng thái mới"
          options={(['dang_xu_ly', 'hoan_thanh', 'tu_choi'] as ReportStatus[]).map((s) => ({ value: s, label: STATUS_STYLE[s].label }))}
          value={status}
          onChange={setStatus}
        />
        <Txt variant="label">Ghi chú gửi người dân</Txt>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="VD: Đã báo điện lực, dự kiến sửa trong 2 ngày"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={styles.note}
        />
        <Notice text={error} />
        <Button title="Lưu và báo người dân" icon="send" onPress={save} loading={busy} />
      </Card>

      <Card style={styles.card}>
        <Txt variant="subtitle">Tiến trình</Txt>
        {updates.map((u) => {
          const s = STATUS_STYLE[u.status];
          return (
            <View key={u.id} style={{ flexDirection: 'row', gap: Spacing.md }}>
              <IconCircle icon={s.icon} color={s.color} bg={s.bg} size={36} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{s.label}</Txt>
                <Txt variant="caption" color={Colors.textMuted}>
                  {fmtDateTime(u.created_at)}
                  {u.actor ? ` · ${u.actor}` : ''}
                </Txt>
                {u.note ? <Txt variant="small">{u.note}</Txt> : null}
              </View>
            </View>
          );
        })}
      </Card>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
        </Pressable>
      </Modal>
      <Button title="Xoá phản ánh" icon="trash" variant="dangerOutline" onPress={remove} />
    </ScrollPage>
  );
}

function Quick({ icon, label, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.quick, disabled && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={Colors.primaryText} />
      <Txt variant="label" color={Colors.primaryText}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  photo: { width: 140, height: 140, borderRadius: Radius.md, backgroundColor: Colors.divider },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primaryBorder },
  note: {
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    fontFamily: Font.regular,
    fontSize: FontSize.body,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
});
