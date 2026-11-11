import type { Database } from '@thon/shared';

import { supabase } from '@/lib/supabase';

export type Poll = {
  id: string;
  title: string;
  description: string | null;
  allow_multiple: boolean;
  is_anonymous: boolean;
  vote_scope: Database['public']['Enums']['vote_scope'];
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
};
export type PollResult = Database['public']['Functions']['poll_results']['Returns'][number];

const SELECT = 'id, title, description, allow_multiple, is_anonymous, vote_scope, closes_at, closed_at, created_at';

export const isOpen = (p: Poll) => !p.closed_at && (!p.closes_at || new Date(p.closes_at) > new Date());

/** "Còn 3 ngày" / "Còn 5 giờ" / "Đã đóng" / "Không thời hạn" */
export function deadlineText(p: Poll) {
  if (!isOpen(p)) return 'Đã đóng';
  if (!p.closes_at) return 'Không thời hạn';
  const ms = new Date(p.closes_at).getTime() - Date.now();
  const h = Math.floor(ms / 3600e3);
  if (h >= 48) return `Còn ${Math.floor(h / 24)} ngày`;
  if (h >= 1) return `Còn ${h} giờ`;
  return `Còn ${Math.max(1, Math.floor(ms / 60e3))} phút`;
}

/** Danh sách khảo sát + những khảo sát tôi đã bỏ phiếu */
export async function fetchPolls(userId: string): Promise<{ polls: Poll[]; voted: Set<string> }> {
  const [p, v] = await Promise.all([
    supabase.from('polls').select(SELECT).order('created_at', { ascending: false }).limit(100),
    supabase.from('poll_votes').select('poll_id').eq('user_id', userId),
  ]);
  return { polls: p.data ?? [], voted: new Set((v.data ?? []).map((x) => x.poll_id)) };
}

export async function fetchPoll(id: string) {
  const [p, r, e] = await Promise.all([
    supabase.from('polls').select(SELECT).eq('id', id).maybeSingle(),
    supabase.rpc('poll_results', { p_poll_id: id }),
    supabase.rpc('poll_eligible_count', { p_poll_id: id }),
  ]);
  return { poll: (p.data ?? null) as Poll | null, results: (r.data ?? []) as PollResult[], eligible: (e.data as number | null) ?? 0 };
}
