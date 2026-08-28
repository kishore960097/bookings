import React, { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QueueProvider, useQueue } from './context/QueueContext';
import { Header } from './components/Header';
import { NotificationCenter } from './components/NotificationCenter';
import { AuthModal } from './components/auth/AuthModal';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/landing/LoginPage';
import { QGoLogo } from './components/landing/QGoLogo';

// Consumer components
import { SalonList } from './components/consumer/SalonList';
import { SalonDetail } from './components/consumer/SalonDetail';
import { BookAppointmentModal } from './components/consumer/BookAppointmentModal';
import { JoinQueueModal } from './components/consumer/JoinQueueModal';
import { TicketView } from './components/consumer/TicketView';
import { BookingHistory } from './components/consumer/BookingHistory';
import { ReviewModal } from './components/consumer/ReviewModal';

// Owner components
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { MobileFrameWrapper } from './components/common/MobileFrameWrapper';

import { Salon, Service, Booking } from './types';

type AppPage = 'landing' | 'login' | 'register' | 'app';

function AppContent() {
  const { user, currentRole, logout, isLoadingSession } = useAuth();
  const { activeBooking } = useQueue();

  // Page routing — landing for unauthenticated, app for authenticated
  const [page, setPage] = useState<AppPage>(user ? 'app' : 'landing');

  // Sync page state when user logs in/out
  React.useEffect(() => {
    if (user && page !== 'app') setPage('app');
    if (!user && page === 'app') setPage('landing');
  }, [user]);

  // Navigation states for consumer app
  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>('home');
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

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

  // ─── Main App (Authenticated) ───
  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: '#F1F5F9', color: '#1E293B' }}>
      {/* Universal Navigation Header */}
      <Header
        activeTab={currentView}
        onNavigate={(tab) => {
          if (tab === 'home' || tab === 'bookings') {
            setCurrentView(tab);
          }
        }}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onOpenActiveTicket={() => handleViewTicket()}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentRole === 'consumer' && (
          <>
            {currentView === 'home' && (
              <SalonList
                onSelectSalon={handleSelectSalon}
                onOpenActiveTicket={() => handleViewTicket()}
              />
            )}

            {currentView === 'salon_detail' && selectedSalon && (
              <SalonDetail
                salonId={selectedSalon.id}
                onBack={() => setCurrentView('home')}
                onBookAppointment={(salon, srv) => handleOpenBookAppointment(salon, srv)}
                onJoinQueue={(salon, srv) => handleOpenJoinQueue(salon, srv)}
                onWriteReview={(salon) => {
                  setSelectedSalon(salon);
                  setIsReviewModalOpen(true);
                }}
              />
            )}

            {currentView === 'ticket' && selectedBookingId && (
              <TicketView
                bookingId={selectedBookingId}
                onBack={() => setCurrentView('home')}
              />
            )}

            {currentView === 'bookings' && (
              <BookingHistory
                onSelectBooking={(id) => handleViewTicket(id)}
                onBookAgain={(_salonId) => {
                  setCurrentView('home');
                }}
                onRate={(booking) => handleRateBooking(booking)}
              />
            )}
          </>
        )}

        {currentRole === 'owner' && <OwnerDashboard />}
      </main>

      {/* Footer */}
      <footer className="h-10 bg-slate-900 text-slate-400 text-[10px] sm:text-[11px] px-4 sm:px-8 flex items-center justify-between border-t border-slate-800 uppercase tracking-wider font-bold shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>System Up: 99.98% • v2.0.0</span>
        </div>
        <div className="text-slate-500 font-medium normal-case tracking-normal">
          © {new Date().getFullYear()} QGo Technologies • All Rights Reserved
        </div>
      </footer>

      {/* Global Modals & Drawers */}
      <AuthModal />

      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onSelectBooking={(id) => handleViewTicket(id)}
      />

      {isBookModalOpen && selectedSalon && (
        <BookAppointmentModal
          salon={selectedSalon}
          preselectedService={preselectedService}
          onClose={() => setIsBookModalOpen(false)}
          onBookingSuccess={handleBookingCreated}
        />
      )}

      {isQueueModalOpen && selectedSalon && (
        <JoinQueueModal
          salon={selectedSalon}
          preselectedService={preselectedService}
          onClose={() => setIsQueueModalOpen(false)}
          onQueueSuccess={handleBookingCreated}
        />
      )}

      {isReviewModalOpen && (
        <ReviewModal
          salon={selectedSalon || undefined}
          booking={reviewBooking}
          onClose={() => {
            setIsReviewModalOpen(false);
            setReviewBooking(undefined);
          }}
          onSuccess={() => {
            // refresh
          }}
        />
      )}
    </div>
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
