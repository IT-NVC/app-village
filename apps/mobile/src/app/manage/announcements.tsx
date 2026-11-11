import { PRIORITY_LABEL, type PriorityLevel } from '@thon/shared';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { IconButton, Txt } from '@/components/ui';
import { Colors, Font, Radius } from '@/constants/theme';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const COLOR: Record<PriorityLevel, string> = { khan: Colors.danger, quan_trong: Colors.warning, thuong: Colors.primaryText };

async function load() {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, priority, target_all, scheduled_at')
    .order('scheduled_at', { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((a) => ({ ...a, stats: null as { total: number; read_count: number } | null }));
  // Thống kê đã đọc cho 20 thông báo gần nhất
  await Promise.all(
    rows.slice(0, 20).map(async (r) => {
      const { data: s } = await supabase.rpc('announcement_read_stats', { p_announcement: r.id });
      if (s?.[0]) r.stats = s[0];
    }),
  );
  return rows;
}

export default function AnnouncementsAdminScreen() {
  const state = useLoad(load);
  return (
    <ManageShell title="Thông báo đã gửi" right={<IconButton icon="add" label="Gửi thông báo mới" onPress={() => router.push('/manage/announce')} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(a) => a.id}
            empty={{ icon: 'megaphone-outline', title: 'Chưa gửi thông báo nào' }}
            renderItem={(a) => {
              const pct = a.stats?.total ? Math.round((a.stats.read_count / a.stats.total) * 100) : null;
              const future = new Date(a.scheduled_at) > new Date();
              return (
                <RowCard onPress={() => router.push({ pathname: '/manage/announcement/[id]', params: { id: a.id } })} style={{ alignItems: 'stretch', flexDirection: 'column', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt variant="caption" color={COLOR[a.priority]} style={{ fontFamily: Font.bold }}>
                      {PRIORITY_LABEL[a.priority].toUpperCase()}
                    </Txt>
                    {future && (
                      <Txt variant="caption" color={Colors.purple} style={{ fontFamily: Font.bold }}>
                        · HẸN GIỜ
                      </Txt>
                    )}
                    <Txt variant="caption" color={Colors.textMuted} style={{ flex: 1, textAlign: 'right' }}>
                      {fmtDateTime(a.scheduled_at)}
                    </Txt>
                  </View>
                  <Txt variant="bodyStrong">{a.title}</Txt>
                  {pct !== null && (
                    <View style={{ gap: 4 }}>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: Colors.divider, overflow: 'hidden' }}>
                        <View style={{ height: 8, width: `${pct}%`, backgroundColor: Colors.primary, borderRadius: Radius.sm }} />
                      </View>
                      <Txt variant="caption" color={Colors.textSecondary}>
                        {a.stats!.read_count}/{a.stats!.total} người đã đọc ({pct}%)
                      </Txt>
                    </View>
                  )}
                </RowCard>
              );
            }}
          />
        )}
      </Async>
    </ManageShell>
  );
}

