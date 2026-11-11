import { supabase } from '@/lib/supabase';

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  cover_url: string | null;
  is_pinned: boolean;
  published_at: string | null;
};

const SELECT = 'id, title, summary, content, cover_url, is_pinned, published_at';

/** Tin đã đăng: tin ghim lên trước, rồi mới nhất */
export async function fetchNews(limit = 50): Promise<NewsItem[]> {
  const { data } = await supabase
    .from('news')
    .select(SELECT)
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchNewsItem(id: string): Promise<NewsItem | null> {
  const { data } = await supabase.from('news').select(SELECT).eq('id', id).eq('is_published', true).maybeSingle();
  return data ?? null;
}
