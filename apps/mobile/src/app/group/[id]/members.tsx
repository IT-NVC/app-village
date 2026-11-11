import { Ionicons } from '@expo/vector-icons';
import { LEADERSHIP_ROLE_LABEL, type LeadershipRole } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useChat } from '@/lib/chat';
import { confirmAction, showInfo } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

type Row = {
  user_id: string;
  role: 'admin' | 'member';
  is_muted: boolean;
  full_name: string;
  area_name: string | null;
  leadership_role: LeadershipRole | null;
};

async function fetchMembers(groupId: string): Promise<Row[]> {
  const { data } = await supabase.from('chat_group_members').select('user_id, role, is_muted').eq('group_id', groupId);
  const ids = (data ?? []).map((m) => m.user_id);
  const { data: dir } = ids.length
    ? await supabase.from('member_directory').select('id, full_name, area_name, leadership_role').in('id', ids)
    : { data: [] };
  const byId = new Map((dir ?? []).map((d) => [d.id, d]));
  return (data ?? [])
    .map((m) => {
      const d = byId.get(m.user_id);
      return {
        ...m,
        full_name: d?.full_name ?? 'Thành viên',
        area_name: d?.area_name ?? null,
        leadership_role: d?.leadership_role ?? null,
      };
    })
    .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'admin' ? -1 : 1));
}

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { groups, refresh } = useChat();
  const group = groups?.find((g) => g.id === id);
  const iAmAdmin = group?.my_role === 'admin';
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetchMembers(id).then(setRows);
  }, [id]);
  const reload = useCallback(() => fetchMembers(id).then(setRows), [id]);

  async function update(r: Row, patch: { role?: 'admin' | 'member'; muted?: boolean }) {
    const { error } = await supabase.rpc('update_group_member', {
      p_group_id: id,
      p_user_id: r.user_id,
      p_role: patch.role,
      p_is_muted: patch.muted,
    });
    if (error) showInfo('Không thực hiện được', error.message);
    reload();
  }

  async function remove(r: Row) {
    const self = r.user_id === me?.id;
    confirmAction(
      self ? 'Rời nhóm?' : `Xoá ${r.full_name} khỏi nhóm?`,
      self ? 'Bạn sẽ không nhận tin nhắn của nhóm này nữa.' : 'Người này sẽ không xem được tin nhắn của nhóm nữa.',
      self ? 'Rời nhóm' : 'Xoá',
      async () => {
        const { error } = await supabase.rpc('remove_group_member', { p_group_id: id, p_user_id: r.user_id });
        if (error) return showInfo('Không thực hiện được', error.message);
        await refresh();
        if (self) router.replace('/chat');
        else reload();
      },
      true,
    );
  }

  // Nhóm khu / ban ngành tự đồng bộ thành viên theo danh sách khu, ban ngành → không xoá tay ở đây
  const manualGroup = group?.type === 'custom';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader
        title="Thành viên"
        subtitle={group ? `${group.name} · ${group.member_count} người` : undefined}
        onBack={() => router.back()}
      />
      {rows === null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.user_id}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}
          ListHeaderComponent={
            !manualGroup ? (
              <Card style={{ backgroundColor: Colors.primarySoft, marginBottom: Spacing.sm }}>
                <Txt variant="small" color={Colors.primaryDark}>
                  Thành viên nhóm {group?.type === 'area' ? 'khu' : 'ban ngành'} được tự động cập nhật theo danh sách của thôn.
                </Txt>
              </Card>
            ) : undefined
          }
          renderItem={({ item: r }) => {
            const self = r.user_id === me?.id;
            return (
              <View style={styles.row}>
                <Avatar name={r.full_name} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">
                    {r.full_name}
                    {self ? ' (bạn)' : ''}
                  </Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {[r.leadership_role && LEADERSHIP_ROLE_LABEL[r.leadership_role], r.area_name].filter(Boolean).join(' · ') || 'Thành viên'}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {r.role === 'admin' && <Badge text="Quản trị nhóm" color={Colors.primaryText} bg={Colors.primarySoft} />}
                    {r.is_muted && <Badge text="Đang bị khoá chat" color={Colors.warning} bg={Colors.warningSoft} />}
                  </View>
                </View>
                {iAmAdmin && !self && (
                  <View style={{ gap: 6 }}>
                    <Action
                      icon={r.is_muted ? 'volume-high' : 'volume-mute'}
                      label={r.is_muted ? 'Mở khoá chat' : 'Khoá chat'}
                      onPress={() => update(r, { muted: !r.is_muted })}
                    />
                    <Action
                      icon={r.role === 'admin' ? 'shield-outline' : 'shield-checkmark'}
                      label={r.role === 'admin' ? 'Bỏ quản trị' : 'Cho làm quản trị'}
                      onPress={() => update(r, { role: r.role === 'admin' ? 'member' : 'admin' })}
                    />
                    {manualGroup && <Action icon="person-remove" label="Xoá" danger onPress={() => remove(r)} />}
                  </View>
                )}
                {self && manualGroup && <Action icon="exit-outline" label="Rời nhóm" danger onPress={() => remove(r)} />}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: bg }}>
      <Txt variant="caption" color={color} style={{ fontFamily: Font.semibold, fontSize: 12, lineHeight: 16 }}>
        {text}
      </Txt>
    </View>
  );
}

function Action({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={16} color={danger ? Colors.danger : Colors.primaryText} />
      <Txt variant="caption" color={danger ? Colors.danger : Colors.primaryText} style={{ fontFamily: Font.semibold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
});
