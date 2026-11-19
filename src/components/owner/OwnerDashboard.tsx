import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Salon, DashboardOverviewData, GeneratedTurfSlot, isTurfBusiness } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmt12 } from '../../utils/timeFormat';
import { useQueue } from '../../context/QueueContext';
import { OwnerDashboardOverview } from './OwnerDashboardOverview';
import { OwnerSlotCalendar } from './OwnerSlotCalendar';
import { OwnerBookingsView } from './OwnerBookingsView';
import { OwnerCustomersView } from './OwnerCustomersView';
import { OwnerEarningsView } from './OwnerEarningsView';
import { OwnerNotificationsView } from './OwnerNotificationsView';
import { SalonSettings } from './SalonSettings';
import { ScheduleManagerView } from './ScheduleManagerView';
import { QrScannerModal } from './QrScannerModal';
import { BusinessSetupWizard } from './BusinessSetupWizard';
import { BusinessStatusBanner, StatusBadge } from './BusinessStatusBanner';
import { OwnerProfileView } from './OwnerProfileView';
import { OwnerReviewsView } from './OwnerReviewsView';
import { LiquidTabBar, LiquidTab } from '../common/LiquidTabBar';
import { LiquidFlowBackground } from '../common/LiquidFlowBackground';
import { QGoLoader } from '../common/QGoLoader';
import {
  Home,
  Calendar,
  CalendarDays,
  Layers,
  Users,
  TrendingUp,
  Settings,
  Bell,
  QrCode,
  Building2,
  ChevronDown,
  Check,
  X,
  Share2,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Lock,
  Unlock,
  User,
  Star,
} from 'lucide-react';

interface OwnerDashboardProps {
  initialSalon?: Salon;
  onBackToLanding?: () => void;
}

export type OwnerNavTab =
  | 'dashboard'
  | 'bookings'
  | 'slots'
  | 'schedules'
  | 'customers'
  | 'earnings'
  | 'reviews'
  | 'settings'
  | 'notifications'
  | 'profile';

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ initialSalon, onBackToLanding }) => {
  const { user, setUser, t } = useAuth();
  const { notifications, refreshNotifications, markAllNotificationsRead } = useQueue();

  const [ownerSalons, setOwnerSalons] = useState<Salon[]>([]);
  const [salon, setSalonState] = useState<Salon | null>(() => {
    if (initialSalon) return initialSalon;
    try {
      const saved = sessionStorage.getItem('qgo_owner_salon');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const setSalon = (s: Salon | null | ((prev: Salon | null) => Salon | null)) => {
    setSalonState((prev) => {
      const next = typeof s === 'function' ? s(prev) : s;
      if (next) sessionStorage.setItem('qgo_owner_salon', JSON.stringify(next));
      else sessionStorage.removeItem('qgo_owner_salon');
      return next;
    });
  };
  const [loading, setLoading] = useState(!initialSalon);

  const [isShopSwitcherOpen, setIsShopSwitcherOpen] = useState(false);
  const [showWizard, setShowWizardState] = useState<boolean>(() => {
    return sessionStorage.getItem('qgo_owner_wizard') === 'true';
  });
  const setShowWizard = (show: boolean) => {
    setShowWizardState(show);
    sessionStorage.setItem('qgo_owner_wizard', String(show));
  };

  const [activeTab, setActiveTabState] = useState<OwnerNavTab>(() => {
    const saved = sessionStorage.getItem('qgo_owner_tab') as OwnerNavTab;
    const validTabs: OwnerNavTab[] = ['dashboard', 'bookings', 'slots', 'schedules', 'customers', 'earnings', 'reviews', 'settings', 'notifications', 'profile'];
    if (saved && validTabs.includes(saved)) {
      return saved;
    }
    return 'dashboard';
  });
  const setActiveTab = (tab: OwnerNavTab) => {
    setActiveTabState(tab);
    sessionStorage.setItem('qgo_owner_tab', tab);
  };

  useEffect(() => {
    const handleOwnerNav = (e: any) => {
      if (e?.detail) {
        setActiveTab(e.detail as any);
      }
    };
    window.addEventListener('qgo-owner-navigate', handleOwnerNav);
    return () => window.removeEventListener('qgo-owner-navigate', handleOwnerNav);
  }, []);

  // A tab bar can be horizontally scrolled on narrow phones. Never allow that
  // scroll position to carry the whole page off-screen when the active view changes.
  useEffect(() => {
    window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, [activeTab]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Dashboard Overview state
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Slot modal opened from Overview table
  const [selectedSlotForDetail, setSelectedSlotForDetail] = useState<GeneratedTurfSlot | null>(null);
  const [slotActionLoading, setSlotActionLoading] = useState(false);

  // Simulated approval loading state
  const [approving, setApproving] = useState(false);

  // Load all salons for this owner
  const loadOwnerSalons = async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('qgo_token') : null;
    if (!user && !token) {
      setLoading(false);
      setOwnerSalons([]);
      setSalon(null);
      return;
    }
    try {
      setLoading(true);
      const res = await api.getOwnerSalons();
      if (res && res.salons) {
        const mySalons = res.salons;
        setOwnerSalons(mySalons);
        if (mySalons.length > 0) {
          setSalon((prev) => (prev && mySalons.some((s) => s.id === prev.id) ? prev : mySalons[0]));
        } else {
          setSalon(null);
          setShowWizard(true);
        }
      } else {
        setOwnerSalons([]);
        setSalon(null);
        setShowWizard(true);
      }
    } catch (e) {
      console.error('Error fetching salons for owner:', e);
      setOwnerSalons([]);
      setSalon(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadOwnerSalons();
    }
  }, [user?.id]);

  // Fetch live dashboard overview data
  const fetchOverviewData = useCallback(async () => {
    if (!salon || (salon.status !== 'live' && salon.status !== 'approved')) return;
    try {
      const res = await api.getDashboardOverview(salon.id);
      if (res && res.data) {
        setOverview(res.data);
      }
    } catch (e) {
      console.error('Error fetching dashboard overview:', e);
    }
  }, [salon?.id, salon?.status]);

  // Initial fetch and throttled background sync (paused when screen/tab is hidden)
  useEffect(() => {
    if (salon && (salon.status === 'live' || salon.status === 'approved')) {
      setOverviewLoading(true);
      fetchOverviewData().finally(() => setOverviewLoading(false));

      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fetchOverviewData();
      }, 12000);
      return () => clearInterval(interval);
    }
  }, [salon?.id, salon?.status, fetchOverviewData]);

  // Approve Business Handler (One-Click instant approval for testing / admin)
  const handleSimulateApproval = async () => {
    if (!salon) return;
    setApproving(true);
    try {
      const res = await api.approveSalon(salon.id);
      if (res && res.salon) {
        setSalon(res.salon);
        setOwnerSalons((prev) => prev.map((s) => (s.id === res.salon.id ? res.salon : s)));
        // Update auth user so salonId/role reflect the approved state immediately
        if (res.user) {
          setUser(res.user);
        }
        await refreshNotifications();
      }
    } catch (e) {
      console.error('Error approving salon:', e);
    } finally {
      setApproving(false);
    }
  };

  const handleWizardComplete = (updated: Salon) => {
    setShowWizard(false);
    setSalon(updated);
    setOwnerSalons((prev) => {
      const existing = prev.find((s) => s.id === updated.id);
      if (existing) {
        return prev.map((s) => (s.id === updated.id ? updated : s));
      }
      return [updated, ...prev];
    });
  };

  const handleCancelBookedSlotModal = async () => {
    if (!selectedSlotForDetail || !selectedSlotForDetail.bookingId) return;
    if (!window.confirm(`Are you sure you want to cancel the booking for ${selectedSlotForDetail.customerName || 'Customer'} and process refund?`)) {
      return;
    }
    setSlotActionLoading(true);
    try {
      await api.cancelBooking(selectedSlotForDetail.bookingId, 'Cancelled by owner from dashboard');
      setSelectedSlotForDetail(null);
      fetchOverviewData();
    } catch (e) {
      console.error('Error cancelling slot:', e);
    } finally {
      setSlotActionLoading(false);
    }
  };

  // ─── Loading Screen ───
  if (loading) {
    return (
      <QGoLoader variant="fullscreen" text="Loading your business…" />
    );
  }

  // ─── State 1: No Business Created Yet ───
  if (!salon && !showWizard) {
    return (
      <div className="min-h-screen ow-bg text-[var(--qp-text)] py-16 px-4">
        <div className="max-w-2xl mx-auto">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--qp-text-sec)] hover:text-[var(--qp-text)] transition-colors cursor-pointer"
              type="button"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <div className="ow-card p-10 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl ow-inner flex items-center justify-center mx-auto shadow-sm">
              <Building2 className="w-10 h-10 text-[var(--qp-text)]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--qp-text)]">
                Welcome to QGo, {user?.name?.split(' ')[0] || 'Partner'}!
              </h1>
              <p className="text-[var(--qp-text-sec)] text-sm max-w-sm mx-auto">
                Set up your business on QGo so customers can discover you and start booking slots.
              </p>
            </div>

            <button
              onClick={() => setShowWizard(true)}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-150 ease-out hover:scale-[1.02] hover:opacity-90 shadow-sm cursor-pointer"
              style={{
                background: 'var(--q-grad-cta)',
                color: '#FFFFFF',
              }}
            >
              <span className="text-white font-bold" style={{ color: '#FFFFFF' }}>
                Start Setting Up My Business
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 2: Onboarding Wizard ───
  if (showWizard) {
    return (
      <div className="min-h-screen ow-bg text-[var(--qp-text)]">
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <button
            onClick={() => setShowWizard(false)}
            className="text-sm font-semibold text-[var(--qp-text-sec)] hover:text-[var(--qp-text)] flex items-center gap-1.5 mb-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            Exit Setup
          </button>
        </div>
        <BusinessSetupWizard
          existingSalon={salon}
          onComplete={handleWizardComplete}
        />
      </div>
    );
  }

  const salonStatus = salon?.status || 'draft';
  const isApprovedOrLive = salonStatus === 'approved' || salonStatus === 'live';
  const isUnderReview = salonStatus === 'under_review';
  const isDraft = salonStatus === 'draft';

  // ─── State 3: Under Review Screen (with instant approval simulation button) ───
  if (salon && !isApprovedOrLive) {
    return (
      <div className="min-h-screen ow-bg text-[var(--qp-text)] px-4 py-8 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-6 transition-colors duration-150 duration-500 ease-out">
          {/* Business Header Card */}
          <div className="ow-card p-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[20px] ow-inner flex items-center justify-center text-[var(--qp-text)] text-2xl font-semibold shadow-sm shrink-0 overflow-hidden">
                {salon.logoUrl ? (
                  <img src={salon.logoUrl} alt={salon.name} className="w-full h-full object-cover" />
                ) : (
                  salon.name.charAt(0)
                )}
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-[var(--qp-text-sec)] uppercase">Your Business</p>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--qp-text)]">{salon.name}</h1>
                <p className="text-sm text-[var(--qp-text-sec)] mt-0.5">{salon.address || salon.city || 'Location set'}</p>
              </div>
            </div>
            <StatusBadge status={salon.status} />
          </div>

          {/* Under Review Card */}
          {isUnderReview && (
            <div className="ow-card p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-[20px] ow-inner text-[#0A0A0A] flex items-center justify-center mx-auto shadow-sm">
                <Clock className="w-8 h-8" />
              </div>

              <div className="space-y-3">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-[#0A0A0A] text-[#FFFFFF]">
                  Under Review
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--qp-text)]">
                  Your business is being reviewed
                </h2>
                <p className="text-sm text-[var(--qp-text-sec)] max-w-md mx-auto leading-relaxed">
                  Our team is verifying your business details, pitch dimensions, and working hours. We'll notify you as soon as your business is approved and live.
                </p>
              </div>

              {/* Quick Simulation Button */}
              <div className="pt-6 border-t border-[var(--qp-border)] flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSimulateApproval}
                  disabled={approving}
                  style={{ background: 'linear-gradient(180deg,#F0554A 0%,#E73229 50%,#D42B22 100%)' }}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-[#FFFFFF] font-bold text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 transition-opacity"
                >
                  <span>{approving ? 'Approving...' : 'Simulate Approval'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWizard(true)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl ow-inner font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ color: '#000000' }}
                >
                  Review Details
                </button>
              </div>
            </div>
          )}

          {isDraft && (
            <BusinessStatusBanner
              salon={salon}
              onContinueSetup={() => setShowWizard(true)}
              onResubmit={() => setShowWizard(true)}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── State 4: COMPLETE APPROVED OWNER DASHBOARD ───
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const navItem = (id: OwnerNavTab, label: string, Icon: any, badge?: number) => (
    <button
      id={`owner-nav-${id}`}
      onClick={() => {
        setActiveTab(id);
        if (id === 'notifications') markAllNotificationsRead();
      }}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-150 ease-out whitespace-nowrap cursor-pointer ${
        activeTab === id
          ? 'bg-[var(--q-grad-cta)] text-white shadow-[0_2px_8px_rgba(231,50,41,0.35)]'
          : 'text-[#5C5C5C] hover:text-[#0A0A0A] hover:bg-black/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`w-4 h-4 rounded-full text-[11px] font-bold flex items-center justify-center ${
            activeTab === id ? 'bg-white text-[#E73229]' : 'bg-[#E73229] text-white'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="relative min-h-screen w-[100dvw] max-w-full overflow-x-clip ow-bg text-[var(--qp-text)] font-sans pb-24 md:pb-12">
      {/* ── LIQUID FLOW BACKGROUND ── */}
      <LiquidFlowBackground />

      {/* ── TOP OWNER APP BAR ── */}
      <div
        className="sticky top-0 z-50 ow-glass w-full border-b border-black/5 dark:border-white/10"
        style={{
          paddingTop: Capacitor.isNativePlatform()
            ? 'max(36px, calc(env(safe-area-inset-top, 0px) + 8px))'
            : 'max(10px, env(safe-area-inset-top, 10px))',
        }}
      >
        <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Business Selector & Name */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl ow-inner flex items-center justify-center font-semibold text-[#0A0A0A] text-base shadow-sm shrink-0 overflow-hidden">
              {salon!.logoUrl ? (
                <img src={salon!.logoUrl} alt={salon!.name} className="w-full h-full object-cover" />
              ) : (
                salon!.name.charAt(0)
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsShopSwitcherOpen(!isShopSwitcherOpen)}
                className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-[#0A0A0A] dark:text-[#FFFFFF] hover:opacity-80 transition-opacity group cursor-pointer"
              >
                <span className="truncate max-w-[200px] sm:max-w-none text-[#0A0A0A] dark:text-[#FFFFFF] font-bold">{salon!.name}</span>
                {ownerSalons.length > 1 && (
                  <ChevronDown className="w-4 h-4 text-[#5C5C5C] dark:text-[#A1A1AA] group-hover:text-[#0A0A0A] dark:group-hover:text-[#FFFFFF] shrink-0" />
                )}
              </button>
              <p className="text-xs text-[#5C5C5C] dark:text-[#A1A1AA] truncate">{salon!.address || salon!.city}</p>

              {/* Switcher dropdown */}
              {isShopSwitcherOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsShopSwitcherOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl ow-card text-[#0A0A0A] dark:text-[#FFFFFF] z-40 overflow-hidden py-2 animate-in zoom-in-95">
                    <div className="px-4 py-2 border-b border-[var(--qp-border)] text-xs font-semibold text-[#5C5C5C] dark:text-[#A1A1AA]">
                      My Businesses
                    </div>
                    {ownerSalons.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSalon(s);
                          setIsShopSwitcherOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                          s.id === salon!.id ? 'bg-black/5 dark:bg-white/10 font-semibold' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate text-[#0A0A0A] dark:text-[#FFFFFF]">{s.name}</p>
                          <StatusBadge status={s.status} />
                        </div>
                        {s.id === salon!.id && <Check className="w-4 h-4 text-[#E73229] shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Scan ticket header icon (active next to profile) */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="p-2.5 rounded-full glass hover:bg-black/5 dark:hover:bg-white/10 text-[#000000] dark:text-[#FFFFFF] transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
              title="Scan QR Ticket"
              aria-label="Scan QR Ticket"
            >
              <QrCode className="w-5 h-5 text-[#000000] dark:text-[#FFFFFF]" />
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#0A0A0A] dark:text-[#FFFFFF] transition-colors relative flex items-center justify-center cursor-pointer ${activeTab === 'notifications' ? 'bg-black/5 dark:bg-white/10 text-[#E73229]' : ''}`}
              title="Alerts"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-[#0A0A0A] dark:text-[#FFFFFF]" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#E73229] rounded-full border-2 border-white"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#0A0A0A] dark:text-[#FFFFFF] transition-colors flex items-center justify-center cursor-pointer ${activeTab === 'profile' ? 'bg-black/5 dark:bg-white/10 text-[#E73229]' : ''}`}
              title="Profile"
              aria-label="Profile"
            >
              <User className="w-5 h-5 text-[#0A0A0A] dark:text-[#FFFFFF]" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ── RESPONSIVE OWNER NAVIGATION BAR ── */}
        <div className="flex justify-center w-full max-w-3xl mx-auto px-1">
          <LiquidTabBar
            tabs={[
              { id: 'dashboard', label: t.dashboardTab || 'Dashboard', icon: Home },
              { id: 'bookings', label: t.bookingsTab || 'Bookings', icon: Calendar },
              { id: 'slots', label: t.slotsTab || 'Slots', icon: Layers },
              { id: 'customers', label: t.customersTab || 'Customers', icon: Users },
              { id: 'earnings', label: t.earningsTab || 'Earnings', icon: TrendingUp },
              { id: 'reviews', label: 'Reviews', icon: Star },
              { id: 'schedules', label: t.schedulesTab || 'Schedules', icon: CalendarDays },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId as OwnerNavTab);
              if (tabId === 'notifications') markAllNotificationsRead();
            }}
            className="glass w-auto max-w-full p-1.5 shadow-sm"
          />
        </div>

      {/* ── ACTIVE TAB VIEW CONTENT ── */}
      <div key={activeTab} className="animate-tab-content">
        {activeTab === 'dashboard' && (
          <OwnerDashboardOverview
            salon={salon!}
            overview={overview}
            loading={overviewLoading}
            onNavigateTab={(tab) => setActiveTab(tab as OwnerNavTab)}
            onSelectSlot={(slot) => setSelectedSlotForDetail(slot)}
            onRefresh={fetchOverviewData}
          />
        )}

        {activeTab === 'bookings' && (
          <OwnerBookingsView
            salon={salon!}
            onRefreshOverview={fetchOverviewData}
          />
        )}

        {activeTab === 'slots' && (
          <OwnerSlotCalendar
            salon={salon!}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenSchedules={() => setActiveTab('schedules')}
          />
        )}

        {activeTab === 'customers' && <OwnerCustomersView salon={salon!} />}

        {activeTab === 'earnings' && <OwnerEarningsView salon={salon!} />}

        {activeTab === 'reviews' && <OwnerReviewsView salon={salon!} />}

        {activeTab === 'schedules' && (
          <ScheduleManagerView salon={salon!} onUpdateSalon={(updated) => setSalon(updated)} />
        )}

        {activeTab === 'settings' && (
          <SalonSettings salon={salon!} onUpdateSalon={(updated) => setSalon(updated)} />
        )}

        {activeTab === 'notifications' && (
          <OwnerNotificationsView
            notifications={notifications}
            onMarkAllRead={markAllNotificationsRead}
          />
        )}

        {activeTab === 'profile' && (
          <OwnerProfileView onOpenSettings={() => setActiveTab('settings')} />
        )}
      </div>

      {/* ── QR Scanner Modal ── */}
      {isScannerOpen && (
        <QrScannerModal
          salon={salon!}
          onClose={() => setIsScannerOpen(false)}
          onCheckInSuccess={() => {
            fetchOverviewData();
          }}
        />
      )}

      {/* ── Slot Detail Modal from Today's Slots ── */}
      {selectedSlotForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,10,10,0.50)]">
          <div className="ow-card p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(10,10,10,0.08)]">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">Slot Details</h3>
                <p className="text-sm text-[#5C5C5C]">Today · {fmt12(selectedSlotForDetail.startTime)} – {fmt12(selectedSlotForDetail.endTime)}</p>
              </div>
              <button
                onClick={() => setSelectedSlotForDetail(null)}
                className="p-2 rounded-full hover:bg-black/5 text-[#5C5C5C] hover:text-[#0A0A0A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 rounded-2xl ow-inner space-y-4 text-sm text-[#0A0A0A]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--qp-text-sec)]">Slot Time:</span>
                <span className="font-semibold">{fmt12(selectedSlotForDetail.startTime)} – {fmt12(selectedSlotForDetail.endTime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--qp-text-sec)]">Duration &amp; Price:</span>
                <span className="font-semibold">{selectedSlotForDetail.durationMinutes}m · ₹{selectedSlotForDetail.price}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--qp-text-sec)]">Status:</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    selectedSlotForDetail.isBooked
                      ? 'bg-[#E7F5EE] text-[#16845B]'
                      : selectedSlotForDetail.isBlocked
                      ? 'bg-[#EFEFEF] text-[#5C5C5C]'
                      : 'bg-[#FDECEA] text-[#B3231B]'
                  }`}
                >
                  {selectedSlotForDetail.isBooked ? 'Booked' : selectedSlotForDetail.isBlocked ? 'Blocked' : 'Available'}
                </span>
              </div>

              {selectedSlotForDetail.isBooked && (
                <>
                  <div className="pt-4 border-t border-[var(--qp-border)] flex justify-between items-center">
                    <span className="text-[var(--qp-text-sec)]">Customer:</span>
                    <span className="font-semibold">{selectedSlotForDetail.customerName || 'Customer'}</span>
                  </div>
                  {selectedSlotForDetail.customerPhone && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--qp-text-sec)]">Phone:</span>
                      <span className="font-semibold">{selectedSlotForDetail.customerPhone}</span>
                    </div>
                  )}
                  {selectedSlotForDetail.bookingId && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--qp-text-sec)]">Booking ID:</span>
                      <span className="font-semibold text-[var(--qp-primary)]">
                        QGO-{selectedSlotForDetail.bookingId.split('_').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-4">
              {selectedSlotForDetail.isBooked ? (
                <button
                  type="button"
                  onClick={handleCancelBookedSlotModal}
                  disabled={slotActionLoading}
                  className="w-full py-3.5 rounded-2xl bg-[#FBEAE8] text-[#B3261E] font-semibold text-sm hover:bg-[#FBEAE8]/80 transition-colors"
                >
                  {slotActionLoading ? 'Processing...' : 'Cancel Booking & Process Refund'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlotForDetail(null);
                    setActiveTab('slots');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-semibold text-sm transition-opacity duration-150 ease-out hover:opacity-90 shadow-sm"
                >
                  Manage in Slots Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
