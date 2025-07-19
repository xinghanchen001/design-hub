import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session);

      if (!mounted) return;

      // If we're in the process of signing out, ignore session restore
      if (isSigningOut && event !== 'SIGNED_OUT') {
        console.log('Ignoring auth state change during sign out process');
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setIsSigningOut(false);
        setLoading(false);
        // Clear any persistent storage
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.warn('Failed to clear storage:', e);
        }
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // THEN check for existing session (but not if we're signing out)
    if (!isSigningOut) {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (mounted && !isSigningOut) {
          if (error) {
            console.error('Error getting session:', error);
            setSession(null);
            setUser(null);
          } else {
            setSession(session);
            setUser(session?.user ?? null);
          }
          setLoading(false);
        }
      });
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isSigningOut]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');
      setIsSigningOut(true);
      setLoading(true);

      // Clear state immediately
      setUser(null);
      setSession(null);

      // Clear all storage first
      try {
        localStorage.clear();
        sessionStorage.clear();
        // Clear specific Supabase keys that might persist
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('supabase') || key.startsWith('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }

      // Call Supabase signOut with proper scope
      const { error } = await supabase.auth.signOut({
        scope: 'global',
      });

      if (error) {
        console.error('Supabase sign out error:', error);
      }

      console.log('Sign out completed');
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      // Always complete the sign out process
      setUser(null);
      setSession(null);
      setIsSigningOut(false);
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
