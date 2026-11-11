import { Ionicons } from '@expo/vector-icons';
import type { ReportStatus } from '@thon/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, IconCircle, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { CATEGORY_STYLE, REPORT_SELECT, STATUS_STYLE, signedUrls, type Report } from '@/lib/reports';
import { newChannel, supabase } from '@/lib/supabase';

type Update = { id: string; status: ReportStatus; note: string | null; created_at: string };

async function fetchReport(id: string) {
  const [r, u] = await Promise.all([
    supabase.from('reports').select(REPORT_SELECT).eq('id', id).maybeSingle(),
    supabase.from('report_updates').select('id, status, note, created_at').eq('report_id', id).order('created_at'),
  ]);
  const urls = r.data?.images.length ? await signedUrls(r.data.images) : {};
  return { report: (r.data ?? null) as Report | null, updates: (u.data ?? []) as Update[], urls };
}

export default function ReportDetail() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<string | null>(null);

  const apply = useCallback((d: Awaited<ReturnType<typeof fetchReport>>) => {
    setReport(d.report);
    setUpdates(d.updates);
    setUrls(d.urls);
  }, []);
  const load = useCallback(() => fetchReport(id).then(apply), [id, apply]);

  useEffect(() => {
    fetchReport(id).then(apply);
    // Cán bộ cập nhật trạng thái -> hiện ngay
    const channel = newChannel(`report-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, apply, load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/reports'));

  if (report === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Chi tiết phản ánh" onBack={back} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      </View>
    );
  }
  if (report === null) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Chi tiết phản ánh" onBack={back} />
        <EmptyState icon="document-outline" title="Không tìm thấy phản ánh" />
      </View>
    );
  }

  const cat = CATEGORY_STYLE[report.category];
  const st = STATUS_STYLE[report.status];

  return (
    <ScrollPage header={<PageHeader title="Chi tiết phản ánh" onBack={back} />}>
      {created === '1' && (
        <Notice tone="success" text="Đã gửi phản ánh tới Bí thư thôn. Bạn sẽ thấy tiến trình xử lý ngay tại đây." />
      )}

      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
          <Pill icon={cat.icon} text={cat.label} color={cat.color} bg={cat.bg} />
          <Pill icon={st.icon} text={st.label} color={st.color} bg={st.bg} />
        </View>
        <Txt variant="title">{report.title}</Txt>
        <Txt variant="caption" color={Colors.textMuted}>
          Gửi lúc {fmtDateTime(report.created_at)}
        </Txt>
        {report.description ? (
          <Txt variant="body" selectable style={{ fontSize: 18, lineHeight: 28 }}>
            {report.description}
          </Txt>
        ) : null}

        {report.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {report.images.map((p) => (
              <Pressable key={p} onPress={() => urls[p] && setViewer(urls[p])} accessibilityLabel="Xem ảnh lớn">
                <Image source={urls[p] ? { uri: urls[p] } : undefined} style={styles.photo} contentFit="cover" transition={200} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {(report.latitude != null || report.address_text) && (
          <Pressable
            disabled={report.latitude == null}
            onPress={() => Linking.openURL(`https://www.google.com/maps?q=${report.latitude},${report.longitude}`)}
            style={styles.location}>
            <Ionicons name="location" size={22} color={Colors.primaryText} />
            <Txt variant="small" style={{ flex: 1 }}>
              {report.address_text ?? 'Vị trí đã ghi nhận'}
            </Txt>
            {report.latitude != null && (
              <Txt variant="caption" color={Colors.primaryText} style={{ fontFamily: Font.semibold }}>
                Bản đồ ›
              </Txt>
            )}
          </Pressable>
        )}
      </Card>

      <Card style={styles.card}>
        <Txt variant="subtitle">Tiến trình xử lý</Txt>
        {updates.map((u, i) => {
          const s = STATUS_STYLE[u.status];
          const last = i === updates.length - 1;
          return (
            <View key={u.id} style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={{ alignItems: 'center' }}>
                <IconCircle icon={s.icon} color={s.color} bg={s.bg} size={40} />
                {!last && <View style={styles.line} />}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : Spacing.md }}>
                <Txt variant="bodyStrong">{s.label}</Txt>
                <Txt variant="caption" color={Colors.textMuted}>
                  {timeAgo(u.created_at)}
                </Txt>
                {u.note ? (
                  <Txt variant="small" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                    {u.note}
                  </Txt>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>

      {report.status === 'hoan_thanh' && <RatingCard report={report} onDone={load} />}

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)} accessibilityLabel="Đóng ảnh">
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
          <Txt variant="small" color={Colors.white} center>
            Chạm để đóng
          </Txt>
        </Pressable>
      </Modal>
    </ScrollPage>
  );
}

function Pill({ icon, text, color, bg }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Txt variant="caption" color={color} style={{ fontFamily: Font.bold }}>
        {text}
      </Txt>
    </View>
  );
}

const STAR_LABELS = ['', 'Rất chưa hài lòng', 'Chưa hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];

function RatingCard({ report, onDone }: { report: Report; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (report.rating) {
    return (
      <Card style={styles.card}>
        <Txt variant="subtitle">Đánh giá của bạn</Txt>
        <Stars value={report.rating} />
        {report.rating_comment ? <Txt variant="body">{report.rating_comment}</Txt> : null}
      </Card>
    );
  }

  return (
    <Card style={[styles.card, { borderWidth: 2, borderColor: Colors.primaryBorder }]}>
      <Txt variant="subtitle">Bạn thấy việc xử lý thế nào?</Txt>
      <Stars value={stars} onChange={setStars} />
      {stars > 0 && (
        <Txt variant="label" color={Colors.primaryText} center>
          {STAR_LABELS[stars]}
        </Txt>
      )}
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Góp ý thêm (không bắt buộc)"
        placeholderTextColor={Colors.textMuted}
        multiline
        style={styles.comment}
      />
      <Notice text={error} />
      <Button
        title="Gửi đánh giá"
        icon="star"
        disabled={stars === 0}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const { error: err } = await supabase.rpc('rate_report', {
            p_report_id: report.id,
            p_rating: stars,
            p_comment: comment.trim() || undefined,
          });
          setBusy(false);
          if (err) setError(err.message);
          else onDone();
        }}
      />
    </Card>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${n} sao`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={40} color={n <= value ? '#F5A623' : Colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  photo: { width: 140, height: 140, borderRadius: Radius.md, backgroundColor: Colors.divider },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  line: { width: 2, flex: 1, minHeight: 16, backgroundColor: Colors.divider, marginVertical: 2 },
  comment: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    fontFamily: Font.regular,
    fontSize: FontSize.body,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
});
