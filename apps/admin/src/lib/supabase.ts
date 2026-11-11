import { createClient } from '@supabase/supabase-js';
import type { Database } from '@thon/shared';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong apps/admin/.env');

export const supabase = createClient<Database>(url, key);

/** PostgREST trả tối đa 1000 dòng / lần: tải hết bằng cách lấy theo từng trang */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}

/** Ném lỗi để React Query / try-catch bắt được */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Quan hệ 1-1 của PostgREST có thể trả object hoặc mảng tuỳ phiên bản */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Danh sách: ném lỗi nếu có, trả [] nếu rỗng */
export function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

/** Một dòng bắt buộc phải có */
export function mustOne<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error('Không tìm thấy dữ liệu');
  return res.data;
}

export type NotifyKind = 'announcement' | 'sos_update' | 'report_update' | 'poll' | 'event' | 'booking_review';

/** Báo máy chủ gửi thông báo đẩy cho một sự kiện (không chờ, không báo lỗi — push chỉ là phụ trợ) */
export function notify(kind: NotifyKind, id: string) {
  supabase.functions.invoke('notify', { body: { kind, id } }).catch(() => {});
}
