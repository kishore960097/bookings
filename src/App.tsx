import React, { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QueueProvider, useQueue } from './context/QueueContext';
import { NotificationCenter } from './components/NotificationCenter';
import { AuthModal } from './components/auth/AuthModal';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/landing/LoginPage';
import { QGoLogo } from './components/landing/QGoLogo';

// Consumer — redesigned green/white theme
import { CustomerPage } from './features/customer/CustomerPage';

// Owner components
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MobileFrameWrapper } from './components/common/MobileFrameWrapper';

import { Salon, Service, Booking } from './types';

type AppPage = 'landing' | 'login' | 'register' | 'app';

function AppContent() {
  const { user, currentRole, logout, isLoadingSession } = useAuth();
  const { activeBooking } = useQueue();
  const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/admin';

  // Page routing — landing for unauthenticated, app for authenticated
  const [page, setPage] = useState<AppPage>(user ? 'app' : isAdminPath ? 'login' : 'landing');

  // Sync page state when user logs in/out
  React.useEffect(() => {
    if (user && page !== 'app') setPage('app');
    if (!user && page === 'app') setPage('landing');
  }, [user]);

  // Navigation states for consumer app
  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>(() => (sessionStorage.getItem('qgo_cv') as any) || 'home');
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
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

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white animate-in fade-in duration-500">
        <QGoLogo size="xl" className="animate-pulse mb-6" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading QGo...</p>
      </div>
    );
  }

  // ─── Landing Page ───
  if (page === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setPage('register')}
        onSignIn={() => setPage('login')}
      />
    );
  }

  // ─── Login / Register Page ───
  if (page === 'login' || page === 'register') {
    return (
      <LoginPage
        defaultView={page === 'register' ? 'register' : 'login'}
        onClose={() => setPage('landing')}
        onSuccess={() => setPage('app')}
      />
    );
  }

  if (isAdminPath && currentRole !== 'admin') {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FFF8F3] px-5 text-center text-[#0F172A]">
        <div className="ap-glass-panel max-w-md p-8">
          <QGoLogo size="lg" className="mx-auto mb-5" />
          <h1 className="text-2xl font-bold">Admin access restricted</h1>
          <p className="mt-3 text-sm text-slate-600">Admin access is restricted to the authorized QGo administrator.</p>
          <button className="btn-primary mt-6" onClick={() => { logout(); setPage('login'); }}>Sign in with another account</button>
        </div>
      </div>
    );
  }

  // ─── Main App (Authenticated) ───
  return (
    <>
      {currentRole === 'consumer' && (
        <CustomerPage
          onOpenNotifications={() => setIsNotificationOpen(true)}
          onLogout={logout}
        />
      )}

      {currentRole === 'owner' && (
        <div className="min-h-screen flex flex-col font-sans" style={{ background: '#F1F5F9', color: '#1E293B' }}>
          <main className="flex-1">
            <OwnerDashboard
              onBackToLanding={() => {
                logout();
                setPage('landing');
              }}
            />
          </main>
        </div>
      )}

      {currentRole === 'admin' && (
        <AdminDashboard />
      )}

      {/* Global Modals & Drawers */}
      <AuthModal />

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
    <AuthProvider>
      <QueueProvider>
        <MobileFrameWrapper>
          <AppContent />
        </MobileFrameWrapper>
      </QueueProvider>
    </AuthProvider>
  );

  if (hasValidClientId) {
    return <GoogleOAuthProvider clientId={clientId}>{content}</GoogleOAuthProvider>;
  }

  return content;
}

export default App;
