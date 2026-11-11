import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { fmtDateTime } from '@/lib/format';
import { deadlineText, fetchPoll, isOpen, type Poll, type PollResult } from '@/lib/polls';
import { supabase } from '@/lib/supabase';

export default function PollScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ poll: Poll | null; results: PollResult[]; eligible: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const apply = useCallback((d: Awaited<ReturnType<typeof fetchPoll>>) => {
    setData(d);
    setPicked(d.results.filter((r) => r.my_vote).map((r) => r.option_id));
  }, []);

  useEffect(() => {
    fetchPoll(id).then(apply);
  }, [id, apply]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/polls'));

  if (!data || !data.poll) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Biểu quyết" onBack={back} />
        {data === null ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <EmptyState icon="stats-chart-outline" title="Không tìm thấy khảo sát" />
        )}
      </View>
    );
  }

  const { poll, results, eligible } = data;
  const open = isOpen(poll);
  const hasVoted = results.some((r) => r.my_vote);
  const voting = open && (!hasVoted || editing);
  const voters = results[0]?.voters ?? 0;
  const totalVotes = results.reduce((n, r) => n + r.votes, 0);
  const unit = poll.vote_scope === 'household' ? 'hộ' : 'người';

  function toggle(optionId: string) {
    setError(null);
    if (poll!.allow_multiple) setPicked((p) => (p.includes(optionId) ? p.filter((x) => x !== optionId) : [...p, optionId]));
    else setPicked([optionId]);
  }

  async function submit() {
    if (picked.length === 0) return setError('Vui lòng chọn ít nhất một phương án.');
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('cast_vote', { p_poll_id: poll!.id, p_option_ids: picked });
    setBusy(false);
    if (err) return setError(err.message);
    setEditing(false);
    setDone(true);
    apply(await fetchPoll(id));
  }

  return (
    <ScrollPage header={<PageHeader title="Biểu quyết" subtitle={deadlineText(poll)} onBack={back} />}>
      <Card style={styles.card}>
        <Txt variant="title">{poll.title}</Txt>
        {poll.description ? (
          <Txt variant="body" color={Colors.textSecondary}>
            {poll.description}
          </Txt>
        ) : null}
        <View style={styles.tags}>
          <Tag icon={poll.vote_scope === 'household' ? 'home' : 'person'} text={poll.vote_scope === 'household' ? 'Mỗi hộ 1 phiếu' : 'Mỗi người 1 phiếu'} />
          <Tag icon={poll.allow_multiple ? 'checkbox' : 'radio-button-on'} text={poll.allow_multiple ? 'Chọn nhiều' : 'Chọn một'} />
          <Tag icon={poll.is_anonymous ? 'eye-off' : 'eye'} text={poll.is_anonymous ? 'Ẩn danh' : 'Công khai với cán bộ'} />
          {poll.closes_at && open && <Tag icon="time" text={`Hạn: ${fmtDateTime(poll.closes_at)}`} />}
        </View>
      </Card>

      {done && <Notice tone="success" text="Đã ghi nhận ý kiến của bạn. Cảm ơn bà con!" />}

      {voting ? (
        <Card style={styles.card}>
          <Txt variant="subtitle">{poll.allow_multiple ? 'Chọn các phương án bạn đồng ý' : 'Chọn một phương án'}</Txt>
          {results.map((r) => {
            const selected = picked.includes(r.option_id);
            return (
              <Pressable
                key={r.option_id}
                onPress={() => toggle(r.option_id)}
                accessibilityRole={poll.allow_multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: selected }}
                style={[styles.option, selected && styles.optionSelected]}>
                <Ionicons
                  name={
                    poll.allow_multiple
                      ? selected ? 'checkbox' : 'square-outline'
                      : selected ? 'radio-button-on' : 'radio-button-off'
                  }
                  size={28}
                  color={selected ? Colors.primary : Colors.textMuted}
                />
                <Txt variant="bodyStrong" style={{ flex: 1 }}>
                  {r.label}
                </Txt>
              </Pressable>
            );
          })}
          <Notice text={error} />
          <Button title={hasVoted ? 'Lưu phiếu mới' : 'Gửi ý kiến'} icon="checkmark-circle" onPress={submit} loading={busy} disabled={picked.length === 0} />
          {editing && <Button title="Huỷ" variant="ghost" onPress={() => { setEditing(false); setPicked(results.filter((r) => r.my_vote).map((r) => r.option_id)); }} />}
        </Card>
      ) : (
        <Card style={styles.card}>
          <Txt variant="subtitle">{open ? 'Kết quả tạm thời' : 'Kết quả'}</Txt>
          {results.map((r) => {
            const pct = totalVotes ? Math.round((r.votes / totalVotes) * 100) : 0;
            const max = Math.max(...results.map((x) => x.votes));
            const leading = r.votes > 0 && r.votes === max;
            return (
              <View key={r.option_id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {r.my_vote && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>
                    {r.label}
                  </Txt>
                  <Txt variant="bodyStrong" color={leading ? Colors.primaryText : Colors.textSecondary}>
                    {pct}%
                  </Txt>
                </View>
                <View style={styles.track}>
                  <View style={[styles.bar, { width: `${pct}%`, backgroundColor: leading ? Colors.primary : '#9CCFB0' }]} />
                </View>
                <Txt variant="caption" color={Colors.textMuted}>
                  {r.votes} phiếu
                </Txt>
              </View>
            );
          })}
          <View style={styles.participation}>
            <Ionicons name="people" size={20} color={Colors.primaryText} />
            <Txt variant="small" color={Colors.primaryDark} style={{ flex: 1 }}>
              {voters}/{eligible || '?'} {unit} đã tham gia
              {eligible ? ` (${Math.round((voters / eligible) * 100)}%)` : ''}
            </Txt>
          </View>
          {open && hasVoted && (
            <Button title="Đổi phiếu" variant="secondary" icon="create-outline" onPress={() => { setDone(false); setEditing(true); }} />
          )}
        </Card>
      )}
    </ScrollPage>
  );
}

function Tag({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={14} color={Colors.primaryText} />
      <Txt variant="caption" color={Colors.primaryText} style={{ fontFamily: Font.semibold, fontSize: 13 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.divider,
    backgroundColor: Colors.card,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  track: { height: 14, borderRadius: 7, backgroundColor: Colors.divider, overflow: 'hidden' },
  bar: { height: 14, borderRadius: 7 },
  participation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
});
