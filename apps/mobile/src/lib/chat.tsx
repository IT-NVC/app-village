import type { Database } from '@thon/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

export type ChatGroup = Database['public']['Functions']['my_chat_groups']['Returns'][number];

export type Message = {
  id: string;
  group_id: string;
  sender_id: string | null;
  content: string | null;
  image_path: string | null;
  is_pinned: boolean;
  deleted_at: string | null;
  created_at: string;
};

export const MESSAGE_SELECT = 'id, group_id, sender_id, content, image_path, is_pinned, deleted_at, created_at';
export const CHAT_BUCKET = 'chat';
export const PAGE_SIZE = 40;

/** Tin nhắn cũ hơn mốc `before` (mới nhất trước) */
export async function fetchMessages(groupId: string, before?: string): Promise<Message[]> {
  let q = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (before) q = q.lt('created_at', before);
  const { data } = await q;
  return data ?? [];
}

/** Màu tên người gửi (ổn định theo id) để dễ phân biệt trong nhóm */
const NAME_COLORS = ['#1E63B8', '#B26A00', '#6A3FB5', '#C2185B', '#00796B', '#5D4037', '#3949AB', '#2E7D32'];
export function nameColor(id: string | null) {
  if (!id) return NAME_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

type Value = {
  groups: ChatGroup[] | null;
  totalUnread: number;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Value | null>(null);

async function fetchInbox(): Promise<ChatGroup[]> {
  const { data, error } = await supabase.rpc('my_chat_groups');
  if (error) console.warn('Tải hộp thư lỗi', error.message);
  return data ?? [];
}

export function ChatProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [groups, setGroups] = useState<ChatGroup[] | null>(null);

  const refresh = useCallback(async () => {
    setGroups(await fetchInbox());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchInbox().then(setGroups);
    // Tin nhắn mới / được thêm vào nhóm -> cập nhật hộp thư (RLS chỉ gửi sự kiện của nhóm mình)
    const channel = supabase
      .channel('chat-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchInbox().then(setGroups))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, () => fetchInbox().then(setGroups))
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && fetchInbox().then(setGroups));
    // Dự phòng khi Realtime lỡ sự kiện
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') fetchInbox().then(setGroups);
    }, 60_000);
    return () => {
      supabase.removeChannel(channel);
      sub.remove();
      clearInterval(timer);
    };
  }, [enabled]);

  const value = useMemo<Value>(
    () => ({ groups, totalUnread: (groups ?? []).reduce((n, g) => n + (g.unread ?? 0), 0), refresh }),
    [groups, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChat phải nằm trong ChatProvider');
  return v;
}
