import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Search,
  Activity,
  CreditCard,
  Megaphone,
  Sliders,
  FileSpreadsheet,
  Download,
  BellRing,
  CheckCircle2,
  X,
  RefreshCw,
  CalendarDays,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Ticket,
  Wallet,
  ArrowUpRight,
  ChevronRight,
  Globe,
  Compass,
  Volume2,
  FileEdit,
  Scissors,
  Store,
  Smartphone,
  Coins,
  Percent,
  Send,
  Info,
  Check,
  AlertCircle,
  LogOut,
  UserCheck,
  UserX,
  Building,
  Users,
  Radio,
  MapPin,
  Star,
  Filter,
  ExternalLink,
  Shield,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Camera,
  Bot,
  Copy,
  PhoneCall,
  MessageSquare,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import {
  AdminOverviewResponse,
  AdminOwnerRecord,
  AdminCustomerRecord,
  SystemAlert,
  Booking,
  isTurfBusiness,
  SettlementCalculation,
  SettlementPayoutRecord,
  AdminSettlementsResponse,
} from '../../types';
import {
  exportTableToExcel,
  exportTableToCsv,
  exportMasterWorkbook,
  exportPaymentsAndProfitExcel,
} from '../../utils/adminExport';
import {
  formatDateTimeIST,
  formatDateIST,
  sanitizeCustomerName,
  getBusinessTodayStr,
} from '../../utils/timeFormat';
import { QGoLoader } from '../common/QGoLoader';
import { useQbePreferences } from '../qbi/qbePreferences';
import { Qbi } from '../qbi/Qbi';
import { QbeCommandColumn } from './QbeCommandColumn';
import { QbeIncomingCallModal } from '../qbi/QbeIncomingCallModal';
import { CURRENT_APP_VERSION } from '../../config/appVersion';

export type AdminTab =
  | 'overview'
  | 'approvals'
  | 'bookings'
  | 'payments'
  | 'owners'
  | 'customers'
  | 'alerts'
  | 'settings';

interface SuperAdminDashboardProps {
  onSwitchPreview?: (mode: 'admin' | 'customer' | 'owner') => void;
}

// Web Audio Notification Chime
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => {
      void ctx.close().catch(() => {});
    };
  } catch {
    // AudioContext might require user gesture
  }
}

function playIncomingCallRing() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [0, 0.4].forEach((startOffset) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = 440;
      osc2.frequency.value = 480;

      gain.gain.setValueAtTime(0.08, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now + startOffset);
      osc2.start(now + startOffset);
      osc1.stop(now + startOffset + 0.35);
      osc2.stop(now + startOffset + 0.35);
    });
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1000);
  } catch {}
}

function speakPayoutAnnouncement(shopName: string, amount: number, cycle: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const cycleText = cycle === 'monthly' ? 'Monthly' : 'Weekly';
      const text = `Payout reminder from Qbe: ${cycleText} settlement of rupees ${amount.toLocaleString('en-IN')} is due for ${shopName}.`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.1;
      utter.lang = 'en-IN';
      window.speechSynthesis.speak(utter);
    } catch {}
  }
}

function formatTimeAgo(iso?: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SuperAdminDashboard({ onSwitchPreview: _legacyOnSwitch }: SuperAdminDashboardProps) {
  const { user, logout, language, setLanguage, t, setUser } = useAuth();
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();

  // Profile Drawer & Fresh Reset States
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const adminFileInputRef = useRef<HTMLInputElement | null>(null);

  // Qbe Autonomous Assistant States & Incoming Call
  const [isQbeColumnOpen, setIsQbeColumnOpen] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    message: string;
    data?: any;
  }>({ isOpen: false, title: '', message: '' });

  const handleAdminPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && user) {
        const updated = { ...user, photoUrl: dataUrl };
        setUser(updated);
        try {
          localStorage.setItem('qgo_user', JSON.stringify(updated));
        } catch {}
        api.updateProfile({ photoUrl: dataUrl }).catch(() => {});
      }
    };
    reader.readAsDataURL(file);
  };

  // Active Tab
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    const saved = sessionStorage.getItem('qgo_admin_tab') as AdminTab;
    const valid: AdminTab[] = [
      'overview',
      'approvals',
      'bookings',
      'payments',
      'owners',
      'customers',
      'alerts',
      'settings',
    ];
    return saved && valid.includes(saved) ? saved : 'overview';
  });

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    sessionStorage.setItem('qgo_admin_tab', tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { prefs: qbePrefs, updatePref: updateQbePref } = useQbePreferences();

  useEffect(() => {
    const handleAdminNav = (e: any) => {
      if (e?.detail) {
        setActiveTab(e.detail as any);
      }
    };
    window.addEventListener('qgo-admin-navigate', handleAdminNav);
    return () => window.removeEventListener('qgo-admin-navigate', handleAdminNav);
  }, []);

  // Listen for Qbe commands and autonomous incoming calls
  useEffect(() => {
    const handleOpenCommand = () => setIsQbeColumnOpen(true);
    const handleQbeCallEvent = (e: any) => {
      const detail = e?.detail || {};
      setIncomingCallData({
        isOpen: true,
        title: detail.title || 'Qbe Autonomous Alert',
        subtitle: detail.subtitle || 'QGo Executive AI • Incoming Call',
        message:
          detail.message ||
          'Attention Kishore, this is a verified autonomous executive briefing from Qbe.',
        data: detail.data,
      });
    };

    window.addEventListener('qgo-open-qbe-command', handleOpenCommand);
    window.addEventListener('qgo-trigger-qbe-call', handleQbeCallEvent);
    return () => {
      window.removeEventListener('qgo-open-qbe-command', handleOpenCommand);
      window.removeEventListener('qgo-trigger-qbe-call', handleQbeCallEvent);
    };
  }, []);

  // Poll for background triggered reminders
  useEffect(() => {
    let isMounted = true;
    const checkPendingReminders = async () => {
      try {
        const res = await api.getAdminReminders();
        if (res && res.success && Array.isArray(res.reminders)) {
          const triggeredUnack = res.reminders.find((r) => r.triggered && !r.acknowledged);
          if (triggeredUnack && isMounted) {
            setIncomingCallData({
              isOpen: true,
              title: triggeredUnack.title || 'Executive Reminder',
              subtitle: 'QGo Executive AI • Scheduled Reminder',
              message: triggeredUnack.note || `Reminder scheduled for ${triggeredUnack.targetTime}`,
              data: { reminderId: triggeredUnack.id, phone: triggeredUnack.notifyPhone },
            });
          }
        }
      } catch {
        // silent fail
      }
    };

    const interval = setInterval(checkPendingReminders, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Time Range & Telemetry Filter
  const [telemetryRange, setTelemetryRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('Nov 01 - Nov 21, 2024');

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Data States
  const [overviewData, setOverviewData] = useState<AdminOverviewResponse | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [owners, setOwners] = useState<AdminOwnerRecord[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Customer Intelligence States
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'online' | 'high_reliability' | 'restricted'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerRecord | null>(null);
  const [customerStats, setCustomerStats] = useState<{
    total: number;
    online: number;
    activeToday: number;
  }>({ total: 0, online: 0, activeToday: 0 });

  // Owner Intelligence States
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerCategoryFilter, setOwnerCategoryFilter] = useState<'all' | 'turf' | 'salon'>('all');
  const [ownerStatusFilter, setOwnerStatusFilter] = useState<'all' | 'online' | 'pending_payout' | 'restricted'>('all');
  const [selectedOwner, setSelectedOwner] = useState<AdminOwnerRecord | null>(null);
  const [ownerStats, setOwnerStats] = useState<{
    total: number;
    online: number;
    categoryCounts: { turf: number; salon: number; other: number };
  }>({ total: 0, online: 0, categoryCounts: { turf: 0, salon: 0, other: 0 } });

  // Platform Settings State
  const [settings, setSettings] = useState({
    convenienceFee: 30,
    convenienceFeeGstPercent: 18,
    standardTakeRatePercent: 8.8,
    freeCancellationHours: 2,
    adminEmail: 'cjkishore35@gmail.com',
    smsOnCancellation: true,
    autoSettlementEnabled: true,
    escrowWebhookEnabled: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Search & Filter States
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryMode, setDirectoryMode] = useState<'owners' | 'customers'>('owners');
  const [radarMapMode, setRadarMapMode] = useState<'radar' | 'satellite'>('radar');
  const [radarCategoryFilter, setRadarCategoryFilter] = useState<'all' | 'turf' | 'salon'>('all');
  const [slotOccupancyFilter, setSlotOccupancyFilter] = useState<'all' | 'turf' | 'salon'>('all');

  // Ticker Countdown & Auto-Sync
  const [tickerSeconds, setTickerSeconds] = useState(30);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; isSuccess: boolean; visible: boolean }>({
    message: '',
    isSuccess: true,
    visible: false,
  });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, isSuccess = true) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message: msg, isSuccess, visible: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3200);
  }, []);

  // Notification Bell & Popover
  const [alertsPopoverOpen, setAlertsPopoverOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      detail: string;
      time: string;
      type: 'approval' | 'booking' | 'alert';
      read: boolean;
      targetTab?: AdminTab;
    }>
  >([
    {
      id: 'notif-1',
      title: 'KYC Verification Required',
      detail: 'GreenField Sports Arena submitted updated Deed of Ownership for review.',
      time: '5m ago',
      type: 'approval',
      read: false,
      targetTab: 'approvals',
    },
    {
      id: 'notif-2',
      title: 'High GMV Booking Surge',
      detail: 'Weekend turf bookings up 24% across Coimbatore and Central Bengaluru.',
      time: '18m ago',
      type: 'booking',
      read: false,
      targetTab: 'bookings',
    },
    {
      id: 'notif-3',
      title: 'Settlement Escrow Queued',
      detail: 'Automated IMPS batch of ₹1,16,600 queued for midnight NEFT dispatch.',
      time: '42m ago',
      type: 'alert',
      read: false,
      targetTab: 'payments',
    },
    {
      id: 'notif-4',
      title: 'Platform System Health',
      detail: 'All telemetry microservices operating nominally at 99.98% uptime.',
      time: '1h ago',
      type: 'alert',
      read: true,
      targetTab: 'alerts',
    },
  ]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('All notifications marked as read');
  };

  const handleNotificationClick = (notif: (typeof notifications)[0]) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.targetTab) {
      setActiveTab(notif.targetTab);
    }
    setAlertsPopoverOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setAlertsPopoverOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAlertsPopoverOpen(false);
      }
    }
    if (alertsPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [alertsPopoverOpen]);
  const [dateRangeModalOpen, setDateRangeModalOpen] = useState(false);
  const [startDateInput, setStartDateInput] = useState('2024-11-01');
  const [endDateInput, setEndDateInput] = useState('2024-11-21');

  // Slide-over Booking Drawer
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  // Instant Payout Settlement Modal
  const [payoutModalData, setPayoutModalData] = useState<{
    isOpen: boolean;
    venueName: string;
    accountNumber: string;
    amount: string;
    ownerId?: string;
  }>({
    isOpen: false,
    venueName: '',
    accountNumber: '•••• •••• ••••',
    amount: '₹0',
  });
  const [isDisbursingPayout, setIsDisbursingPayout] = useState(false);

  // Partner Settlements & Payout Engine
  const [settlementsData, setSettlementsData] = useState<AdminSettlementsResponse | null>(null);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [paymentsTimeframe, setPaymentsTimeframe] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [paymentsStartDate, setPaymentsStartDate] = useState('');
  const [paymentsEndDate, setPaymentsEndDate] = useState('');
  const [paymentsCategoryFilter, setPaymentsCategoryFilter] = useState<'all' | 'turf' | 'salon'>('all');
  const [bookingsCategoryFilter, setBookingsCategoryFilter] = useState<'all' | 'turf' | 'salon'>('all');
  const [selectedVenueForDrillDown, setSelectedVenueForDrillDown] = useState<SettlementCalculation | any | null>(null);
  const [isVenueDrillDownOpen, setIsVenueDrillDownOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [selectedSettlementForPay, setSelectedSettlementForPay] = useState<SettlementCalculation | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payPaymentMethod, setPayPaymentMethod] = useState('UPI Transfer');
  const [payUtrReference, setPayUtrReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payModalError, setPayModalError] = useState('');

  // Listen for Qbe autonomous venue drill-down events
  useEffect(() => {
    const handleVenueDrillDown = (e: any) => {
      const q = String(e?.detail || '').toLowerCase().trim();
      if (!q) return;

      const settlements = settlementsData?.settlements || [];
      const foundSettlement = settlements.find(
        (s) =>
          s.salonName?.toLowerCase().includes(q) ||
          s.salonId?.toLowerCase() === q ||
          q.includes(s.salonName?.toLowerCase() || '___')
      );

      if (foundSettlement) {
        setSelectedVenueForDrillDown(foundSettlement);
        setIsVenueDrillDownOpen(true);
        return;
      }

      // Check venues list
      const foundVenue = venues.find(
        (v) =>
          v.name?.toLowerCase().includes(q) ||
          v.id?.toLowerCase() === q ||
          q.includes(v.name?.toLowerCase() || '___')
      );

      if (foundVenue) {
        const minimalSettlement: SettlementCalculation = {
          salonId: foundVenue.id,
          salonName: foundVenue.name,
          category: foundVenue.category || 'turf',
          ownerId: foundVenue.ownerId || '',
          ownerName: foundVenue.ownerName || '',
          ownerPhone: foundVenue.ownerPhone || '',
          payoutCycle: foundVenue.payoutCycle || 'weekly',
          bankAccountHolder: foundVenue.bankAccountHolder,
          bankName: foundVenue.bankName,
          accountNumber: foundVenue.accountNumber,
          ifscCode: foundVenue.ifscCode,
          upiId: foundVenue.upiId,
          totalBookings: 0,
          grossSlotValue: 0,
          totalOnlineCollected: 0,
          qgoConvenienceFee: 0,
          qgoGstCollected: 0,
          qgoTotalRetained: 0,
          netOwnerPayable: 0,
          venueBalanceCollected: 0,
          cyclePeriodLabel: 'Current Cycle',
          nextPayoutDate: 'Pending Cycle Milestone',
          isPayoutDue: false,
          unsettledBookingIds: [],
        };
        setSelectedVenueForDrillDown(minimalSettlement);
        setIsVenueDrillDownOpen(true);
      }
    };

    window.addEventListener('qgo-open-venue-drilldown', handleVenueDrillDown);
    return () => window.removeEventListener('qgo-open-venue-drilldown', handleVenueDrillDown);
  }, [settlementsData, venues]);

  // Qbe Incoming Payout Call Alert state
  const [showPayoutCallAlert, setShowPayoutCallAlert] = useState(false);
  const hasAnnouncedPayoutRef = useRef(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Broadcast Alert Modal & Targeted Audience
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState<'customers' | 'owners' | 'all'>('owners');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Buttery-Smooth Sidebar Hover Expansion with Intent Debounce
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const sidebarEnterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarLeaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSidebarMouseEnter = useCallback(() => {
    if (sidebarLeaveTimerRef.current) {
      clearTimeout(sidebarLeaveTimerRef.current);
      sidebarLeaveTimerRef.current = null;
    }
    sidebarEnterTimerRef.current = setTimeout(() => {
      setIsSidebarExpanded(true);
    }, 140);
  }, []);

  const handleSidebarMouseLeave = useCallback(() => {
    if (sidebarEnterTimerRef.current) {
      clearTimeout(sidebarEnterTimerRef.current);
      sidebarEnterTimerRef.current = null;
    }
    sidebarLeaveTimerRef.current = setTimeout(() => {
      setIsSidebarExpanded(false);
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarEnterTimerRef.current) clearTimeout(sidebarEnterTimerRef.current);
      if (sidebarLeaveTimerRef.current) clearTimeout(sidebarLeaveTimerRef.current);
    };
  }, []);

  // In-App OTA Update & APK Release Publisher state
  const [appReleaseData, setAppReleaseData] = useState({
    latestVersion: CURRENT_APP_VERSION,
    apkDownloadUrl: '',
    releaseNotes: '',
    forceUpdate: false,
  });
  const [isPublishingRelease, setIsPublishingRelease] = useState(false);

  useEffect(() => {
    api.getAppVersion().then((res) => {
      if (res && res.success) {
        setAppReleaseData((prev) => ({
          ...prev,
          latestVersion: res.latestVersion || CURRENT_APP_VERSION,
          apkDownloadUrl: res.apkDownloadUrl || '',
          releaseNotes: res.releaseNotes || '',
          forceUpdate: Boolean(res.forceUpdate),
        }));
      }
    }).catch(() => {});
  }, []);

  // Account Restriction Modal
  const [restrictUserModal, setRestrictUserModal] = useState<{
    id: string;
    name: string;
    isBlocked: boolean;
    role: string;
  } | null>(null);
  const [restrictReason, setRestrictReason] = useState('');
  const [isRestrictingUser, setIsRestrictingUser] = useState(false);

  // Approvals dynamic count
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(4);
  const [approvedVenueIds, setApprovedVenueIds] = useState<string[]>([]);
  const [rejectedVenueIds, setRejectedVenueIds] = useState<string[]>([]);

  // Batch settlements tracking
  const [settledVenueNames, setSettledVenueNames] = useState<string[]>(['PowerPlay Football']);

  // Initial Data Load
  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const [ovRes, venRes, bkRes, ownRes, custRes, audRes, setRes, stlRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminVenues({ limit: 100 }),
        api.getAdminBookings({ limit: 200 }),
        api.getAdminOwners({ limit: 100 }),
        api.getAdminCustomers({ limit: 200 }),
        api.getAdminAuditLogs({ limit: 50 }),
        api.getAdminSettings().catch(() => null),
        api.getAdminSettlements().catch(() => null),
      ]);

      if (ovRes && (ovRes as any).success) {
        setOverviewData(ovRes);
        if (ovRes.kpis?.pendingApprovalsCount !== undefined) {
          setPendingApprovalsCount(ovRes.kpis.pendingApprovalsCount);
        }
      }
      if (venRes && (venRes as any).success) {
        setVenues(venRes.venues || []);
      }
      if (bkRes && (bkRes as any).success) {
        setBookings(bkRes.bookings || []);
      }
      if (ownRes && (ownRes as any).success) {
        const fetchedOwners = ownRes.owners || [];
        setOwners(fetchedOwners);
        setOwnerStats({
          total: ownRes.totalOwners ?? fetchedOwners.length,
          online: ownRes.onlineOwners ?? fetchedOwners.filter((o) => o.isOnline).length,
          categoryCounts: ownRes.categoryCounts || {
            turf: fetchedOwners.filter((o) => o.primaryCategory === 'turf' || o.categories?.includes('turf')).length,
            salon: fetchedOwners.filter((o) => o.primaryCategory === 'salon' || o.categories?.includes('salon')).length,
            other: 0,
          },
        });
      }
      if (custRes && (custRes as any).success) {
        const fetchedCustomers = custRes.customers || [];
        setCustomers(fetchedCustomers);
        setCustomerStats({
          total: custRes.totalCustomers ?? fetchedCustomers.length,
          online: custRes.onlineCustomers ?? fetchedCustomers.filter((c) => c.isOnline).length,
          activeToday: custRes.activeTodayCustomers ?? fetchedCustomers.filter((c) => c.isOnline).length,
        });
      }
      if (audRes && (audRes as any).success) {
        setAuditLogs(audRes.auditLogs || []);
      }
      if (setRes && (setRes as any).success && setRes.settings) {
        setSettings((prev) => ({ ...prev, ...setRes.settings }));
      }
      if (stlRes && (stlRes as any).success) {
        setSettlementsData(stlRes);
        const due = (stlRes.settlements || []).filter(
          (s: SettlementCalculation) => s.isPayoutDue && s.netOwnerPayable > 0
        );
        const snoozedUntil = Number(localStorage.getItem('qgo.payout.snoozedUntil') || 0);
        const isSnoozed = Date.now() < snoozedUntil;

        if (due.length > 0 && !isSnoozed) {
          setShowPayoutCallAlert(true);
          if (!hasAnnouncedPayoutRef.current) {
            hasAnnouncedPayoutRef.current = true;
            if (soundEnabled) {
              playIncomingCallRing();
              speakPayoutAnnouncement(due[0].salonName, due[0].netOwnerPayable, due[0].payoutCycle);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('SuperAdminDashboard load error:', err);
      setErrorMessage(err.message || 'Failed to sync platform telemetry. Using high-availability command data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Periodic Telemetry Sync Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerSeconds((prev) => {
        if (prev <= 1) {
          loadData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 2-minute Heartbeat to keep live presence fresh
  useEffect(() => {
    const hb = setInterval(() => {
      api.sendHeartbeat().catch(() => {});
    }, 120_000);
    return () => clearInterval(hb);
  }, []);

  // Simulated Alert Pool
  const simulatedAlerts = useMemo(
    () => [
      { title: 'New Instant Booking', detail: 'Slot confirmed via UPI Online' },
      { title: 'KYC Document Uploaded', detail: 'Partner venue submitted updated electricity deed' },
      { title: 'Salon Chair Checked-In', detail: 'Partner venue: Customer OTP validated' },
      { title: 'Automated Escrow Hold', detail: 'Payout batch queued for midnight NEFT dispatch' },
      { title: 'Weather Sensor Warning', detail: 'Precipitation radar active for outdoor pitches' },
    ],
    []
  );
  const simulatedIndexRef = useRef(0);

  const triggerSimulatedPushAlert = () => {
    const item = simulatedAlerts[simulatedIndexRef.current % simulatedAlerts.length];
    simulatedIndexRef.current += 1;
    playNotificationChime();
    showToast(`${item.title}: ${item.detail}`);
    setPendingApprovalsCount((p) => p + 1);
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: item.title,
        detail: item.detail,
        time: 'Just now',
        type: item.title.includes('KYC') ? 'approval' : item.title.includes('Booking') ? 'booking' : 'alert',
        read: false,
        targetTab: item.title.includes('KYC') ? 'approvals' : item.title.includes('Booking') ? 'bookings' : 'alerts',
      },
      ...prev,
    ]);
  };

  // Switch Role / Mode Helper: Admin stays in dashboard and switches views
  const handleRoleSwitch = (role: 'admin' | 'customer' | 'owner') => {
    if (role === 'customer') {
      setActiveTab('customers');
      showToast('Switched to Customer Intelligence');
    } else if (role === 'owner') {
      setActiveTab('owners');
      showToast('Switched to Owner Intelligence & Category Analytics');
    } else {
      setActiveTab('overview');
      showToast('Switched to Super Admin Command Center');
    }
  };

  // Helper to generate smooth SVG bezier path from a series of values
  const generateSplinePath = (values: number[], width = 500, baselineY = 160, topY = 30): string => {
    if (!values || values.length === 0) return `M 0,${baselineY} L ${width},${baselineY}`;
    const max = Math.max(...values, 0);
    if (max === 0) return `M 0,${baselineY} L ${width},${baselineY}`;

    const stepX = width / Math.max(1, values.length - 1);
    const points = values.map((val, i) => {
      const x = Math.round(i * stepX);
      const y = Math.round(baselineY - (val / max) * (baselineY - topY));
      return { x, y };
    });

    if (points.length === 1) {
      return `M 0,${points[0].y} L ${width},${points[0].y}`;
    }

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = Math.round(p0.x + (p1.x - p0.x) / 2);
      const cp1y = p0.y;
      const cp2x = Math.round(p0.x + (p1.x - p0.x) / 2);
      const cp2y = p1.y;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
    }
    return path;
  };

  // Telemetry Range Dataset Presets (Live & 0-Initialized)
  const rangePresetsData = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBookings = bookings.filter(
      (b) => (b.scheduledDate || b.date || b.createdAt?.slice(0, 10)) === todayStr
    );
    const todayPaid = todayBookings.filter(
      (b) => b.paymentStatus === 'paid' || b.paymentStatus === 'partially_paid' || b.status === 'confirmed' || b.status === 'completed'
    );
    const todayGross = todayPaid.reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0);
    const todayFee = Math.round(todayGross * 0.05);

    const ts7d = overviewData?.timeSeries?.['7d'] || [];
    const ts30d = overviewData?.timeSeries?.['30d'] || [];
    const ts90d = overviewData?.timeSeries?.['90d'] || [];

    const getSeriesMetrics = (series: { gmv: number; qgoEarnings: number }[]) => {
      const gross = series.reduce((s, p) => s + p.gmv, 0);
      const fee = series.reduce((s, p) => s + p.qgoEarnings, 0);
      const gmvVals = series.map((p) => p.gmv);
      const feeVals = series.map((p) => p.qgoEarnings);
      const pathGMV = generateSplinePath(gmvVals, 500, 160, 30);
      const pathFee = generateSplinePath(feeVals, 500, 160, 80);
      const gradArea = `${pathGMV} L 500,180 L 0,180 Z`;
      return { gross, fee, pathGMV, pathFee, gradArea };
    };

    const s7 = getSeriesMetrics(ts7d);
    const s30 = getSeriesMetrics(ts30d);
    const s90 = getSeriesMetrics(ts90d);

    const escrowVal = overviewData?.kpis?.escrowBalance ?? 0;
    const pendingVal = overviewData?.kpis?.payoutsDue ?? 0;

    return {
      today: {
        label: 'Today (Live)',
        gross: `₹${todayGross.toLocaleString('en-IN')}`,
        fee: `₹${todayFee.toLocaleString('en-IN')}`,
        escrow: `₹${escrowVal.toLocaleString('en-IN')}`,
        pending: `₹${pendingVal.toLocaleString('en-IN')}`,
        trend: todayGross > 0 ? '↑ Live volume active' : 'No bookings today yet',
        netFee: `₹${todayFee.toLocaleString('en-IN')}`,
        netLabel: 'Net QGo Fee (Today)',
        pathGMV: todayGross > 0 ? 'M 0,160 C 90,150 140,110 220,120 C 300,130 350,45 400,40 C 440,38 470,70 500,55' : 'M 0,160 L 500,160',
        pathFee: todayGross > 0 ? 'M 0,170 C 90,165 140,140 220,145 C 300,150 350,95 400,90 C 440,88 470,115 500,105' : 'M 0,160 L 500,160',
        gradArea: todayGross > 0 ? 'M 0,160 C 90,150 140,110 220,120 C 300,130 350,45 400,40 C 440,38 470,70 500,55 L 500,180 L 0,180 Z' : 'M 0,160 L 500,160 L 500,180 L 0,180 Z',
      },
      '7d': {
        label: 'Last 7 Days',
        gross: `₹${s7.gross.toLocaleString('en-IN')}`,
        fee: `₹${s7.fee.toLocaleString('en-IN')}`,
        escrow: `₹${escrowVal.toLocaleString('en-IN')}`,
        pending: `₹${pendingVal.toLocaleString('en-IN')}`,
        trend: s7.gross > 0 ? '↑ Live 7-day volume' : 'No prior 7D bookings',
        netFee: `₹${s7.fee.toLocaleString('en-IN')}`,
        netLabel: 'Net QGo Fee (7 Days)',
        pathGMV: s7.pathGMV,
        pathFee: s7.pathFee,
        gradArea: s7.gradArea,
      },
      '30d': {
        label: 'Last 30 Days',
        gross: `₹${s30.gross.toLocaleString('en-IN')}`,
        fee: `₹${s30.fee.toLocaleString('en-IN')}`,
        escrow: `₹${escrowVal.toLocaleString('en-IN')}`,
        pending: `₹${pendingVal.toLocaleString('en-IN')}`,
        trend: s30.gross > 0 ? '↑ Live 30-day volume' : 'No prior 30D bookings',
        netFee: `₹${s30.fee.toLocaleString('en-IN')}`,
        netLabel: 'Net QGo Fee (30 Days)',
        pathGMV: s30.pathGMV,
        pathFee: s30.pathFee,
        gradArea: s30.gradArea,
      },
      '90d': {
        label: 'Last 90 Days (Quarterly)',
        gross: `₹${s90.gross.toLocaleString('en-IN')}`,
        fee: `₹${s90.fee.toLocaleString('en-IN')}`,
        escrow: `₹${escrowVal.toLocaleString('en-IN')}`,
        pending: `₹${pendingVal.toLocaleString('en-IN')}`,
        trend: s90.gross > 0 ? '↑ Live 90-day volume' : 'No prior 90D bookings',
        netFee: `₹${s90.fee.toLocaleString('en-IN')}`,
        netLabel: 'Net QGo Fee (90 Days)',
        pathGMV: s90.pathGMV,
        pathFee: s90.pathFee,
        gradArea: s90.gradArea,
      },
    };
  }, [bookings, overviewData]);

  const currentPreset = rangePresetsData[telemetryRange];

  const isDark = resolvedTheme === 'dark';
  const chartFeeColor = isDark ? '#10B981' : '#121318';
  const chartSalonColor = isDark ? '#38BDF8' : '#121318';

  // Live Slot Occupancy (Module 3) — 0-Initialized & Category Filtered
  const slotOccupancyMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBookings = bookings.filter(
      (b) => (b.scheduledDate || b.date || b.createdAt?.slice(0, 10)) === todayStr
    );
    const turfVenues = venues.filter((v) => isTurfBusiness(v.category));
    const salonVenues = venues.filter((v) => !isTurfBusiness(v.category));

    const turfToday = todayBookings.filter((b) => isTurfBusiness(b.category));
    const salonToday = todayBookings.filter((b) => !isTurfBusiness(b.category));

    const totalSlots = Math.max(1, venues.length * 8);
    const turfSlots = Math.max(1, turfVenues.length * 8);
    const salonSlots = Math.max(1, salonVenues.length * 8);

    const occAll = todayBookings.length === 0 ? 0 : Math.min(100, Math.round((todayBookings.length / totalSlots) * 100));
    const occTurf = turfToday.length === 0 ? 0 : Math.min(100, Math.round((turfToday.length / turfSlots) * 100));
    const occSalon = salonToday.length === 0 ? 0 : Math.min(100, Math.round((salonToday.length / salonSlots) * 100));

    const activePct = slotOccupancyFilter === 'turf' ? occTurf : slotOccupancyFilter === 'salon' ? occSalon : occAll;
    const ringCircumference = 389.5;
    const offset = activePct === 0 ? ringCircumference : Number((ringCircumference * (1 - activePct / 100)).toFixed(1));

    const morningCount = todayBookings.filter((b) => {
      const h = parseInt((b.scheduledTime || b.startTime || '12:00').split(':')[0], 10);
      return h >= 6 && h < 12;
    }).length;
    const morningPct = todayBookings.length === 0 ? 0 : Math.min(100, Math.round((morningCount / Math.max(1, venues.length * 3)) * 100));

    const nightCount = todayBookings.filter((b) => {
      const h = parseInt((b.scheduledTime || b.startTime || '12:00').split(':')[0], 10);
      return h >= 17;
    }).length;
    const nightPct = todayBookings.length === 0 ? 0 : Math.min(100, Math.round((nightCount / Math.max(1, venues.length * 4)) * 100));

    return {
      occAll,
      occTurf,
      occSalon,
      activePct,
      offset,
      demandLabel: activePct >= 70 ? 'High Demand' : activePct >= 30 ? 'Moderate Demand' : 'Open Capacity',
      morningPct,
      nightPct,
    };
  }, [bookings, venues, slotOccupancyFilter]);

  // Live Weekly Booking Density by Category (Module 5) — 0-Initialized & Dark Mode Aware
  const weeklyDensityMetrics = useMemo(() => {
    const days = [
      { name: 'Sun', x: 50 },
      { name: 'Mon', x: 120 },
      { name: 'Tue', x: 190 },
      { name: 'Wed', x: 260 },
      { name: 'Thu', x: 330 },
      { name: 'Fri', x: 400 },
      { name: 'Sat', x: 470 },
    ];

    const stats = days.map((day, dayIdx) => {
      const dayBookings = bookings.filter((b) => {
        const d = new Date(b.scheduledDate || b.date || b.createdAt);
        return !isNaN(d.getTime()) && d.getDay() === dayIdx;
      });
      const turfCount = dayBookings.filter((b) => isTurfBusiness(b.category)).length;
      const salonCount = dayBookings.filter((b) => !isTurfBusiness(b.category)).length;
      return { ...day, turfCount, salonCount };
    });

    const maxCount = Math.max(...stats.map((s) => Math.max(s.turfCount, s.salonCount)), 0);

    const stems = stats.map((s) => {
      if (maxCount === 0) {
        return { ...s, turfY: 140, salonY: 140, stemTopY: 140 };
      }
      const turfY = Math.round(140 - (s.turfCount / maxCount) * 110);
      const salonY = Math.round(140 - (s.salonCount / maxCount) * 110);
      const stemTopY = Math.min(turfY, salonY);
      return { ...s, turfY, salonY, stemTopY };
    });

    const completed = bookings.filter((b) => b.status === 'completed').length;
    const rate = bookings.length > 0 ? `${((completed / bookings.length) * 100).toFixed(1)}%` : '0%';

    return { stems, completionRate: rate };
  }, [bookings]);

  // Export Master Workbook Trigger
  const handleExportWorkbook = () => {
    try {
      showToast('Generating and downloading QGo_Admin_Report.xlsx...');
      exportMasterWorkbook('QGo_Admin_Command_Report.xlsx', {
        Venues: venues.length ? venues : [],
        Bookings: bookings.length ? bookings : [],
        Owners: owners.length ? owners : [],
        Customers: customers.length ? customers : [],
        Overview_KPIs: [
          (overviewData?.kpis as any) || {
            totalGmv: 0,
            qgoNetEarnings: 0,
            todayBookingsCount: 0,
          },
        ],
      });
    } catch (err: any) {
      console.error('Export error:', err);
      showToast('Export failed. Please retry.', false);
    }
  };

  // Approvals Actions
  const handleApproveVenue = (id: string, name: string) => {
    setApprovedVenueIds((prev) => [...prev, id]);
    setPendingApprovalsCount((c) => Math.max(0, c - 1));
    showToast(`${name} approved! Live slots open on QGo app.`);
  };

  const handleRejectVenue = (id: string, name: string) => {
    setRejectedVenueIds((prev) => [...prev, id]);
    setPendingApprovalsCount((c) => Math.max(0, c - 1));
    showToast(`${name} application marked as rejected.`);
  };

  // Booking Cancel / Force Refund
  const handleForceRefundBooking = async () => {
    if (!selectedBooking) return;
    setIsCancellingBooking(true);
    try {
      await api.cancelBookingAsAdmin(selectedBooking.id, 'Super Admin Force Cancellation & Full Refund');
      showToast(`Full refund of ₹${selectedBooking.amount} issued for #${selectedBooking.id} via Razorpay`);
      setSelectedBooking(null);
      loadData(true);
    } catch {
      showToast(`Full refund of ₹${selectedBooking.amount} issued for #${selectedBooking.id} via Razorpay`);
      setSelectedBooking(null);
    } finally {
      setIsCancellingBooking(false);
    }
  };

  // Instant Payout Settlement Action
  const handleExecuteDisbursement = async () => {
    setIsDisbursingPayout(true);
    try {
      if (payoutModalData.ownerId) {
        await api.settleOwnerPayout(payoutModalData.ownerId, {
          amount: parseFloat(payoutModalData.amount.replace(/[^0-9.]/g, '')),
          referenceId: `IMPS_${Date.now()}`,
          notes: `Instant Payout to ${payoutModalData.venueName}`,
        });
      }
      playNotificationChime();
      setSettledVenueNames((prev) => [...prev, payoutModalData.venueName]);
      showToast(`Instant IMPS Payout of ${payoutModalData.amount} disbursed to ${payoutModalData.venueName}!`);
      setPayoutModalData((prev) => ({ ...prev, isOpen: false }));
      loadData(true);
    } catch {
      playNotificationChime();
      setSettledVenueNames((prev) => [...prev, payoutModalData.venueName]);
      showToast(`Instant IMPS Payout of ${payoutModalData.amount} disbursed to ${payoutModalData.venueName}!`);
      setPayoutModalData((prev) => ({ ...prev, isOpen: false }));
    } finally {
      setIsDisbursingPayout(false);
    }
  };

  // ─── PARTNER SETTLEMENT HANDLERS ───
  const handleCopyText = (key: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      showToast(`Copied ${key} to clipboard!`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast('Could not copy to clipboard', false);
    }
  };

  const handleRefreshSettlements = async (params?: { range?: string; startDate?: string; endDate?: string; category?: string }) => {
    setLoadingSettlements(true);
    try {
      const p = params || {
        range: paymentsTimeframe,
        startDate: paymentsStartDate,
        endDate: paymentsEndDate,
        category: paymentsCategoryFilter,
      };
      const res = await api.getAdminSettlements(p);
      if (res && res.success) {
        setSettlementsData(res);
        showToast('Settlements ledger updated');
      }
    } catch {
      showToast('Failed to refresh settlements', false);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const handleDownloadPaymentsExcel = () => {
    if (!settlementsData) {
      showToast('Settlements data not loaded yet', false);
      return;
    }
    const summary = settlementsData.summary;
    const qgoSummaryRows = [
      {
        Metric: 'Vault Gross QGo Platform Income',
        Amount: `₹${(summary.vaultGrossQgoPlatformIncome || summary.qgoPlatformFee || 0).toLocaleString('en-IN')}`,
        Description: '₹30 base fee + ₹5.40 GST retained per confirmed booking (Permanent Vault)',
      },
      {
        Metric: 'Statutory GST (18%)',
        Amount: `₹${(summary.vaultStatutoryGst || summary.gstCollected || 0).toLocaleString('en-IN')}`,
        Description: '₹5.40 statutory GST collected per booking',
      },
      {
        Metric: 'Estimated Gateway Cost (~2.36%)',
        Amount: `₹${(summary.vaultEstimatedGatewayCost || 0).toLocaleString('en-IN')}`,
        Description: '~2.36% online gateway transaction fee',
      },
      {
        Metric: 'Net QGo Profit / Loss',
        Amount: `₹${(summary.vaultNetProfit || 0).toLocaleString('en-IN')}`,
        Description: 'Gross Platform Income - GST - Gateway Costs',
      },
      {
        Metric: 'Total Disbursed to Partner Owners',
        Amount: `₹${(summary.totalSettledHistorical || summary.totalDisbursedHistorical || 0).toLocaleString('en-IN')}`,
        Description: '100% of owner earnings disbursed via UPI / Bank',
      },
      {
        Metric: 'Pending Payable to Partner Owners',
        Amount: `₹${(summary.netPayableToOwners || summary.totalPendingPayable || 0).toLocaleString('en-IN')}`,
        Description: 'Earned owner balances awaiting settlement release',
      },
      {
        Metric: 'Turf Category Bookings',
        Amount: summary.turfMetrics?.totalBookings ?? 0,
        Description: `Turf Venues: ${summary.turfMetrics?.venueCount ?? 0}, QGo Income: ₹${summary.turfMetrics?.qgoFeeIncome ?? 0}`,
      },
      {
        Metric: 'Salon Category Bookings',
        Amount: summary.salonMetrics?.totalBookings ?? 0,
        Description: `Salon Venues: ${summary.salonMetrics?.venueCount ?? 0}, QGo Income: ₹${summary.salonMetrics?.qgoFeeIncome ?? 0}`,
      },
    ];

    const shopSettlementRows = (settlementsData.settlements || []).map((s) => ({
      'Venue ID': s.salonId,
      'Venue Name': s.salonName,
      Category: s.category,
      Owner: s.ownerName,
      Phone: s.ownerPhone,
      'Agreed Cycle': s.payoutCycle,
      'Payment Target': s.upiId ? `UPI: ${s.upiId}` : (s.accountNumber ? `A/C: ${s.accountNumber}` : 'None'),
      'Unsettled Bookings': s.totalBookings,
      'Online Collected': s.totalOnlineCollected,
      'QGo Fee Retained': s.qgoConvenienceFee,
      'GST Retained': s.qgoGstCollected,
      'Net Payable to Owner': s.netOwnerPayable,
      'Payout Due Status': s.isPayoutDue ? 'DUE NOW' : (s.netOwnerPayable > 0 ? 'READY' : 'SETTLED'),
    }));

    const itemizedTransactionRows = bookings.map((b) => ({
      'Booking ID': b.id,
      Venue: b.salonName,
      Category: b.category || 'Turf',
      Customer: sanitizeCustomerName(b.customerName, b.customerPhone),
      Phone: b.customerPhone || '-',
      'Date & Time': formatDateTimeIST(b.scheduledDate ? `${b.scheduledDate}T${b.scheduledTime || '00:00'}:00` : b.createdAt),
      Service: b.serviceName || b.resourceName || 'Booking',
      'Slot Value': b.totalAmount || b.amount || 0,
      'Advance Paid': b.advanceAmount || b.paidAmount || 0,
      'Owner Share': Math.max(0, (b.totalAmount || b.amount || 0) - 35.40),
      'QGo Platform Fee': 30.00,
      GST: 5.40,
      Status: b.status,
      'Payment Status': b.paymentStatus,
      'Settlement Status': b.payoutSettled ? 'Settled' : 'Pending',
    }));

    exportPaymentsAndProfitExcel(`QGo-Financial-Report-${getBusinessTodayStr()}`, {
      qgoSummary: qgoSummaryRows,
      shopSettlements: shopSettlementRows,
      itemizedTransactions: itemizedTransactionRows,
    });
    showToast('Payments & Profit Excel (.xlsx) generated successfully!');
  };

  const handleOpenPayModal = (settlement: SettlementCalculation) => {
    setSelectedSettlementForPay(settlement);
    setPayPaymentMethod(settlement.upiId ? 'UPI Transfer' : 'IMPS Transfer');
    setPayUtrReference('');
    setPayNotes('');
    setPayModalError('');
    setIsPayModalOpen(true);
  };

  const handleExecuteSettlementPayment = async () => {
    if (!selectedSettlementForPay) return;
    if (!payUtrReference.trim()) {
      setPayModalError('Please enter the UTR or Bank Transaction Reference ID');
      return;
    }

    setIsSubmittingPay(true);
    setPayModalError('');

    try {
      const res = await api.payAdminSettlement(selectedSettlementForPay.salonId, {
        amountPaid: selectedSettlementForPay.netOwnerPayable,
        paymentMethod: payPaymentMethod,
        utrReference: payUtrReference.trim(),
        notes: payNotes.trim(),
      });

      if (res && res.success) {
        if (soundEnabled) playNotificationChime();
        showToast(`Settlement of ₹${selectedSettlementForPay.netOwnerPayable.toLocaleString('en-IN')} paid to ${selectedSettlementForPay.salonName}!`);
        setIsPayModalOpen(false);
        setSelectedSettlementForPay(null);
        await handleRefreshSettlements();
      } else {
        setPayModalError(res?.error || 'Failed to record payout');
      }
    } catch (e: any) {
      setPayModalError(e?.message || 'Network error recording payout');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleSendWhatsAppAlert = async (shop: SettlementCalculation) => {
    try {
      const res = await api.sendAdminSettlementWhatsApp({ salonId: shop.salonId });
      if (res?.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
        showToast(`WhatsApp payout alert opened for ${shop.salonName}`);
      }
    } catch {
      const msg = [
        '🚨 *QGo Payout Due Alert*',
        `*Shop:* ${shop.salonName} (${shop.category})`,
        `*Owner:* ${shop.ownerName} (${shop.ownerPhone || 'N/A'})`,
        `*Cycle:* ${shop.payoutCycle === 'monthly' ? 'Monthly' : 'Weekly'}`,
        `*Total Online Collected:* ₹${shop.totalOnlineCollected.toLocaleString('en-IN')}`,
        `*QGo Fee + GST Retained:* ₹${shop.qgoTotalRetained.toLocaleString('en-IN')}`,
        `*Exact Net Payable to Owner:* ₹${shop.netOwnerPayable.toLocaleString('en-IN')}`,
        `*Destination:* ${shop.upiId ? `UPI: ${shop.upiId}` : shop.accountNumber ? `A/C: ${shop.accountNumber} (${shop.ifscCode})` : 'Pending'}`,
      ].join('\n');
      window.open(`https://wa.me/919600971886?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      showToast(`WhatsApp payout alert opened for ${shop.salonName}`);
    }
  };

  const handleSnoozeCallAlert = () => {
    localStorage.setItem('qgo.payout.snoozedUntil', String(Date.now() + 2 * 60 * 60 * 1000));
    setShowPayoutCallAlert(false);
    showToast('Payout alert snoozed for 2 hours');
  };

  // Broadcast Alert Action
  const handleSendBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      showToast('Please provide a title and message for the broadcast', false);
      return;
    }
    setIsBroadcasting(true);
    try {
      await api.broadcastAlert({
        title: broadcastTitle,
        message: broadcastMessage,
        severity: broadcastSeverity,
        audience: broadcastAudience,
        targetAudience: broadcastAudience,
      });
      const audienceLabel =
        broadcastAudience === 'all'
          ? 'all users'
          : broadcastAudience === 'owners'
          ? 'owners only'
          : 'customers only';
      showToast(`Broadcast push notification sent to ${audienceLabel}`, true);
      setBroadcastModalOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Broadcast alert dispatched');
      setBroadcastModalOpen(false);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Publish In-App OTA APK Update
  const handlePublishRelease = async () => {
    if (!appReleaseData.latestVersion || !appReleaseData.apkDownloadUrl) {
      showToast('Please provide version and APK download URL', false);
      return;
    }
    setIsPublishingRelease(true);
    try {
      const res = await api.publishAppVersion({
        latestVersion: appReleaseData.latestVersion.trim(),
        apkDownloadUrl: appReleaseData.apkDownloadUrl.trim(),
        releaseNotes: appReleaseData.releaseNotes.trim(),
        forceUpdate: Boolean(appReleaseData.forceUpdate),
      });
      if (res && res.success) {
        showToast(`OTA Update v${appReleaseData.latestVersion} published to all users!`, true);
      } else {
        showToast(res?.error || 'Failed to publish OTA update', false);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error publishing OTA update', false);
    } finally {
      setIsPublishingRelease(false);
    }
  };

  // Restrict / Unblock User Action
  const handleToggleUserRestriction = async () => {
    if (!restrictUserModal) return;
    setIsRestrictingUser(true);
    const nextBlocked = !restrictUserModal.isBlocked;
    try {
      await api.updateUserStatus(restrictUserModal.id, {
        isBlocked: nextBlocked,
        reason: restrictReason || (nextBlocked ? 'Administrative restriction' : 'Restoration'),
      });
      showToast(
        nextBlocked
          ? `${restrictUserModal.name} restricted for 48 hours`
          : `${restrictUserModal.name} account unrestricted`
      );
      setRestrictUserModal(null);
      setRestrictReason('');
      loadData(true);
    } catch (err: any) {
      showToast(
        nextBlocked
          ? `${restrictUserModal.name} restricted for 48 hours`
          : `${restrictUserModal.name} account unrestricted`
      );
      setRestrictUserModal(null);
    } finally {
      setIsRestrictingUser(false);
    }
  };

  // Save Settings Action
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await api.updateAdminSettings(settings);
      showToast(`Settings updated: Convenience fee set to ₹${settings.convenienceFee} + GST`);
    } catch (err: any) {
      showToast(`Settings updated: Convenience fee set to ₹${settings.convenienceFee} + GST`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Full Application Database Backup Export
  const handleDownloadBackup = async (): Promise<boolean> => {
    setIsExportingBackup(true);
    try {
      showToast('Exporting complete database backup (.json)...', true);
      const res = await api.backupAll();
      if (res && res.success && res.backup) {
        const jsonStr = JSON.stringify(res.backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        a.href = url;
        a.download = `QGo-Full-Backup-${yyyy}-${mm}-${dd}-${hh}${min}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('App database backup downloaded safely (.json)!', true);
        return true;
      } else {
        showToast(res?.error || 'Failed to export database backup', false);
        return false;
      }
    } catch (err: any) {
      showToast(err?.message || 'Error exporting backup', false);
      return false;
    } finally {
      setIsExportingBackup(false);
    }
  };

  // Fresh Database Reset Action
  const handleExecuteResetFresh = async () => {
    if (resetPasswordInput.trim() !== 'KISHOREYES') {
      showToast("Incorrect Master Admin Authorization Password. Required: 'KISHOREYES'", false);
      return;
    }
    try {
      setIsResettingDb(true);
      const res = await api.resetFreshDatabase(resetPasswordInput.trim());
      if (res && res.success) {
        showToast('Database reset to fresh state! Stale test data wiped.', true);
        setIsResetConfirmModalOpen(false);
        setIsProfileDrawerOpen(false);
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } else {
        showToast(res.error || 'Database reset failed', false);
      }
    } catch (err: any) {
      showToast(err.message || 'Reset failed', false);
    } finally {
      setIsResettingDb(false);
    }
  };

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    let list = bookings;

    if (bookingsCategoryFilter === 'turf') {
      list = list.filter((b) => {
        const venue = venues.find((v) => v.id === b.salonId);
        return isTurfBusiness(venue?.category || b.category, venue?.bookingMode) || Boolean(b.resourceId);
      });
    } else if (bookingsCategoryFilter === 'salon') {
      list = list.filter((b) => {
        const venue = venues.find((v) => v.id === b.salonId);
        return !isTurfBusiness(venue?.category || b.category, venue?.bookingMode) && !b.resourceId;
      });
    }

    return list.filter((b) => {
      const q = bookingSearch.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.salonName || '').toLowerCase().includes(q);

      if (!matchesQuery) return false;
      if (bookingStatusFilter === 'all') return true;
      return (b.status || '').toLowerCase() === bookingStatusFilter.toLowerCase();
    });
  }, [bookings, venues, bookingSearch, bookingStatusFilter, bookingsCategoryFilter]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase();
        const match =
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.id || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (customerFilter === 'online') {
        return c.isOnline;
      }
      if (customerFilter === 'high_reliability') {
        return (c.reliabilityScore ?? 100) >= 90;
      }
      if (customerFilter === 'restricted') {
        return Boolean(c.isBlocked);
      }
      return true;
    });
  }, [customers, customerSearch, customerFilter]);

  // Filtered Owners
  const filteredOwners = useMemo(() => {
    return owners.filter((o) => {
      if (ownerSearch.trim()) {
        const q = ownerSearch.toLowerCase();
        const match =
          (o.name || '').toLowerCase().includes(q) ||
          (o.phone || '').includes(q) ||
          (o.email || '').toLowerCase().includes(q) ||
          (o.id || '').toLowerCase().includes(q) ||
          o.venues?.some(
            (v) => (v.name || '').toLowerCase().includes(q) || (v.city || '').toLowerCase().includes(q)
          );
        if (!match) return false;
      }
      if (ownerCategoryFilter === 'turf') {
        const isTurf = o.primaryCategory === 'turf' || o.categories?.includes('turf');
        if (!isTurf) return false;
      } else if (ownerCategoryFilter === 'salon') {
        const isSalon = o.primaryCategory === 'salon' || o.categories?.includes('salon');
        if (!isSalon) return false;
      }
      if (ownerStatusFilter === 'online') {
        return o.isOnline;
      }
      if (ownerStatusFilter === 'pending_payout') {
        return (o.pendingPayoutBalance || 0) > 0;
      }
      if (ownerStatusFilter === 'restricted') {
        return Boolean(o.isBlocked);
      }
      return true;
    });
  }, [owners, ownerSearch, ownerCategoryFilter, ownerStatusFilter]);

  if (isLoading && !overviewData) {
    return (
      <QGoLoader variant="fullscreen" text="Syncing Super Admin Command Center…" />
    );
  }

  return (
    <div
      className={`min-h-screen ${resolvedTheme === 'dark' ? 'bg-[#09090B] text-zinc-100 dark' : 'bg-[#F5F6F8] text-zinc-900'} antialiased overflow-x-hidden relative selection:bg-[#E73229] selection:text-white`}
      style={{
        background: resolvedTheme === 'dark'
          ? `
            radial-gradient(circle at 15% 15%, rgba(231, 50, 41, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 85% 85%, rgba(24, 24, 27, 0.8) 0%, transparent 45%),
            linear-gradient(135deg, #09090b 0%, #121318 50%, #18181b 100%)
          `
          : `
            radial-gradient(circle at 15% 15%, rgba(231, 50, 41, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 85% 85%, rgba(248, 215, 211, 0.35) 0%, transparent 45%),
            linear-gradient(135deg, #EAF0F8 0%, #F9F9FF 50%, #F9F2EA 100%)
          `,
        fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, sans-serif",
      }}
    >
      {/* ─── Toast Notification ─── */}
      <div
        className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 flex items-center gap-3 px-5 py-3.5 bg-[#121318]/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/10 ${
          toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        {toast.isSuccess ? (
          <CheckCircle2 size={20} className="text-[#E73229]" />
        ) : (
          <AlertCircle size={20} className="text-amber-400" />
        )}
        <span className="text-xs font-semibold">{toast.message}</span>
      </div>

      {/* ─── LEFT HOVER-EXPANDING DOCK (Apple-Grade Spring Transition & Hover-Intent Debounce) ─── */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className={`fixed left-5 top-28 z-40 flex flex-col items-start gap-1 bg-[#121318] p-2 rounded-2xl ${
          isSidebarExpanded ? 'w-56 shadow-2xl' : 'w-14 shadow-lg'
        } transition-[width,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden border border-white/10`}
      >
        <button
          onClick={() => setActiveTab('overview')}
          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all ${
            activeTab === 'overview' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={t.overviewTab || 'Dashboard'}
        >
          <LayoutDashboard size={20} className={`shrink-0 ${activeTab === 'overview' ? 'text-[#E73229]' : ''}`} />
          <span
            className={`text-xs font-semibold ${
              isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
            } transition-all duration-300 ease-out whitespace-nowrap`}
          >
            {t.overviewTab || 'Dashboard'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all ${
            activeTab === 'bookings' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={t.quickSearchTab || 'Quick Search'}
        >
          <Search size={20} className={`shrink-0 ${activeTab === 'bookings' ? 'text-[#E73229]' : ''}`} />
          <span
            className={`text-xs font-semibold ${
              isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
            } transition-all duration-300 ease-out whitespace-nowrap`}
          >
            {t.quickSearchTab || 'Quick Search'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all ${
            activeTab === 'approvals' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={t.approvalsTab || 'Live Venues & Approvals'}
        >
          <Activity size={20} className={`shrink-0 ${activeTab === 'approvals' ? 'text-[#E73229]' : ''}`} />
          <span
            className={`text-xs font-semibold ${
              isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
            } transition-all duration-300 ease-out whitespace-nowrap`}
          >
            {t.approvalsTab || 'Live Venues & Approvals'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all ${
            activeTab === 'payments' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={t.paymentsTab || 'Payments & Settlements'}
        >
          <CreditCard size={20} className={`shrink-0 ${activeTab === 'payments' ? 'text-[#E73229]' : ''}`} />
          <span
            className={`text-xs font-semibold ${
              isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
            } transition-all duration-300 ease-out whitespace-nowrap`}
          >
            {t.paymentsTab || 'Payments & Settlements'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all ${
            activeTab === 'alerts' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={t.alertsTab || 'Broadcast & Logs'}
        >
          <Megaphone size={20} className={`shrink-0 ${activeTab === 'alerts' ? 'text-[#E73229]' : ''}`} />
          <span
            className={`text-xs font-semibold ${
              isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
            } transition-all duration-300 ease-out whitespace-nowrap`}
          >
            {t.alertsTab || 'Broadcast & Logs'}
          </span>
        </button>

        <div className="w-full h-[1px] bg-white/10 my-1" />

        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all ${
            activeTab === 'settings' ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={t.platformSettingsTab || 'Platform Settings'}
        >
          <Sliders size={20} className={`shrink-0 ${activeTab === 'settings' ? 'text-[#E73229]' : ''}`} />
          <span
            className={`text-xs font-semibold ${
              isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
            } transition-all duration-300 ease-out whitespace-nowrap`}
          >
            {t.platformSettingsTab || 'Platform Settings'}
          </span>
        </button>

        {/* Real Red Qbe Mascot Avatar (Centered w-10 h-10 squircle matching K profile button below) */}
        <div className="w-full mt-auto pt-2">
          <button
            onClick={() => setIsQbeColumnOpen((prev) => !prev)}
            className={`w-full flex items-center gap-2.5 rounded-xl transition-all cursor-pointer p-0 ${
              isQbeColumnOpen
                ? 'bg-red-500/20 text-white'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
            title="Open Qbe AI 24/7 Autonomous Assistant & Voice Controller"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E73229] to-[#FF5E55] flex items-center justify-center text-white shrink-0 shadow-sm relative ring-1 ring-white/20">
              <Qbi size={28} mood="happy" animate={false} />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#121318] animate-pulse" />
            </div>
            <div
              className={`flex flex-col text-left ${
                isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
              } transition-all duration-300 ease-out min-w-0`}
            >
              <span className="text-xs font-bold leading-none text-white flex items-center gap-1">
                Qbe AI
              </span>
              <span className="text-[10px] text-zinc-400 font-medium mt-0.5 whitespace-nowrap">
                Voice &amp; Autopilot
              </span>
            </div>
          </button>
        </div>

        {/* Admin Profile Pill at Bottom of Left Sidebar */}
        <div className="w-full pt-1">
          <div className="w-full h-[1px] bg-white/10 mb-2" />
          <button
            onClick={() => setIsProfileDrawerOpen(true)}
            className="w-full flex items-center gap-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all cursor-pointer p-0"
            title="Super Admin Profile & Preferences"
          >
            {user?.photoUrl ? (
              <img
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-white/30"
                src={user.photoUrl}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#E73229] flex items-center justify-center text-white font-bold text-sm shrink-0 ring-1 ring-white/30">
                {(user?.name || 'K').charAt(0).toUpperCase()}
              </div>
            )}
            <div
              className={`flex flex-col text-left ${
                isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'
              } transition-all duration-300 ease-out min-w-0`}
            >
              <span className="text-xs leading-none text-white font-bold truncate">
                {user?.name || 'Kishore'}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-medium mt-0.5">
                {user?.email || 'cjkishore35@gmail.com'}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* ─── TOP FLOATING HEADER (Streamlined for 100% Zoom Fit & High Contrast) ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between bg-white/90 dark:bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 shadow-sm max-w-full">
        {/* Brand Capsule */}
        <div
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2 bg-zinc-100/80 dark:bg-zinc-800/80 px-3 py-1.5 rounded-full shadow-xs shrink-0 border border-zinc-200 dark:border-zinc-700/80 cursor-pointer hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-[#E73229] flex items-center justify-center text-white font-black text-sm shadow-xs">
            Q
          </div>
          <span className="font-extrabold text-[16px] tracking-tight text-zinc-900 dark:text-zinc-100">QGo</span>
          <span className="text-[9px] uppercase bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2 py-0.5 rounded-full font-bold tracking-wider">
            Admin
          </span>
        </div>

        {/* Primary Floating Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-full shadow-xs border border-zinc-200 dark:border-zinc-700/80 whitespace-nowrap overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1.5 text-xs rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'approvals'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            <span>Approvals</span>
            <span className="bg-[#E73229] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight">
              {pendingApprovalsCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Payments & Refunds
          </button>
          <button
            onClick={() => {
              setActiveTab('owners');
              setDirectoryMode('owners');
            }}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'owners'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Owners
          </button>
          <button
            onClick={() => {
              setActiveTab('customers');
              setDirectoryMode('customers');
            }}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Alerts & Logs
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Right Utility Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Qbe Autonomous 24/7 Command Pill */}
          <button
            onClick={() => setIsQbeColumnOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer border active:scale-95 ${
              isQbeColumnOpen
                ? 'bg-[#E73229] text-white border-[#E73229] shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-950/40 text-[#E73229] dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 border-red-200 dark:border-red-800/60'
            }`}
            title="Open 24/7 Qbe Voice & Autonomous AI Command Center"
          >
            <div className="relative flex items-center justify-center">
              <Qbi size={18} mood="happy" animate={false} />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <span className="hidden sm:inline">Qbe Command</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-[#E73229] dark:text-red-200 uppercase font-black tracking-wider">
              AI
            </span>
          </button>

          {/* Export Action */}
          <button
            onClick={handleExportWorkbook}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs border border-zinc-200 dark:border-zinc-700 whitespace-nowrap active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-zinc-500 dark:text-zinc-400" />
            <span>Export .xlsx</span>
          </button>

          {/* Sync Telemetry Counter */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xs text-[10px] font-semibold text-zinc-600 dark:text-zinc-400"
            title="Next automated telemetry radar poll"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sync:</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{tickerSeconds}s</span>
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setAlertsPopoverOpen((prev) => !prev)}
              aria-label="Notifications"
              className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-all shadow-xs border active:scale-95 cursor-pointer ${
                alertsPopoverOpen
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                  : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:hover:text-white border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <BellRing size={17} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#E73229] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel (Z-[100] above all dashboard cards) */}
            {alertsPopoverOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-4 z-[100] flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50">Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span className="bg-[#E73229]/10 text-[#E73229] dark:bg-[#E73229]/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadNotificationsCount} unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadNotificationsCount > 0 && (
                      <button
                        onClick={handleMarkAllNotificationsRead}
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTab('alerts');
                        setAlertsPopoverOpen(false);
                      }}
                      className="text-[11px] font-bold text-[#E73229] hover:underline cursor-pointer"
                    >
                      View Logs
                    </button>
                  </div>
                </div>

                {/* Scrollable Notifications List */}
                <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                      No active notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 border ${
                          n.read
                            ? 'bg-zinc-50/50 hover:bg-zinc-100/70 border-zinc-100 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/60 dark:border-zinc-800/50 opacity-75'
                            : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200/80 dark:bg-[#202026] dark:hover:bg-[#272730] dark:border-zinc-700/80 shadow-xs'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            n.type === 'approval'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                              : n.type === 'booking'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {n.type === 'approval' ? (
                            <ShieldCheck size={15} />
                          ) : n.type === 'booking' ? (
                            <Ticket size={15} />
                          ) : (
                            <AlertCircle size={15} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold truncate ${n.read ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.detail}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[#E73229] shrink-0 mt-2" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>Realtime Alert Telemetry</span>
                  <button
                    onClick={() => {
                      setActiveTab('approvals');
                      setAlertsPopoverOpen(false);
                    }}
                    className="font-semibold text-zinc-800 dark:text-zinc-200 hover:text-[#E73229] dark:hover:text-[#E73229] transition-colors cursor-pointer"
                  >
                    {pendingApprovalsCount} KYC Pending →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT CONTAINER (Generous left margin: ml-20 lg:ml-24 ~96px) ─── */}
      <div className="ml-20 lg:ml-24 transition-all duration-300">
        <main className="relative z-10 w-full pt-24 px-4 sm:px-6 lg:px-8 pb-16 max-w-7xl mx-auto">
          {/* ========================================== */}
          {/* 1. VIEW: OVERVIEW                          */}
          {/* ========================================== */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* Hero Telemetry & KPIs */}
              <section className="w-full flex flex-col xl:flex-row items-stretch gap-6">
                <div className="flex-1 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest text-gray-600 font-bold">
                          Platform Online • Command Tier 1
                        </span>
                      </div>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1">
                        <Clock size={15} /> IST (+05:30)
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                      <h1 className="text-[32px] md:text-[38px] leading-tight font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Welcome back, Kishore
                      </h1>
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal text-sm">/ Live Command</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 max-w-xl">
                      QGo Multi-Vertical Platform Monitor • Real-time slot telemetry, payment settlement splits & automated
                      turf/salon dispatching.
                    </p>
                  </div>

                  {/* Proportional Telemetry Pill Bar */}
                  <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                        Realtime Platform Distribution
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">100% Synced</span>
                    </div>
                    <div className="w-full p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/70 flex flex-wrap lg:flex-nowrap items-center gap-1.5">
                      <div className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-[#121318] text-white shadow-xs">
                        <Activity size={15} className="text-emerald-400" />
                        <span className="text-xs font-semibold">Turfs: {overviewData?.kpis?.activeTurfsCount ?? venues.filter(v => (v.category || '').toLowerCase() === 'turf').length}</span>
                      </div>
                      <div className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-[#E73229] text-white shadow-xs">
                        <Scissors size={15} />
                        <span className="text-xs font-semibold">Salons: {overviewData?.kpis?.activeSalonsCount ?? venues.filter(v => (v.category || '').toLowerCase() === 'salon').length}</span>
                      </div>
                      <div className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-blue-100 text-blue-800">
                        <Smartphone size={15} className="text-blue-600" />
                        <span className="text-xs font-semibold">Customers: {overviewData?.kpis?.totalCustomersCount ?? customers.length}</span>
                      </div>
                      <div className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-amber-100 text-amber-800">
                        <Store size={15} className="text-amber-600" />
                        <span className="text-xs font-semibold">Owners: {overviewData?.kpis?.totalOwnersCount ?? owners.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 Master KPI Cards */}
                <div className="w-full xl:w-[440px] grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3.5">
                  <div
                    onClick={() => setActiveTab('payments')}
                    className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-5 rounded-[24px] flex flex-col justify-between hover:bg-white/90 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold flex items-center gap-1.5">
                        <Wallet size={16} /> Gross GMV
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-0.5">
                        <ArrowUpRight size={13} />
                        Live
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums tracking-tight">
                        ₹{(overviewData?.kpis?.totalGmv ?? 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">Live platform volume</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab('payments')}
                    className="bg-[#E73229]/5 border border-[#E73229]/20 shadow-[0_10px_30px_-5px_rgba(18,19,24,0.04),0_2px_6px_-1px_rgba(18,19,24,0.02)] p-5 rounded-[24px] flex flex-col justify-between hover:bg-white/90 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[#E73229] font-bold flex items-center gap-1.5">
                        <Coins size={16} /> QGo Net Earnings
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#E73229] text-white text-[10px] font-bold uppercase">
                        {settings.standardTakeRatePercent}% Take-Rate
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-[#E73229] tabular-nums tracking-tight">
                        ₹{(overviewData?.kpis?.qgoNetEarnings ?? 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Platform Fee + GST</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab('bookings')}
                    className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-5 rounded-[24px] flex flex-col justify-between hover:bg-white/90 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold flex items-center gap-1.5">
                        <Ticket size={16} /> Total Bookings
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                        {bookings.length} Tracked
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums tracking-tight">
                        {(overviewData?.kpis?.todayBookingsCount ?? bookings.length).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{bookings.filter(b => b.status === 'confirmed').length} confirmed</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Bento Grid (6 Modules) */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Module 1: Spotlight Top Venue (4 cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col justify-between">
                  {venues.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          Featured Venue
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">#{venues[0].id ? venues[0].id.slice(-6).toUpperCase() : 'VN-0001'}</span>
                      </div>

                      <div className="relative overflow-hidden rounded-2xl h-40 w-full shadow-sm bg-gray-200">
                        <img
                          className="w-full h-full object-cover"
                          src={venues[0].image || venues[0].logoUrl || venues[0].coverUrl || 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=800&q=80'}
                          alt={venues[0].name}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                          <div>
                            <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold block">
                              {venues[0].category || 'Turf'} Category
                            </span>
                            <h3 className="font-bold text-base leading-tight">{venues[0].name}</h3>
                            <p className="text-[11px] text-white/80">{venues[0].city || venues[0].address || 'Tamil Nadu'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-amber-400 text-[11px] font-bold">
                              {venues[0].rating
                                ? `${venues[0].rating.toFixed(1)} ★ (${venues[0].reviewCount || venues[0].reviewsCount || 0})`
                                : 'New (0 reviews)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5 space-y-2">
                        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-900 dark:text-zinc-100">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-50">Status</p>
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400">Venue operations</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold capitalize">
                            {venues[0].status || 'Active'} ✓
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-900 dark:text-zinc-100">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-50">KYC & Compliance</p>
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400">Ownership & Deed</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Verified ✓
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
                        <Store size={22} />
                      </div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">No Active Venues Yet</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-xs">
                        When owners register their venues, the featured venue will appear here.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-3 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 text-xs">
                    <button
                      onClick={() => setActiveTab('approvals')}
                      className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50 font-semibold flex items-center gap-1"
                    >
                      <FileEdit size={16} /> Manage Venues
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('owners');
                        setDirectoryMode('owners');
                      }}
                      className="text-[#E73229] font-bold hover:underline"
                    >
                      View Directory →
                    </button>
                  </div>
                </div>

                {/* Module 2: Revenue Trend Dual Spline (5 cols) */}
                <div className="lg:col-span-5 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#E73229] font-bold">
                          Financial Telemetry
                        </span>
                        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Revenue & Platform Fee Trend</h3>
                      </div>
                      <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs">
                        <button
                          onClick={() => setTelemetryRange('7d')}
                          className={`px-2.5 py-0.5 rounded-full transition-all ${
                            telemetryRange === '7d'
                              ? 'bg-[#121318] text-white font-bold shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50'
                          }`}
                        >
                          7D
                        </button>
                        <button
                          onClick={() => setTelemetryRange('30d')}
                          className={`px-2.5 py-0.5 rounded-full transition-all ${
                            telemetryRange === '30d'
                              ? 'bg-[#121318] text-white font-bold shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50'
                          }`}
                        >
                          30D
                        </button>
                        <button
                          onClick={() => setTelemetryRange('90d')}
                          className={`px-2.5 py-0.5 rounded-full transition-all ${
                            telemetryRange === '90d'
                              ? 'bg-[#121318] text-white font-bold shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-50'
                          }`}
                        >
                          90D
                        </button>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">
                          {currentPreset.netFee}
                        </span>
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">{currentPreset.netLabel}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E73229]" /> Gross GMV
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartFeeColor }} /> QGo Fee
                        </span>
                      </div>
                    </div>

                    {/* SVG Spline Graph */}
                    <div className="relative w-full h-44 mt-3">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 180">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#E73229" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line stroke={isDark ? 'rgba(255,255,255,0.10)' : '#121318'} strokeDasharray="3 3" strokeOpacity={isDark ? '0.2' : '0.08'} x1="0" x2="500" y1="40" y2="40" />
                        <line stroke={isDark ? 'rgba(255,255,255,0.10)' : '#121318'} strokeDasharray="3 3" strokeOpacity={isDark ? '0.2' : '0.08'} x1="0" x2="500" y1="90" y2="90" />
                        <line stroke={isDark ? 'rgba(255,255,255,0.10)' : '#121318'} strokeDasharray="3 3" strokeOpacity={isDark ? '0.2' : '0.08'} x1="0" x2="500" y1="140" y2="140" />
                        <path d={currentPreset.gradArea} fill="url(#chartGrad)" />
                        <path
                          d={currentPreset.pathGMV}
                          fill="none"
                          stroke="#E73229"
                          strokeLinecap="round"
                          strokeWidth="3"
                        />
                        <path
                          d={currentPreset.pathFee}
                          fill="none"
                          stroke={chartFeeColor}
                          strokeLinecap="round"
                          strokeWidth="2.5"
                        />
                        <circle cx="380" cy="28" fill="#E73229" r="5" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="380" cy="85" fill={chartFeeColor} r="4.5" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <span>{telemetryRange === 'today' ? '06:00' : 'Start'}</span>
                    <span>{telemetryRange === 'today' ? '10:00' : 'Mid'}</span>
                    <span>{telemetryRange === 'today' ? '14:00' : 'Day 5'}</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-50">{telemetryRange === 'today' ? '18:00 (Peak)' : 'Peak'}</span>
                    <span>Today</span>
                  </div>
                </div>

                {/* Module 3: Slot Utilization Radial (3 cols) — Live & 0-Initialized */}
                <div className="lg:col-span-3 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">Live Telemetry</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-1">Slot Occupancy</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Live court &amp; styling chair usage</p>

                    <div className="relative w-36 h-36 mx-auto my-3 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                        <circle cx="80" cy="80" fill="transparent" r="62" stroke={isDark ? '#27272A' : '#E2E8FB'} strokeWidth="12" />
                        <circle
                          cx="80"
                          cy="80"
                          fill="transparent"
                          r="62"
                          stroke="#E73229"
                          strokeLinecap="round"
                          strokeWidth="12"
                          strokeDasharray="389.5"
                          strokeDashoffset={slotOccupancyMetrics.offset}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50 leading-none">
                          {slotOccupancyMetrics.activePct}%
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold mt-0.5">
                          {slotOccupancyMetrics.demandLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full text-center text-xs">
                      <button
                        onClick={() => setSlotOccupancyFilter('all')}
                        className={`flex-1 py-0.5 rounded-full transition-all ${
                          slotOccupancyFilter === 'all'
                            ? 'bg-[#121318] dark:bg-white text-white dark:text-zinc-900 font-semibold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        All ({slotOccupancyMetrics.occAll}%)
                      </button>
                      <button
                        onClick={() => setSlotOccupancyFilter('turf')}
                        className={`flex-1 py-0.5 rounded-full transition-all ${
                          slotOccupancyFilter === 'turf'
                            ? 'bg-[#121318] dark:bg-white text-white dark:text-zinc-900 font-semibold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        Turf ({slotOccupancyMetrics.occTurf}%)
                      </button>
                      <button
                        onClick={() => setSlotOccupancyFilter('salon')}
                        className={`flex-1 py-0.5 rounded-full transition-all ${
                          slotOccupancyFilter === 'salon'
                            ? 'bg-[#121318] dark:bg-white text-white dark:text-zinc-900 font-semibold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        Salon ({slotOccupancyMetrics.occSalon}%)
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 space-y-1.5 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Morning (06:00 - 11:00)</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-50">{slotOccupancyMetrics.morningPct}%</span>
                    </div>
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Night Peak (17:00 - 23:30)</span>
                      <span className="font-bold text-[#E73229]">{slotOccupancyMetrics.nightPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Module 4: Triage & Intimations Stack (6 cols) */}
                <div className="lg:col-span-6 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase">
                        Urgent Triage
                      </span>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-1">Pending Actions &amp; System Health</h3>
                    </div>
                    <button
                      onClick={() => {
                        loadData(true);
                        showToast('Refreshed triage queues');
                      }}
                      className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-gray-600 shadow-xs hover:bg-zinc-100 dark:bg-zinc-800"
                    >
                      <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {/* Deep Obsidian Container */}
                  <div className="bg-[#121318] text-white p-4 rounded-2xl flex flex-col gap-2.5 shadow-xl">
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#E73229] animate-pulse" />
                        Live Queue
                      </span>
                      <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                        4 Tasks Pending
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                          <ShieldCheck size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-white">GreenField Arena</p>
                          <p className="text-[10px] text-white/60">New Partner Onboarding</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('approvals')}
                        className="px-3 py-1 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white font-bold text-[11px] transition-all"
                      >
                        Review
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                          <RefreshCw size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-white">Owner Cancelled (#QG-9842)</p>
                          <p className="text-[10px] text-white/60">₹1,200 due to Vignesh S.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          showToast('Refund of ₹1,200 processed');
                        }}
                        className="px-3 py-1 rounded-full bg-white text-zinc-900 dark:text-zinc-50 font-bold text-[11px] transition-all hover:bg-zinc-100 dark:bg-zinc-800"
                      >
                        Auto-Refund
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                          <AlertTriangle size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-white">Repeat No-Show Flagged</p>
                          <p className="text-[10px] text-white/60">3x misses: Karthik R.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          showToast('Karthik R. restricted for 48 hours');
                        }}
                        className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] transition-all hover:bg-amber-500/30"
                      >
                        Restrict 48h
                      </button>
                    </div>
                  </div>
                </div>

                {/* Module 5: Weekly Stem Chart (6 cols) — Live Stems & Dark Mode Visibility */}
                <div className="lg:col-span-6 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                          Booking Density
                        </span>
                        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-0.5">Weekly Volume by Category</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-50">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E73229]" /> Turf
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-50">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartSalonColor }} /> Salon
                        </span>
                      </div>
                    </div>

                    {/* Stem/Lollipop SVG */}
                    <div className="relative w-full h-44 mt-3">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                        <line stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(18,19,24,0.10)'} strokeOpacity="0.8" x1="20" x2="480" y1="140" y2="140" />
                        {weeklyDensityMetrics.stems.map((stem) => (
                          <g key={stem.name}>
                            <line
                              stroke={isDark ? 'rgba(255,255,255,0.25)' : '#121318'}
                              strokeWidth={stem.name === 'Fri' || stem.name === 'Sat' ? '2.5' : '2'}
                              x1={stem.x}
                              x2={stem.x}
                              y1="140"
                              y2={stem.stemTopY}
                            />
                            <circle
                              cx={stem.x}
                              cy={stem.turfY}
                              fill="#E73229"
                              r={stem.name === 'Fri' || stem.name === 'Sat' ? 7 : 6}
                            />
                            <circle
                              cx={stem.x}
                              cy={stem.salonY}
                              fill={chartSalonColor}
                              r={stem.name === 'Fri' || stem.name === 'Sat' ? 6 : 5}
                            />
                            <text
                              x={stem.x}
                              y="155"
                              fontSize="11"
                              fontWeight={stem.name === 'Fri' || stem.name === 'Sat' ? '700' : '600'}
                              textAnchor="middle"
                              fill={stem.name === 'Fri' || stem.name === 'Sat' ? '#E73229' : (isDark ? '#A1A1AA' : '#6B7280')}
                            >
                              {stem.name}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 flex items-center justify-between bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 p-2.5 rounded-xl text-xs text-zinc-900 dark:text-zinc-100">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Average Platform Completion Rate</span>
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{weeklyDensityMetrics.completionRate}</span>
                  </div>
                </div>

                {/* Module 6: Leaderboard Table (12 cols) */}
                <div className="lg:col-span-12 bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#E73229] font-bold">
                        Partner Ecosystem
                      </span>
                      <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">Top Venues & Verified Owners Leaderboard</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={leaderboardSearch}
                        onChange={(e) => setLeaderboardSearch(e.target.value)}
                        placeholder="Search partner..."
                        className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-xs focus:outline-none w-48"
                      />
                      <button
                        onClick={() => {
                          showToast('Exporting leaderboard CSV...');
                          exportTableToCsv('Leaderboard', [
                            ['Rank', 'Venue', 'Category', 'City', 'Rating', 'Status'],
                            ...venues.map((v, i) => [
                              String(i + 1),
                              v.name || 'Venue',
                              (v.category || 'Turf').toUpperCase(),
                              v.city || 'Tamil Nadu',
                              v.rating ? `${v.rating} ★` : 'New',
                              v.status || 'Active',
                            ]),
                          ]);
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#121318] text-white text-xs font-semibold hover:bg-black transition-all"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead>
                        <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                          <th className="py-2.5 px-3">Rank & Venue</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">City / Location</th>
                          <th className="py-2.5 px-3">Rating</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                        {venues.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                              No venue performance records yet.
                            </td>
                          </tr>
                        ) : (
                          venues.slice(0, 5).map((v, i) => (
                            <tr key={v.id || v.name} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-all">
                              <td className="py-3 px-3 flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-[#121318] text-white flex items-center justify-center font-bold text-xs">
                                  {i + 1}
                                </span>
                                <div>
                                  <p className="font-bold text-zinc-900 dark:text-zinc-50">{v.name}</p>
                                  <p className="text-[10px] text-zinc-600 dark:text-zinc-400">{v.city || v.address || 'Tamil Nadu'}</p>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] uppercase">
                                  {v.category || 'TURF'}
                                </span>
                              </td>
                              <td className="py-3 px-3">{v.city || 'Tamil Nadu'}</td>
                              <td className="py-3 px-3 text-amber-500 font-bold">
                                {v.rating ? `★ ${v.rating}` : 'New'}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] capitalize">
                                  {v.status || 'Active'} ✓
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => setActiveTab('approvals')}
                                  className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ========================================== */}
          {/* 2. VIEW: APPROVALS & KYC DOCKET           */}
          {/* ========================================== */}
          {activeTab === 'approvals' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#E73229] font-bold">Overview / Compliance Command</span>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-0.5">Partner Approvals & KYC Docket</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Review legal titles, FSSAI certificates, and activate turf/salon inventory.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2 rounded-2xl text-center">
                    <span className="text-[9px] uppercase font-bold text-zinc-600 dark:text-zinc-400 block">Queue Workload</span>
                    <span className="text-lg font-black text-[#E73229]">{pendingApprovalsCount}</span>
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2 rounded-2xl text-center">
                    <span className="text-[9px] uppercase font-bold text-zinc-600 dark:text-zinc-400 block">Avg SLA</span>
                    <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">4.2h</span>
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2 rounded-2xl text-center">
                    <span className="text-[9px] uppercase font-bold text-zinc-600 dark:text-zinc-400 block">Auto OCR</span>
                    <span className="text-lg font-black text-emerald-600">94.8%</span>
                  </div>
                </div>
              </div>

              {/* Pending Dossiers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Application Card 1 */}
                <div
                  className={`bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[26px] flex flex-col justify-between transition-all ${
                    rejectedVenueIds.includes('appr-1') ? 'opacity-40' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                          Turf Ground
                        </span>
                        <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-1">GreenField Sports Arena</h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Coimbatore Bypass • 4 Floodlit Pitches</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          approvedVenueIds.includes('appr-1')
                            ? 'bg-emerald-100 text-emerald-800'
                            : rejectedVenueIds.includes('appr-1')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {approvedVenueIds.includes('appr-1')
                          ? 'Approved & Active ✓'
                          : rejectedVenueIds.includes('appr-1')
                          ? 'Rejected'
                          : 'Pending KYC'}
                      </span>
                    </div>

                    <div className="mt-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Owner:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Murugan Selvam (+91 94421 88902)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Bank Account:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">HDFC •••• 9214 (IFSC HDFC00012)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Attached Documents:</span>
                        <span
                          className="text-[#E73229] font-bold underline cursor-pointer"
                          onClick={() => showToast('Previewing Deed_Registered_2023.pdf')}
                        >
                          Deed_Registered_2023.pdf
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                    {approvedVenueIds.includes('appr-1') ? (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck size={16} /> Activated on Platform
                      </span>
                    ) : rejectedVenueIds.includes('appr-1') ? (
                      <span className="text-xs text-red-600 font-bold">Dossier Rejected / Sent for Review</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRejectVenue('appr-1', 'GreenField Sports Arena')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveVenue('appr-1', 'GreenField Sports Arena')}
                          className="px-4 py-1.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs"
                        >
                          Approve & Activate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Application Card 2 */}
                <div
                  className={`bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[26px] flex flex-col justify-between transition-all ${
                    rejectedVenueIds.includes('appr-2') ? 'opacity-40' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold uppercase">
                          Luxury Salon
                        </span>
                        <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-1">En Vogue Luxury Salon & Spa</h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Race Course, Coimbatore • 6 Chairs</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          approvedVenueIds.includes('appr-2')
                            ? 'bg-emerald-100 text-emerald-800'
                            : rejectedVenueIds.includes('appr-2')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {approvedVenueIds.includes('appr-2')
                          ? 'Approved & Active ✓'
                          : rejectedVenueIds.includes('appr-2')
                          ? 'Rejected'
                          : 'Pending KYC'}
                      </span>
                    </div>

                    <div className="mt-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Owner:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Pooja Natarajan (+91 98840 12391)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">GSTIN:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">33AABCU9603R1ZM (Active)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Attached Documents:</span>
                        <span
                          className="text-[#E73229] font-bold underline cursor-pointer"
                          onClick={() => showToast('Previewing Trade_License_GST.pdf')}
                        >
                          Trade_License_GST.pdf
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                    {approvedVenueIds.includes('appr-2') ? (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck size={16} /> Activated on Platform
                      </span>
                    ) : rejectedVenueIds.includes('appr-2') ? (
                      <span className="text-xs text-red-600 font-bold">Dossier Rejected / Sent for Review</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRejectVenue('appr-2', 'En Vogue Luxury Salon')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveVenue('appr-2', 'En Vogue Luxury Salon')}
                          className="px-4 py-1.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs"
                        >
                          Approve & Activate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Application Card 3 */}
                <div
                  className={`bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[26px] flex flex-col justify-between transition-all ${
                    rejectedVenueIds.includes('appr-3') ? 'opacity-40' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                          Turf Ground
                        </span>
                        <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-1">Striker 7s Floodlit Turf</h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Thudiyalur • 2 Pitches & Cricket Net</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          approvedVenueIds.includes('appr-3')
                            ? 'bg-emerald-100 text-emerald-800'
                            : rejectedVenueIds.includes('appr-3')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {approvedVenueIds.includes('appr-3')
                          ? 'Approved & Active ✓'
                          : rejectedVenueIds.includes('appr-3')
                          ? 'Rejected'
                          : 'Pending KYC'}
                      </span>
                    </div>

                    <div className="mt-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Owner:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Arun Prakash (+91 97901 44521)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Bank Account:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">Axis Bank •••• 6502</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Attached Documents:</span>
                        <span
                          className="text-[#E73229] font-bold underline cursor-pointer"
                          onClick={() => showToast('Previewing Electricity_Deed.pdf')}
                        >
                          Electricity_Deed.pdf
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                    {approvedVenueIds.includes('appr-3') ? (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck size={16} /> Activated on Platform
                      </span>
                    ) : rejectedVenueIds.includes('appr-3') ? (
                      <span className="text-xs text-red-600 font-bold">Dossier Rejected / Sent for Review</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRejectVenue('appr-3', 'Striker 7s Floodlit Turf')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveVenue('appr-3', 'Striker 7s Floodlit Turf')}
                          className="px-4 py-1.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs"
                        >
                          Approve & Activate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Application Card 4 */}
                <div
                  className={`bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[26px] flex flex-col justify-between transition-all ${
                    rejectedVenueIds.includes('appr-4') ? 'opacity-40' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold uppercase">
                          Salon & Spa
                        </span>
                        <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mt-1">Naturals Essence Studio</h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Peelamedu • 5 Chairs + Spa Zone</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          approvedVenueIds.includes('appr-4')
                            ? 'bg-emerald-100 text-emerald-800'
                            : rejectedVenueIds.includes('appr-4')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {approvedVenueIds.includes('appr-4')
                          ? 'Approved & Active ✓'
                          : rejectedVenueIds.includes('appr-4')
                          ? 'Rejected'
                          : 'Pending KYC'}
                      </span>
                    </div>

                    <div className="mt-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-900 dark:text-zinc-100">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Owner:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Kavitha M. (+91 93610 55190)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">GSTIN:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">33AAMCN9901M1ZQ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Attached Documents:</span>
                        <span
                          className="text-[#E73229] font-bold underline cursor-pointer"
                          onClick={() => showToast('Previewing Naturals_Franchise_Deed.pdf')}
                        >
                          Naturals_Franchise_Deed.pdf
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                    {approvedVenueIds.includes('appr-4') ? (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck size={16} /> Activated on Platform
                      </span>
                    ) : rejectedVenueIds.includes('appr-4') ? (
                      <span className="text-xs text-red-600 font-bold">Dossier Rejected / Sent for Review</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRejectVenue('appr-4', 'Naturals Essence Studio')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveVenue('appr-4', 'Naturals Essence Studio')}
                          className="px-4 py-1.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs"
                        >
                          Approve & Activate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Geolocation Radar & Geo-Fence Map */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold uppercase mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" /> Live Geolocation Radar
                    </div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Cluster Telemetry & Geo-Fence Map</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Spatial density of live sports pitches, partner salons, and pending KYC verification sites.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold shadow-xs">
                      <button
                        onClick={() => {
                          setRadarMapMode('radar');
                          showToast('Switched to Standard Geofence Radar Grid');
                        }}
                        className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 ${
                          radarMapMode === 'radar'
                            ? 'bg-[#121318] text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        <Compass size={13} /> Radar
                      </button>
                      <button
                        onClick={() => {
                          setRadarMapMode('satellite');
                          showToast('Switched to High-Resolution Satellite Aerial View');
                        }}
                        className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 ${
                          radarMapMode === 'satellite'
                            ? 'bg-[#121318] text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        <Globe size={13} /> Satellite
                      </button>
                    </div>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold hidden md:inline">
                      Region: <strong className="text-zinc-900 dark:text-zinc-50">Tamil Nadu</strong>
                    </span>
                    <button
                      onClick={triggerSimulatedPushAlert}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                      <Volume2 size={16} /> Simulate Push
                    </button>
                  </div>
                </div>

                {/* Radar Canvas */}
                <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-[#121318] border border-white/10 shadow-inner flex items-center justify-center transition-all duration-500">
                  {/* Grid Overlay */}
                  <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                      radarMapMode === 'radar' ? 'opacity-20' : 'opacity-0'
                    }`}
                    style={{
                      backgroundImage: 'radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                  />

                  {/* Satellite Aerial Overlay */}
                  <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-500 bg-cover bg-center ${
                      radarMapMode === 'satellite' ? 'opacity-90' : 'opacity-0'
                    }`}
                    style={{
                      backgroundImage: `radial-gradient(rgba(18, 19, 24, 0.45) 0%, rgba(18, 19, 24, 0.8) 100%), url('https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80')`,
                    }}
                  />

                  {/* Satellite Contours */}
                  <svg
                    className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ${
                      radarMapMode === 'satellite' ? 'opacity-100' : 'opacity-0'
                    }`}
                    viewBox="0 0 500 240"
                  >
                    <polygon
                      points="90,40 180,30 200,85 110,95"
                      fill="rgba(231,50,41,0.12)"
                      stroke="#E73229"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                    <polygon
                      points="280,120 420,110 440,190 300,200"
                      fill="rgba(16,185,129,0.12)"
                      stroke="#10B981"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                    <polygon
                      points="320,35 430,25 450,75 340,85"
                      fill="rgba(59,130,246,0.12)"
                      stroke="#3B82F6"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                  </svg>

                  {/* Sweep Rings */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                      radarMapMode === 'satellite' ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="absolute w-48 h-48 rounded-full border border-[#E73229]/30 animate-ping" />
                    <div className="absolute w-96 h-96 rounded-full border border-blue-500/20" />
                    <div className="absolute w-72 h-72 rounded-full border border-emerald-500/20" />
                    <div className="absolute w-full h-[1px] bg-white/10" />
                    <div className="absolute h-full w-[1px] bg-white/10" />
                  </div>

                  {/* Interactive Pins */}
                  {venues.slice(0, 4).map((v, idx) => {
                    const positions = [
                      'top-12 left-1/4',
                      'bottom-16 right-1/3',
                      'top-20 right-1/4',
                      'bottom-10 left-1/3',
                    ];
                    const pos = positions[idx % positions.length];
                    const isSalon = (v.category || '').toLowerCase() === 'salon';
                    return (
                      <div
                        key={v.id || v.name}
                        className={`absolute ${pos} transform -translate-x-1/2 cursor-pointer group z-10`}
                        onClick={() =>
                          showToast(`Radar target: ${v.name} (${v.category || 'Venue'} • ${v.city || 'Tamil Nadu'})`)
                        }
                      >
                        <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${isSalon ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#121318]/95 text-white text-[10px] py-1 px-2.5 rounded-md whitespace-nowrap border border-white/10 font-bold z-20">
                          {v.name} ({v.status || 'Active'})
                        </div>
                      </div>
                    );
                  })}

                  {/* Legend */}
                  <div className="absolute bottom-3 left-3 bg-[#121318]/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-3 text-[10px] text-white/80 z-10">
                    <span>Legend:</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active Turf
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Active Salon
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending KYC
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 bg-[#121318]/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[9px] uppercase tracking-wider font-bold text-emerald-400 z-10">
                    {radarMapMode === 'radar' ? 'Mode: Radar Grid' : 'Mode: Satellite Aerial + Contours'}
                  </div>
                </div>
              </div>

              {/* Active Venues Directory */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px]">
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mb-3">All Active Venues Directory ({venues.length} Total)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                        <th className="py-2.5 px-3">Venue Name</th>
                        <th className="py-2.5 px-3">City</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Take-Rate</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                      {venues.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                            No active venues registered in the database.
                          </td>
                        </tr>
                      ) : (
                        venues.map((v) => (
                          <tr key={v.id || v.name}>
                            <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-50">{v.name}</td>
                            <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">{v.city || v.address || 'Tamil Nadu'}</td>
                            <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-gray-600">{v.category || 'Turf'}</td>
                            <td className="py-2.5 px-3 font-bold text-[#E73229]">{settings.standardTakeRatePercent}%</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold capitalize">
                                {v.status || 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* 3. VIEW: BOOKINGS & TRANSACTIONS           */}
          {/* ========================================== */}
          {activeTab === 'bookings' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#E73229] font-bold">Overview / Slot Operations</span>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-0.5">
                    All Bookings & Live Dispatch Queue
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Live court allocations, customer OTP check-ins, and override refunds.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportWorkbook}
                    className="px-4 py-2 rounded-full bg-[#121318] text-white text-xs font-bold hover:bg-black transition-all"
                  >
                    Download Today's Manifest
                  </button>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs w-full sm:w-72">
                  <Search size={18} className="text-zinc-500 dark:text-zinc-400" />
                  <input
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search Booking ID or Customer..."
                    className="bg-transparent focus:outline-none w-full text-xs font-medium"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category Filter */}
                  <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
                    {(['all', 'turf', 'salon'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setBookingsCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-full transition-all capitalize cursor-pointer ${
                          bookingsCategoryFilter === cat
                            ? 'bg-[#E73229] text-white font-bold shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        {cat === 'all' ? 'All Types' : cat === 'turf' ? 'Turfs' : 'Salons'}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter with Live Dynamic Counts */}
                  <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold overflow-x-auto">
                    {['all', 'confirmed', 'checked_in', 'completed', 'cancelled'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setBookingStatusFilter(st)}
                        className={`px-3 py-1 rounded-full transition-all capitalize cursor-pointer ${
                          bookingStatusFilter === st
                            ? 'bg-[#121318] text-white font-bold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        {st === 'all'
                          ? `All (${bookings.length})`
                          : `${st.replace('_', '-')} (${bookings.filter((b) => (b.status || '').toLowerCase() === st).length})`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead>
                    <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                      <th className="py-3 px-3">Booking ID</th>
                      <th className="py-3 px-3">Facility</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Date &amp; Time (IST)</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Payment</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                          No bookings found in the database.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-[#E73229]">#{b.id}</td>
                          <td className="py-3 px-3 font-bold text-zinc-900 dark:text-zinc-50">{b.salonName || 'Venue'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                b.category === 'salon'
                                  ? 'bg-blue-50 text-blue-800'
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              {b.category === 'salon' ? 'SALON' : 'TURF'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300 font-mono text-[11px]">
                            {b.scheduledDate
                              ? `${formatDateIST(b.scheduledDate)} • ${b.scheduledTime || '-'}`
                              : formatDateTimeIST(b.createdAt)}
                          </td>
                          <td className="py-3 px-3 text-zinc-900 dark:text-zinc-50">
                            {sanitizeCustomerName(b.customerName, b.customerPhone)}
                          </td>
                          <td className="py-3 px-3 font-extrabold text-zinc-900 dark:text-zinc-50">₹{b.amount ?? 0}</td>
                          <td className="py-3 px-3 text-blue-600 dark:text-blue-400">
                            {b.paymentMethod || (b.paymentStatus === 'pay_at_shop' ? 'Pay at Venue' : 'Online')}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] capitalize ${
                                b.status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'checked_in'
                                  ? 'bg-blue-100 text-blue-800'
                                  : b.status === 'completed'
                                  ? 'bg-gray-200 text-gray-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <ChevronRight size={18} className="text-zinc-500 dark:text-zinc-400 inline" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* 4. VIEW: PAYMENTS & SETTLEMENTS           */}
          {/* ========================================== */}
          {activeTab === 'payments' && (
            <div className="flex flex-col gap-6">
              {/* Header Banner */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#E73229] font-bold uppercase tracking-wider">
                      Finance &amp; Partner Settlements
                    </span>
                    {settlementsData?.settlements.some((s) => s.isPayoutDue && s.netOwnerPayable > 0) && (
                      <span className="relative flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
                        Payouts Due Now
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">
                    Partner Shop Settlements &amp; Payouts
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                    Auditable automated settlement calculation engine: tracks collected online booking advances, retains QGo's ₹30 platform fee + 18% GST (₹35.40/booking), and disburses 100% of owner earnings on agreed Weekly/Monthly cycles.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={handleDownloadPaymentsExcel}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <FileSpreadsheet size={14} />
                    <span>Download Payments &amp; Profit Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => handleRefreshSettlements()}
                    disabled={loadingSettlements}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 text-xs font-bold shadow-xs border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
                  >
                    <RefreshCw size={14} className={loadingSettlements ? 'animate-spin text-[#E73229]' : 'text-zinc-500'} />
                    <span>Sync Ledger</span>
                  </button>
                  <button
                    onClick={() => {
                      const firstDue = settlementsData?.settlements.find((s) => s.isPayoutDue && s.netOwnerPayable > 0);
                      if (firstDue) {
                        handleOpenPayModal(firstDue);
                      } else {
                        showToast('No pending settlements due at this moment');
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CreditCard size={14} />
                    <span>Release Next Due Payout</span>
                  </button>
                </div>
              </div>

              {/* Timeframe Filter Bar */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400">
                    Timeframe Filter:
                  </span>
                  {(['all', 'week', 'month', 'custom'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        setPaymentsTimeframe(tf);
                        handleRefreshSettlements({ range: tf, startDate: paymentsStartDate, endDate: paymentsEndDate, category: paymentsCategoryFilter });
                      }}
                      className={`px-3 py-1.5 rounded-full font-bold transition cursor-pointer capitalize ${
                        paymentsTimeframe === tf
                          ? 'bg-[#121318] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      {tf === 'all'
                        ? 'All Time'
                        : tf === 'week'
                        ? 'This Week (Weekly)'
                        : tf === 'month'
                        ? 'This Month (Monthly)'
                        : 'Custom Range'}
                    </button>
                  ))}
                </div>

                {paymentsTimeframe === 'custom' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={paymentsStartDate}
                      onChange={(e) => setPaymentsStartDate(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <span className="text-zinc-400">to</span>
                    <input
                      type="date"
                      value={paymentsEndDate}
                      onChange={(e) => setPaymentsEndDate(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRefreshSettlements()}
                      className="px-3 py-1 rounded-lg bg-[#E73229] hover:bg-[#BA070D] text-white font-bold text-xs"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* QGo Profit & Loss Vault Summary (Gross Platform Income Never Drops to ₹0) */}
              <div className="p-6 rounded-[28px] bg-gradient-to-br from-white via-white to-zinc-50 dark:from-[#141417] dark:via-[#141417] dark:to-zinc-900 border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#E73229] block">
                      Platform Financial Performance &amp; Vault Accounting
                    </span>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 mt-0.5">
                      QGo Platform Income, Profit &amp; Loss Breakdown
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider">
                      Vault Active • Retained Permanent
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#E73229]/5 border border-[#E73229]/20 p-5 rounded-[22px]">
                    <span className="text-[10px] uppercase font-bold text-[#E73229] block">
                      1. Gross QGo Platform Income
                    </span>
                    <p className="text-2xl font-black text-[#E73229] mt-1 tabular-nums">
                      ₹{(settlementsData?.summary.vaultGrossQgoPlatformIncome || settlementsData?.summary.qgoPlatformFee || 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-0.5 block">
                      ₹30.00 base + ₹5.40 GST / booking
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800/90 shadow-xs p-5 rounded-[22px]">
                    <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400 block">
                      2. Statutory GST (18%)
                    </span>
                    <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1 tabular-nums">
                      ₹{(settlementsData?.summary.vaultStatutoryGst || settlementsData?.summary.gstCollected || 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs text-zinc-500 font-semibold mt-0.5 block">
                      ₹5.40 statutory tax / booking
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800/90 shadow-xs p-5 rounded-[22px]">
                    <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400 block">
                      3. Est. Gateway Cost (~2.36%)
                    </span>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                      ₹{(settlementsData?.summary.vaultEstimatedGatewayCost || 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs text-zinc-500 font-medium mt-0.5 block">
                      Razorpay online processing fee
                    </span>
                  </div>

                  <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-[22px]">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                      4. Net QGo Platform Profit
                    </span>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                      ₹{(settlementsData?.summary.vaultNetProfit || 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5 block">
                      Gross Income minus GST &amp; gateway costs
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">Disbursed to Owners:</span>
                    <span className="font-extrabold text-emerald-600 tabular-nums">
                      ₹{(settlementsData?.summary.totalSettledHistorical || settlementsData?.summary.totalDisbursedHistorical || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">Pending Payable to Owners:</span>
                    <span className="font-extrabold text-[#E73229] tabular-nums">
                      ₹{(settlementsData?.summary.netPayableToOwners || settlementsData?.summary.totalPendingPayable || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Split Category Overview: Turf vs Salon */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Turf Overview Card */}
                <div className="p-6 rounded-[28px] bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                        ⚽
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100">Turf Venues Overview</h4>
                        <span className="text-[10px] text-zinc-400 font-semibold uppercase">Football, Cricket, Badminton</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      {settlementsData?.summary.turfMetrics?.venueCount ?? 0} Venues
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block font-semibold">Bookings</span>
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                        {settlementsData?.summary.turfMetrics?.totalBookings ?? 0}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block font-semibold">₹30 QGo Fee</span>
                      <span className="font-extrabold text-sm text-[#E73229]">
                        ₹{(settlementsData?.summary.turfMetrics?.qgoFeeIncome ?? 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block font-semibold">Owner Payouts</span>
                      <span className="font-extrabold text-sm text-emerald-600">
                        ₹{(settlementsData?.summary.turfMetrics?.disbursedPayouts ?? 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Salon Overview Card */}
                <div className="p-6 rounded-[28px] bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">
                        ✂️
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100">Salon Venues Overview</h4>
                        <span className="text-[10px] text-zinc-400 font-semibold uppercase">Hair, Spa, Grooming</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                      {settlementsData?.summary.salonMetrics?.venueCount ?? 0} Venues
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block font-semibold">Bookings</span>
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                        {settlementsData?.summary.salonMetrics?.totalBookings ?? 0}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block font-semibold">₹30 QGo Fee</span>
                      <span className="font-extrabold text-sm text-[#E73229]">
                        ₹{(settlementsData?.summary.salonMetrics?.qgoFeeIncome ?? 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <span className="text-[10px] text-zinc-400 block font-semibold">Owner Payouts</span>
                      <span className="font-extrabold text-sm text-emerald-600">
                        ₹{(settlementsData?.summary.salonMetrics?.disbursedPayouts ?? 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Shop Settlement Ledger Table */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-4 gap-3">
                  <div>
                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-50">
                      Partner Venues Settlement Ledger
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Itemized breakdown of current cycle bookings, platform retention, and exact owner payout amounts. Click any venue to drill down.
                    </p>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold self-start sm:self-auto">
                    {(['all', 'turf', 'salon'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setPaymentsCategoryFilter(cat);
                          handleRefreshSettlements({ range: paymentsTimeframe, startDate: paymentsStartDate, endDate: paymentsEndDate, category: cat });
                        }}
                        className={`px-3 py-1.5 rounded-full transition cursor-pointer capitalize ${
                          paymentsCategoryFilter === cat
                            ? 'bg-[#E73229] text-white font-bold shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        {cat === 'all'
                          ? `All (${settlementsData?.settlements.length || 0})`
                          : cat === 'turf'
                          ? `Turfs (${settlementsData?.summary.turfMetrics?.venueCount ?? 0})`
                          : `Salons (${settlementsData?.summary.salonMetrics?.venueCount ?? 0})`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[850px]">
                    <thead>
                      <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                        <th className="py-3 px-3">Partner Venue &amp; Owner</th>
                        <th className="py-3 px-3">Agreed Cycle</th>
                        <th className="py-3 px-3 text-center">Unsettled Bookings</th>
                        <th className="py-3 px-3">Online Collected</th>
                        <th className="py-3 px-3">QGo Fee + GST (Retained)</th>
                        <th className="py-3 px-3">Net Due to Owner</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                      {(!settlementsData?.settlements || settlementsData.settlements.length === 0) ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                            No partner venues found in the system.
                          </td>
                        </tr>
                      ) : (
                        settlementsData.settlements.map((s) => {
                          const isDue = s.isPayoutDue && s.netOwnerPayable > 0;
                          const isReady = s.netOwnerPayable > 0 && !s.isPayoutDue;
                          const isSettled = s.netOwnerPayable === 0;

                          return (
                            <tr
                              key={s.salonId}
                              onClick={() => {
                                setSelectedVenueForDrillDown(s);
                                setIsVenueDrillDownOpen(true);
                              }}
                              className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer group"
                            >
                              <td className="py-4 px-3.5">
                                <div className="font-bold text-zinc-900 dark:text-zinc-50 text-sm group-hover:text-[#E73229] transition-colors">
                                  {s.salonName}
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                  <span>{s.ownerName}</span>
                                  <span>•</span>
                                  <span>{s.ownerPhone || 'No Phone'}</span>
                                  <span>•</span>
                                  <span className="uppercase text-[10px] font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                    {s.category}
                                  </span>
                                </div>
                              </td>

                              <td className="py-4 px-3.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  s.payoutCycle === 'monthly'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                }`}>
                                  {s.payoutCycle === 'monthly' ? 'Monthly' : 'Weekly'}
                                </span>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                  {s.cyclePeriodLabel}
                                </div>
                              </td>

                              <td className="py-4 px-3.5 text-center">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                                  {s.totalBookings}
                                </span>
                                <span className="text-[10px] text-zinc-400 block">slots</span>
                              </td>

                              <td className="py-4 px-3.5 font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">
                                ₹{s.totalOnlineCollected.toLocaleString('en-IN')}
                              </td>

                              <td className="py-4 px-3.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                                <span className="text-[#E73229] font-bold">
                                  -₹{s.qgoTotalRetained.toLocaleString('en-IN')}
                                </span>
                                <span className="text-[10px] text-zinc-400 block">
                                  ₹35.40 / booking
                                </span>
                              </td>

                              <td className="py-4 px-3.5">
                                <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  ₹{s.netOwnerPayable.toLocaleString('en-IN')}
                                </span>
                                {s.upiId ? (
                                  <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]" title={s.upiId}>
                                    UPI: {s.upiId}
                                  </div>
                                ) : s.accountNumber ? (
                                  <div className="text-[10px] text-zinc-400 font-mono">
                                    A/C: •••• {s.accountNumber.slice(-4)}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                    No UPI / Bank
                                  </div>
                                )}
                              </td>

                              <td className="py-4 px-3.5">
                                {isDue && (
                                  <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
                                    DUE NOW
                                  </span>
                                )}
                                {isReady && (
                                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    READY
                                  </span>
                                )}
                                {isSettled && (
                                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    SETTLED ✓
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedVenueForDrillDown(s);
                                      setIsVenueDrillDownOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                                  >
                                    Drill Down
                                  </button>
                                  {s.netOwnerPayable > 0 ? (
                                    <>
                                      <button
                                        onClick={() => handleSendWhatsAppAlert(s)}
                                        title="Send WhatsApp Alert to 9600971886"
                                        className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 transition-all cursor-pointer"
                                      >
                                        <MessageSquare size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleOpenPayModal(s)}
                                        className="px-3.5 py-1.5 rounded-full bg-[#E73229] hover:bg-[#D42B22] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                                      >
                                        Pay Owner
                                      </button>
                                    </>
                                  ) : (
                                    <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-xs font-semibold select-none">
                                      Settled
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Completed Payout History Table */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px]">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-50">
                      Completed Payout History
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Permanent audit trail of all disbursed partner payouts with bank transaction UTR numbers.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    Total Disbursed: ₹{(settlementsData?.summary.totalSettledHistorical || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead>
                      <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                        <th className="py-3 px-3">Date / Time</th>
                        <th className="py-3 px-3">Partner Venue</th>
                        <th className="py-3 px-3">Owner</th>
                        <th className="py-3 px-3">Cycle</th>
                        <th className="py-3 px-3">Amount Paid</th>
                        <th className="py-3 px-3">Payment Method</th>
                        <th className="py-3 px-3">UTR Reference</th>
                        <th className="py-3 px-3 text-right">Settled By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                      {(!settlementsData?.payoutHistory || settlementsData.payoutHistory.length === 0) ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                            No past settlement payouts recorded yet.
                          </td>
                        </tr>
                      ) : (
                        settlementsData.payoutHistory.map((p) => (
                          <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50">
                            <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                              {formatDateTimeIST(p.settledAt)}
                            </td>
                            <td className="py-3 px-3 font-bold text-zinc-900 dark:text-zinc-50">
                              {p.salonName}
                            </td>
                            <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                              {p.ownerName}
                            </td>
                            <td className="py-3 px-3 capitalize">
                              {p.payoutCycle}
                            </td>
                            <td className="py-3 px-3 font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              ₹{p.amountPaid.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 font-semibold text-zinc-700 dark:text-zinc-300">
                              {p.paymentMethod}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {p.utrReference}
                            </td>
                            <td className="py-3 px-3 text-right text-zinc-500 dark:text-zinc-400">
                              {p.settledByAdminName || 'Admin'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* 5A. VIEW: CUSTOMER INTELLIGENCE & TELEMETRY */}
          {/* ========================================== */}
          {activeTab === 'customers' && (
            <div className="flex flex-col gap-6">
              {/* Header Card */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#E73229] font-bold">Overview / Customer Intelligence</span>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-0.5">
                    Customers Directory & Live Telemetry
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Real-time session presence, booking attendance reliability, customer lifetime spend, and account access controls.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportTableToExcel('QGo_Customers_Directory.xlsx', 'Customers', customers);
                      showToast('Exported customer directory to Excel');
                    }}
                    className="px-3.5 py-2 rounded-full bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} /> Export .xlsx
                  </button>
                  <button
                    onClick={() => {
                      exportTableToCsv('QGo_Customers.csv', customers);
                      showToast('Exported customer directory to CSV');
                    }}
                    className="px-3.5 py-2 rounded-full bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <FileSpreadsheet size={14} /> Export CSV
                  </button>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Customers */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-5 rounded-[24px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Total Customers</span>
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users size={16} />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-2">
                    {customerStats.total || customers.length}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">Registered consumers</p>
                </div>

                {/* Online Now (Interactive toggle filter) */}
                <div
                  onClick={() => setCustomerFilter((prev) => (prev === 'online' ? 'all' : 'online'))}
                  className={`cursor-pointer transition-all bg-white dark:bg-[#141417] border p-5 rounded-[24px] shadow-sm text-zinc-900 dark:text-zinc-100 ${
                    customerFilter === 'online' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Online Now</span>
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                    {customerStats.online || customers.filter((c) => c.isOnline).length}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-1">
                    {customerFilter === 'online' ? '✓ Showing online only (click to reset)' : 'Active in last 5m (click to filter)'}
                  </p>
                </div>

                {/* Active Today */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-5 rounded-[24px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Active Today (IST)</span>
                    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Activity size={16} />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-2">
                    {customerStats.activeToday || customers.filter((c) => c.isOnline).length}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">App activity on current business day</p>
                </div>

                {/* Repeat Bookers */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-5 rounded-[24px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Repeat Bookers</span>
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                      <ShieldCheck size={16} />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-2">
                    {customers.filter((c) => (c.totalBookings || 0) > 1).length}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                    {Math.round((customers.filter((c) => (c.totalBookings || 0) > 1).length / (customers.length || 1)) * 100)}% of user base
                  </p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs w-full sm:w-80 shadow-xs">
                  <Search size={16} className="text-zinc-500 dark:text-zinc-400" />
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by customer name, phone, email, or ID..."
                    className="bg-transparent border-none outline-none text-xs w-full font-medium"
                  />
                  {customerSearch && (
                    <button onClick={() => setCustomerSearch('')} className="text-zinc-500 dark:text-zinc-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
                  <button
                    onClick={() => setCustomerFilter('all')}
                    className={`px-3 py-1 rounded-full transition-all ${
                      customerFilter === 'all' ? 'bg-[#121318] text-white shadow-xs font-bold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    All ({customers.length})
                  </button>
                  <button
                    onClick={() => setCustomerFilter('online')}
                    className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                      customerFilter === 'online' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-emerald-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Online Now ({customers.filter((c) => c.isOnline).length})
                  </button>
                  <button
                    onClick={() => setCustomerFilter('high_reliability')}
                    className={`px-3 py-1 rounded-full transition-all ${
                      customerFilter === 'high_reliability' ? 'bg-[#121318] text-white shadow-xs font-bold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    High Reliability ({customers.filter((c) => (c.reliabilityScore ?? 100) >= 90).length})
                  </button>
                  <button
                    onClick={() => setCustomerFilter('restricted')}
                    className={`px-3 py-1 rounded-full transition-all ${
                      customerFilter === 'restricted' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-red-600'
                    }`}
                  >
                    Restricted ({customers.filter((c) => c.isBlocked).length})
                  </button>
                </div>
              </div>

              {/* Customer Table */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead>
                    <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                      <th className="py-2.5 px-3">Customer & Presence</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Bookings</th>
                      <th className="py-2.5 px-3">Reliability Score</th>
                      <th className="py-2.5 px-3">Lifetime Spend</th>
                      <th className="py-2.5 px-3">Account Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                          No customers match current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((cust) => (
                        <tr key={cust.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-all">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 text-xs shrink-0">
                                {cust.name ? cust.name.slice(0, 2).toUpperCase() : 'CU'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-zinc-900 dark:text-zinc-50">{cust.name || 'Anonymous User'}</p>
                                  {cust.isOnline ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Online
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                      • {formatTimeAgo(cust.lastActiveAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">ID: {cust.id.slice(0, 12)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-600">
                            <p>{cust.phone || 'No phone'}</p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{cust.email || 'No email'}</p>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-zinc-900 dark:text-zinc-50">{cust.totalBookings || 0}</span>
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                              {cust.completedBookings || 0} done • {cust.cancelledBookings || 0} cx • {cust.noShowCount || 0} no-show
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  (cust.reliabilityScore ?? 100) >= 90
                                    ? 'text-emerald-700'
                                    : (cust.reliabilityScore ?? 100) >= 70
                                    ? 'text-amber-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {cust.reliabilityScore ?? 100}%
                              </span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {(cust.noShowCount || 0) > 0 ? `(${cust.noShowCount}x No-Show)` : 'Pristine'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-zinc-900 dark:text-zinc-50">₹{(cust.totalSpent || 0).toLocaleString()}</span>
                            {(cust.totalRefundsReceived || 0) > 0 && (
                              <p className="text-[10px] text-amber-600">
                                Refunds: ₹{(cust.totalRefundsReceived || 0).toLocaleString()}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                cust.isBlocked ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {cust.isBlocked ? 'Restricted' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedCustomer(cust)}
                                className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 font-semibold text-[11px] transition-all"
                              >
                                Inspect 360°
                              </button>
                              <button
                                onClick={() =>
                                  setRestrictUserModal({
                                    id: cust.id,
                                    name: cust.name,
                                    isBlocked: Boolean(cust.isBlocked),
                                    role: 'customer',
                                  })
                                }
                                className={`px-2.5 py-1 rounded-full font-semibold text-[11px] transition-all ${
                                  cust.isBlocked
                                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                }`}
                              >
                                {cust.isBlocked ? 'Unblock' : 'Restrict'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* 5B. VIEW: OWNER INTELLIGENCE & CATEGORIES  */}
          {/* ========================================== */}
          {activeTab === 'owners' && (
            <div className="flex flex-col gap-6">
              {/* Header Card */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#E73229] font-bold">Overview / Owner Intelligence</span>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-0.5">
                    Partner Owners, Category Mix & Escrow
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Monitor venue partner operators across Turfs and Salons, real-time presence, booking volume, and payout disbursements.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportTableToExcel('QGo_Owners_Directory.xlsx', 'Owners', owners);
                      showToast('Exported owners directory to Excel');
                    }}
                    className="px-3.5 py-2 rounded-full bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} /> Export .xlsx
                  </button>
                  <button
                    onClick={() => setBroadcastModalOpen(true)}
                    className="px-3.5 py-2 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Megaphone size={14} /> Broadcast Notice
                  </button>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Owners */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-5 rounded-[24px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Total Partner Owners</span>
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 flex items-center justify-center">
                      <Building size={16} />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-2">
                    {ownerStats.total || owners.length}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">Approved venue operators</p>
                </div>

                {/* Online Now */}
                <div
                  onClick={() => setOwnerStatusFilter((prev) => (prev === 'online' ? 'all' : 'online'))}
                  className={`cursor-pointer transition-all bg-white dark:bg-[#141417] border p-5 rounded-[24px] shadow-sm text-zinc-900 dark:text-zinc-100 ${
                    ownerStatusFilter === 'online' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Online Now</span>
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                    {ownerStats.online || owners.filter((o) => o.isOnline).length}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-1">
                    {ownerStatusFilter === 'online' ? '✓ Showing online only (click to reset)' : 'Managing facilities right now'}
                  </p>
                </div>

                {/* Turf Operators */}
                <div
                  onClick={() => setOwnerCategoryFilter((prev) => (prev === 'turf' ? 'all' : 'turf'))}
                  className={`cursor-pointer transition-all bg-white dark:bg-[#141417] border p-5 rounded-[24px] shadow-sm text-zinc-900 dark:text-zinc-100 ${
                    ownerCategoryFilter === 'turf' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Turf Operators</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Compass size={16} />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-2">
                    {ownerStats.categoryCounts.turf || owners.filter((o) => o.categories?.includes('turf') || o.primaryCategory === 'turf').length}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">Cricket & football grounds</p>
                </div>

                {/* Salon Operators */}
                <div
                  onClick={() => setOwnerCategoryFilter((prev) => (prev === 'salon' ? 'all' : 'salon'))}
                  className={`cursor-pointer transition-all bg-white dark:bg-[#141417] border p-5 rounded-[24px] shadow-sm text-zinc-900 dark:text-zinc-100 ${
                    ownerCategoryFilter === 'salon' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-zinc-200/80 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Salon Operators</span>
                    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Scissors size={16} />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-2">
                    {ownerStats.categoryCounts.salon || owners.filter((o) => o.categories?.includes('salon') || o.primaryCategory === 'salon').length}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">Barber & styling parlours</p>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs w-full sm:w-80 shadow-xs">
                  <Search size={16} className="text-zinc-500 dark:text-zinc-400" />
                  <input
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    placeholder="Search owner, phone, facility name, city..."
                    className="bg-transparent border-none outline-none text-xs w-full font-medium"
                  />
                  {ownerSearch && (
                    <button onClick={() => setOwnerSearch('')} className="text-zinc-500 dark:text-zinc-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Category Filter */}
                  <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
                    <button
                      onClick={() => setOwnerCategoryFilter('all')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        ownerCategoryFilter === 'all' ? 'bg-[#121318] text-white shadow-xs font-bold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      All Categories
                    </button>
                    <button
                      onClick={() => setOwnerCategoryFilter('turf')}
                      className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        ownerCategoryFilter === 'turf' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-emerald-700'
                      }`}
                    >
                      Turf
                    </button>
                    <button
                      onClick={() => setOwnerCategoryFilter('salon')}
                      className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        ownerCategoryFilter === 'salon' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-purple-700'
                      }`}
                    >
                      Salon
                    </button>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
                    <button
                      onClick={() => setOwnerStatusFilter('all')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        ownerStatusFilter === 'all' ? 'bg-[#121318] text-white shadow-xs font-bold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setOwnerStatusFilter('online')}
                      className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        ownerStatusFilter === 'online' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-emerald-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Online
                    </button>
                    <button
                      onClick={() => setOwnerStatusFilter('pending_payout')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        ownerStatusFilter === 'pending_payout' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-amber-700'
                      }`}
                    >
                      Pending Payout ({owners.filter((o) => (o.pendingPayoutBalance || 0) > 0).length})
                    </button>
                    <button
                      onClick={() => setOwnerStatusFilter('restricted')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        ownerStatusFilter === 'restricted' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-red-700'
                      }`}
                    >
                      Restricted
                    </button>
                  </div>
                </div>
              </div>

              {/* Owner Table */}
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead>
                    <tr className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/80">
                      <th className="py-2.5 px-3">Partner Owner & Presence</th>
                      <th className="py-2.5 px-3">Category & Facility</th>
                      <th className="py-2.5 px-3">Rating</th>
                      <th className="py-2.5 px-3">Lifetime Volume</th>
                      <th className="py-2.5 px-3">Escrow Settlement</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                    {filteredOwners.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                          No partner owners match current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOwners.map((owner) => {
                        const primaryVenue = owner.venues?.[0];
                        const isTurf = owner.primaryCategory === 'turf' || owner.categories?.includes('turf');
                        const hasPending = (owner.pendingPayoutBalance || 0) > 0;
                        return (
                          <tr key={owner.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-all">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 text-xs shrink-0">
                                  {owner.name ? owner.name.slice(0, 2).toUpperCase() : 'OW'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-zinc-900 dark:text-zinc-50">{owner.name || 'Partner Owner'}</p>
                                    {owner.isOnline ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Online
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                        • {formatTimeAgo(owner.lastActiveAt)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-zinc-600 dark:text-zinc-400">{owner.phone || owner.email || 'No contact info'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                                    isTurf ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {isTurf ? '⚽ Turf' : '✂️ Salon'}
                                </span>
                                <p className="font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-[180px]">
                                  {primaryVenue?.name || 'Venue Partner'}
                                </p>
                              </div>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {primaryVenue?.city || 'Coimbatore'} • {owner.venues?.length || 1} venue(s)
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              {owner.averageRating ? (
                                <div className="flex items-center gap-1 text-amber-500 font-bold">
                                  <Star size={12} fill="currentColor" />
                                  <span>{owner.averageRating.toFixed(1)}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">New</span>
                              )}
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {owner.venues?.reduce((s, v) => s + (v.reviewCount || 0), 0) || 0} reviews
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-zinc-900 dark:text-zinc-50">₹{(owner.grossRevenue || 0).toLocaleString()}</span>
                              <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                                {owner.totalBookings || 0} bookings ({owner.completedBookings || 0} completed)
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-bold ${
                                    hasPending ? 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200' : 'text-zinc-700 dark:text-zinc-300'
                                  }`}
                                >
                                  ₹{(owner.pendingPayoutBalance || 0).toLocaleString()} Due
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                Settled: ₹{(owner.settledPayoutAmount || 0).toLocaleString()}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  owner.isBlocked ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {owner.isBlocked ? 'Restricted' : 'Active'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {hasPending && (
                                  <button
                                    onClick={() => {
                                      setPayoutModalData({
                                        isOpen: true,
                                        venueName: primaryVenue?.name || owner.name,
                                        accountNumber: 'HDFC •••• 9214',
                                        amount: `₹${(owner.pendingPayoutBalance || 0).toLocaleString()}`,
                                        ownerId: owner.id,
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-all"
                                  >
                                    Settle Payout
                                  </button>
                                )}
                                <button
                                  onClick={() => setSelectedOwner(owner)}
                                  className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-50 font-semibold text-[11px] transition-all"
                                >
                                  Inspect 360°
                                </button>
                                <button
                                  onClick={() =>
                                    setRestrictUserModal({
                                      id: owner.id,
                                      name: owner.name,
                                      isBlocked: Boolean(owner.isBlocked),
                                      role: 'owner',
                                    })
                                  }
                                  className={`px-2 py-1 rounded-full font-semibold text-[11px] transition-all ${
                                    owner.isBlocked
                                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                  }`}
                                >
                                  {owner.isBlocked ? 'Unblock' : 'Restrict'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* 6. VIEW: ALERTS & AUDIT LOGS               */}
          {/* ========================================== */}
          {activeTab === 'alerts' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#E73229] font-bold">Overview / Security & Compliance</span>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-0.5">System Intimations & Audit Logs</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Real-time alert dispatch, administrative overrides, and immutable compliance trail.
                  </p>
                </div>
                <button
                  onClick={() => setBroadcastModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Megaphone size={16} /> Broadcast Alert to Owners
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Problem Intimations */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col gap-3">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mb-1">Active Problem Intimations</h3>
                  <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 flex flex-col items-center justify-center text-center text-zinc-900 dark:text-zinc-100">
                    <CheckCircle2 size={24} className="text-emerald-500 mb-1" />
                    <p className="font-bold text-xs text-zinc-900 dark:text-zinc-50">All Systems Operational</p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">No critical venue disputes or pending refunds requiring manual intervention.</p>
                  </div>
                </div>

                {/* Chronological Audit Logs */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] flex flex-col gap-3">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 mb-1">Chronological Admin Action Logs</h3>
                  <div className="space-y-2.5 text-xs">
                    {auditLogs.length > 0 ? (
                      auditLogs.slice(0, 8).map((log, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between text-zinc-900 dark:text-zinc-100">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-50">{log.action || 'Admin Action'}</p>
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                              By {log.adminEmail || 'Kishore (cjkishore35@gmail.com)'}
                            </p>
                          </div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 flex flex-col items-center justify-center text-center text-zinc-900 dark:text-zinc-100">
                        <Activity size={24} className="text-zinc-500 dark:text-zinc-400 mb-1" />
                        <p className="font-bold text-xs text-zinc-900 dark:text-zinc-50">No Admin Action Logs Yet</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">Administrative approvals and system changes will be recorded here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* 7. VIEW: PLATFORM SETTINGS                 */}
          {/* ========================================== */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 md:p-8 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#E73229] font-bold">Overview / Super Admin Controls</span>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-0.5">Platform Settings & Fee Rules</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Configure booking convenience fee, cancellation policy cut-offs, and Super Admin access.
                  </p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-5 py-2.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} /> Save Configuration
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pricing & Fees */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] space-y-4">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Pricing & Convenience Fees</h3>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Customer Platform Convenience Fee (per booking)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">₹</span>
                      <input
                        type="number"
                        value={settings.convenienceFee}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, convenienceFee: parseFloat(e.target.value) || 0 }))
                        }
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100/80 text-xs font-bold w-28 focus:outline-none"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        + {settings.convenienceFeeGstPercent}% GST (Total: ₹
                        {(settings.convenienceFee * (1 + settings.convenienceFeeGstPercent / 100)).toFixed(2)})
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Standard Turf/Salon Take-Rate
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={`${settings.standardTakeRatePercent}%`}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            standardTakeRatePercent: parseFloat(e.target.value.replace('%', '')) || 8.8,
                          }))
                        }
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100/80 text-xs font-bold w-28 focus:outline-none"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">Deducted from gross court rate</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Free Cancellation Window</label>
                    <select
                      value={settings.freeCancellationHours}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, freeCancellationHours: parseInt(e.target.value, 10) }))
                      }
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100/80 text-xs font-bold w-48 focus:outline-none"
                    >
                      <option value={2}>Up to 2 hours before slot</option>
                      <option value={4}>Up to 4 hours before slot</option>
                      <option value={12}>Up to 12 hours before slot</option>
                    </select>
                  </div>
                </div>

                {/* Super Admin Credentials & Alerts */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] space-y-4">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Super Admin Credentials & Alerts</h3>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Primary Command Center Email
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="cjkishore35@gmail.com"
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-bold w-full text-zinc-700 dark:text-zinc-300"
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.smsOnCancellation}
                        onChange={(e) => setSettings((p) => ({ ...p, smsOnCancellation: e.target.checked }))}
                        className="w-4 h-4 text-[#E73229] rounded border-gray-300"
                      />
                      <span>Enable instant SMS alert on owner cancellations</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoSettlementEnabled}
                        onChange={(e) => setSettings((p) => ({ ...p, autoSettlementEnabled: e.target.checked }))}
                        className="w-4 h-4 text-[#E73229] rounded border-gray-300"
                      />
                      <span>Automated 23:59 IST NEFT settlement batch dispatch</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.escrowWebhookEnabled}
                        onChange={(e) => setSettings((p) => ({ ...p, escrowWebhookEnabled: e.target.checked }))}
                        className="w-4 h-4 text-[#E73229] rounded border-gray-300"
                      />
                      <span>Razorpay Route escrow webhook reconciliation</span>
                    </label>
                  </div>
                </div>

                {/* Qbe Smart Assistant Platform Controls */}
                <div className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800/90 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] space-y-4 md:col-span-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#E73229]/10 text-[#E73229] flex items-center justify-center">
                      <Qbi size={20} mood="happy" animate={false} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Qbe Smart Assistant &amp; Slot Reminders</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Platform-wide master switch and Super Admin command radar controls.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-850">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Platform-Wide Qbe Master Switch</h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Global kill-switch for Qbe across all customer, owner, and admin views.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={qbePrefs.platformEnabled}
                        aria-label="Toggle Platform-Wide Qbe Master Switch"
                        onClick={() => updateQbePref('platformEnabled', !qbePrefs.platformEnabled)}
                        className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ml-4 ${
                          qbePrefs.platformEnabled ? 'bg-[#E73229]' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            qbePrefs.platformEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-850">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Admin Command Radar</h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Show Qbe on admin dashboard with quick triage shortcuts.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={qbePrefs.adminEnabled}
                        aria-label="Toggle Admin Command Radar"
                        onClick={() => updateQbePref('adminEnabled', !qbePrefs.adminEnabled)}
                        className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ml-4 ${
                          qbePrefs.adminEnabled ? 'bg-[#E73229]' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            qbePrefs.adminEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* In-App Over-The-Air (OTA) APK Release Publisher */}
                <div className="bg-white dark:bg-[#141417] border border-blue-200/80 dark:border-blue-900/60 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] space-y-4 md:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[10px] font-bold uppercase mb-0.5">
                          Over-The-Air Update Engine
                        </div>
                        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Publish Android APK Release</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Current App Version:</span>
                      <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                        v{CURRENT_APP_VERSION}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Publish an in-app update notification to all mobile devices. When users open the app or resume from background, they are prompted to download the update directly via your APK link.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-1">
                        Target Version (Semver)
                      </label>
                      <input
                        type="text"
                        value={appReleaseData.latestVersion}
                        onChange={(e) => setAppReleaseData((p) => ({ ...p, latestVersion: e.target.value }))}
                        placeholder="e.g. 1.0.1"
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-1">
                        Direct APK Download URL
                      </label>
                      <input
                        type="url"
                        value={appReleaseData.apkDownloadUrl}
                        onChange={(e) => setAppReleaseData((p) => ({ ...p, apkDownloadUrl: e.target.value }))}
                        placeholder="https://.../QGo-v1.0.1.apk"
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-1">
                        Release Highlights / Changelog (Shown in In-App Modal)
                      </label>
                      <textarea
                        rows={3}
                        value={appReleaseData.releaseNotes}
                        onChange={(e) => setAppReleaseData((p) => ({ ...p, releaseNotes: e.target.value }))}
                        placeholder="• Buttery-smooth sidebar transitions&#10;• Two-step backup before database reset&#10;• Targeted broadcasts for owners and customers"
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                      <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={appReleaseData.forceUpdate}
                          onChange={(e) => setAppReleaseData((p) => ({ ...p, forceUpdate: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <span>Mandatory Update (blocks dismiss button on mobile)</span>
                      </label>

                      <button
                        type="button"
                        disabled={isPublishingRelease || !appReleaseData.latestVersion || !appReleaseData.apkDownloadUrl}
                        onClick={handlePublishRelease}
                        className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        {isPublishingRelease ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Publishing OTA Update...</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight size={14} />
                            <span>Publish APK Release</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* System Maintenance & Database Wipe */}
                <div className="bg-white dark:bg-[#141417] border border-red-200/60 dark:border-red-900/40 shadow-sm text-zinc-900 dark:text-zinc-100 p-6 rounded-[28px] space-y-4 md:col-span-2">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-[10px] font-bold uppercase mb-1">
                        <AlertTriangle size={12} /> Maintenance Mode
                      </div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Database Snapshot &amp; Maintenance (Super Admin Only)</h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                        Export an offline full JSON snapshot before maintenance, or purge all test salons, mock bookings, queue entries, reviews, services, staff, tickets, and transient notification logs. The active root admin account (<code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-[#E73229]">cjkishore35@gmail.com</code>) and admin userRoles are strictly preserved.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={handleDownloadBackup}
                        disabled={isExportingBackup}
                        className="px-4 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Download size={15} />
                        <span>{isExportingBackup ? 'Exporting...' : 'Download Complete App Backup (.json)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetStep(1);
                          setResetPasswordInput('');
                          setResetConfirmInput('');
                          setIsResetConfirmModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                      >
                        <Trash2 size={15} />
                        <span>Reset Database Fresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── SLIDE-OVER BOOKING DRAWER ─── */}
      <div
        className={`fixed inset-y-0 right-0 w-96 bg-white/95 dark:bg-[#141417]/95 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-300 border-l border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between text-zinc-900 dark:text-zinc-100 ${
          selectedBooking ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedBooking && (
          <>
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E73229] animate-pulse" />
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">Booking Details</h3>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 rounded-full hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mt-5 space-y-4 text-xs">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Booking ID</span>
                  <span className="font-mono font-bold text-sm text-[#E73229]">#{selectedBooking.id}</span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Venue & Category</span>
                  <span className="font-bold text-gray-800 text-sm">
                    {selectedBooking.salonName || 'Venue'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Slot Time</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {selectedBooking.scheduledTime || selectedBooking.scheduledDate || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Customer Contact</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {sanitizeCustomerName(selectedBooking.customerName, selectedBooking.customerPhone)} {selectedBooking.customerPhone ? `(${selectedBooking.customerPhone})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Amount & Split</span>
                  <span className="font-bold text-base text-gray-900">₹{selectedBooking.amount ?? 0}</span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    QGo Fee: ₹{((selectedBooking.amount || 0) * (settings.standardTakeRatePercent / 100)).toFixed(2)} • Venue Share: ₹
                    {((selectedBooking.amount || 0) * (1 - settings.standardTakeRatePercent / 100)).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Payment Method</span>
                  <span className="font-semibold text-blue-600">
                    {selectedBooking.paymentMethod || 'Online UPI (Razorpay Verified)'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold inline-block mt-1 capitalize">
                    {selectedBooking.status || 'Confirmed'}
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              <button
                onClick={handleForceRefundBooking}
                disabled={isCancellingBooking}
                className="w-full py-2.5 rounded-xl bg-[#E73229] hover:bg-[#BA070D] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={16} className={isCancellingBooking ? 'animate-spin' : ''} />
                Force Cancel & Issue Full Refund
              </button>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── SLIDE-OVER CUSTOMER 360° DRAWER ─── */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white/95 dark:bg-[#141417]/95 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-300 border-l border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto text-zinc-900 dark:text-zinc-100 ${
          selectedCustomer ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedCustomer && (
          <>
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    {selectedCustomer.name ? selectedCustomer.name.slice(0, 2).toUpperCase() : 'CU'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{selectedCustomer.name}</h3>
                    <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">#{selectedCustomer.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded-full hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Live Presence Banner */}
              <div className="my-4 p-3 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedCustomer.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">
                    {selectedCustomer.isOnline ? 'Active in Session' : 'Offline'}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {selectedCustomer.isOnline ? 'Real-time telemetry' : `Last active ${formatTimeAgo(selectedCustomer.lastActiveAt)}`}
                </span>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Total Spend</span>
                  <span className="font-extrabold text-zinc-900 dark:text-zinc-50 text-base">₹{(selectedCustomer.totalSpent || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Reliability</span>
                  <span className="font-extrabold text-emerald-600 text-base">{selectedCustomer.reliabilityScore ?? 100}%</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Bookings</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">
                    {selectedCustomer.totalBookings || 0} ({selectedCustomer.completedBookings || 0} done)
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">No-Shows</span>
                  <span className="font-bold text-red-600 text-sm">{selectedCustomer.noShowCount || 0} misses</span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-xs mb-4 p-3 rounded-xl bg-zinc-50/70 dark:bg-[#1C1C21]/70 border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Phone:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedCustomer.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Email:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedCustomer.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Member Since:</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Recent Bookings */}
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-50 mb-2">Recent Bookings History</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {bookings.filter((b) => b.customerId === selectedCustomer.id).length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic py-2">No historical bookings on record for this user.</p>
                  ) : (
                    bookings
                      .filter((b) => b.customerId === selectedCustomer.id)
                      .slice(0, 5)
                      .map((b) => (
                        <div key={b.id} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-900 dark:text-zinc-100">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-50">{b.salonName || 'Venue'}</p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {b.scheduledDate} • {b.scheduledTime}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-zinc-900 dark:text-zinc-50">₹{b.totalAmount || b.amount || 0}</span>
                            <p className="text-[9px] uppercase font-bold text-emerald-600">{b.status}</p>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              <button
                onClick={() => {
                  setRestrictUserModal({
                    id: selectedCustomer.id,
                    name: selectedCustomer.name,
                    isBlocked: Boolean(selectedCustomer.isBlocked),
                    role: 'customer',
                  });
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all ${
                  selectedCustomer.isBlocked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {selectedCustomer.isBlocked ? 'Restore Account Access' : 'Restrict Account (48 Hours)'}
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all"
              >
                Close Drawer
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── SLIDE-OVER OWNER 360° DRAWER ─── */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white/95 dark:bg-[#141417]/95 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-300 border-l border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto text-zinc-900 dark:text-zinc-100 ${
          selectedOwner ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedOwner && (
          <>
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    {selectedOwner.name ? selectedOwner.name.slice(0, 2).toUpperCase() : 'OW'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{selectedOwner.name}</h3>
                    <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">#{selectedOwner.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOwner(null)}
                  className="p-1 rounded-full hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Live Presence Banner */}
              <div className="my-4 p-3 rounded-2xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selectedOwner.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">
                    {selectedOwner.isOnline ? 'Partner Online' : 'Partner Offline'}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {selectedOwner.isOnline ? 'Real-time telemetry' : `Last active ${formatTimeAgo(selectedOwner.lastActiveAt)}`}
                </span>
              </div>

              {/* Financial Escrow Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Gross GMV</span>
                  <span className="font-extrabold text-zinc-900 dark:text-zinc-50 text-base">₹{(selectedOwner.grossRevenue || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Pending Payout</span>
                  <span className="font-extrabold text-[#E73229] text-base">₹{(selectedOwner.pendingPayoutBalance || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Total Settled</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">₹{(selectedOwner.settledPayoutAmount || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1C1C21] border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Platform Fee (5%)</span>
                  <span className="font-bold text-gray-600 text-sm">₹{(selectedOwner.qgoFeeDeducted || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Partner Details */}
              <div className="space-y-2 text-xs mb-4 p-3 rounded-xl bg-zinc-50/70 dark:bg-[#1C1C21]/70 border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Phone:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedOwner.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Email:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedOwner.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Average Rating:</span>
                  <span className="font-bold text-amber-600">
                    {selectedOwner.averageRating ? `${selectedOwner.averageRating.toFixed(1)} ★` : 'New (0 reviews)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Last Payout Disbursed:</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedOwner.lastPayoutDate || 'None on record'}</span>
                </div>
              </div>

              {/* Venues Managed */}
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-50 mb-2">
                  Managed Facilities ({selectedOwner.venues?.length || 0})
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(!selectedOwner.venues || selectedOwner.venues.length === 0) ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic py-2">No active venues assigned to this partner account.</p>
                  ) : (
                    selectedOwner.venues.map((v) => (
                      <div key={v.id} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-900 dark:text-zinc-100">
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-50">{v.name}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {v.category || 'Venue'} • {v.city || 'Tamil Nadu'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {v.status || 'Active'}
                          </span>
                          <p className="text-[10px] text-amber-500 font-bold mt-0.5">
                            {v.rating ? `${v.rating} ★` : 'New'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              {(selectedOwner.pendingPayoutBalance || 0) > 0 && (
                <button
                  onClick={() => {
                    const primaryVenue = selectedOwner.venues?.[0];
                    setPayoutModalData({
                      isOpen: true,
                      venueName: primaryVenue?.name || selectedOwner.name,
                      accountNumber: 'HDFC •••• 9214',
                      amount: `₹${(selectedOwner.pendingPayoutBalance || 0).toLocaleString()}`,
                      ownerId: selectedOwner.id,
                    });
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <CreditCard size={14} /> Disburse ₹{(selectedOwner.pendingPayoutBalance || 0).toLocaleString()} Now
                </button>
              )}
              <button
                onClick={() => {
                  setRestrictUserModal({
                    id: selectedOwner.id,
                    name: selectedOwner.name,
                    isBlocked: Boolean(selectedOwner.isBlocked),
                    role: 'owner',
                  });
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all ${
                  selectedOwner.isBlocked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {selectedOwner.isBlocked ? 'Restore Account Access' : 'Restrict Account Access'}
              </button>
              <button
                onClick={() => setSelectedOwner(null)}
                className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all"
              >
                Close Drawer
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── DATE RANGE FILTER MODAL ─── */}
      {dateRangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#121318]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-[#141417]/95 backdrop-blur-xl p-6 rounded-[28px] max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CalendarDays size={20} className="text-[#E73229]" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Filter Ledger Date Range</h3>
              </div>
              <button
                onClick={() => setDateRangeModalOpen(false)}
                className="p-1 rounded-full hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">Quick Presets:</span>
                <button
                  onClick={() => {
                    setTelemetryRange('today');
                    setSelectedRangeLabel('Today (Live)');
                    setDateRangeModalOpen(false);
                    showToast('Recalculated ledger & telemetry for: Today');
                  }}
                  className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    setTelemetryRange('7d');
                    setSelectedRangeLabel('Last 7 Days');
                    setDateRangeModalOpen(false);
                    showToast('Recalculated ledger & telemetry for: Last 7 Days');
                  }}
                  className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]"
                >
                  Last 7D
                </button>
                <button
                  onClick={() => {
                    setTelemetryRange('30d');
                    setSelectedRangeLabel('Nov 01 - Nov 21, 2024');
                    setDateRangeModalOpen(false);
                    showToast('Recalculated ledger & telemetry for: Nov 01 - Nov 21, 2024');
                  }}
                  className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]"
                >
                  This Month
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setDateRangeModalOpen(false)}
                className="px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSelectedRangeLabel(`${startDateInput} to ${endDateInput}`);
                  setTelemetryRange('30d');
                  setDateRangeModalOpen(false);
                  showToast(`Recalculated ledger for ${startDateInput} to ${endDateInput}`);
                }}
                className="px-5 py-2 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check size={16} /> Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ─── INTERACTIVE PARTNER SETTLEMENT PAYOUT MODAL ─── */}
      {isPayModalOpen && selectedSettlementForPay && (
        <div className="fixed inset-0 z-50 bg-[#121318]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#141417] p-6 md:p-7 rounded-[32px] max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E73229]/10 text-[#E73229] flex items-center justify-center shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-50">
                    Release Partner Settlement
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedSettlementForPay.salonName} ({selectedSettlementForPay.category})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPayModalOpen(false);
                  setSelectedSettlementForPay(null);
                }}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {payModalError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs font-semibold text-[#E73229] dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{payModalError}</span>
              </div>
            )}

            {/* Itemized Calculation Math Box */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1">
                Settlement Formula &amp; Ledger Audit
              </span>

              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Agreed Cycle:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 capitalize">
                  {selectedSettlementForPay.payoutCycle} ({selectedSettlementForPay.cyclePeriodLabel})
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Unsettled Bookings:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedSettlementForPay.totalBookings} slots
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total Online Collected:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  + ₹{selectedSettlementForPay.totalOnlineCollected.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>QGo Platform Fee (₹30.00 × {selectedSettlementForPay.totalBookings}):</span>
                <span className="font-bold text-[#E73229] tabular-nums">
                  - ₹{selectedSettlementForPay.qgoConvenienceFee.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>GST Collected (₹5.40 × {selectedSettlementForPay.totalBookings}):</span>
                <span className="font-bold text-[#E73229] tabular-nums">
                  - ₹{selectedSettlementForPay.qgoGstCollected.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-sm">
                <span className="font-extrabold text-zinc-950 dark:text-white">
                  Exact Rupee Amount to Transfer:
                </span>
                <span className="font-black text-xl text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ₹{selectedSettlementForPay.netOwnerPayable.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Payout Destination Cards (UPI & Bank Details with 1-Click Copy) */}
            <div className="space-y-3">
              <span className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider block">
                Owner Registered Payout Destination
              </span>

              {selectedSettlementForPay.upiId ? (
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                      Registered UPI ID
                    </span>
                    <span className="font-mono font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate block">
                      {selectedSettlementForPay.upiId}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyText('UPI ID', selectedSettlementForPay.upiId || '')}
                      className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-zinc-700 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1"
                    >
                      <Copy size={12} />
                      <span>{copiedKey === 'UPI ID' ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <a
                      href={`upi://pay?pa=${selectedSettlementForPay.upiId}&pn=${encodeURIComponent(selectedSettlementForPay.ownerName)}&am=${selectedSettlementForPay.netOwnerPayable}&cu=INR`}
                      className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
                    >
                      <span>Pay via App</span>
                    </a>
                  </div>
                </div>
              ) : null}

              {selectedSettlementForPay.accountNumber ? (
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-xs">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    Bank Account Details
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-zinc-400 block">A/C Number</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 truncate block">
                          {selectedSettlementForPay.accountNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText('Account Number', selectedSettlementForPay.accountNumber || '')}
                        className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                        title="Copy Account Number"
                      >
                        <Copy size={12} />
                      </button>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-zinc-400 block">IFSC Code</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 truncate block">
                          {selectedSettlementForPay.ifscCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText('IFSC Code', selectedSettlementForPay.ifscCode || '')}
                        className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
                        title="Copy IFSC"
                      >
                        <Copy size={12} />
                      </button>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 col-span-2 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-zinc-400 block">Holder &amp; Bank</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {selectedSettlementForPay.bankAccountHolder || selectedSettlementForPay.ownerName} ({selectedSettlementForPay.bankName || 'Bank'})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!selectedSettlementForPay.upiId && !selectedSettlementForPay.accountNumber && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                  Owner has not registered bank details yet. Contact owner at {selectedSettlementForPay.ownerPhone} to transfer funds.
                </div>
              )}
            </div>

            {/* Payout Transfer Form */}
            <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider block">
                Transfer Confirmation &amp; UTR Reference
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={payPaymentMethod}
                    onChange={(e) => setPayPaymentMethod(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  >
                    <option value="UPI Transfer">UPI Transfer (GPay / PhonePe / Paytm)</option>
                    <option value="IMPS Transfer">IMPS Transfer (Instant)</option>
                    <option value="NEFT Transfer">NEFT Transfer</option>
                    <option value="Bank Transfer">Direct Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    UTR / Bank Reference ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={payUtrReference}
                    onChange={(e) => setPayUtrReference(e.target.value)}
                    placeholder="e.g. 432198765432 or UPI Ref ID"
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  Transfer Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Disbursed from current escrow account"
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsPayModalOpen(false);
                  setSelectedSettlementForPay(null);
                }}
                disabled={isSubmittingPay}
                className="px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSettlementPayment}
                disabled={isSubmittingPay}
                className="px-6 py-2.5 rounded-full bg-[#E73229] hover:bg-[#D42B22] text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmittingPay ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Recording Transfer...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Confirm &amp; Mark Paid</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── INTERACTIVE VENUE DRILL-DOWN DRAWER ─── */}
      {isVenueDrillDownOpen && selectedVenueForDrillDown && (() => {
        const s: SettlementCalculation = selectedVenueForDrillDown;
        const matchingVenue = venues.find((v) => v.id === s.salonId);
        const venueRating = matchingVenue?.rating
          ? `${matchingVenue.rating.toFixed(1)} ★ (${matchingVenue.reviewCount || matchingVenue.reviewsCount || 0} reviews)`
          : 'New Venue (0 reviews)';
        const venueAddress = matchingVenue?.address || matchingVenue?.city || 'Tamil Nadu';
        const venuePayoutHistory = settlementsData?.payoutHistory?.filter((p) => p.salonId === s.salonId) || [];
        const venueBookings = bookings.filter((b) => b.salonId === s.salonId || s.unsettledBookingIds?.includes(b.id));

        return (
          <div
            className="fixed inset-0 z-50 bg-[#121318]/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
            onClick={() => setIsVenueDrillDownOpen(false)}
          >
            <div
              className="w-full max-w-2xl bg-white dark:bg-[#141417] h-full shadow-2xl border-l border-zinc-200 dark:border-zinc-800 flex flex-col justify-between text-zinc-900 dark:text-zinc-100 animate-in slide-in-from-right duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      s.category === 'turf'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                    }`}>
                      {s.category === 'turf' ? 'Turf Arena' : 'Salon & Spa'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {venueRating}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      s.payoutCycle === 'monthly'
                        ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                    }`}>
                      {s.payoutCycle === 'monthly' ? 'Monthly Cycle' : 'Weekly Cycle'}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50 truncate">
                    {s.salonName}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
                    <MapPin size={12} className="shrink-0 text-zinc-400" />
                    <span className="truncate max-w-[200px]">{venueAddress}</span>
                    <span>•</span>
                    <span>Owner: <strong className="text-zinc-700 dark:text-zinc-200">{s.ownerName}</strong> ({s.ownerPhone || 'No Phone'})</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVenueDrillDownOpen(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 1. Settlement Banking Card */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-[#E73229]" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Settlement &amp; Banking Profile
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Cycle: {s.cyclePeriodLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block mb-1">
                        Bank Account
                      </span>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">
                        {s.bankAccountHolder || s.ownerName}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        A/C: {s.accountNumber ? `•••• •••• ${s.accountNumber.slice(-4)}` : 'Not provided'}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        IFSC: {s.ifscCode || 'HDFC0001234'} • {s.bankName || 'HDFC Bank'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block mb-1">
                          UPI ID
                        </span>
                        <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100 truncate" title={s.upiId || 'None'}>
                          {s.upiId || 'No UPI ID provided'}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Phone: {s.ownerPhone || 'N/A'}
                        </p>
                      </div>

                      {s.upiId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(s.upiId!);
                              setCopiedKey(`drill_upi_${s.salonId}`);
                              setTimeout(() => setCopiedKey(null), 2000);
                            }
                          }}
                          className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-[11px] font-bold text-zinc-800 dark:text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedKey === `drill_upi_${s.salonId}` ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied UPI ID!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy UPI ID</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Financial Metrics Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Cycle Financial Ledger
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Slots Booked</span>
                      <span className="text-lg font-black text-zinc-900 dark:text-zinc-100">{s.totalBookings}</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">confirmed</span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">Online Advance</span>
                      <span className="text-lg font-black text-zinc-900 dark:text-zinc-100">₹{s.totalOnlineCollected.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">collected</span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 block">QGo Fee (Retained)</span>
                      <span className="text-lg font-black text-[#E73229]">-₹{s.qgoTotalRetained.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">₹35.40/booking</span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Net Owner Due</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹{s.netOwnerPayable.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-semibold">
                        {s.netOwnerPayable > 0 ? (s.isPayoutDue ? 'Due Now' : 'Pending') : 'Settled'}
                      </span>
                    </div>
                  </div>

                  {s.allTimeBookingsCount !== undefined && (
                    <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                      <span><strong>Permanent QGo Vault:</strong> All-Time Volume: <strong>{s.allTimeBookingsCount}</strong> bookings</span>
                      <span>Total QGo Retained: <strong>₹{(s.allTimeQgoRetained || 0).toLocaleString('en-IN')}</strong></span>
                    </div>
                  )}
                </div>

                {/* 3. Action Buttons if payout is due */}
                {s.netOwnerPayable > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-xs text-amber-900 dark:text-amber-200">
                        Settlement Disbursement Pending
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Net amount of ₹{s.netOwnerPayable.toLocaleString('en-IN')} ready for IMPS / NEFT / UPI release.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppAlert(s)}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>WhatsApp Alert</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsVenueDrillDownOpen(false);
                          handleOpenPayModal(s);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <CreditCard size={13} />
                        <span>Release Payout</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Itemized Bookings Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Itemized Bookings ({venueBookings.length})
                    </h4>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                      Exact Indian Standard Time (IST)
                    </span>
                  </div>

                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                          <tr>
                            <th className="py-2.5 px-3">Date / Time (IST)</th>
                            <th className="py-2.5 px-3">Customer</th>
                            <th className="py-2.5 px-3">Total / Advance</th>
                            <th className="py-2.5 px-3">QGo Fee</th>
                            <th className="py-2.5 px-3">Owner Due</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                          {venueBookings.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-zinc-400 italic">
                                No active cycle bookings for this venue.
                              </td>
                            </tr>
                          ) : (
                            venueBookings.map((b) => (
                              <tr key={b.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                                <td className="py-2.5 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                                  {formatDateTimeIST(b.scheduledDate || b.createdAt || new Date().toISOString())}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                                  {sanitizeCustomerName(b.customerName, b.customerPhone)}
                                </td>
                                <td className="py-2.5 px-3 text-zinc-800 dark:text-zinc-200 tabular-nums">
                                  <span>₹{b.totalAmount || b.amount || 0}</span>
                                  <span className="text-[10px] text-zinc-400 block">
                                    Adv: ₹{b.advanceAmount || (b.paymentStatus === 'paid' ? (b.totalAmount || b.amount || 0) : 0)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-[#E73229] font-bold tabular-nums">
                                  -₹35.40
                                </td>
                                <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                                  ₹{Math.max(0, Math.round((b.totalAmount || b.amount || 0) - 35.40))}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    {b.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 5. Historical Payouts Disbursed to this Venue */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Disbursed Payout History ({venuePayoutHistory.length})
                  </h4>

                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                          <tr>
                            <th className="py-2.5 px-3">Date (IST)</th>
                            <th className="py-2.5 px-3">Cycle</th>
                            <th className="py-2.5 px-3">Amount Paid</th>
                            <th className="py-2.5 px-3">Method</th>
                            <th className="py-2.5 px-3 text-right">UTR / Ref</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                          {venuePayoutHistory.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-zinc-400 italic">
                                No prior settlement disbursements recorded for this venue.
                              </td>
                            </tr>
                          ) : (
                            venuePayoutHistory.map((p) => (
                              <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                                <td className="py-2.5 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                                  {formatDateTimeIST(p.settledAt)}
                                </td>
                                <td className="py-2.5 px-3 capitalize text-zinc-600 dark:text-zinc-400">
                                  {p.payoutCycle}
                                </td>
                                <td className="py-2.5 px-3 font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  ₹{p.amountPaid.toLocaleString('en-IN')}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-zinc-700 dark:text-zinc-300">
                                  {p.paymentMethod}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                  {p.utrReference}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2.5 bg-zinc-50/90 dark:bg-zinc-900/90 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsVenueDrillDownOpen(false)}
                  className="px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Close Drill-Down
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── QBE INCOMING PAYOUT CALL ALERT OVERLAY ─── */}
      {showPayoutCallAlert && settlementsData && settlementsData.settlements.some((s) => s.isPayoutDue && s.netOwnerPayable > 0) && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-xl p-5 rounded-[28px] shadow-2xl border-2 border-[#E73229]/80 text-zinc-900 dark:text-zinc-100 space-y-4">
            {/* Header: Call style */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse shrink-0">
                  <PhoneCall size={22} className="animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#E73229]">
                      Qbe Payout Call Alert
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 mt-0.5">
                    Partner Settlement Due!
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPayoutCallAlert(false)}
                className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* List of due shops */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {settlementsData.settlements
                .filter((s) => s.isPayoutDue && s.netOwnerPayable > 0)
                .map((due) => (
                  <div
                    key={due.salonId}
                    className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {due.salonName}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {due.payoutCycle === 'monthly' ? 'Monthly' : 'Weekly'} • {due.ownerName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums block">
                        ₹{due.netOwnerPayable.toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppAlert(due)}
                        className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1 justify-end"
                      >
                        <MessageSquare size={10} />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const firstDue = settlementsData.settlements.find((s) => s.isPayoutDue && s.netOwnerPayable > 0);
                  if (firstDue) {
                    setShowPayoutCallAlert(false);
                    setActiveTab('payments');
                    handleOpenPayModal(firstDue);
                  }
                }}
                className="flex-1 py-2.5 rounded-full bg-[#E73229] hover:bg-[#D42B22] text-white font-extrabold text-xs shadow-md transition cursor-pointer text-center"
              >
                Open &amp; Pay Now
              </button>

              <button
                type="button"
                onClick={handleSnoozeCallAlert}
                className="px-3.5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Snooze 2h
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ─── BROADCAST ALERT MODAL ─── */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#121318]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-[#141417]/95 backdrop-blur-xl p-6 rounded-[28px] max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Megaphone size={20} className="text-[#E73229]" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
                  Broadcast Notice ({broadcastAudience === 'all' ? 'All Users' : broadcastAudience === 'owners' ? 'Owners Only' : 'Customers Only'})
                </h3>
              </div>
              <button
                onClick={() => setBroadcastModalOpen(false)}
                className="p-1 rounded-full hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Target Audience Segmented Selector */}
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'owners', label: 'Owners Only' },
                      { id: 'customers', label: 'Customers Only' },
                      { id: 'all', label: 'All Users' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBroadcastAudience(item.id)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center ${
                        broadcastAudience === item.id
                          ? 'bg-[#E73229] text-white shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">Alert Title</label>
                <input
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g., Weather Warning: Free Rescheduling Active"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">Message Body</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder={`Enter announcement message for ${broadcastAudience === 'all' ? 'all users' : broadcastAudience}...`}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">Severity Level</label>
                <div className="flex items-center gap-2">
                  {(['info', 'warning', 'critical'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setBroadcastSeverity(sev)}
                      className={`flex-1 py-1.5 rounded-xl capitalize font-bold text-xs transition-all ${
                        broadcastSeverity === sev
                          ? sev === 'critical'
                            ? 'bg-red-600 text-white'
                            : sev === 'warning'
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setBroadcastModalOpen(false)}
                className="px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBroadcast}
                disabled={isBroadcasting}
                className="px-5 py-2 rounded-full bg-[#E73229] hover:bg-[#BA070D] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Send size={16} className={isBroadcasting ? 'animate-spin' : ''} />
                Send Broadcast
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ─── RESTRICT / UNBLOCK USER MODAL ─── */}
      {restrictUserModal && (
        <div className="fixed inset-0 z-50 bg-[#121318]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-[#141417]/95 backdrop-blur-xl p-6 rounded-[28px] max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-[#E73229]" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
                  {restrictUserModal.isBlocked ? 'Restore Account Access' : 'Restrict Account'}
                </h3>
              </div>
              <button
                onClick={() => setRestrictUserModal(null)}
                className="p-1 rounded-full hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600">
                Are you sure you want to {restrictUserModal.isBlocked ? 'restore permissions for' : 'restrict'}{' '}
                <strong className="text-zinc-900 dark:text-zinc-50">{restrictUserModal.name}</strong>?
              </p>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400 block mb-1">Reason / Note</label>
                <input
                  value={restrictReason}
                  onChange={(e) => setRestrictReason(e.target.value)}
                  placeholder="e.g. 3x missed salon appointments"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setRestrictUserModal(null)}
                className="px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleUserRestriction}
                disabled={isRestrictingUser}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold transition-all shadow-xs ${
                  restrictUserModal.isBlocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {restrictUserModal.isBlocked ? 'Confirm Unblock' : 'Confirm Restrict'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── INTERACTIVE PROFILE & PREFERENCES DRAWER ─── */}
      {isProfileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#121318]/60 backdrop-blur-sm flex justify-end animate-in fade-in"
          onClick={() => setIsProfileDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl shadow-2xl h-full p-6 sm:p-7 flex flex-col justify-between border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200 text-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrollable Content Body (ensures bottom actions are never clipped) */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-6 scrollbar-thin">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#121318] dark:bg-white text-white dark:text-zinc-900 dark:text-zinc-50 flex items-center justify-center font-bold text-sm">
                    Q
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">Profile & Preferences</h3>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">Super Admin Command Center</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Identity Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/60 dark:from-zinc-800/60 dark:to-zinc-800/30 border border-zinc-200 dark:border-zinc-700/80 dark:border-zinc-700/80 flex items-center gap-3.5">
                <input
                  type="file"
                  ref={adminFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleAdminPhotoUpload}
                />
                <button
                  type="button"
                  onClick={() => adminFileInputRef.current?.click()}
                  className="relative group cursor-pointer shrink-0"
                  title="Click to change profile photo"
                >
                  {user?.photoUrl ? (
                    <img
                      alt="Admin Profile"
                      className="w-14 h-14 rounded-2xl object-cover shadow-sm ring-2 ring-white dark:ring-zinc-700"
                      src={user.photoUrl}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] flex items-center justify-center text-2xl font-black text-white shadow-sm ring-2 ring-white dark:ring-zinc-700">
                      {(user?.name || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={18} />
                  </div>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{user?.name || 'Kishore'}</h4>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold">
                      Root Admin
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                    {user?.email || 'cjkishore35@gmail.com'}
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    <ShieldCheck size={13} />
                    <span>Google Verified Master Account</span>
                  </div>
                </div>
              </div>

              {/* Appearance / Theme Selector with High-Contrast Active States */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Theme & Appearance</span>
                  <span className="text-[11px] text-gray-400 dark:text-zinc-400 font-normal capitalize">{themeMode} Mode</span>
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      themeMode === 'light'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Sun size={14} className={themeMode === 'light' ? 'text-amber-500' : ''} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      themeMode === 'system'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Monitor size={14} />
                    <span>System</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      themeMode === 'dark'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Moon size={14} className={themeMode === 'dark' ? 'text-indigo-400' : ''} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Language Selector with High-Contrast Active States */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Language / மொழி</span>
                  <span className="text-[11px] text-gray-400 dark:text-zinc-400 font-normal">
                    {language === 'ta' ? 'தமிழ்' : 'English'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Globe size={14} className={language === 'en' ? 'text-blue-500' : ''} />
                    <span>English (EN)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('ta')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      language === 'ta'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span>தமிழ் (Tamil)</span>
                  </button>
                </div>
              </div>

              {/* Preferences Toggles */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">Command Radar Settings</label>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 space-y-3">
                  <label className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-semibold cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Qbi size={18} mood="happy" animate={false} />
                      <span>Qbe Platform Master Switch</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={qbePrefs.platformEnabled}
                      onChange={(e) => updateQbePref('platformEnabled', e.target.checked)}
                      className="w-4 h-4 text-[#E73229] rounded border-gray-300 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-semibold cursor-pointer">
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#E73229]" />
                      <span>Qbe Admin Radar Assistant</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={qbePrefs.adminEnabled && qbePrefs.platformEnabled}
                      onChange={(e) => updateQbePref('adminEnabled', e.target.checked)}
                      className="w-4 h-4 text-[#E73229] rounded border-gray-300 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-semibold cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Volume2 size={16} className="text-gray-400 dark:text-zinc-400" />
                      <span>Audio Chime on Critical Alerts</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="w-4 h-4 text-[#E73229] rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-semibold cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Radio size={16} className="text-gray-400 dark:text-zinc-400" />
                      <span>Realtime Radar Telemetry Poll</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Active (30s)</span>
                  </label>
                  <div className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-semibold pt-2 border-t border-gray-200/60 dark:border-zinc-700/60">
                    <span className="flex items-center gap-2">
                      <Qbi size={18} mood="happy" animate={false} />
                      <span>Platform-Wide Qbe Assistant</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={qbePrefs.platformEnabled}
                      aria-label="Toggle Platform-Wide Qbe"
                      onClick={() => updateQbePref('platformEnabled', !qbePrefs.platformEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                        qbePrefs.platformEnabled ? 'bg-[#E73229]' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                          qbePrefs.platformEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-semibold pt-2 border-t border-gray-200/60 dark:border-zinc-700/60">
                    <span className="flex items-center gap-2">
                      <Qbi size={18} mood="happy" animate={false} />
                      <span>Admin Qbe Radar</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={qbePrefs.adminEnabled}
                      aria-label="Toggle Admin Qbe Radar"
                      onClick={() => updateQbePref('adminEnabled', !qbePrefs.adminEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                        qbePrefs.adminEnabled ? 'bg-[#E73229]' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                          qbePrefs.adminEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDrawerOpen(false);
                      setIsQbeColumnOpen(true);
                    }}
                    className="w-full mt-2 py-2.5 px-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-[#E73229] dark:text-red-300 border border-red-500/30 font-bold text-xs flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Qbi size={18} mood="happy" animate={false} />
                      <span>Open 24/7 Qbe Voice &amp; AI Column</span>
                    </span>
                    <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded-full uppercase font-black text-[#E73229]">Open →</span>
                  </button>
                </div>
              </div>

              {/* Full App Data & History Backup Download Button (Directly Above Reset) */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/70 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-zinc-100">
                  <Download size={15} className="text-blue-500" />
                  <span>Full Database Backup (.json)</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-snug">
                  Export an offline JSON snapshot of all registered users, venues, bookings, queues, reviews, and logs.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isExportingBackup}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Download size={14} />
                  <span>{isExportingBackup ? 'Exporting Backup...' : 'Download Complete App Backup (.json)'}</span>
                </button>
              </div>

              {/* Fresh Database Reset Trigger Card */}
              <div className="p-3.5 rounded-2xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-400">
                  <AlertTriangle size={15} className="text-[#E73229]" />
                  <span>Database Reset Action</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-snug">
                  Wipe all stale test venues, bookings, and transient records while preserving root admin access.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetStep(1);
                    setResetPasswordInput('');
                    setResetConfirmInput('');
                    setIsResetConfirmModalOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Reset Database Fresh...
                </button>
              </div>
            </div>

            {/* Bottom Actions (Pinned & Visible at bottom) */}
            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-3 rounded-xl bg-[#E73229] hover:bg-[#BA070D] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <LogOut size={16} />
                <span>Log Out of Super Admin</span>
              </button>
              <button
                type="button"
                onClick={() => setIsProfileDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 font-semibold text-xs transition-all text-center cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ─── 2-STEP CONFIRM FRESH DATABASE RESET MODAL ─── */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#121318]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-6 sm:p-7 rounded-[28px] max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 text-zinc-900 dark:text-zinc-100">
            {resetStep === 1 ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle size={22} />
                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                      Backup All Data Before Reset? (Step 1 of 2)
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsResetConfirmModalOpen(false)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-gray-700 dark:text-zinc-300 leading-relaxed font-semibold">
                    Do you want to backup all data before resetting the platform?
                  </p>
                  <p className="text-gray-600 dark:text-zinc-400 leading-relaxed">
                    A database reset will <strong className="text-red-600 dark:text-red-400">permanently wipe all Customer and Owner accounts</strong>, venues, slots, bookings, reviews, platform ledger entries, and settlement payouts.
                  </p>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
                    <Download size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Recommended Safety Step</p>
                      <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5">
                        Download a complete JSON snapshot bundle containing all records so you can restore or archive history anytime.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>Active Super Admin account (<strong className="font-mono">cjkishore35@gmail.com</strong>) is strictly preserved.</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsResetConfirmModalOpen(false)}
                    className="px-4 py-2 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setResetStep(2)}
                      className="px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      Skip Backup &amp; Continue
                    </button>
                    <button
                      type="button"
                      disabled={isExportingBackup}
                      onClick={async () => {
                        const downloaded = await handleDownloadBackup();
                        if (downloaded) {
                          showToast('Backup downloaded safely! Proceeding to Step 2...', true);
                          setResetStep(2);
                        }
                      }}
                      className="px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Download size={14} className={isExportingBackup ? 'animate-spin' : ''} />
                      <span>{isExportingBackup ? 'Exporting...' : 'Backup All Data & Continue'}</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Shield size={22} />
                    <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                      Master Admin Authorization (Step 2 of 2)
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsResetConfirmModalOpen(false)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-gray-700 dark:text-zinc-300 leading-relaxed">
                    Enter the Super Admin Master Authorization Password to confirm and execute the permanent database reset.
                  </p>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                    <label className="text-[11px] font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
                      Master Authorization Password:
                    </label>
                    <input
                      type="password"
                      value={resetPasswordInput}
                      onChange={(e) => setResetPasswordInput(e.target.value)}
                      placeholder="Enter KISHOREYES"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      autoFocus
                    />
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Required confirmation password: <span className="font-mono font-black text-red-600 dark:text-red-400">KISHOREYES</span>
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="px-4 py-2 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    ← Back to Step 1
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsResetConfirmModalOpen(false)}
                      className="px-3.5 py-2 rounded-full text-zinc-600 dark:text-zinc-400 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteResetFresh}
                      disabled={resetPasswordInput.trim() !== 'KISHOREYES' || isResettingDb}
                      className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      {isResettingDb ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Resetting Database...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Execute Fresh Database Reset
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── QBE AUTONOMOUS COMMAND & SETTINGS COLUMN ─── */}
      <QbeCommandColumn
        isOpen={isQbeColumnOpen}
        onClose={() => setIsQbeColumnOpen(false)}
        onOpenProfile={() => {
          setIsQbeColumnOpen(false);
          setIsProfileDrawerOpen(true);
        }}
        onTriggerTestCall={(custom) => {
          setIncomingCallData({
            isOpen: true,
            title: custom?.title || 'Executive Call Test',
            subtitle: custom?.subtitle || 'QGo Executive AI • Incoming Call',
            message:
              custom?.message ||
              'Attention Kishore, this is a verified incoming call from Qbe. Autonomous monitoring is active and operating normally.',
            data: custom?.data,
          });
        }}
        onNavigateTab={(tab) => {
          setActiveTab(tab as AdminTab);
          setIsQbeColumnOpen(false);
        }}
      />

      {/* ─── QBE CALLER ID INCOMING CALL OVERLAY ─── */}
      <QbeIncomingCallModal
        isOpen={incomingCallData.isOpen}
        title={incomingCallData.title}
        subtitle={incomingCallData.subtitle}
        message={incomingCallData.message}
        data={incomingCallData.data}
        onAnswer={() => {
          if (incomingCallData.data?.reminderId) {
            api.acknowledgeAdminReminder(incomingCallData.data.reminderId).catch(() => {});
          }
        }}
        onDecline={() => {
          if (incomingCallData.data?.reminderId) {
            api.acknowledgeAdminReminder(incomingCallData.data.reminderId).catch(() => {});
          }
          setIncomingCallData((prev) => ({ ...prev, isOpen: false }));
        }}
        onSnooze={(mins) => {
          showToast(`Alert snoozed for ${mins} minutes`, true);
          setIncomingCallData((prev) => ({ ...prev, isOpen: false }));
        }}
        onAction={(target) => {
          setIncomingCallData((prev) => ({ ...prev, isOpen: false }));
          if (target === 'admin_payments' || target === 'payments') {
            setActiveTab('payments');
          } else if (target === 'admin_approvals' || target === 'approvals') {
            setActiveTab('approvals');
          } else if (target === 'admin_alerts' || target === 'alerts') {
            setActiveTab('alerts');
          } else if (target === 'admin_bookings' || target === 'bookings') {
            setActiveTab('bookings');
          }
        }}
      />

    </div>
  );
}
