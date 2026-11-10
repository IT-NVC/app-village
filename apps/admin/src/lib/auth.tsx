import type { Session } from '@supabase/supabase-js';
import { rankOf, usernameToEmail, type AccountStatus, type LeadershipRole } from '@thon/shared';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export type Me = {
  id: string;
  username: string | null;
  status: AccountStatus;
  leadership_role: LeadershipRole | null;
  full_name: string | null;
  area_name: string | null;
};

type AuthValue = {
  loading: boolean;
  session: Session | null;
  me: Me | null;
  /** 3 Bí thư, 2 Trưởng thôn, 1 Phó thôn, 0 không phải cán bộ */
  rank: number;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(s: Session | null) {
      setSession(s);
      if (!s) {
        setMe(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase.rpc('get_me');
      setMe((data as unknown as Me) ?? null);
      setLoading(false);
    }
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => load(s), 0);
      else setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const rank = me?.status === 'active' ? rankOf(me.leadership_role) : 0;
    return {
      loading,
      session,
      me,
      rank,
      isAdmin: rank >= 2,
      async signIn(username, password) {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(username),
          password,
        });
        if (error) {
          setLoading(false);
          return error.message.toLowerCase().includes('invalid login credentials')
            ? 'Sai tên đăng nhập hoặc mật khẩu.'
            : error.message;
        }
        return null;
      },
      async signInWithGoogle() {
        // Trình duyệt chuyển sang Google rồi quay lại trang này; supabase-js tự đọc phiên từ URL
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        return error ? error.message : null;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    };
  }, [loading, session, me]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider');
  return v;
}
