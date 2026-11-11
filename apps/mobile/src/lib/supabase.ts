import '@/lib/storage-polyfill';

import type { Database } from '@thon/shared';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Thiếu EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Sao chép apps/mobile/.env.example thành .env rồi điền vào.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Khi render phía server (web) không có localStorage
    storage: typeof localStorage === 'undefined' ? undefined : localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Chỉ làm mới token khi app đang mở
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

let channelSeq = 0;
/**
 * Tạo kênh realtime với tên KHÔNG BAO GIỜ trùng.
 * supabase.channel(tên) trả về kênh đã có nếu trùng tên; kênh đó có thể đã đăng ký xong
 * (hoặc đang huỷ dở) nên gọi .on() lần nữa sẽ báo "cannot add postgres_changes callbacks ... after subscribe()".
 */
export function newChannel(name: string) {
  channelSeq += 1;
  return supabase.channel(`${name}#${channelSeq}`);
}
