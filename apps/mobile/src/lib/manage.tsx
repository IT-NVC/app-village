import { rankOf } from '@thon/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Vibration } from 'react-native';

import { useAuth } from '@/lib/auth';
import { newChannel, supabase } from '@/lib/supabase';

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

type Value = { counts: ManageCounts; total: number; refresh: () => Promise<void> };
const EMPTY: ManageCounts = { sos: 0, accounts: 0, reports: 0, bookings: 0 };
const Ctx = createContext<Value | null>(null);

/**
 * Số việc đang chờ cán bộ xử lý — MỘT bộ đếm dùng chung cho toàn app (thanh tab + màn hình Quản lý),
 * nên chỉ có một kênh realtime. Cập nhật ngay khi có SOS / phản ánh / yêu cầu mới, và định kỳ 30 giây.
 */
export function ManageProvider({ children }: { children: ReactNode }) {
  const rank = useRank();
  const [counts, setCounts] = useState<ManageCounts>(EMPTY);

  const refresh = useCallback(async () => {
    if (rank >= 1) setCounts(await fetchCounts(rank));
  }, [rank]);

  useEffect(() => {
    if (rank < 1) return;
    fetchCounts(rank).then(setCounts);
    const channel = newChannel('manage-counts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_events' }, () => {
        Vibration.vibrate([0, 400, 200, 400]);
        fetchCounts(rank).then(setCounts);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_events' }, () => fetchCounts(rank).then(setCounts))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => fetchCounts(rank).then(setCounts))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_bookings' }, () => fetchCounts(rank).then(setCounts))
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && fetchCounts(rank).then(setCounts));
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') fetchCounts(rank).then(setCounts);
    }, 30_000);
    return () => {
      supabase.removeChannel(channel);
      sub.remove();
      clearInterval(timer);
    };
  }, [rank]);

  const value = useMemo<Value>(
    () => ({ counts, refresh, total: counts.sos + counts.accounts + counts.reports + counts.bookings }),
    [counts, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useManageCounts() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useManageCounts phải nằm trong ManageProvider');
  return v;
}
