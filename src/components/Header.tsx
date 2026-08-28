import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { QGoLogo } from './landing/QGoLogo';
import { RoleSwitcher } from './RoleSwitcher';
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
      <header className="sticky top-0 z-40 h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-8 flex items-center justify-between shadow-xs">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            id="brand-logo-btn"
            onClick={() => handleNav('home')}
            className="flex items-center gap-1.5 group text-left cursor-pointer"
          >
            <QGoLogo size="sm" />
            <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded uppercase tracking-wider border border-blue-100">
              Live
            </span>
          </button>

          {/* Live System Indicator (Desktop) */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-semibold text-slate-500 border-l border-slate-200 pl-4">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200/80">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-700 text-[11px] font-bold tracking-tight">Live Queue Engine</span>
            </div>
          </div>
        </div>

        {/* Consumer Active Token Pill (Desktop) */}
        {role === 'consumer' && activeBooking && (
          <button
            id="active-token-header-pill"
            onClick={onOpenActiveTicket || (() => handleNav('ticket'))}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100 transition-all shadow-xs cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <Ticket className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-black font-mono">#{activeBooking.tokenNumber?.split('-').pop()}</span>
            <span className="text-xs text-slate-600">
              • {activeBooking.queuePosition === 1 ? "Next in line!" : `${activeBooking.peopleAhead || 0} ahead (~${activeBooking.estimatedWaitMinutes || 10}m)`}
            </span>
          </button>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100/80 hover:bg-slate-200 border border-slate-200 text-[11px] sm:text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* Consumer Nav Links (Desktop) */}
          {role === 'consumer' && (
            <div className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-2">
              <button
                id="nav-home-btn"
                onClick={() => handleNav('home')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  active === 'home' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t.explore}
              </button>
              <button
                id="nav-bookings-btn"
                onClick={() => handleNav('bookings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active === 'bookings' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t.myBookings}</span>
              </button>
            </div>
          )}

          {/* Notifications */}
          <RoleSwitcher />

          {/* Notifications */}
          <button
            id="notifications-toggle-btn"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute 0 top-0.5 right-0.5 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile / Login */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-200">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-bold text-slate-800 hidden md:inline max-w-[100px] truncate">{user.name}</span>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
            >
              {t.login}
            </button>
          )}

          {/* Mobile Menu Toggle for Owner or Extra Controls */}
          {role === 'owner' && (
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer (When Open) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bg-white border-b border-slate-200 px-4 py-4 space-y-3 shadow-2xl z-40 animate-in slide-in-from-top-2">
          {user && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{user.name}</div>
                  <div className="text-[10px] text-slate-500 capitalize">{user.role} Account</div>
                </div>
              </div>
              <button
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="text-xs font-bold text-red-600 flex items-center gap-1 hover:underline"
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
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {/* Explore */}
          <button
            onClick={() => handleNav('home')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              active === 'home'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">{t.explore}</span>
          </button>

          {/* Active Live Token Quick Button (Center Floating Pill if active) */}
          {activeBooking ? (
            <button
              onClick={onOpenActiveTicket || (() => handleNav('ticket'))}
              className="flex flex-col items-center justify-center -mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-3.5 py-2 shadow-lg ring-4 ring-white transition-all transform active:scale-95 cursor-pointer"
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black font-mono">#{activeBooking.tokenNumber?.split('-').pop()}</span>
              </div>
              <span className="text-[9px] font-bold text-blue-100">Live Turn</span>
            </button>
          ) : (
            <button
              onClick={() => handleNav('home')}
              className="flex flex-col items-center justify-center -mt-3 bg-blue-600 text-white rounded-2xl p-2.5 shadow-md ring-4 ring-white transition-all transform active:scale-95 cursor-pointer"
            >
              <Ticket className="w-4 h-4" />
            </button>
          )}

          {/* My Bookings */}
          <button
            onClick={() => handleNav('bookings')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              active === 'bookings'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">{t.myBookings}</span>
          </button>

          {/* Profile / Sign In */}
          {!user ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">{t.login}</span>
            </button>
          ) : (
            <button
              onClick={logout}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl text-slate-400 hover:text-red-600 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">Exit</span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
