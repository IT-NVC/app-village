import { must, mustOne, rows as list, supabase } from '@/lib/supabase';

/** Tìm hộ theo mã; chưa có thì tạo mới. Trả null nếu không nhập mã hộ. */
export async function ensureHousehold(code: string | null | undefined, headName: string, areaId: string | null) {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  const found = must(await supabase.from('households').select('id').eq('code', c).maybeSingle());
  if (found) return found.id;
  const created = mustOne(
    await supabase.from('households').insert({ code: c, head_name: headName, area_id: areaId }).select('id').single(),
  );
  return created.id;
}

/** Tạo hàng loạt các hộ còn thiếu; trả Map mã hộ -> id */
export async function ensureHouseholds(
  items: { code: string; head_name: string; area_id: string | null }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const codes = [...new Set(items.map((i) => i.code))];
  if (codes.length === 0) return map;
  for (let i = 0; i < codes.length; i += 200) {
    const chunk = codes.slice(i, i + 200);
    const rows = list(await supabase.from('households').select('id, code').in('code', chunk));
    for (const r of rows) if (r.code) map.set(r.code, r.id);
  }
  const missing = codes
    .filter((c) => !map.has(c))
    .map((c) => items.find((i) => i.code === c)!)
    .map((i) => ({ code: i.code, head_name: i.head_name, area_id: i.area_id }));
  for (let i = 0; i < missing.length; i += 500) {
    const rows = list(await supabase.from('households').insert(missing.slice(i, i + 500)).select('id, code'));
    for (const r of rows) if (r.code) map.set(r.code, r.id);
  }
  return map;
}
