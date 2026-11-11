import { supabase } from '@/lib/supabase';

export type Area = { id: string; name: string; description: string | null; sort_order: number };
export type Org = { id: string; name: string; area_id: string | null; description: string | null };

/** Bỏ dấu tiếng Việt + chữ thường, để tìm kiếm không cần gõ dấu */
export function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Dịch lỗi CSDL thường gặp sang tiếng Việt dễ hiểu */
export function friendlyError(message: string) {
  if (message.includes('duplicate key') && message.includes('chat_groups')) return 'Nhóm chat này đã được tạo trước đó.';
  if (message.includes('duplicate key')) return 'Tên này đã tồn tại.';
  if (message.includes('violates foreign key')) return 'Không xoá được vì còn dữ liệu liên quan.';
  if (message.includes('row-level security')) return 'Bạn không có quyền thực hiện thao tác này.';
  return message;
}

/** PostgREST trả tối đa 1000 dòng / lần: tải hết bằng cách lấy theo từng trang */
export async function fetchAllRows<T>(
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

export async function fetchAreas(): Promise<Area[]> {
  const { data, error } = await supabase.from('areas').select('id, name, description, sort_order').order('sort_order').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrgs(): Promise<Org[]> {
  const { data, error } = await supabase.from('organizations').select('id, name, area_id, description').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Tìm hộ theo mã; chưa có thì tạo mới. Trả null nếu không nhập mã hộ. */
export async function ensureHousehold(code: string | null | undefined, headName: string, areaId: string | null): Promise<string | null> {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  const found = await supabase.from('households').select('id').eq('code', c).maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (found.data) return found.data.id;
  const created = await supabase.from('households').insert({ code: c, head_name: headName, area_id: areaId }).select('id').single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

/** "05/09/1960" -> "1960-09-05"; null nếu sai định dạng */
export function parseVnDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCDate() !== d || date.getUTCMonth() !== mo - 1 || y < 1900 || date > new Date()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "1960-09-05" -> "05/09/1960" */
export const toVnDate = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');

/** Lấy thông báo lỗi tiếng Việt từ phản hồi lỗi của Edge Function */
export async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    } catch {
      /* bỏ qua */
    }
  }
  return errText(error);
}

/** Tạo / xoá tài khoản (cần quyền quản trị Auth nên làm ở máy chủ). Trả về null nếu thành công, hoặc thông báo lỗi. */
export async function manageAccount(body: { action: 'create'; resident_id: string; username: string; password: string } | { action: 'delete'; user_id: string }): Promise<string | null> {
  const { error } = await supabase.functions.invoke('admin-account', { body });
  return error ? functionError(error) : null;
}
