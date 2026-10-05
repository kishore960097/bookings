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
import { ScheduleManagerView } from './ScheduleManagerView';
import { QrScannerModal } from './QrScannerModal';
import { BusinessSetupWizard } from './BusinessSetupWizard';
import { BusinessStatusBanner, StatusBadge } from './BusinessStatusBanner';
import { OwnerProfileView } from './OwnerProfileView';
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
  User} from 'lucide-react';

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
  | 'settings'
  | 'notifications'
  | 'profile';

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ initialSalon, onBackToLanding }) => {
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
      <div className="min-h-screen bg-[var(--qp-bg)] text-[var(--qp-text)] flex flex-col items-center justify-center p-4">
        
        <p className="text-sm font-semibold text-[var(--qp-text-sec)] tracking-tight">Loading your business...</p>
      </div>
    );
  }

  // ─── State 1: No Business Created Yet ───
  if (!salon && !showWizard) {
    return (
      <div className="min-h-screen bg-[var(--qp-bg)] text-[var(--qp-text)] py-16 px-4">
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

          <div className="ap-glass-card p-10 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-[var(--qp-surface)] border border-[var(--qp-border)] flex items-center justify-center mx-auto shadow-sm">
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
              className="w-full py-4 rounded-2xl bg-[var(--qp-primary)] text-white font-semibold text-base flex items-center justify-center gap-2 transition-all duration-300 ease-out hover:scale-[1.02] hover:opacity-90 shadow-sm cursor-pointer"
            >
              
              Start Setting Up My Business
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 2: Onboarding Wizard ───
  if (showWizard) {
    return (
      <div className="min-h-screen bg-[var(--qp-bg)] text-[var(--qp-text)]">
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
      <div className="min-h-screen bg-[var(--qp-bg)] text-[var(--qp-text)] px-4 py-8 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-6 transition-all duration-500 ease-out">
          {/* Business Header Card */}
          <div className="ap-glass-card p-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[20px] bg-[var(--qp-surface)] border border-[var(--qp-border)] flex items-center justify-center text-[var(--qp-text)] text-2xl font-semibold shadow-sm shrink-0 overflow-hidden">
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
            <div className="ap-glass-card p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-[20px] bg-[var(--qp-surface)] border border-[var(--qp-border)] text-[var(--qp-text)] flex items-center justify-center mx-auto shadow-sm">
                <Clock className="w-8 h-8" />
              </div>

              <div className="space-y-3">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[var(--qp-surface)] border border-[var(--qp-border)] text-[var(--qp-text)]">
                  Under Review
                </span>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--qp-text)]">
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
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[var(--qp-primary)] text-white font-semibold text-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:opacity-90 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  
                  <span>{approving ? 'Approving...' : 'Simulate Approval'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWizard(true)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[var(--qp-surface)] border border-[var(--qp-border)] text-[var(--qp-text)] font-semibold text-sm hover:bg-white/40 transition-colors"
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
      className={`flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap cursor-pointer ${
        activeTab === id
          ? 'bg-[var(--qp-surface)] shadow-sm text-[var(--qp-text)]'
          : 'text-[var(--qp-text-sec)] hover:text-[var(--qp-text)] hover:bg-black/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="w-4 h-4 rounded-full bg-[var(--qp-primary)] text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--qp-bg)] text-[var(--qp-text)] font-sans pb-24 md:pb-12">
      {/* ── TOP OWNER APP BAR ── */}
      <div className="sticky top-0 z-50 ap-glass-nav w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Business Selector & Name */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--qp-surface)] border border-[var(--qp-border)] flex items-center justify-center font-semibold text-[var(--qp-text)] text-base shadow-sm shrink-0 overflow-hidden">
              {salon!.logoUrl ? (
                <img src={salon!.logoUrl} alt={salon!.name} className="w-full h-full object-cover" />
              ) : (
                salon!.name.charAt(0)
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsShopSwitcherOpen(!isShopSwitcherOpen)}
                className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-[var(--qp-text)] hover:opacity-80 transition-opacity group cursor-pointer"
              >
                <span className="truncate max-w-[200px] sm:max-w-none">{salon!.name}</span>
                {ownerSalons.length > 1 && (
                  <ChevronDown className="w-4 h-4 text-[var(--qp-text-sec)] group-hover:text-[var(--qp-text)] shrink-0" />
                )}
              </button>
              <p className="text-xs text-[var(--qp-text-sec)] truncate">{salon!.address || salon!.city}</p>

              {/* Switcher dropdown */}
              {isShopSwitcherOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsShopSwitcherOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl ap-glass-panel text-[var(--qp-text)] z-40 overflow-hidden py-2 animate-in zoom-in-95">
                    <div className="px-4 py-2 border-b border-[var(--qp-border)] text-xs font-semibold text-[var(--qp-text-sec)]">
                      My Businesses
                    </div>
                    {ownerSalons.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSalon(s);
                          setIsShopSwitcherOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-black/5 transition-colors ${
                          s.id === salon!.id ? 'bg-black/5 font-semibold' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate text-[var(--qp-text)]">{s.name}</p>
                          <StatusBadge status={s.status} />
                        </div>
                        {s.id === salon!.id && <Check className="w-4 h-4 text-[var(--qp-primary)] shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`p-2.5 rounded-full hover:bg-[var(--qp-surface)] text-[var(--qp-text)] transition-colors relative flex items-center justify-center cursor-pointer ${activeTab === 'notifications' ? 'bg-[var(--qp-surface)] text-[var(--qp-primary)]' : ''}`}
              title="Alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-[var(--qp-bg)]"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`p-2.5 rounded-full hover:bg-[var(--qp-surface)] text-[var(--qp-text)] transition-colors flex items-center justify-center cursor-pointer ${activeTab === 'profile' ? 'bg-[var(--qp-surface)] text-[var(--qp-primary)]' : ''}`}
              title="Profile"
            >
              <User className="w-5 h-5" />
            </button>
            
            <div className="w-px h-6 bg-[var(--qp-border)] mx-1 hidden sm:block"></div>
            
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-[var(--qp-surface)] border border-[var(--qp-border)] hover:bg-white/40 text-[var(--qp-text)] font-semibold text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Scan Customer</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ── RESPONSIVE OWNER NAVIGATION BAR ── */}
        <div className="flex ap-glass-card p-1.5 gap-1 overflow-x-auto scrollbar-none w-max max-w-full mx-auto">
          {navItem('dashboard', 'Dashboard', Home)}
          {navItem('bookings', 'Bookings', Calendar)}
          {navItem('slots', 'Slots & Calendar', Layers)}
          {navItem('customers', 'Customers', Users)}
          {navItem('earnings', 'Earnings', TrendingUp)}
          {navItem('schedules', 'Open Slots', CalendarDays)}
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
          onOpenSchedules={() => setActiveTab('schedules')}
        />
      )}

      {activeTab === 'customers' && <OwnerCustomersView salon={salon!} />}

      {activeTab === 'earnings' && <OwnerEarningsView salon={salon!} />}

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

      {/* ── QR Scanner Modal ── */}
      {isScannerOpen && (
        <QrScannerModal
          salon={salon!}
          onClose={() => setIsScannerOpen(false)}
          onCheckInSuccess={(booking) => {
            setTimeout(() => {
              setIsScannerOpen(false);
              fetchOverviewData();
            }, 1500);
          }}
        />
      )}

      {/* ── Slot Detail Modal from Today's Slots ── */}
      {selectedSlotForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="ap-glass-panel p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--qp-border)]">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[var(--qp-text)]">Slot Details</h3>
                <p className="text-sm text-[var(--qp-text-sec)]">Today · {fmt12(selectedSlotForDetail.startTime)} – {fmt12(selectedSlotForDetail.endTime)}</p>
              </div>
              <button
                onClick={() => setSelectedSlotForDetail(null)}
                className="p-2 rounded-full hover:bg-[var(--qp-surface)] text-[var(--qp-text-sec)] hover:text-[var(--qp-text)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--qp-surface)] border border-[var(--qp-border)] space-y-4 text-sm text-[var(--qp-text)]">
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
                      ? 'bg-rose-100 text-rose-700'
                      : selectedSlotForDetail.isBlocked
                      ? 'bg-black/10 text-[var(--qp-text)]'
                      : 'bg-emerald-100 text-emerald-700'
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
                  className="w-full py-3.5 rounded-2xl bg-rose-50 text-rose-600 font-semibold text-sm hover:bg-rose-100 transition-colors"
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
                  className="w-full py-3.5 rounded-2xl bg-[var(--qp-primary)] text-white font-semibold text-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:opacity-90 shadow-sm"
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
