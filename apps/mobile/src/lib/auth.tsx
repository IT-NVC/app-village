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
        const redirectTo = makeRedirectUri();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data.url) return translateAuthError(error?.message ?? 'Không mở được Google');
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return null; // người dùng tự đóng
        const params = new URL(result.url).searchParams;
        const errDesc = params.get('error_description');
        if (errDesc) return translateAuthError(errDesc);
        const code = params.get('code');
        if (!code) return 'Đăng nhập Google không thành công.';
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        return exErr ? translateAuthError(exErr.message) : null;
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
