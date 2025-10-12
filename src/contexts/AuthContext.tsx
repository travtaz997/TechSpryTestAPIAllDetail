import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type NetTermsStatus = 'not_requested' | 'pending' | 'approved' | 'declined';

export interface NetTermsApplication {
  legalBusinessName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: Record<string, unknown> | null;
  shippingAddress?: Record<string, unknown> | null;
  accountsPayableEmail?: string;
  estimatedMonthlySpend?: string;
  taxId?: string;
  notes?: string;
}

export interface BusinessProfile {
  jobTitle?: string;
  website?: string;
  taxId?: string;
  metadata?: Record<string, unknown> | null;
}

interface UserProfile {
  id: string;
  auth_user_id: string;
  customer_id: string | null;
  role: 'admin' | 'buyer' | 'viewer';
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  account_type?: 'business' | 'consumer' | null;
  business_profile?: BusinessProfile | null;
  net_terms_status?: NetTermsStatus | null;
  net_terms_requested_at?: string | null;
  net_terms_reviewed_at?: string | null;
  net_terms_application?: NetTermsApplication | null;
  net_terms_internal_notes?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; data: { user: User | null } | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(authUserId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(
          `
            id,
            auth_user_id,
            customer_id,
            role,
            email,
            first_name,
            last_name,
            phone,
            account_type,
            business_profile,
            net_terms_status,
            net_terms_requested_at,
            net_terms_reviewed_at,
            net_terms_application,
            net_terms_internal_notes
          `
        )
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as UserProfile | null);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signUp(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error, data };
    } catch (error) {
      return { error: error as Error, data: null };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: async () => {
      if (!user) {
        setProfile(null);
        return;
      }
      await loadUserProfile(user.id);
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
