import React, { createContext, useContext, useState, useEffect, useTransition } from 'react';
import { User, UserRole, Language } from '../types';
import { translations } from '../i18n';
import { api, AUTH_TOKEN_KEY } from '../services/api';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
  switchRole: (role: 'consumer' | 'owner') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isLoadingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'qgo_user';
const TOKEN_KEY = AUTH_TOKEN_KEY;
const LANG_KEY = 'qgo_lang';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback to null
      }
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

  // Session restoration on startup
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoadingSession(false);
        return;
      }

      try {
        const res = await api.getMe(token);
        if (res.success && res.user) {
          startTransition(() => {
            setUser(res.user!);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
          });
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        }
      } catch (err) {
        console.error('Session validation error:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };

    restoreSession();

    // Do not clear session based solely on Firebase auth state 
    // since the app uses a custom backend token for authorization.
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [user]);

  const loginWithGoogle = async (
    credential: string,
    requestedRole: string,
    accessToken?: string,
    name?: string,
    picture?: string
  ) => {
    try {
      const res = await api.loginWithGoogle(credential, requestedRole, accessToken, name, picture);
      if (res.success && res.user && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        startTransition(() => {
          setUser(res.user!);
        });
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'Authentication failed', code: res.code };
    } catch (e: any) {
      console.error('Google login error:', e);
      return { success: false, error: e?.message || 'Network error during authentication' };
    }
  };

  const loginWithOtp = async (phone: string, otp: string, name?: string) => {
    try {
      const res = await api.verifyOtp(phone, otp, name);
      if (res.success && res.user && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        startTransition(() => {
          setUser(res.user!);
        });
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'OTP verification failed' };
    } catch (e: any) {
      console.error('OTP login error:', e);
      return { success: false, error: e?.message || 'Network error during OTP login' };
    }
  };

  const loginAsDemo = async (demoRole: 'consumer' | 'owner') => {
    try {
      const res = await api.loginAsDemo(demoRole);
      if (res.success && res.user && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        startTransition(() => {
          setUser(res.user!);
        });
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'Demo login failed' };
    } catch (e: any) {
      console.error('Demo login error:', e);
      return { success: false, error: e?.message || 'Network error during demo login' };
    }
  };

  const switchRole = async (nextRole: 'consumer' | 'owner') => {
    try {
      const res = await api.switchRole(nextRole);
      if (res.success && res.user && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        startTransition(() => {
          setUser(res.user!);
        });
        return { success: true };
      }
      return { success: false, error: res.error || 'Role switch failed' };
    } catch (e: any) {
      console.error('Role switch error:', e);
      return { success: false, error: e?.message || 'Network error during role switch' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    signOut(auth).catch(() => {});
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
        switchRole,
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
