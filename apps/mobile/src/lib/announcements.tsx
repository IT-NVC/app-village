import type { PriorityLevel } from '@thon/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { Colors } from '@/constants/theme';
import { newChannel, supabase } from '@/lib/supabase';

export type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: PriorityLevel;
  scheduled_at: string;
  target_all: boolean;
  sender_id: string | null;
  read: boolean;
};

/** Màu & icon theo mức độ */
export const PRIORITY_STYLE: Record<PriorityLevel, { label: string; color: string; bg: string; icon: 'alert-circle' | 'star' | 'notifications' }> = {
  khan: { label: 'Khẩn', color: Colors.danger, bg: Colors.dangerSoft, icon: 'alert-circle' },
  quan_trong: { label: 'Quan trọng', color: Colors.warning, bg: Colors.warningSoft, icon: 'star' },
  thuong: { label: 'Thông thường', color: Colors.primaryText, bg: Colors.primarySoft, icon: 'notifications' },
};

type Value = {
  items: Announcement[];
  loading: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const Ctx = createContext<Value | null>(null);

export function AnnouncementsProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  const refresh = useCallback(async () => {
    const uid = userRef.current;
    if (!uid) return;
    // RLS chỉ trả về thông báo dành cho mình; lọc thêm thông báo hẹn giờ chưa tới
    const [anns, reads] = await Promise.all([
      supabase
        .from('announcements')
        .select('id, title, content, priority, scheduled_at, target_all, sender_id')
        .lte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: false })
        .limit(100),
      supabase.from('announcement_reads').select('announcement_id').eq('user_id', uid),
    ]);
    if (anns.error) {
      console.warn('Tải thông báo lỗi', anns.error.message);
      setLoading(false);
      return;
    }
    const readSet = new Set((reads.data ?? []).map((r) => r.announcement_id));
    setItems((anns.data ?? []).map((a) => ({ ...a, read: readSet.has(a.id) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    refresh();
    // Có thông báo mới -> tải lại ngay
    const channel = newChannel('announcements-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => refresh())
      .subscribe();
    // Mở lại app -> tải lại (để hiện thông báo hẹn giờ vừa tới giờ)
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    // Dự phòng: Realtime có thể lỡ sự kiện lúc vừa kết nối / mạng chập chờn -> tải lại định kỳ khi app đang mở
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 120_000);
    return () => {
      supabase.removeChannel(channel);
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, refresh]);

  const markRead = useCallback(async (id: string) => {
    const uid = userRef.current;
    if (!uid) return;
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    await supabase
      .from('announcement_reads')
      .upsert({ announcement_id: id, user_id: uid }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
  }, []);

  const markAllRead = useCallback(async () => {
    const uid = userRef.current;
    if (!uid) return;
    const unread = items.filter((a) => !a.read).map((a) => ({ announcement_id: a.id, user_id: uid }));
    if (unread.length === 0) return;
    setItems((prev) => prev.map((a) => ({ ...a, read: true })));
    await supabase.from('announcement_reads').upsert(unread, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
  }, [items]);

  const value = useMemo<Value>(
    () => ({ items, loading, unreadCount: items.filter((a) => !a.read).length, refresh, markRead, markAllRead }),
    [items, loading, refresh, markRead, markAllRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnnouncements() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAnnouncements phải nằm trong AnnouncementsProvider');
  return v;
}
