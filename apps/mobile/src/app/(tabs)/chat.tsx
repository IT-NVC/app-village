import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState, IconCircle, PageHeader, Txt, type IconName } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useChat, type ChatGroup } from '@/lib/chat';
import { timeAgo } from '@/lib/format';

const TYPE_STYLE: Record<ChatGroup['type'], { icon: IconName; color: string; bg: string; label: string }> = {
  area: { icon: 'location', color: Colors.primaryText, bg: Colors.primarySoft, label: 'Nhóm khu' },
  org: { icon: 'people', color: Colors.info, bg: Colors.infoSoft, label: 'Ban ngành' },
  custom: { icon: 'chatbubbles', color: Colors.purple, bg: Colors.purpleSoft, label: 'Nhóm' },
};

/** Dòng xem trước tin nhắn cuối */
function preview(g: ChatGroup, myId: string | undefined) {
  if (!g.last_message_at) return 'Chưa có tin nhắn';
  const who = g.last_sender_id === myId ? 'Bạn' : (g.last_sender_name ?? '').split(' ').slice(-1)[0] || 'Ai đó';
  if (g.last_deleted) return `${who}: tin nhắn đã thu hồi`;
  if (g.last_has_image && !g.last_content) return `${who}: 📷 Ảnh`;
  return `${who}: ${g.last_content ?? ''}`;
}

export default function ChatListScreen() {
  const { me } = useAuth();
  const { groups, totalUnread, refresh } = useChat();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader
        title="Tin nhắn"
        subtitle={totalUnread ? `${totalUnread} tin nhắn chưa đọc` : 'Nhóm chat của khu và ban ngành'}
      />
      <FlatList
        data={groups ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 }}
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
          groups === null ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="Bạn chưa ở nhóm nào"
              message="Khi cán bộ thôn tạo nhóm cho khu hoặc ban ngành của bạn, nhóm sẽ tự hiện ở đây."
            />
          )
        }
        renderItem={({ item: g }) => {
          const t = TYPE_STYLE[g.type];
          const unread = g.unread ?? 0;
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${g.name}${unread ? `, ${unread} tin chưa đọc` : ''}`}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
              <IconCircle icon={t.icon} color={t.color} bg={t.bg} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.top}>
                  <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1, fontFamily: unread ? Font.bold : Font.semibold }}>
                    {g.name}
                  </Txt>
                  <Txt variant="caption" color={unread ? Colors.primaryText : Colors.textMuted}>
                    {g.last_message_at ? timeAgo(g.last_message_at) : ''}
                  </Txt>
                </View>
                <View style={styles.top}>
                  <Txt
                    variant="small"
                    numberOfLines={1}
                    color={unread ? Colors.text : Colors.textSecondary}
                    style={{ flex: 1, fontFamily: unread ? Font.semibold : Font.regular }}>
                    {preview(g, me?.id)}
                  </Txt>
                  {unread > 0 && (
                    <View style={styles.badge}>
                      <Txt variant="caption" color={Colors.white} style={{ fontFamily: Font.bold, fontSize: 12, lineHeight: 16 }}>
                        {unread > 99 ? '99+' : unread}
                      </Txt>
                    </View>
                  )}
                  {g.is_muted && <Ionicons name="volume-mute" size={16} color={Colors.textMuted} />}
                </View>
                <Txt variant="caption" color={Colors.textMuted}>
                  {t.label} · {g.member_count} thành viên
                </Txt>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
