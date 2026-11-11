import type { Database } from '@thon/shared';

import { signedUrlsFor } from '@/lib/images';
import { supabase } from '@/lib/supabase';

type Fns = Database['public']['Functions'];
export type FundSummary = Fns['fund_summaries']['Returns'][number];
export type FundTx = Fns['fund_transactions_view']['Returns'][number];
export type Contribution = Fns['fund_household_contributions']['Returns'][number];

export const RECEIPT_BUCKET = 'fund-receipts';

/** 1500000 -> "1.500.000 đ" (không phụ thuộc Intl để chạy ổn định trên mọi máy) */
export function vnd(n: number) {
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '−' : ''}${s} đ`;
}

/** Rút gọn: 12.500.000 -> "12,5 triệu" */
export function vndShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',').replace(',0', '')} tỷ`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} triệu`;
  return vnd(n);
}

export async function fetchFunds(): Promise<FundSummary[]> {
  const { data } = await supabase.rpc('fund_summaries');
  return data ?? [];
}

export async function fetchFund(id: string) {
  const [s, t, c] = await Promise.all([
    supabase.rpc('fund_summaries'),
    supabase.rpc('fund_transactions_view', { p_fund_id: id }),
    supabase.rpc('fund_household_contributions', { p_fund_id: id }),
  ]);
  const txs = t.data ?? [];
  const receipts = await signedUrlsFor(
    RECEIPT_BUCKET,
    txs.map((x) => x.receipt_path).filter((p): p is string => !!p),
  );
  return {
    fund: (s.data ?? []).find((f) => f.id === id) ?? null,
    txs,
    contributions: c.data ?? [],
    receipts,
  };
}
