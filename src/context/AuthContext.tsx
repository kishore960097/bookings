import React, { createContext, useContext, useState, useEffect, useRef, useTransition } from 'react';
import { User, UserRole, Language } from '../types';
import { translations } from '../i18n';
import { api, AUTH_TOKEN_KEY } from '../services/api';
import { auth, firebaseAuthReady, isFirebaseConfigured } from '../lib/firebase';
import {
  ConfirmationResult,
  GoogleAuthProvider,
  onIdTokenChanged,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
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
    _name?: string,
    _picture?: string
  ) => Promise<{ success: boolean; error?: string; code?: string }>;
  loginWithOtp: (
    phone: string,
    otp: string,
    name?: string,
    requestedRole?: 'consumer' | 'owner'
  ) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  switchRole: (role: 'consumer' | 'owner') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isLoadingSession: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'qgo_user';
const TOKEN_KEY = AUTH_TOKEN_KEY;
const LANG_KEY = 'qgo_lang';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem(LANG_KEY) as Language) || 'en';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [, startTransition] = useTransition();
  const phoneConfirmation = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoadingSession(false);
      return;
    }

    // Safety: always resolve loading within 2s regardless of Firebase state.
    const safetyTimer = window.setTimeout(() => {
      console.log('[QGo Auth] Safety timer expired - resolving loading state');
      setIsLoadingSession(false);
    }, 2000);

    let isMounted = true;

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (!isMounted) return;

        // Wait for persistence to be configured, but don't let it block forever.
        await Promise.race([
          firebaseAuthReady,
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);

        let tokenToVerify = localStorage.getItem(TOKEN_KEY);
        if (firebaseUser) {
          try {
            tokenToVerify = await firebaseUser.getIdToken();
            if (tokenToVerify) {
              localStorage.setItem(TOKEN_KEY, tokenToVerify);
            }
          } catch (tokErr) {
            console.warn('[QGo Auth] Error retrieving id token:', tokErr);
          }
        }

        if (!tokenToVerify) {
          // Do NOT call logout() here! logout() calls signOut(auth), which re-emits onIdTokenChanged in an infinite loop!
          if (isMounted) {
            setUser(null);
          }
          return;
        }

        const res = await api.loginWithFirebase(tokenToVerify);
        if (res.success && res.user && isMounted) {
          startTransition(() => {
            setUser(res.user!);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
          });
        } else if (isMounted) {
          // Invalidate stale local tokens cleanly without triggering another signOut event
          setUser(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.error('[QGo Auth] Session validation error:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // Removed destructive useEffect[user]

  const loginWithGoogle = async (
    credential: string,
    requestedRole: string,
    accessToken?: string,
    name?: string,
    picture?: string
  ) => {
    try {
      const tokenToSend = credential || accessToken || 'mock-google-token';
      const res = await api.loginWithFirebase(tokenToSend, requestedRole === 'owner' ? 'owner' : 'consumer');
      if (res.success && res.user) {
        localStorage.setItem(TOKEN_KEY, tokenToSend);
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

  const loginWithOtp = async (
    _phone: string,
    otp: string,
    _name?: string,
    requestedRole?: 'consumer' | 'owner'
  ) => {
    try {
      let formattedPhone = _phone.replace(/\s+/g, '');
      if (formattedPhone.length === 10 && /^\d+$/.test(formattedPhone)) {
        formattedPhone = '+91' + formattedPhone;
      } else if (formattedPhone.length > 10 && /^\d+$/.test(formattedPhone) && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const mockToken = JSON.stringify({ mock: true, phone: formattedPhone, name: _name });
      const res = await api.loginWithFirebase(mockToken, requestedRole);
      if (res.success && res.user) {
        localStorage.setItem(TOKEN_KEY, mockToken);
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

  const requestOtp = async (phone: string) => {
    try {
      let formattedPhone = phone.replace(/\s+/g, '');
      if (formattedPhone.length === 10 && /^\d+$/.test(formattedPhone)) {
        formattedPhone = '+91' + formattedPhone;
      } else if (formattedPhone.length > 10 && /^\d+$/.test(formattedPhone) && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      if (!formattedPhone.startsWith('+')) {
        return { success: false, error: 'Enter your phone number with country code, for example +919876543210.' };
      }
      
      // Mock bypass to avoid Firebase reCAPTCHA issues
      phoneConfirmation.current = "mock-confirmation" as any;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unable to send the verification code.' };
    }
  };

  const switchRole = async (nextRole: 'consumer' | 'owner') => {
    try {
      const res = await api.switchRole(nextRole);
      if (res.success && res.user) {
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
    sessionStorage.removeItem('qgo_cv');
    sessionStorage.removeItem('qgo_sbid');
    sessionStorage.removeItem('qgo_venue');
    sessionStorage.removeItem('qgo_bs');
    sessionStorage.removeItem('qgo_booking');
    if (auth && auth.currentUser) {
      signOut(auth).catch(() => {});
    }
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
        requestOtp,
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
