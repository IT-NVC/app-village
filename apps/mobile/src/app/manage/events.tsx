import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, PillTabs, RowCard, useLoad } from '@/components/manage-kit';
import { IconButton, IconCircle, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { EVENT_STYLE } from '@/lib/calendar';
import { fmtDateTime } from '@/lib/format';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

async function load(past: boolean) {
  let q = supabase.from('events').select('id, title, category, location, starts_at, ends_at, areas(name)').order('starts_at', { ascending: !past }).limit(200);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  q = past ? q.lt('starts_at', today.toISOString()) : q.gte('starts_at', today.toISOString());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({ ...e, area: one(e.areas)?.name ?? null }));
}

export default function EventsAdminScreen() {
  const [which, setWhich] = useState<'up' | 'past'>('up');
  const state = useLoad(() => load(which === 'past'), which);
  return (
    <ManageShell title="Sự kiện" right={<IconButton icon="add" label="Thêm sự kiện" onPress={() => router.push({ pathname: '/manage/event/[id]', params: { id: 'new' } })} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(e) => e.id}
            empty={{ icon: 'calendar-outline', title: which === 'up' ? 'Chưa có sự kiện sắp tới' : 'Không có sự kiện đã qua', message: 'Bấm dấu + để thêm lịch họp, lễ hội, thu gom rác…' }}
            header={<PillTabs<'up' | 'past'> items={[{ key: 'up', label: 'Sắp tới' }, { key: 'past', label: 'Đã qua' }]} value={which} onChange={setWhich} scroll={false} />}
            renderItem={(e) => {
              const s = EVENT_STYLE[e.category];
              return (
                <RowCard onPress={() => router.push({ pathname: '/manage/event/[id]', params: { id: e.id } })}>
                  <IconCircle icon={s.icon} color={s.color} bg={s.bg} size={48} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{e.title}</Txt>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      {fmtDateTime(e.starts_at)} · {e.area ?? 'Toàn thôn'}
                      {e.location ? ` · ${e.location}` : ''}
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
