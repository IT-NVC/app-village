import { rankOf } from '@thon/shared';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Vibration } from 'react-native';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Cấp bậc của người đang đăng nhập: 3 Bí thư, 2 Trưởng thôn, 1 Phó thôn, 0 người dân */
export function useRank() {
  const { me } = useAuth();
  return me?.status === 'active' ? rankOf(me.leadership_role) : 0;
}

export type ManageCounts = { sos: number; accounts: number; reports: number; bookings: number };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
export { one };

async function count(table: 'sos_events' | 'profiles' | 'reports' | 'venue_bookings', col: string, val: string) {
  const { count: c } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(col, val);
  return c ?? 0;
}

async function fetchCounts(rank: number): Promise<ManageCounts> {
  const [sos, accounts, reports, bookings] = await Promise.all([
    count('sos_events', 'status', 'dang_cho'),
    count('profiles', 'status', 'pending'),
    rank >= 2 ? count('reports', 'status', 'moi') : Promise.resolve(0),
    count('venue_bookings', 'status', 'cho_duyet'),
  ]);
  return { sos, accounts, reports, bookings };
}

/** Số việc đang chờ cán bộ xử lý. Cập nhật ngay khi có SOS / phản ánh / yêu cầu mới, và định kỳ 30 giây. */
export function useManageCounts() {
  const rank = useRank();
  const [counts, setCounts] = useState<ManageCounts>({ sos: 0, accounts: 0, reports: 0, bookings: 0 });

  const refresh = useCallback(async () => {
    if (rank >= 1) setCounts(await fetchCounts(rank));
  }, [rank]);

  useEffect(() => {
    if (rank < 1) return;
    fetchCounts(rank).then(setCounts);
    const channel = supabase
      .channel('manage-counts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_events' }, () => {
        Vibration.vibrate([0, 400, 200, 400]);
        fetchCounts(rank).then(setCounts);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => fetchCounts(rank).then(setCounts))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_bookings' }, () => fetchCounts(rank).then(setCounts))
      .subscribe();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') fetchCounts(rank).then(setCounts);
    }, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [rank]);

  return { counts, refresh, total: counts.sos + counts.accounts + counts.reports + counts.bookings };
}
