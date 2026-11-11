import { Ionicons } from '@expo/vector-icons';
import { LEADERSHIP_ROLE_LABEL, type LeadershipRole } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, ListRow, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { PRIORITY_STYLE, useAnnouncements } from '@/lib/announcements';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Sender = { full_name: string | null; leadership_role: LeadershipRole | null };

export default function AnnouncementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, markRead } = useAnnouncements();
  const item = items.find((a) => a.id === id);
  const [sender, setSender] = useState<Sender | null>(null);
  const [targets, setTargets] = useState<string[]>([]);

  // Mở xem là đánh dấu đã đọc
  useEffect(() => {
    if (item && !item.read) markRead(item.id);
  }, [item, markRead]);

  useEffect(() => {
    if (!item) return;
    if (item.sender_id) {
      supabase
        .from('member_directory')
        .select('full_name, leadership_role')
        .eq('id', item.sender_id)
        .maybeSingle()
        .then(({ data }) => setSender(data));
    }
    if (!item.target_all) {
      supabase
        .from('announcement_targets')
        .select('areas(name), organizations(name)')
        .eq('announcement_id', item.id)
        .then(({ data }) =>
          setTargets(
            (data ?? [])
              .map((t) => {
                const area = Array.isArray(t.areas) ? t.areas[0] : t.areas;
                const org = Array.isArray(t.organizations) ? t.organizations[0] : t.organizations;
                return area?.name ?? org?.name ?? '';
              })
              .filter(Boolean),
          ),
        );
    }
  }, [item]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/notifications'));

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Thông báo" onBack={back} />
        <EmptyState icon="document-outline" title="Không tìm thấy thông báo" message="Thông báo có thể đã bị xoá." />
      </View>
    );
  }

  const p = PRIORITY_STYLE[item.priority];
  const senderText = sender
    ? `${sender.full_name ?? ''}${sender.leadership_role ? ` · ${LEADERSHIP_ROLE_LABEL[sender.leadership_role]}` : ''}`
    : 'Cán bộ thôn';

  return (
    <ScrollPage header={<PageHeader title="Chi tiết thông báo" onBack={back} />}>
      <Card style={styles.card}>
        <View style={[styles.badge, { backgroundColor: p.bg }]}>
          <Ionicons name={p.icon} size={18} color={p.color} />
          <Txt variant="caption" color={p.color} style={{ fontFamily: Font.bold }}>
            {p.label}
          </Txt>
        </View>
        <Txt variant="title">{item.title}</Txt>
        <Txt variant="caption" color={Colors.textMuted}>
          {fmtDateTime(item.scheduled_at)}
        </Txt>
        <View style={styles.divider} />
        {/* Nội dung: chữ to, giãn dòng rộng, cho phép bôi đen sao chép */}
        <Txt variant="body" selectable style={{ fontSize: 19, lineHeight: 30 }}>
          {item.content}
        </Txt>
      </Card>

      <Card style={{ paddingVertical: Spacing.xs, ...Shadow.sm }}>
        <ListRow icon="person-outline" title="Người gửi" subtitle={senderText} />
        <ListRow
          icon="people-outline"
          title="Gửi tới"
          subtitle={item.target_all ? 'Toàn thôn' : targets.join(', ') || '…'}
          divider={false}
        />
      </Card>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm, ...Shadow.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
});
