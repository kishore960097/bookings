import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { QGoLogo } from '../landing/QGoLogo';
import {
  Bell,
  Ticket,
  Calendar,
  LogOut,
  Menu,
  X,
  Globe,
  Compass,
  User as UserIcon,
} from 'lucide-react';

interface HeaderProps {
  currentTab?: string;
  activeTab?: string;
  setCurrentTab?: (tab: string) => void;
  onNavigate?: (tab: string) => void;
  onOpenNotifications: () => void;
  onOpenActiveTicket?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  activeTab,
  setCurrentTab,
  onNavigate,
  onOpenNotifications,
  onOpenActiveTicket,
}) => {
  const active = activeTab || currentTab || 'home';
  const handleNav = (tab: string) => {
    if (onNavigate) onNavigate(tab);
    if (setCurrentTab) setCurrentTab(tab);
  };

  const { user, role, t, language, setLanguage, logout, setIsAuthModalOpen } = useAuth();
  const { activeBooking, unreadCount } = useQueue();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 h-14 sm:h-16 q-glass-frosted border-b border-[var(--q-hairline)] px-3 sm:px-8 flex items-center justify-between shadow-xs">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            id="brand-logo-btn"
            onClick={() => handleNav('home')}
            className="flex items-center gap-1.5 group text-left cursor-pointer"
          >
            <QGoLogo size="sm" />
            <span className="hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 bg-[var(--q-red-wash)] text-[var(--q-red)] rounded uppercase tracking-wider border border-[rgba(232,52,42,0.15)]">
              Live
            </span>
          </button>

          {/* Live System Indicator (Desktop) */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-semibold text-[var(--q-muted)] border-l border-[var(--q-hairline)] pl-4">
            <div className="flex items-center gap-1.5 bg-[var(--q-canvas)] px-2 py-1 rounded border border-[var(--q-hairline)]">
              <div className="w-2 h-2 rounded-full bg-[var(--q-red)] animate-pulse" />
              <span className="text-[var(--q-muted)] text-[11px] font-bold tracking-tight">Live Queue Engine</span>
            </div>
          </div>
        </div>

        {/* Consumer Active Token Pill (Desktop) */}
        {role === 'consumer' && activeBooking && (
          <button
            id="active-token-header-pill"
            onClick={onOpenActiveTicket || (() => handleNav('ticket'))}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--q-red-wash)] border border-[rgba(232,52,42,0.20)] text-[var(--q-red-pressed)] hover:bg-[rgba(232,52,42,0.15)] transition-colors duration-150 shadow-xs cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--q-red)] animate-pulse" />
            <Ticket className="w-3.5 h-3.5 text-[var(--q-red)]" />
            <span className="text-xs font-black font-mono">#{activeBooking.tokenNumber?.split('-').pop()}</span>
            <span className="text-xs text-[var(--q-body)]">
              • {activeBooking.queuePosition === 1 ? "Next in line!" : `${activeBooking.peopleAhead || 0} ahead (~${activeBooking.estimatedWaitMinutes || 10}m)`}
            </span>
          </button>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[var(--q-canvas-soft)] hover:bg-[rgba(23,23,23,0.06)] border border-[var(--q-hairline)] text-[11px] sm:text-xs font-bold text-[var(--q-body)] transition-colors cursor-pointer"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-[var(--q-muted)]" />
            <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* Consumer Nav Links (Desktop) */}
          {role === 'consumer' && (
            <div className="hidden md:flex items-center gap-1 border-l border-[var(--q-hairline)] pl-2">
              <button
                id="nav-home-btn"
                onClick={() => handleNav('home')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  active === 'home' ? 'bg-[var(--q-ink)] text-white shadow-xs' : 'text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)]'
                }`}
              >
                {t.explore}
              </button>
              <button
                id="nav-bookings-btn"
                onClick={() => handleNav('bookings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active === 'bookings' ? 'bg-[var(--q-ink)] text-white shadow-xs' : 'text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t.myBookings}</span>
              </button>
            </div>
          )}

          {/* Notifications */}
          <button
            id="notifications-toggle-btn"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)] transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute 0 top-0.5 right-0.5 w-4 h-4 rounded-full bg-[var(--q-red)] text-white text-[11px] font-black flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile / Login */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-[var(--q-hairline)]">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--q-ink)] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-bold text-[var(--q-ink)] hidden md:inline max-w-[100px] truncate">{user.name}</span>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-[var(--q-muted)] hover:text-[var(--q-error)] hover:bg-[rgba(179,38,30,0.10)] transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--q-red-action)] text-white hover:bg-[var(--q-red-pressed)] transition-colors duration-150 shadow-xs cursor-pointer"
            >
              {t.login}
            </button>
          )}

          {/* Mobile Menu Toggle for Owner or Extra Controls */}
          {role === 'owner' && (
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)] md:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer (When Open) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 q-glass-frosted border-b border-[var(--q-hairline)] px-4 py-4 space-y-3 shadow-lg z-40 animate-in slide-in-from-top-2">
          {user && (
            <div className="flex items-center justify-between pb-3 border-b border-[var(--q-hairline)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--q-ink)] text-white flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--q-ink)]">{user.name}</div>
                  <div className="text-[11px] text-[var(--q-muted)] capitalize">{user.role} Account</div>
                </div>
              </div>
              <button
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="text-xs font-bold text-[var(--q-error)] flex items-center gap-1 hover:underline"
              >
                <LogOut size={13} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MOBILE STICKY BOTTOM NAVIGATION BAR (Consumer Only) ─── */}
      {role === 'consumer' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 q-glass-frosted border-t border-[var(--q-hairline)] px-2 py-1.5 flex items-center justify-around shadow-[0_1px_2px_rgba(23,23,23,0.06),0_8px_24px_rgba(23,23,23,0.06)] pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {/* Explore */}
          <button
            onClick={() => handleNav('home')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-colors duration-150 cursor-pointer ${
              active === 'home'
                ? 'text-[var(--q-red)] font-bold scale-105'
                : 'text-[var(--q-muted)] hover:text-[var(--q-ink)]'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[11px] tracking-tight">{t.explore}</span>
          </button>

          {/* Active Live Token Quick Button (Center Floating Pill if active) */}
          {activeBooking ? (
            <button
              onClick={onOpenActiveTicket || (() => handleNav('ticket'))}
              className="flex flex-col items-center justify-center -mt-4 bg-[var(--q-red-action)] text-white rounded-2xl px-3.5 py-2 shadow-lg ring-4 ring-white transition-colors duration-150 transform cursor-pointer"
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-black font-mono">#{activeBooking.tokenNumber?.split('-').pop()}</span>
              </div>
              <span className="text-[11px] font-bold text-white">Live Turn</span>
            </button>
          ) : (
            <button
              onClick={() => handleNav('home')}
              className="flex flex-col items-center justify-center -mt-3 bg-[var(--q-red-action)] text-white rounded-2xl p-2.5 shadow-md ring-4 ring-white transition-colors duration-150 transform cursor-pointer"
            >
              <Ticket className="w-4 h-4" />
            </button>
          )}

          {/* My Bookings */}
          <button
            onClick={() => handleNav('bookings')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-colors duration-150 cursor-pointer ${
              active === 'bookings'
                ? 'text-[var(--q-red)] font-bold scale-105'
                : 'text-[var(--q-muted)] hover:text-[var(--q-ink)]'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[11px] tracking-tight">{t.myBookings}</span>
          </button>

          {/* Profile / Sign In */}
          {!user ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl text-[var(--q-muted)] hover:text-[var(--q-ink)] transition-colors duration-150 cursor-pointer"
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[11px] tracking-tight">{t.login}</span>
            </button>
          ) : (
            <button
              onClick={logout}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl text-[var(--q-muted)] hover:text-[var(--q-error)] transition-colors duration-150 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[11px] tracking-tight">Exit</span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
