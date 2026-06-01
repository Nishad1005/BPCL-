import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { can, type AppRole, type Module, type PermissionRow, type Verb } from '@/lib/permissions';

type Profile = { id: string; name: string; role: AppRole; primary_store_id: string | null };

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  can: (module: Module, verb: Verb) => boolean;
  isAdmin: boolean;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setPerms([]); return; }
    (async () => {
      const { data: prof } = await supabase
        .from('users').select('id, name, role, primary_store_id').eq('id', session.user.id).maybeSingle();
      setProfile(prof as Profile | null);
      if (prof) {
        const { data: rows } = await supabase
          .from('roles_permissions')
          .select('module, can_view, can_create, can_edit, can_approve, can_export')
          .eq('role', (prof as Profile).role);
        setPerms((rows ?? []) as PermissionRow[]);
      }
    })();
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session, profile, loading,
    can: (module, verb) => can(perms, module, verb),
    isAdmin: profile?.role === 'super_admin',
    signInWithOtp: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      return { error: error?.message ?? null };
    },
    verifyOtp: async (email, token) => {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      return { error: error?.message ?? null };
    },
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, profile, perms, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
