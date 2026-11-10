// Truy vấn dữ liệu dùng chung giữa các trang
import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@thon/shared';

import { fetchAll, must, supabase } from '@/lib/supabase';

export type Area = Tables<'areas'>;
export type Organization = Tables<'organizations'>;

export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: async () =>
      must(await supabase.from('areas').select('*').order('sort_order').order('name')) as Area[],
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () =>
      must(await supabase.from('organizations').select('*').order('name')) as Organization[],
  });
}

export type Person = { id: string; full_name: string; area_name: string | null; username: string | null };

/** Danh sách tài khoản đang hoạt động (để chọn người khi phân quyền / thêm vào ban ngành) */
export function useActivePeople() {
  return useQuery({
    queryKey: ['active-people'],
    queryFn: async () => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from('profiles')
          .select('id, username, residents(full_name, areas(name))')
          .eq('status', 'active')
          .range(from, to),
      );
      return rows
        .map((r) => {
          const res = Array.isArray(r.residents) ? r.residents[0] : r.residents;
          const area = res?.areas && (Array.isArray(res.areas) ? res.areas[0] : res.areas);
          return {
            id: r.id,
            username: r.username,
            full_name: res?.full_name ?? r.username ?? '(chưa có tên)',
            area_name: area?.name ?? null,
          } satisfies Person;
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
    },
  });
}

/** Số tài khoản chờ duyệt (hiện trên menu) */
export function usePendingCount() {
  return useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}
