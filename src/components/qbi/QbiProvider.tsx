import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { QbiLang, resolveLang, t, getTips } from './qbiCopy';

export type QbiFailure = 'offline' | 'slot_full' | 'failed';

export interface QbiBookedOpts {
  title?: string;
  sub?: string;
}

export interface QbiNotBookedOpts {
  onRetry?: () => void;
  title?: string;
  sub?: string;
}

export interface QbiApi {
  booked: (opts?: QbiBookedOpts) => void;
  notBooked: (kind: QbiFailure, opts?: QbiNotBookedOpts) => void;
  setScreen: (id: string | null) => void;
}

export type QbiPopup =
  | { type: 'welcome'; variant: 'full' | 'bubble' }
  | { type: 'booked'; title?: string; sub?: string }
  | { type: 'notBooked'; kind: QbiFailure; onRetry?: () => void; title?: string; sub?: string };

export type QbiBannerState = 'hidden' | 'offline' | 'back-online';

export interface QbiContextValue {
  api: QbiApi;
  popup: QbiPopup | null;
  dismissPopup: () => void;
  bannerState: QbiBannerState;
  currentScreenId: string | null;
  helperOpen: boolean;
  setHelperOpen: (open: boolean) => void;
  helperStep: number;
  setHelperStep: React.Dispatch<React.SetStateAction<number>>;
  hasSeenHelper: boolean;
  markHelperSeen: () => void;
  language: QbiLang;
}

const defaultApi: QbiApi = {
  booked: () => {},
  notBooked: () => {},
  setScreen: () => {},
};

export const QbiContext = createContext<QbiContextValue | null>(null);

export function classifyBookingFailure(input: unknown): QbiFailure {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'offline';
    }

    if (input instanceof TypeError) {
      return 'offline';
    }

    if (input instanceof Error) {
      const msg = input.message || '';
      if (/network|failed to fetch|load failed|offline/i.test(msg)) {
        return 'offline';
      }
    }

    if (typeof input === 'object' && input !== null) {
      const record = input as Record<string, unknown>;
      if (record.slotTaken === true) {
        return 'slot_full';
      }
      const errStr = typeof record.error === 'string' ? record.error : '';
      if (/no longer available|already booked|just booked|slot.*taken/i.test(errStr)) {
        return 'slot_full';
      }
      if (/network|failed to fetch|load failed|offline/i.test(errStr)) {
        return 'offline';
      }
    }

    if (typeof input === 'string') {
      if (/no longer available|already booked|just booked|slot.*taken/i.test(input)) {
        return 'slot_full';
      }
      if (/network|failed to fetch|load failed|offline/i.test(input)) {
        return 'offline';
      }
    }
  } catch {
    return 'failed';
  }

  return 'failed';
}

export function useQbi(): QbiApi {
  const ctx = useContext(QbiContext);
  return ctx ? ctx.api : defaultApi;
}

export function useQbiScreen(id: string | null): void {
  const { setScreen } = useQbi();
  useEffect(() => {
    if (id !== null) {
      setScreen(id);
      return () => {
        setScreen(null);
      };
    }
  }, [id, setScreen]);
}

export const QbiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Safe Auth consumption with fallback
  let authContextUser: any = null;
  let authContextRole: string = 'consumer';
  let authContextLang: string = 'en';
  let authIsLoading = false;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    if (auth) {
      authContextUser = auth.user;
      authContextRole = auth.currentRole || auth.role || 'consumer';
      authContextLang = auth.language || 'en';
      authIsLoading = auth.isLoadingSession;
    }
  } catch {
    // Outside AuthProvider fallback
  }

  // Language resolution: Qbi defaults to English
  const [lang, setLang] = useState<QbiLang>(() => {
    try {
      const explicit = localStorage.getItem('qgo_qbi_lang');
      return explicit === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      const explicit = localStorage.getItem('qgo_qbi_lang');
      setLang(explicit === 'ta' ? 'ta' : 'en');
    } catch {
      setLang('en');
    }
  }, []);

  // Current screen tracking
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);

  // Popup state & queue
  const [popup, setPopup] = useState<QbiPopup | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFailureRef = useRef<{ kind: QbiFailure; time: number } | null>(null);

  const clearPopupTimer = useCallback(() => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, []);

  const dismissPopup = useCallback(() => {
    clearPopupTimer();
    setPopup(null);
  }, [clearPopupTimer]);

  // Priority ranking: notBooked (3) > booked (2) > welcome (1)
  const getPriority = (p: QbiPopup | null): number => {
    if (!p) return 0;
    if (p.type === 'notBooked') return 3;
    if (p.type === 'booked') return 2;
    if (p.type === 'welcome') return 1;
    return 0;
  };

  const booked = useCallback(
    (opts?: QbiBookedOpts) => {
      setPopup((current) => {
        const currentPrio = getPriority(current);
        if (currentPrio > 2) {
          // notBooked is higher priority; do not replace
          return current;
        }
        clearPopupTimer();
        popupTimerRef.current = setTimeout(() => {
          dismissPopup();
        }, 2200);
        return { type: 'booked', title: opts?.title, sub: opts?.sub };
      });
    },
    [clearPopupTimer, dismissPopup]
  );

  const notBooked = useCallback(
    (kind: QbiFailure, opts?: QbiNotBookedOpts) => {
      const now = Date.now();
      if (
        lastFailureRef.current &&
        lastFailureRef.current.kind === kind &&
        now - lastFailureRef.current.time < 3000
      ) {
        // Dedupe identical failure within 3s
        return;
      }
      lastFailureRef.current = { kind, time: now };

      clearPopupTimer();
      setPopup({
        type: 'notBooked',
        kind,
        onRetry: opts?.onRetry,
        title: opts?.title,
        sub: opts?.sub,
      });
    },
    [clearPopupTimer]
  );

  const setScreen = useCallback((id: string | null) => {
    setCurrentScreenId(id);
  }, []);

  const api = useMemo<QbiApi>(
    () => ({
      booked,
      notBooked,
      setScreen,
    }),
    [booked, notBooked, setScreen]
  );

  // Offline banner state & flapping debounce
  const [bannerState, setBannerState] = useState<QbiBannerState>('hidden');
  const initialOnlineChecked = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      setBannerState('offline');
    }
    initialOnlineChecked.current = true;

    const handleOffline = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setBannerState('offline');
      }, 800);
    };

    const handleOnline = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setBannerState('back-online');
        setTimeout(() => {
          setBannerState('hidden');
        }, 2000);
      }, 800);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Welcome card / bubble logic (idempotent, StrictMode-safe)
  const welcomeTriggeredRef = useRef(false);

  useEffect(() => {
    if (authIsLoading) return;
    if (welcomeTriggeredRef.current) return;

    // Never show for owner
    if (authContextRole === 'owner') return;

    // Only for logged-out landing or consumer
    const isConsumerOrLanding = !authContextUser || authContextRole === 'consumer';
    if (!isConsumerOrLanding) return;

    // Check session storage guard
    try {
      if (sessionStorage.getItem('qgo_qbi_session')) {
        return;
      }
    } catch {
      // ignore
    }

    welcomeTriggeredRef.current = true;

    try {
      sessionStorage.setItem('qgo_qbi_session', '1');
    } catch {
      // ignore
    }

    let isFirstEver = false;
    try {
      isFirstEver = !localStorage.getItem('qgo_qbi_welcomed');
      if (isFirstEver) {
        localStorage.setItem('qgo_qbi_welcomed', '1');
      }
    } catch {
      isFirstEver = true;
    }

    setPopup((current) => {
      if (current !== null) return current; // Do not replace active popup
      clearPopupTimer();
      popupTimerRef.current = setTimeout(() => {
        dismissPopup();
      }, 2600);
      return { type: 'welcome', variant: isFirstEver ? 'full' : 'bubble' };
    });
  }, [authIsLoading, authContextUser, authContextRole, clearPopupTimer, dismissPopup]);

  // Helper Bot state
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperStep, setHelperStep] = useState(0);
  const [hasSeenHelper, setHasSeenHelper] = useState(() => {
    try {
      return !!localStorage.getItem('qgo_qbi_helper_seen');
    } catch {
      return false;
    }
  });

  const markHelperSeen = useCallback(() => {
    try {
      localStorage.setItem('qgo_qbi_helper_seen', '1');
    } catch {}
    setHasSeenHelper(true);
  }, []);

  // Reset helper step when screen changes
  useEffect(() => {
    setHelperStep(0);
  }, [currentScreenId]);

  // Dismiss notBooked on browser Back
  useEffect(() => {
    const handlePopState = () => {
      if (popup && popup.type === 'notBooked') {
        dismissPopup();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [popup, dismissPopup]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearPopupTimer();
    };
  }, [clearPopupTimer]);

  const value: QbiContextValue = {
    api,
    popup,
    dismissPopup,
    bannerState,
    currentScreenId,
    helperOpen,
    setHelperOpen,
    helperStep,
    setHelperStep,
    hasSeenHelper,
    markHelperSeen,
    language: lang,
  };

  return <QbiContext.Provider value={value}>{children}</QbiContext.Provider>;
};
