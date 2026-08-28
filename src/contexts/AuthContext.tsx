import React, { createContext, useContext, useState, useEffect, useTransition } from 'react';
import { User, UserRole, Language } from '../types';
import { translations } from '../i18n';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  currentRole: UserRole;
  language: Language;
  t: typeof translations['en'];
  setLanguage: (lang: Language) => void;
  setUser: (user: User | null) => void;
  loginWithGoogle: (
    credential: string,
    role: string,
    accessToken?: string,
    name?: string,
    picture?: string
  ) => Promise<{ success: boolean; error?: string; code?: string }>;
  loginWithOtp: (
    phone: string,
    otp: string,
    name?: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: (role: 'consumer' | 'owner') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isLoadingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LANG_KEY = 'qgo_lang';
const STORAGE_KEY = 'qgo_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem(LANG_KEY) as Language) || 'en';
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  useEffect(() => {
    // Initial session load
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await api.getMe();
        if (res.success && res.user) {
          startTransition(() => {
            setUser(res.user!);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
          });
        } else {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      }
      setIsLoadingSession(false);
    };

    restoreSession();

    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const res = await api.getMe();
        if (res.success && res.user) {
          startTransition(() => {
            setUser(res.user!);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
          });
        }
      } else if (event === 'SIGNED_OUT') {
        startTransition(() => {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = async (
    credential: string,
    requestedRole: string,
    accessToken?: string,
    name?: string,
    picture?: string
  ) => {
    try {
      const res = await api.loginWithGoogle(credential, requestedRole, accessToken, name, picture);
      if (res.success) {
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'Authentication failed' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error during authentication' };
    }
  };

  const loginWithOtp = async (phone: string, otp: string, name?: string) => {
    try {
      const res = await api.verifyOtp(phone, otp, name);
      if (res.success) {
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'OTP verification failed' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error during OTP login' };
    }
  };

  const loginAsDemo = async (demoRole: 'consumer' | 'owner') => {
    return { success: false, error: 'Demo login not available in production' };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const currentT = translations[language] || translations['en'];

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'consumer',
        currentRole: user?.role || 'consumer',
        language,
        t: currentT,
        setLanguage,
        setUser,
        loginWithGoogle,
        loginWithOtp,
        loginAsDemo,
        logout,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isLoadingSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
