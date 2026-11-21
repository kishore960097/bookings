import React, { createContext, useContext, useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react';
import { User, UserRole, Language } from '../types';
import { translations } from '../i18n';
import { api, AUTH_TOKEN_KEY } from '../services/api';
import { auth, firebaseAuthReady, isFirebaseConfigured } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import {
  ConfirmationResult,
  onIdTokenChanged,
  RecaptchaVerifier,
  signInWithCustomToken,
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
    requestedRole?: 'consumer' | 'owner' | 'admin'
  ) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string; devOtp?: string }>;
  switchRole: (role: 'consumer' | 'owner' | 'admin') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isLoadingSession: boolean;
  sessionError: string | null;
  retrySession: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'qgo_user';
const TOKEN_KEY = AUTH_TOKEN_KEY;
const LANG_KEY = 'qgo_lang';

function getStoredPreferredRole(): 'consumer' | 'owner' | 'admin' | undefined {
  try {
    const preferred = localStorage.getItem('qgo_preferred_role') as 'consumer' | 'owner' | 'admin' | null;
    if (preferred === 'owner' || preferred === 'consumer' || preferred === 'admin') {
      return preferred;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return undefined;
    const user = JSON.parse(stored) as Pick<User, 'role' | 'activeRole'>;
    if (user.activeRole === 'admin' || user.role === 'admin') {
      return 'admin';
    }
    return user.activeRole === 'owner' || user.role === 'owner' ? 'owner' : 'consumer';
  } catch {
    return undefined;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cached profile data is not authorization. A user is exposed to the app only
  // after the backend has verified a Firebase token for this launch.
  const [user, setUser] = useState<User | null>(null);

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRetryNonce, setSessionRetryNonce] = useState(0);

  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem(LANG_KEY) as Language) || (localStorage.getItem('qgo_language') as Language) || 'en';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [, startTransition] = useTransition();
  const phoneConfirmation = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const nativeVerificationIdRef = useRef<string | null>(null);
  const nativeAutoVerifiedRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const inFlightSessionRef = useRef<Promise<{ success: boolean; user?: User; error?: string; code?: string }> | null>(null);
  const isServerOtpRef = useRef<boolean>(false);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
      localStorage.setItem('qgo_language', lang);
    } catch {}
  };

  // Autonomous Qbe Voice & App Language Controller Event Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLangEvent = (e: any) => {
      const lang = e?.detail;
      if (lang === 'en' || lang === 'ta') {
        setLanguage(lang);
      }
    };
    window.addEventListener('qgo-set-language', handleLangEvent);
    return () => window.removeEventListener('qgo-set-language', handleLangEvent);
  }, []);

  useEffect(() => {
    const isNativeAuth = Capacitor.isNativePlatform();
    if (!isFirebaseConfigured && !isNativeAuth) {
      setIsLoadingSession(false);
      return;
    }

    // Native Firebase Authentication maintains its own session; it is not
    // mirrored into the Firebase Web SDK used by the Capacitor WebView. Restore
    // that native session explicitly so an app restart cannot strand a signed-in
    // user on the login screen just because localStorage was cleared.
    if (isNativeAuth) {
      let isMounted = true;
      const restoreNativeSession = async () => {
        try {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const { user: nativeUser } = await FirebaseAuthentication.getCurrentUser().catch(() => ({ user: null }));
          if (!nativeUser) {
            // Check if there is an existing session stored locally (e.g. OTP, phone, or local token)
            const existingToken = localStorage.getItem(TOKEN_KEY);
            const existingUserStr = localStorage.getItem(STORAGE_KEY);
            if (existingToken && existingUserStr) {
              try {
                const meRes = await api.loginWithFirebase(existingToken, getStoredPreferredRole());
                if (meRes.success && meRes.user && isMounted) {
                  setSessionError(null);
                  setUser(meRes.user);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(meRes.user));
                  return;
                }
              } catch (err) {
                console.warn('[QGo Auth] Reconnection notice for native session:', err);
              }
              try {
                const cachedUser = JSON.parse(existingUserStr);
                if (cachedUser && cachedUser.id && isMounted) {
                  setUser(cachedUser);
                  return;
                }
              } catch {}
            }
            if (isMounted) {
              setUser(null);
            }
            return;
          }

          const { token } = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
          const res = await api.loginWithFirebase(token, getStoredPreferredRole());
          if (res.success && res.user && isMounted) {
            setSessionError(null);
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
            setUser(res.user);
          } else if (isMounted) {
            console.warn('[QGo Auth] Native session was rejected by the backend:', res.code, res.error);
            const isAuthRejected =
              res.status === 401 ||
              res.status === 403 ||
              res.code === 'HTTP_401' ||
              res.code === 'HTTP_403' ||
              res.code === 'OWNER_ACCESS_DENIED';

            if (isAuthRejected) {
              setUser(null);
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(STORAGE_KEY);
              await FirebaseAuthentication.signOut().catch(() => undefined);
            } else {
              const cached = localStorage.getItem(STORAGE_KEY);
              if (cached) {
                try {
                  setUser(JSON.parse(cached));
                } catch {}
              }
              setSessionError(res.error || 'Reconnecting to QGo server...');
            }
          }
        } catch (error) {
          console.warn('[QGo Auth] Native session restore notice:', error);
          if (isMounted) {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
              try {
                setUser(JSON.parse(cached));
                return;
              } catch {}
            }
            setUser(null);
          }
        } finally {
          if (isMounted) setIsLoadingSession(false);
        }
      };
      void restoreNativeSession();
      return () => {
        isMounted = false;
      };
    }

    // Safety: fallback timeout (7000ms) to ensure slow mobile connections don't hang indefinitely
    const safetyTimer = window.setTimeout(() => {
      console.log('[QGo Auth] Safety timer expired - resolving loading state');
      setIsLoadingSession(false);
    }, 7000);

    let isMounted = true;

    // Handle mobile browser redirect flow if returning from Google OAuth
    if (!isNativeAuth && isFirebaseConfigured) {
      void import('firebase/auth')
        .then(({ getRedirectResult }) => {
          getRedirectResult(auth)
            .then(async (redirectResult) => {
              if (redirectResult && redirectResult.user && isMounted) {
                const idToken = await redirectResult.user.getIdToken();
                const pendingRole = (localStorage.getItem('qgo_pending_role') as any) || getStoredPreferredRole();
                localStorage.removeItem('qgo_pending_role');
                const res = await api.loginWithFirebase(idToken, pendingRole);
                if (res.success && res.user && isMounted) {
                  setSessionError(null);
                  localStorage.setItem(TOKEN_KEY, idToken);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
                  startTransition(() => {
                    setUser(res.user!);
                  });
                  setIsLoadingSession(false);
                }
              }
            })
            .catch((err) => {
              console.warn('[QGo Auth] getRedirectResult notice:', err);
            });
        })
        .catch(() => {});
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (!isMounted) return;

        // Wait for persistence to be configured, but don't let it block forever.
        await Promise.race([
          firebaseAuthReady,
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);

        if (!firebaseUser) {
          if (isMounted) {
            const existingToken = localStorage.getItem(TOKEN_KEY);
            const existingUserStr = localStorage.getItem(STORAGE_KEY);

            // If we have an existing local session (e.g. OTP login, Google OAuth session, or cached user),
            // validate it against the backend instead of wiping it out on page reload.
            if (existingToken && existingUserStr) {
              try {
                // Keep the role selected at sign-in when a development server restart
                // recreates the in-memory auth record. A plain /auth/me call would
                // otherwise recreate that account as a consumer.
                const meRes = await api.loginWithFirebase(existingToken, getStoredPreferredRole());
                if (meRes.success && meRes.user && isMounted) {
                  setSessionError(null);
                  setUser(meRes.user);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(meRes.user));
                  setIsLoadingSession(false);
                  return;
                }
                if (meRes.retriable && isMounted) {
                  setSessionError(meRes.error || 'Unable to verify your session with the QGo server.');
                  setIsLoadingSession(false);
                  return;
                }
              } catch (meErr) {
                console.warn('[QGo Auth] Existing session check notice:', meErr);
                // On temporary network errors or offline, preserve the user from storage
                try {
                  const parsed = JSON.parse(existingUserStr);
                  if (parsed && parsed.id && isMounted) {
                    setUser(parsed);
                    setIsLoadingSession(false);
                    return;
                  }
                } catch {}
              }
            }

            // Only clear state if there is no existing valid local token
            setUser(null);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(STORAGE_KEY);
            setIsLoadingSession(false);
          }
          return;
        }

        let tokenToVerify: string | null = null;
        try {
          tokenToVerify = await firebaseUser.getIdToken();
          if (tokenToVerify) {
            localStorage.setItem(TOKEN_KEY, tokenToVerify);
          }
        } catch (tokErr) {
          console.warn('[QGo Auth] Error retrieving id token:', tokErr);
          if (isMounted) setUser(null);
          return;
        }

        if (!tokenToVerify) {
          if (isMounted) setUser(null);
          return;
        }

        // Single-flight deduplication: reuse in-flight session promise to avoid concurrent 401s
        if (!inFlightSessionRef.current) {
          inFlightSessionRef.current = api.loginWithFirebase(tokenToVerify, getStoredPreferredRole());
        }
        const res = await inFlightSessionRef.current;
        inFlightSessionRef.current = null;

        if (res.success && res.user && isMounted) {
          setSessionError(null);
          startTransition(() => {
            setUser(res.user!);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
          });
        } else if (isMounted) {
          console.warn('[QGo Auth] Session verification failed on server:', res.error, res.code, res.status);
          const isAuthRejected =
            res.status === 401 ||
            res.status === 403 ||
            res.code === 'HTTP_401' ||
            res.code === 'HTTP_403' ||
            res.code === 'auth/missing-token' ||
            res.code === 'auth/invalid-token' ||
            res.code === 'auth/id-token-expired' ||
            res.code === 'auth/id-token-revoked' ||
            res.code === 'OWNER_ACCESS_DENIED';

          if (isAuthRejected) {
            setUser(null);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(STORAGE_KEY);
            setSessionError(null);
            try {
              await signOut(auth);
            } catch {}
          } else {
            // On 429, 5xx, or network failure:
            // KEEP the Firebase session and cached profile, show non-destructive message, retry with backoff
            const cachedUserStr = localStorage.getItem(STORAGE_KEY);
            if (cachedUserStr) {
              try {
                setUser(JSON.parse(cachedUserStr));
              } catch {}
            }
            const isRateLimited = res.status === 429 || res.code === 'HTTP_429';
            const msg = isRateLimited
              ? 'High traffic detected. Retrying connection...'
              : (res.error || 'Unable to connect to QGo server. Retrying in background...');
            setSessionError(msg);

            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current || 0), 10000);
            retryCountRef.current = (retryCountRef.current || 0) + 1;
            setTimeout(() => {
              if (isMounted) setSessionRetryNonce((n) => n + 1);
            }, delay);
          }
        }
      } catch (err) {
        inFlightSessionRef.current = null;
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
  }, [sessionRetryNonce]);

  // Removed destructive useEffect[user]

  const loginWithGoogle = async (
    credential: string,
    requestedRole: string,
    accessToken?: string,
    _name?: string,
    _picture?: string
  ) => {
    try {
      // Clear any prior stale tokens before starting fresh session exchange
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setSessionError(null);

      const tokenToSend = credential || accessToken;
      if (!tokenToSend) {
        return { success: false, error: 'Google did not return a verifiable Firebase session.' };
      }
      const roleToUse = requestedRole === 'owner' ? 'owner' : 'consumer';
      localStorage.setItem('qgo_preferred_role', roleToUse);
      // Execute role-aware session exchange
      const sessionPromise = api.loginWithFirebase(tokenToSend, roleToUse);
      inFlightSessionRef.current = sessionPromise;
      const res = await sessionPromise;
      inFlightSessionRef.current = null;

      if (res.success && res.user) {
        setSessionError(null);
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
      inFlightSessionRef.current = null;
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
      // Clear any prior stale tokens before starting fresh
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(STORAGE_KEY);
      setSessionError(null);

      if (requestedRole) {
        localStorage.setItem('qgo_preferred_role', requestedRole);
      }
      const code = otp.trim();
      if (!code) {
        return { success: false, error: 'Verification code is required.' };
      }

      let formattedPhone = _phone.replace(/[\s\-()]/g, '');
      if (formattedPhone.length === 10 && /^\d+$/.test(formattedPhone)) {
        formattedPhone = '+91' + formattedPhone;
      } else if (formattedPhone.length > 10 && /^\d+$/.test(formattedPhone) && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      let idToken: string | null = null;

      if (Capacitor.isNativePlatform() && !isServerOtpRef.current) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        if (nativeAutoVerifiedRef.current) {
          const tokenRes = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
          idToken = tokenRes.token;
        } else if (nativeVerificationIdRef.current) {
          const confirmRes = await FirebaseAuthentication.confirmVerificationCode({
            verificationId: nativeVerificationIdRef.current,
            verificationCode: code,
          });
          idToken = confirmRes.credential?.idToken || null;
          if (!idToken) {
            const tokenRes = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
            idToken = tokenRes.token;
          }
        }
      } else if (!isServerOtpRef.current && phoneConfirmation.current) {
        try {
          const userCred = await phoneConfirmation.current.confirm(code);
          idToken = await userCred.user.getIdToken();
        } catch (credErr) {
          console.warn('[QGo Auth] Firebase confirmation failed, attempting backend verify:', credErr);
        }
      }

      // If we don't have a Firebase ID token yet (or server-side OTP was used), verify with the backend
      if (!idToken) {
        const verifyRes = await api.verifyOtp(formattedPhone, code, _name, requestedRole);
        if (!verifyRes.success || !verifyRes.token) {
          return { success: false, error: verifyRes.error || 'Invalid or expired verification code.' };
        }

        // If the backend generated a custom token, exchange it via Firebase SDK for an ID token
        const customToken = verifyRes.token;
        if (auth && !Capacitor.isNativePlatform() && isFirebaseConfigured) {
          try {
            const userCred = await signInWithCustomToken(auth, customToken);
            idToken = await userCred.user.getIdToken();
          } catch (exchangeErr) {
            console.warn('[QGo Auth] signInWithCustomToken exchange note:', exchangeErr);
            idToken = customToken;
          }
        } else {
          idToken = customToken;
        }

        // If backend already returned verified user and idToken, complete sign-in directly
        if (verifyRes.user) {
          if (!inFlightSessionRef.current) {
            inFlightSessionRef.current = api.loginWithFirebase(idToken, requestedRole);
          }
          const res = await inFlightSessionRef.current;
          inFlightSessionRef.current = null;
          const finalUser = (res.success && res.user) ? res.user : verifyRes.user;
          setSessionError(null);
          localStorage.setItem(TOKEN_KEY, idToken);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalUser));
          startTransition(() => {
            setUser(finalUser);
          });
          setIsAuthModalOpen(false);
          return { success: true };
        }
      }

      if (!idToken) {
        return { success: false, error: 'Could not obtain verification credentials.' };
      }

      if (!inFlightSessionRef.current) {
        inFlightSessionRef.current = api.loginWithFirebase(idToken, requestedRole);
      }
      const res = await inFlightSessionRef.current;
      inFlightSessionRef.current = null;
      if (res.success && res.user) {
        setSessionError(null);
        localStorage.setItem(TOKEN_KEY, idToken);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        startTransition(() => {
          setUser(res.user!);
        });
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: res.error || 'OTP verification failed on server' };
    } catch (e: any) {
      inFlightSessionRef.current = null;
      console.error('OTP login error:', e);
      const code = e?.code || '';
      let msg = e?.message || 'Verification error. Please try again.';
      if (code === 'auth/invalid-verification-code') {
        msg = 'Invalid verification code. Please check and try again.';
      } else if (code === 'auth/code-expired') {
        msg = 'Verification code has expired. Please request a new code.';
      } else if (code === 'auth/session-expired') {
        msg = 'Verification session has expired. Please request a new code.';
      }
      return { success: false, error: msg };
    }
  };

  const requestOtp = async (phone: string) => {
    try {
      let formattedPhone = phone.replace(/[\s\-()]/g, '');
      if (formattedPhone.length === 10 && /^\d+$/.test(formattedPhone)) {
        formattedPhone = '+91' + formattedPhone;
      } else if (formattedPhone.length > 10 && /^\d+$/.test(formattedPhone) && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      if (!/^\+[1-9]\d{7,14}$/.test(formattedPhone)) {
        return { success: false, error: 'Enter your phone number with country code, for example +919876543210.' };
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          nativeVerificationIdRef.current = null;
          nativeAutoVerifiedRef.current = false;
          isServerOtpRef.current = false;

          const codeSentPromise = new Promise<{ verificationId: string }>(async (resolve, reject) => {
            let timeoutTimer: number;
            let codeSentSub: any = null;
            let completedSub: any = null;
            let failSub: any = null;

            const cleanup = () => {
              clearTimeout(timeoutTimer);
              try {
                if (codeSentSub?.remove) void codeSentSub.remove();
                if (completedSub?.remove) void completedSub.remove();
                if (failSub?.remove) void failSub.remove();
              } catch {}
            };

            timeoutTimer = window.setTimeout(() => {
              cleanup();
              reject(new Error('SMS verification request timed out. Please check signal and try again.'));
            }, 60000);

            try {
              codeSentSub = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
                cleanup();
                resolve({ verificationId: event.verificationId });
              });

              completedSub = await FirebaseAuthentication.addListener('phoneVerificationCompleted', () => {
                cleanup();
                nativeAutoVerifiedRef.current = true;
                resolve({ verificationId: 'auto-verified' });
              });

              failSub = await FirebaseAuthentication.addListener('phoneVerificationFailed', (event: any) => {
                cleanup();
                const msg = event?.message || event?.error || 'Firebase phone verification failed on device.';
                reject(new Error(msg));
              });

              await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: formattedPhone });
            } catch (initErr: any) {
              cleanup();
              reject(initErr);
            }
          });
          const res = await codeSentPromise;
          nativeVerificationIdRef.current = res.verificationId;
          return { success: true };
        } catch (nativeErr: any) {
          console.warn('[QGo Auth] Native phone auth failed, falling back to server OTP:', nativeErr?.message || nativeErr);
          nativeVerificationIdRef.current = null;
          // Fall through to server OTP
        }
      }

      // Web flow: check if recaptcha container is in DOM and try Firebase client SDK
      const recaptchaEl = typeof document !== 'undefined' ? document.getElementById('qgo-phone-recaptcha') : null;
      if (isFirebaseConfigured && recaptchaEl) {
        try {
          if (!recaptchaVerifier.current) {
            recaptchaVerifier.current = new RecaptchaVerifier(auth, 'qgo-phone-recaptcha', {
              size: 'invisible',
            });
          }
          const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier.current);
          phoneConfirmation.current = confirmation;
          isServerOtpRef.current = false;
          return { success: true };
        } catch (firebaseErr: any) {
          console.warn('[QGo Auth] Firebase Web Phone Auth attempt notice, falling back to server OTP:', firebaseErr?.message);
          try {
            if (recaptchaVerifier.current?.clear) {
              recaptchaVerifier.current.clear();
            }
          } catch {}
          recaptchaVerifier.current = null;
        }
      }

      // Backend OTP service (reliable on web, dev environments, and when Firebase phone SMS quota is reached)
      const res = await api.requestOtp(formattedPhone);
      if (res.success) {
        isServerOtpRef.current = true;
        phoneConfirmation.current = null;
        return { success: true, devOtp: res.devOtp };
      }

      return { success: false, error: res.error || 'Unable to send verification code. Please try again.' };
    } catch (error: any) {
      console.warn('[QGo Auth] requestOtp error:', error);
      let msg = error?.message || 'Unable to send the verification code.';
      const code = error?.code || '';
      if (code === 'auth/invalid-phone-number') {
        msg = 'Invalid phone number format. Please check and try again.';
      } else if (code === 'auth/quota-exceeded') {
        msg = 'SMS quota for this project has been exceeded. Please use Google Sign-In or contact support.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (code === 'auth/captcha-check-failed') {
        msg = 'reCAPTCHA verification failed. Please try again.';
      }
      return { success: false, error: msg };
    }
  };

  const switchRole = async (nextRole: 'consumer' | 'owner' | 'admin') => {
    try {
      const res = await api.switchRole(nextRole);
      if (res.success && res.user) {
        localStorage.setItem('qgo_preferred_role', nextRole);
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

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('qgo_preferred_role');
    sessionStorage.removeItem('qgo_app_page');
    sessionStorage.removeItem('qgo_cv');
    sessionStorage.removeItem('qgo_sbid');
    sessionStorage.removeItem('qgo_venue');
    sessionStorage.removeItem('qgo_bs');
    sessionStorage.removeItem('qgo_booking');
    sessionStorage.removeItem('qgo_customer_tab');
    sessionStorage.removeItem('qgo_owner_tab');
    sessionStorage.removeItem('qgo_owner_wizard');
    sessionStorage.removeItem('qgo_owner_salon');
    sessionStorage.removeItem('qgo_wizard_step');
    sessionStorage.removeItem('qgo_admin_tab');
    if (auth && auth.currentUser) {
      signOut(auth).catch(() => {});
    }
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor-firebase/authentication')
        .then(({ FirebaseAuthentication }) => FirebaseAuthentication.signOut())
        .catch((error) => console.warn('[QGo Auth] Native sign-out failed:', error));
    }
    void api.logout();
  }, []);

  const retrySession = useCallback(() => {
    setSessionError(null);
    setIsLoadingSession(true);
    setSessionRetryNonce((nonce) => nonce + 1);
  }, []);

  const currentT = translations[language] || translations['en'];
  const isOwnerUrl = typeof window !== 'undefined' && (/^\/(owner|dashboard)/i.test(window.location.pathname));
  const isAdminUrl = typeof window !== 'undefined' && (/^\/admin/i.test(window.location.pathname));
  const storedRole = getStoredPreferredRole();
  const isSuperAdminUser = user?.role === 'admin' || user?.activeRole === 'admin' || storedRole === 'admin';
  const fallbackRole: UserRole = isSuperAdminUser ? 'admin' : (isOwnerUrl ? 'owner' : isAdminUrl ? 'admin' : (storedRole || 'consumer'));

  const contextValue = useMemo(
    () => ({
      user,
      role: user?.role || fallbackRole,
      currentRole: user?.activeRole || user?.role || fallbackRole,
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
      sessionError,
      retrySession,
    }),
    [
      user,
      fallbackRole,
      language,
      currentT,
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
      sessionError,
      retrySession,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
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
