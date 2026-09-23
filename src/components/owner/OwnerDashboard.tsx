import React, { useState, useEffect, useCallback } from 'react';
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
import { QrScannerModal } from './QrScannerModal';
import { BusinessSetupWizard } from './BusinessSetupWizard';
import { BusinessStatusBanner, StatusBadge } from './BusinessStatusBanner';
import { OwnerProfileView } from './OwnerProfileView';
import {
  Home,
  Calendar,
  Layers,
  Users,
  TrendingUp,
  Settings,
  Bell,
  QrCode,
  Sparkles,
  Building2,
  ChevronDown,
  Check,
  X,
  Share2,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  User,
} from 'lucide-react';

interface OwnerDashboardProps {
  initialSalon?: Salon;
}

export type OwnerNavTab =
  | 'dashboard'
  | 'bookings'
  | 'slots'
  | 'customers'
  | 'earnings'
  | 'settings'
  | 'notifications'
  | 'profile';

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ initialSalon }) => {
  const { user } = useAuth();
  const { notifications, refreshNotifications, markAllNotificationsRead } = useQueue();

  const [ownerSalons, setOwnerSalons] = useState<Salon[]>([]);
  const [salon, setSalon] = useState<Salon | null>(initialSalon || null);
  const [loading, setLoading] = useState(!initialSalon);

  const [isShopSwitcherOpen, setIsShopSwitcherOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState<OwnerNavTab>('dashboard');
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
        }
      } else {
        setOwnerSalons([]);
        setSalon(null);
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
    loadOwnerSalons();
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

  // Initial fetch and 5-second polling for real-time dashboard sync
  useEffect(() => {
    if (salon && (salon.status === 'live' || salon.status === 'approved')) {
      setOverviewLoading(true);
      fetchOverviewData().finally(() => setOverviewLoading(false));

      const interval = setInterval(fetchOverviewData, 5000);
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
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <Sparkles className="w-10 h-10 mx-auto mb-3 text-emerald-600 animate-spin" />
        <p className="text-sm font-bold text-slate-700">Loading your business...</p>
      </div>
    );
  }

  // ─── State 1: No Business Created Yet ───
  if (!salon && !showWizard) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center mx-auto shadow-lg">
            <Building2 className="w-10 h-10 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900">
              Welcome to QGo, {user?.name?.split(' ')[0] || 'Partner'}! 👋
            </h1>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Set up your business on QGo so customers can discover you and start booking slots.
            </p>
          </div>

          <button
            onClick={() => setShowWizard(true)}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-amber-300" />
            Start Setting Up My Business
          </button>
        </div>
      </div>
    );
  }

  // ─── State 2: Onboarding Wizard ───
  if (showWizard) {
    return (
      <div>
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <button
            onClick={() => setShowWizard(false)}
            className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 mb-2 cursor-pointer"
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
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5 animate-in fade-in duration-150">
        {/* Business Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-sm shrink-0">
              {salon.logoUrl ? (
                <img src={salon.logoUrl} alt={salon.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                salon.name.charAt(0)
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Business</p>
              <h1 className="text-xl font-black text-slate-900">{salon.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{salon.address || salon.city || 'Location set'}</p>
            </div>
          </div>
          <StatusBadge status={salon.status} />
        </div>

        {/* Under Review Card */}
        {isUnderReview && (
          <div className="bg-white rounded-3xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/40 p-8 text-center space-y-5 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                Under Review
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                Your business is being reviewed by QGo
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Our verification team is verifying your business details, pitch dimensions, and working hours. We'll notify you as soon as your business is approved and live.
              </p>
            </div>

            {/* Quick Simulation Button */}
            <div className="pt-4 border-t border-blue-100 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSimulateApproval}
                disabled={approving}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{approving ? 'Approving Business...' : '⚡ Simulate QGo Admin Approval'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Review Submitted Info
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
      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
        activeTab === id
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 pb-24 md:pb-12">
      {/* ── TOP OWNER APP BAR ── */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Business Selector & Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-base shadow-sm shrink-0">
            {salon!.name.charAt(0)}
          </div>

          <div className="relative">
            <button
              onClick={() => setIsShopSwitcherOpen(!isShopSwitcherOpen)}
              className="flex items-center gap-1.5 text-base sm:text-lg font-black tracking-tight hover:text-emerald-400 transition-colors group cursor-pointer"
            >
              <span className="truncate max-w-[200px] sm:max-w-none">{salon!.name}</span>
              {ownerSalons.length > 1 && (
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              )}
            </button>
            <p className="text-[11px] text-slate-400 truncate">{salon!.address || salon!.city}</p>

            {/* Switcher dropdown */}
            {isShopSwitcherOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsShopSwitcherOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 z-40 overflow-hidden py-2 animate-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    My Businesses
                  </div>
                  {ownerSalons.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSalon(s);
                        setIsShopSwitcherOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        s.id === salon!.id ? 'bg-emerald-50 text-emerald-950 font-bold' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-slate-900">{s.name}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      {s.id === salon!.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* QR Scan Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Customer QR</span>
          </button>
        </div>
      </div>

      {/* ── RESPONSIVE OWNER NAVIGATION BAR ── */}
      <div className="flex bg-white p-1.5 rounded-3xl border border-slate-200 shadow-2xs gap-1 overflow-x-auto scrollbar-none">
        {navItem('dashboard', 'Dashboard', Home)}
        {navItem('bookings', 'Bookings', Calendar)}
        {navItem('slots', 'Slots & Calendar', Layers)}
        {navItem('customers', 'Customers', Users)}
        {navItem('earnings', 'Earnings', TrendingUp)}
        {navItem('settings', 'Business Settings', Settings)}
        {navItem('notifications', 'Notifications', Bell, unreadNotifsCount)}
        {navItem('profile', 'Profile', User)}
      </div>

      {/* ── ACTIVE TAB VIEW CONTENT ── */}
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

      {activeTab === 'bookings' && <OwnerBookingsView salon={salon!} />}

      {activeTab === 'slots' && (
        <OwnerSlotCalendar
          salon={salon!}
          onOpenSettings={() => setActiveTab('settings')}
        />
      )}

      {activeTab === 'customers' && <OwnerCustomersView salon={salon!} />}

      {activeTab === 'earnings' && <OwnerEarningsView salon={salon!} />}

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
        <OwnerProfileView />
      )}

      {/* ── QR Scanner Modal ── */}
      {isScannerOpen && (
        <QrScannerModal
          salonId={salon!.id}
          onClose={() => setIsScannerOpen(false)}
          onSuccess={() => {
            setIsScannerOpen(false);
            fetchOverviewData();
          }}
        />
      )}

      {/* ── Slot Detail Modal from Today's Slots ── */}
      {selectedSlotForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Slot Details</h3>
                <p className="text-xs text-slate-500 font-mono">Today · {fmt12(selectedSlotForDetail.startTime)} – {fmt12(selectedSlotForDetail.endTime)}</p>
              </div>
              <button
                onClick={() => setSelectedSlotForDetail(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Slot Time:</span>
                <span className="font-bold text-slate-900 font-mono">{fmt12(selectedSlotForDetail.startTime)} – {fmt12(selectedSlotForDetail.endTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration &amp; Price:</span>
                <span className="font-bold text-slate-900 font-mono">{selectedSlotForDetail.durationMinutes}m · ₹{selectedSlotForDetail.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                    selectedSlotForDetail.isBooked
                      ? 'bg-rose-100 text-rose-800'
                      : selectedSlotForDetail.isBlocked
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedSlotForDetail.isBooked ? 'BOOKED' : selectedSlotForDetail.isBlocked ? 'BLOCKED' : 'AVAILABLE'}
                </span>
              </div>

              {selectedSlotForDetail.isBooked && (
                <>
                  <div className="pt-2 border-t border-slate-200 flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-bold text-slate-900">{selectedSlotForDetail.customerName || 'Customer'}</span>
                  </div>
                  {selectedSlotForDetail.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-bold text-slate-900 font-mono">{selectedSlotForDetail.customerPhone}</span>
                    </div>
                  )}
                  {selectedSlotForDetail.bookingId && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Booking ID:</span>
                      <span className="font-bold text-indigo-700 font-mono">
                        QGO-{selectedSlotForDetail.bookingId.split('_').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-2">
              {selectedSlotForDetail.isBooked ? (
                <button
                  type="button"
                  onClick={handleCancelBookedSlotModal}
                  disabled={slotActionLoading}
                  className="w-full py-3 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-sm"
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
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 shadow-sm"
                >
                  Manage in Slots Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
