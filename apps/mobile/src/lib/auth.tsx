import type { Session } from '@supabase/supabase-js';
import { usernameToEmail, type AccountStatus, type LeadershipRole, type OrgRole } from '@thon/shared';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { unregisterPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type Me = {
  id: string;
  username: string | null;
  status: AccountStatus;
  reject_reason: string | null;
  leadership_role: LeadershipRole | null;
  avatar_url: string | null;
  full_name: string | null;
  phone: string | null;
  area_id: string | null;
  area_name: string | null;
  orgs: { org_id: string; name: string; role: OrgRole }[];
};

/** Trạng thái điều hướng của app */
export type AuthPhase = 'loading' | 'error' | 'signedOut' | 'onboarding' | 'waiting' | 'active';

type AuthContextValue = {
  session: Session | null;
  me: Me | null;
  phase: AuthPhase;
  refreshMe: () => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<string | null>;
  signUpWithUsername: (username: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/** Dịch thông báo lỗi của Supabase sang tiếng Việt dễ hiểu */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Sai tên đăng nhập hoặc mật khẩu.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Tên đăng nhập này đã có người dùng. Vui lòng chọn tên khác.';
  if (m.includes('password should be at least')) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (m.includes('network request failed') || m.includes('fetch'))
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng.';
  if (m.includes('rate limit')) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  return message;
}

/** Mã đăng nhập đã đổi (mỗi mã chỉ dùng được một lần — tránh đổi trùng khi cả 2 đường cùng nhận được) */
const usedCodes = new Set<string>();

/** Hoàn tất đăng nhập Google từ địa chỉ quay về (chứa ?code=… hoặc ?error_description=…) */
export async function completeOAuth(url: string): Promise<string | null> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const params = new URLSearchParams(query);
  const errDesc = params.get('error_description');
  if (errDesc) return translateAuthError(errDesc);
  const code = params.get('code');
  if (!code) return 'Đăng nhập Google không thành công.';
  if (usedCodes.has(code)) return null;
  usedCodes.add(code);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? translateAuthError(error.message) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadMe = useCallback(async (s: Session | null) => {
    setLoadError(false);
    if (!s) {
      setMe(null);
      return;
    }
    const { data, error } = await supabase.rpc('get_me');
    if (error || !data) {
      console.warn('get_me lỗi', error?.message);
      setMe(null);
      setLoadError(true);
      return;
    }
    setMe(data as unknown as Me);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadMe(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Không gọi supabase bên trong callback (tránh khoá); đẩy ra ngoài vòng lặp sự kiện
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => loadMe(s), 0);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadMe]);

  const phase: AuthPhase = useMemo(() => {
    if (initializing) return 'loading';
    if (!session) return 'signedOut';
    if (!me) return loadError ? 'error' : 'loading';
    switch (me.status) {
      case 'active':
        return 'active';
      case 'pending':
      case 'locked':
        return 'waiting';
      default:
        return 'onboarding'; // unverified, rejected
    }
  }, [initializing, session, me, loadError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      me,
      phase,
      refreshMe: () => loadMe(session),
      async signInWithUsername(username, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(username),
          password,
        });
        return error ? translateAuthError(error.message) : null;
      },
      async signUpWithUsername(username, password) {
        const u = username.trim().toLowerCase();
        if (!USERNAME_PATTERN.test(u))
          return 'Tên đăng nhập gồm 3–30 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới.';
        const { error } = await supabase.auth.signUp({
          email: usernameToEmail(u),
          password,
          options: { data: { username: u } },
        });
        return error ? translateAuthError(error.message) : null;
      },
      async signInWithGoogle() {
        // Quay về một đường dẫn riêng (/auth/callback), KHÔNG phải địa chỉ gốc của app:
        // trong Expo Go, địa chỉ gốc exp://…:8081 trùng với địa chỉ mở dự án -> Expo Go tải lại app và làm mất kết quả.
        const redirectTo = makeRedirectUri({ path: 'auth/callback' });
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data.url) return translateAuthError(error?.message ?? 'Không mở được Google');
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        // Nếu kết quả đi theo đường deep link thay vì trả về đây, màn hình app/auth/callback.tsx sẽ hoàn tất đăng nhập
        if (result.type !== 'success') return null;
        return completeOAuth(result.url);
      },
      async signOut() {
        await unregisterPush();
        await supabase.auth.signOut();
      },
    }),
    [session, me, phase, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
