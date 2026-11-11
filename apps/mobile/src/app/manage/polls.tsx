import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { IconButton, Txt } from '@/components/ui';
import { Colors, Font } from '@/constants/theme';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

async function load() {
  const { data, error } = await supabase.from('polls').select('id, title, vote_scope, closes_at, closed_at, created_at').order('created_at', { ascending: false }).limit(60);
  if (error) throw new Error(error.message);
  return Promise.all(
    (data ?? []).map(async (p) => {
      const [r, e] = await Promise.all([supabase.rpc('poll_results', { p_poll_id: p.id }), supabase.rpc('poll_eligible_count', { p_poll_id: p.id })]);
      return { ...p, voters: r.data?.[0]?.voters ?? 0, eligible: (e.data as number | null) ?? 0 };
    }),
  );
}

export default function PollsAdminScreen() {
  const state = useLoad(load);
  return (
    <ManageShell title="Biểu quyết" right={<IconButton icon="add" label="Tạo khảo sát" onPress={() => router.push('/manage/poll-new')} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(p) => p.id}
            empty={{ icon: 'stats-chart-outline', title: 'Chưa có khảo sát nào', message: 'Bấm dấu + để lấy ý kiến bà con.' }}
            renderItem={(p) => {
              const open = !p.closed_at && (!p.closes_at || new Date(p.closes_at) > new Date());
              const pct = p.eligible ? Math.round((p.voters / p.eligible) * 100) : 0;
              return (
                <RowCard onPress={() => router.push({ pathname: '/manage/poll/[id]', params: { id: p.id } })}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt variant="bodyStrong">{p.title}</Txt>
                    <Txt variant="caption" color={open ? Colors.success : Colors.textMuted} style={{ fontFamily: Font.bold }}>
                      {open ? 'Đang mở' : 'Đã đóng'} · {p.vote_scope === 'household' ? 'mỗi hộ 1 phiếu' : 'mỗi người 1 phiếu'}
                      {p.closes_at && open ? ` · hạn ${fmtDateTime(p.closes_at)}` : ''}
                    </Txt>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: Colors.divider, overflow: 'hidden' }}>
                      <View style={{ height: 8, width: `${pct}%`, backgroundColor: Colors.primary }} />
                    </View>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      {p.voters}/{p.eligible} {p.vote_scope === 'household' ? 'hộ' : 'người'} đã tham gia ({pct}%)
                    </Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
                </RowCard>
              );
            }}
          />
        )}
      </Async>
    </ManageShell>
  );
}
