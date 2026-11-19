import React, { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QueueProvider, useQueue } from './context/QueueContext';
import { NotificationCenter } from './components/NotificationCenter';
import { AuthModal } from './components/auth/AuthModal';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/landing/LoginPage';
import { QGoLogo } from './components/landing/QGoLogo';
import { QGoIntro } from './components/intro/QGoIntro';
import { QGoLoader } from './components/common/QGoLoader';
import { AppUpdateModal } from './components/common/AppUpdateModal';

// Consumer — redesigned green/white theme
import { CustomerPage } from './features/customer/CustomerPage';

// Owner components
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { MobileFrameWrapper } from './components/common/MobileFrameWrapper';
import { QbiProvider, QbiLayer } from './components/qbi';
import { ShieldCheck } from 'lucide-react';

import { Salon, Service, Booking } from './types';
import { ThemeProvider } from './context/ThemeContext';

type AppPage = 'landing' | 'login' | 'register' | 'app';

// In-memory session flag: resets on browser reload / cold open so intro plays on every refresh,
// but prevents replaying during internal client-side SPA route navigation.
let hasIntroPlayedInSession = false;

function AppContent() {
  const { user, currentRole, logout, isLoadingSession } = useAuth();
  const { activeBooking } = useQueue();
  const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/admin';
  const isOwnerPath = /^\/(owner|dashboard)/i.test(window.location.pathname);
  const [isIntroComplete, setIsIntroComplete] = useState<boolean>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (new URLSearchParams(search).get('intro') === 'off') return true;
    return hasIntroPlayedInSession;
  });
  const handleIntroDone = React.useCallback(() => {
    hasIntroPlayedInSession = true;
    setIsIntroComplete(true);
  }, []);

  const isSuperAdmin = user?.role === 'admin' || user?.activeRole === 'admin' || currentRole === 'admin';

  // Page routing — preserve current page across reload
  const [page, setPageState] = useState<AppPage>(() => {
    const hasUser = Boolean(localStorage.getItem('qgo_user'));
    if (isOwnerPath) return hasUser ? 'app' : 'login';
    if (hasUser) return 'app';
    const savedPage = (localStorage.getItem('qgo_app_page') || sessionStorage.getItem('qgo_app_page')) as AppPage;
    if (savedPage && ['landing', 'login', 'register', 'app'].includes(savedPage)) {
      return savedPage;
    }
    return isAdminPath ? 'login' : 'landing';
  });

  const setPage = (newPage: AppPage) => {
    setPageState(newPage);
    try {
      localStorage.setItem('qgo_app_page', newPage);
      sessionStorage.setItem('qgo_app_page', newPage);
    } catch {}
  };

  // Sync page state when user logs in/out (only redirect to landing when session finished loading and no user in localStorage)
  React.useEffect(() => {
    if (user && page !== 'app') {
      setPage('app');
    } else if (!user && !isLoadingSession && page === 'app') {
      const storedUser = localStorage.getItem('qgo_user');
      if (!storedUser) {
        if (isOwnerPath) {
          setPage('login');
        } else {
          setPage('landing');
        }
      }
    }
  }, [user, isLoadingSession, isOwnerPath, page]);

  const withIntro = (content: React.ReactNode) => (
    <>
      <div aria-hidden={!isIntroComplete} inert={!isIntroComplete ? true : undefined}>
        {content}
      </div>
      {!isIntroComplete && <QGoIntro ready={!isLoadingSession} onDone={handleIntroDone} />}
    </>
  );

  // Navigation states for consumer app
  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>(() => (sessionStorage.getItem('qgo_cv') as any) || 'home');
  const [selectedSalon, setSelectedSalonState] = useState<Salon | null>(() => {
    try {
      const saved = sessionStorage.getItem('qgo_selected_salon');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const setSelectedSalon = (s: Salon | null) => {
    setSelectedSalonState(s);
    if (s) sessionStorage.setItem('qgo_selected_salon', JSON.stringify(s));
    else sessionStorage.removeItem('qgo_selected_salon');
  };
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(() => sessionStorage.getItem('qgo_sbid') || null);

  React.useEffect(() => { sessionStorage.setItem('qgo_cv', currentView); }, [currentView]);
  React.useEffect(() => { if (selectedBookingId) sessionStorage.setItem('qgo_sbid', selectedBookingId); else sessionStorage.removeItem('qgo_sbid'); }, [selectedBookingId]);

  // Modals state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [preselectedService, setPreselectedService] = useState<Service | undefined>(undefined);
  const [reviewBooking, setReviewBooking] = useState<Booking | undefined>(undefined);

  const handleSelectSalon = (salon: Salon) => {
    setSelectedSalon(salon);
    setCurrentView('salon_detail');
  };

  const handleOpenBookAppointment = (salon: Salon, srv?: Service) => {
    setSelectedSalon(salon);
    setPreselectedService(srv);
    setIsBookModalOpen(true);
  };

  const handleOpenJoinQueue = (salon: Salon, srv?: Service) => {
    setSelectedSalon(salon);
    setPreselectedService(srv);
    setIsQueueModalOpen(true);
  };

  const handleBookingCreated = (booking: Booking) => {
    setIsBookModalOpen(false);
    setIsQueueModalOpen(false);
    setSelectedBookingId(booking.id);
    setCurrentView('ticket');
  };

  const handleViewTicket = (bookingId?: string) => {
    if (bookingId) {
      setSelectedBookingId(bookingId);
      setCurrentView('ticket');
    } else if (activeBooking) {
      setSelectedBookingId(activeBooking.id);
      setCurrentView('ticket');
    }
  };

  const handleRateBooking = (booking: Booking) => {
    setReviewBooking(booking);
    setIsReviewModalOpen(true);
  };

  // ─── Landing Page ───
  if (page === 'landing') {
    return withIntro(
      <LandingPage
        onGetStarted={() => setPage('register')}
        onSignIn={() => setPage('login')}
      />
    );
  }

  // ─── Login / Register Page ───
  if (page === 'login' || page === 'register') {
    return withIntro(
      <LoginPage
        defaultView={page === 'register' ? 'register' : 'login'}
        onClose={() => setPage('landing')}
        onSuccess={() => setPage('app')}
      />
    );
  }

  if (isAdminPath && currentRole !== 'admin') {
    return withIntro(
      <div className="min-h-screen grid place-items-center bg-[var(--q-canvas-soft)] px-5 text-center text-[var(--q-ink)]">
        <div className="q-card max-w-md p-8 border border-[var(--q-hairline)]">
          <QGoLogo size="lg" className="mx-auto mb-5" />
          <h1 className="text-2xl font-bold">Admin access restricted</h1>
          <p className="mt-3 text-sm text-[var(--q-muted)]">Admin access is restricted to the authorized QGo administrator.</p>
          <button className="q-btn-primary mt-6" onClick={() => { logout(); setPage('login'); }}>Sign in with another account</button>
        </div>
      </div>
    );
  }

  // ─── Main App (Authenticated / Hydrating) ───
  // Do not mount or render CustomerPage while auth/profile hydration is still in progress
  if (page === 'app' && isLoadingSession) {
    return withIntro(
      isIntroComplete ? (
        <QGoLoader variant="fullscreen" text="Opening QGo…" />
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] dark:bg-[#0A0A0A] text-[#111111] dark:text-[#FFFFFF]" />
      )
    );
  }

  return withIntro(
    <>
      {currentRole !== 'owner' && <div className="q-ambient" aria-hidden="true" />}
      {isSuperAdmin ? (
        <SuperAdminDashboard />
      ) : currentRole === 'owner' ? (
        <div className="min-h-screen flex flex-col font-sans bg-[var(--q-canvas-soft)] text-[var(--q-ink)]">
          <main className="flex-1">
            <OwnerDashboard
              onBackToLanding={() => {
                logout();
                setPage('landing');
              }}
            />
          </main>
        </div>
      ) : (
        <CustomerPage
          onOpenNotifications={() => setIsNotificationOpen(true)}
          onLogout={() => {
            logout();
            setPage('landing');
          }}
        />
      )}

      {/* Qbe Smart Assistant — strictly rendered inside authenticated app session */}
      {user && isIntroComplete && !isLoadingSession && <QbiLayer />}

      {/* Global Modals & Drawers */}
      <AuthModal />
      <AppUpdateModal />

      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onSelectBooking={(id) => {
          setSelectedBookingId(id);
          setCurrentView('ticket');
        }}
      />
    </>
  );
}

export function App() {
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const hasValidClientId = Boolean(clientId && clientId.includes('.apps.googleusercontent.com'));

  const content = (
    <ThemeProvider>
      <AuthProvider>
        <QueueProvider>
          <QbiProvider>
            <div className="q-ambient" aria-hidden="true" />
            <MobileFrameWrapper>
              <AppContent />
            </MobileFrameWrapper>
          </QbiProvider>
        </QueueProvider>
      </AuthProvider>
    </ThemeProvider>
  );

  if (hasValidClientId) {
    return <GoogleOAuthProvider clientId={clientId}>{content}</GoogleOAuthProvider>;
  }

  return content;
}

export default App;
