import React, { Component, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QbiContext } from './QbiProvider';
import { Qbi } from './Qbi';
import { t } from './qbiCopy';
import { AuthContext } from '../../context/AuthContext';
import { useQbePreferences, isQbeActiveForRole } from './qbePreferences';
import { checkSlotReminders, QbeReminderAlert } from './slotReminderEngine';
import {
  handleCustomerAction,
  handleOwnerAction,
  handleAdminAction,
  getAdminDailyBriefing,
  AdminDailyBriefingData,
  QbeActionResponse,
} from './qbeAssistantActions';
import {
  Bot,
  Loader2,
  X,
  Bell,
  Send,
  ChevronRight,
  Newspaper,
  Users,
  Store,
  Wallet,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Activity,
  CheckCircle2,
  Pencil,
  Check,
} from 'lucide-react';

// Self-contained Error Boundary so a render error in Qbe never white-screens the app
export class QbiBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  props: { children: React.ReactNode };
  state: { hasError: boolean } = { hasError: false };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error('[Qbe] UI render error caught by boundary:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export const QbeBoundary = QbiBoundary;

export const QbiLayerContent: React.FC = () => {
  const ctx = useContext(QbiContext);
  const auth = useContext(AuthContext);
  const authUser = auth?.user || null;

  // STRICT REQUIREMENT: Only render Qbe when authenticated with a valid user
  if (!authUser) {
    return null;
  }

  const isSuperAdmin =
    authUser?.role === 'admin' ||
    authUser?.activeRole === 'admin' ||
    auth?.currentRole === 'admin';
  const currentRole = isSuperAdmin
    ? 'admin'
    : (auth?.currentRole || authUser?.role || 'customer');

  const { prefs, updatePref, customName, setCustomName } = useQbePreferences();
  const [isEditingPanelName, setIsEditingPanelName] = useState(false);
  const [tempPanelName, setTempPanelName] = useState(customName);

  // Modal awareness: auto-hide Qbe when full-screen dialog/modal/drawer/wizard is open
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkModals = () => {
      if (typeof document === 'undefined') return;
      const modal = document.querySelector(
        '[role="dialog"]:not(.qbe-root), [role="alertdialog"]:not(.qbe-root), .q-modal, [data-modal="open"], [aria-modal="true"]:not(.qbe-root), .wizard-container'
      );
      setIsModalOpen(Boolean(modal));
    };

    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'role', 'class'],
    });

    return () => observer.disconnect();
  }, []);

  // First-time instruction card state
  const [showFirstTimeCard, setShowFirstTimeCard] = useState(() => !prefs.onboarded);

  // Assistant Chat Panel state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<QbeReminderAlert | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [activeResponse, setActiveResponse] = useState<QbeActionResponse | null>(null);
  const [customInput, setCustomInput] = useState('');

  // ─── ADMIN DAILY EXECUTIVE BRIEFING ("News Reader") ───
  const [showAdminBriefing, setShowAdminBriefing] = useState(false);
  const [briefingData, setBriefingData] = useState<AdminDailyBriefingData | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  const checkAndTriggerDailyBriefing = useCallback(async (force = false) => {
    if (currentRole !== 'admin') return;
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = localStorage.getItem('qgo.qbe.adminNewsDate');

    if (force || lastDate !== today) {
      setIsLoadingBriefing(true);
      setShowAdminBriefing(true);
      try {
        const data = await getAdminDailyBriefing();
        setBriefingData(data);
      } catch (err) {
        console.debug('[Qbe] Briefing error:', err);
      } finally {
        setIsLoadingBriefing(false);
      }
    }
  }, [currentRole]);

  useEffect(() => {
    if (currentRole === 'admin' && prefs.platformEnabled && prefs.adminEnabled && !isModalOpen) {
      checkAndTriggerDailyBriefing(false);
    }
  }, [currentRole, prefs.platformEnabled, prefs.adminEnabled, isModalOpen, checkAndTriggerDailyBriefing]);

  const handleDismissBriefing = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('qgo.qbe.adminNewsDate', today);
    setShowAdminBriefing(false);
  };

  // ─── DRAGGABLE SYSTEM (60-120fps direct DOM translation + safe clamping) ───
  const getInitialPosition = (): { x: number; y: number } => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    const isDesktop = window.innerWidth >= 1024;
    const isCust = currentRole !== 'owner' && currentRole !== 'admin';
    const defaultX = Math.max(16, window.innerWidth - (isDesktop ? 140 : 130));
    const defaultY = Math.max(16, window.innerHeight - (isCust ? 145 : (isDesktop ? 80 : 85)));

    try {
      const saved = localStorage.getItem('qgo.qbe.position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(16, window.innerWidth - 130);
          const maxY = Math.max(16, window.innerHeight - 80);
          const clampedX = Math.min(Math.max(16, parsed.x), maxX);
          const clampedY = Math.min(Math.max(16, parsed.y), maxY);

          // Top-right avoidance: prevent overlapping top-right header controls (Sync badge, notification bell)
          if (clampedY < 100 && clampedX > window.innerWidth - 280) {
            return { x: defaultX, y: defaultY };
          }
          return {
            x: clampedX,
            y: clampedY,
          };
        }
      }
    } catch {}

    return {
      x: defaultX,
      y: defaultY,
    };
  };

  const [position, setPosition] = useState<{ x: number; y: number }>(getInitialPosition);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const posRef = useRef(position);
  posRef.current = position;

  // Window resize bounds handler
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(16, window.innerWidth - 130);
        const maxY = Math.max(16, window.innerHeight - 80);
        let x = Math.min(Math.max(16, prev.x), maxX);
        let y = Math.min(Math.max(16, prev.y), maxY);
        if (y < 100 && x > window.innerWidth - 280) {
          x = Math.max(16, window.innerWidth - 140);
          y = Math.max(16, window.innerHeight - (currentRole === 'admin' ? 80 : 85));
        }
        return { x, y };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...posRef.current };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (!hasMovedRef.current && Math.hypot(dx, dy) >= 6) {
      hasMovedRef.current = true;
    }
    if (!hasMovedRef.current) return;

    const pillWidth = pillRef.current?.offsetWidth || 115;
    const pillHeight = pillRef.current?.offsetHeight || 50;
    const minX = 16;
    const maxX = Math.max(16, window.innerWidth - pillWidth - 16);
    const minY = 16;
    const isCust = currentRole !== 'owner' && currentRole !== 'admin';
    const bottomNavOffset = isCust ? 74 : 16;
    const maxY = Math.max(16, window.innerHeight - pillHeight - bottomNavOffset);

    const newX = Math.min(Math.max(minX, posStartRef.current.x + dx), maxX);
    const newY = Math.min(Math.max(minY, posStartRef.current.y + dy), maxY);

    posRef.current = { x: newX, y: newY };
    if (pillRef.current) {
      pillRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (hasMovedRef.current) {
      try {
        localStorage.setItem('qgo.qbe.position', JSON.stringify(posRef.current));
      } catch {}
      setPosition({ ...posRef.current });
    } else {
      // Tap event! Toggle assistant popover
      setIsAssistantOpen((prev) => !prev);
      if (activeAlert) setActiveAlert(null);
    }
  };

  // Smart Popover Anchoring based on Qbe coordinates
  const getPopoverStyle = (): React.CSSProperties => {
    if (typeof window === 'undefined') return {};
    const width = Math.min(360, window.innerWidth - 32);
    const height = 440;
    const pillWidth = pillRef.current?.offsetWidth || 115;
    const pillHeight = pillRef.current?.offsetHeight || 50;

    // Horizontal anchoring
    let left = posRef.current.x;
    if (posRef.current.x > window.innerWidth / 2) {
      left = posRef.current.x + pillWidth - width;
    }
    left = Math.min(Math.max(16, left), window.innerWidth - width - 16);

    // Vertical anchoring
    let top = posRef.current.y;
    if (posRef.current.y > window.innerHeight / 2) {
      top = posRef.current.y - height - 12;
    } else {
      top = posRef.current.y + pillHeight + 12;
    }
    top = Math.min(Math.max(16, top), window.innerHeight - height - 16);

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      maxHeight: `calc(100vh - 32px)`,
      zIndex: 9999,
    };
  };

  // Automated 30-second Pre-Slot Reminder Monitor
  useEffect(() => {
    if (!prefs.platformEnabled || !prefs.enabled || !isQbeActiveForRole(currentRole)) {
      return;
    }

    const check = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const alert = await checkSlotReminders(
        currentRole === 'owner' ? 'owner' : 'customer',
        authUser?.id,
        authUser?.salonId
      );
      if (alert) {
        setActiveAlert(alert);
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [prefs.platformEnabled, prefs.enabled, currentRole, authUser?.id, authUser?.salonId]);

  // First-Time Enable / Disable Handlers
  const handleEnableQbe = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    } catch {}

    updatePref('enabled', true);
    updatePref('onboarded', true);
    setShowFirstTimeCard(false);
  };

  const handleDisableQbe = () => {
    updatePref('enabled', false);
    updatePref('onboarded', true);
    setShowFirstTimeCard(false);
  };

  // Role Action Chips
  const customerChips = [
    { id: 'nearest', label: 'Nearest open turf', icon: '📍' },
    { id: 'upcoming', label: 'My upcoming slot & queue', icon: '🎫' },
    { id: 'refunds', label: 'Cancellation & refund policy', icon: '💳' },
  ];

  const ownerChips = [
    { id: 'next_2_hours', label: 'Upcoming slots (next 2 hrs)', icon: '⏰' },
    { id: 'pending_balance', label: 'Pending balance collections', icon: '💰' },
    { id: 'today_summary', label: 'Today’s venue summary', icon: '📊' },
  ];

  const adminChips = [
    { id: 'daily_briefing', label: "Today's Briefing", icon: '📰' },
    { id: 'payouts_due', label: 'Payouts & Settlements', icon: '💰' },
    { id: 'pending_approvals', label: 'Pending venue approvals', icon: '🛡️' },
    { id: 'active_alerts', label: 'Active intimations', icon: '⚠️' },
    { id: 'platform_pulse', label: 'Platform pulse', icon: '📈' },
  ];

  const activeChips =
    currentRole === 'admin'
      ? adminChips
      : currentRole === 'owner'
      ? ownerChips
      : customerChips;

  const roleBadge =
    currentRole === 'admin'
      ? 'Admin Command Radar'
      : currentRole === 'owner'
      ? 'Owner Co-Pilot'
      : 'Customer Smart Assistant';

  const handleExecuteChip = async (chipId: string) => {
    if (chipId === 'daily_briefing') {
      checkAndTriggerDailyBriefing(true);
      return;
    }
    setIsThinking(true);
    try {
      let resp: QbeActionResponse;
      if (currentRole === 'admin') {
        resp = await handleAdminAction(chipId as any);
      } else if (currentRole === 'owner') {
        resp = await handleOwnerAction(chipId as any, authUser?.salonId);
      } else {
        resp = await handleCustomerAction(chipId as any);
      }
      setActiveResponse(resp);
    } catch {
      setActiveResponse({ text: 'Unable to query live telemetry right now. Please try again.' });
    } finally {
      setIsThinking(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isThinking) return;

    const query = customInput.trim();
    setCustomInput('');
    setIsThinking(true);

    try {
      let resp: QbeActionResponse;
      if (currentRole === 'admin') {
        resp = await handleAdminAction('custom', query);
      } else if (currentRole === 'owner') {
        resp = await handleOwnerAction('custom', authUser?.salonId, query);
      } else {
        resp = await handleCustomerAction('custom', query);
      }
      setActiveResponse(resp);
    } catch {
      setActiveResponse({ text: 'Could not fetch data for that request. Try tapping one of the quick action chips above.' });
    } finally {
      setIsThinking(false);
    }
  };

  const handleCardAction = (target?: string, data?: any) => {
    if (!target) return;
    setIsAssistantOpen(false);

    if (target.startsWith('ticket_')) {
      const bookingId = target.replace('ticket_', '');
      sessionStorage.setItem('qgo_sbid', bookingId);
      window.dispatchEvent(new CustomEvent('qgo-navigate-tab', { detail: 'booking' }));
    } else if (target.startsWith('venue_')) {
      window.dispatchEvent(new CustomEvent('qgo-select-venue', { detail: data }));
    } else if (target === 'nav_bookings') {
      window.dispatchEvent(new CustomEvent('qgo-navigate-tab', { detail: 'booking' }));
    } else if (target === 'nav_turf') {
      window.dispatchEvent(new CustomEvent('qgo-navigate-tab', { detail: 'turf' }));
    } else if (target === 'owner_schedule' || target === 'owner_calendar') {
      window.dispatchEvent(new CustomEvent('qgo-owner-navigate', { detail: 'schedule' }));
    } else if (target === 'owner_bookings') {
      window.dispatchEvent(new CustomEvent('qgo-owner-navigate', { detail: 'bookings' }));
    } else if (target === 'owner_earnings') {
      window.dispatchEvent(new CustomEvent('qgo-owner-navigate', { detail: 'earnings' }));
    } else if (target === 'admin_approvals') {
      window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'approvals' }));
    } else if (target === 'admin_alerts') {
      window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'alerts' }));
    } else if (target === 'admin_overview') {
      window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'overview' }));
    } else if (target === 'admin_customers') {
      window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'customers' }));
    } else if (target === 'admin_bookings') {
      window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'bookings' }));
    }
  };

  const isRoleEnabled = isQbeActiveForRole(currentRole);

  // If globally or role-disabled, hide completely
  if (!prefs.platformEnabled || !prefs.enabled || !isRoleEnabled) {
    return null;
  }

  // Preserve offline banner from original context if present
  const bannerState = ctx?.bannerState || 'hidden';
  const language = ctx?.language || 'en';

  // Dynamic Mood Selection:
  const mascotMood = isThinking
    ? 'thinking'
    : activeAlert
    ? 'excited'
    : activeResponse?.card?.badge === 'Action Required' || activeResponse?.card?.badge === 'Investigate'
    ? 'sad'
    : 'happy';

  return (
    <>
      {/* Offline Banner (kept from original context) */}
      {bannerState !== 'hidden' && (
        <aside
          role="status"
          aria-live="polite"
          className={`qbi-offline-banner ${
            bannerState === 'back-online' ? 'qbi-offline-banner--online' : ''
          }`}
        >
          <Qbi mood={bannerState === 'back-online' ? 'happy' : 'sad'} size={22} animate={false} />
          <span>
            {bannerState === 'back-online'
              ? t(language, 'backOnline')
              : t(language, 'offlineBanner')}
          </span>
        </aside>
      )}

      {/* ================= 1. First-Time Instruction Card ================= */}
      {showFirstTimeCard && !isModalOpen && (
        <div
          role="region"
          aria-label="Meet Qbe Assistant"
          className="qbe-root fixed right-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-20 z-40 w-[320px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-5 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#E8342A]/10 flex items-center justify-center mb-3">
            <Qbi mood="happy" size={56} animate={true} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8342A]/10 text-[#E8342A] text-[10px] font-extrabold uppercase tracking-wider mb-2">
            <Qbi size={14} mood="happy" animate={false} />
            <span>Meet Qbe Assistant</span>
          </div>
          <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-50 mb-1 tracking-tight">
            Your Smart QGo Co-Pilot
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            Meet Qbe! Your smart QGo assistant — get timely reminders before your booked slots start, instant venue &amp; queue help, and live updates.
          </p>
          <div className="flex flex-col w-full gap-2">
            <button
              type="button"
              onClick={handleEnableQbe}
              className="w-full py-2.5 px-4 rounded-xl bg-[#E8342A] hover:bg-[#D42B22] text-white font-bold text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell size={14} />
              <span>Enable Qbe &amp; Slot Reminders</span>
            </button>
            <button
              type="button"
              onClick={handleDisableQbe}
              className="w-full py-2 px-4 rounded-xl text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Disable / Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* ================= 2. Alert Wake-Up Banner (When Slot Alert Active) ================= */}
      {activeAlert && !isAssistantOpen && !isModalOpen && (
        <div
          role="alert"
          aria-live="assertive"
          className="qbe-root fixed right-4 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-24 z-40 w-[300px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 border-2 border-[#E8342A]/40 dark:border-[#E8342A]/60 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[#E8342A] text-xs font-bold">
              <Bell size={13} className="animate-bounce" />
              <span>{activeAlert.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveAlert(null)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">
            {activeAlert.message}
          </p>
          <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                const bookingId = activeAlert.bookingId;
                setActiveAlert(null);
                if (currentRole === 'owner') {
                  window.dispatchEvent(new CustomEvent('qgo-owner-navigate', { detail: 'schedule' }));
                } else {
                  sessionStorage.setItem('qgo_sbid', bookingId);
                  window.dispatchEvent(new CustomEvent('qgo-navigate-tab', { detail: 'booking' }));
                }
              }}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[#E8342A] text-white text-[11px] font-bold shadow-xs hover:bg-[#D42B22] transition-colors cursor-pointer"
            >
              View Booking
            </button>
            <button
              type="button"
              onClick={() => setActiveAlert(null)}
              className="py-1.5 px-3 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 text-[11px] font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ================= 3. Draggable Floating Mascot Avatar (60-120fps direct DOM translation) ================= */}
      {!isAssistantOpen && !isModalOpen && (
        <div
          ref={pillRef}
          role="button"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            zIndex: 9998,
          }}
          className={`qbe-root group relative flex items-center justify-center w-12 h-12 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md border ${
            activeAlert
              ? 'border-2 border-[#E8342A] shadow-red-500/20 animate-bounce'
              : 'border-zinc-200/90 dark:border-zinc-800'
          } shadow-xl hover:shadow-2xl rounded-full p-1 cursor-grab active:cursor-grabbing transition-all duration-150 select-none active:scale-[0.97]`}
          aria-label={`Drag or tap ${customName} Smart Assistant`}
        >
          {activeAlert && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#E8342A] rounded-full border-2 border-white dark:border-[#18181B] animate-ping" />
          )}
          <div className="w-9 h-9 flex items-center justify-center pointer-events-none">
            <Qbi mood={mascotMood} size={36} animate={true} />
          </div>
        </div>
      )}

      {/* ================= 4. Smart-Anchored Active Chat & Popover ================= */}
      {isAssistantOpen && !isModalOpen && (
        <div
          role="region"
          aria-label={`${customName} Smart Assistant Panel`}
          style={getPopoverStyle()}
          className="qbe-root bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#E8342A]/10 flex items-center justify-center shrink-0">
                <Qbi mood={mascotMood} size={32} animate={false} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  {isEditingPanelName ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tempPanelName}
                        onChange={(e) => setTempPanelName(e.target.value)}
                        className="px-1.5 py-0.5 text-xs font-bold rounded border border-[#E8342A] bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 w-24 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (tempPanelName.trim()) setCustomName(tempPanelName.trim());
                          setIsEditingPanelName(false);
                        }}
                        className="p-1 rounded bg-[#E8342A] text-white hover:opacity-90"
                      >
                        <Check size={11} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 leading-none tracking-tight">
                        {customName} Assistant
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setTempPanelName(customName);
                          setIsEditingPanelName(true);
                        }}
                        className="text-zinc-400 hover:text-[#E8342A] p-0.5 transition-colors cursor-pointer"
                        title="Rename Assistant"
                        aria-label="Rename Assistant"
                      >
                        <Pencil size={11} />
                      </button>
                    </>
                  )}
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                </div>
                <span className="text-[10px] font-bold text-[#E8342A] uppercase tracking-wider">
                  {roleBadge}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {currentRole === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAssistantOpen(false);
                      window.dispatchEvent(new CustomEvent('qgo-open-qbe-command'));
                    }}
                    title="Open 24/7 JARVIS Voice & Command Column"
                    className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#E73229] dark:text-red-300 text-[10px] font-bold flex items-center gap-1 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                  >
                    <Qbi size={14} mood="happy" animate={false} />
                    <span>JARVIS AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => checkAndTriggerDailyBriefing(true)}
                    title="Open Today's Executive Briefing"
                    className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#E8342A] text-[10px] font-bold flex items-center gap-1 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                  >
                    <Newspaper size={12} />
                    <span>Briefing</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsAssistantOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Action Chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Quick Actions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleExecuteChip(c.id)}
                  disabled={isThinking}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <span className="text-xs">{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Response Area */}
          <div className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {isThinking && (
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
                <Loader2 size={14} className="text-[#E8342A] animate-spin" />
                <span>Qbe is scanning live telemetry…</span>
              </div>
            )}

            {!isThinking && !activeResponse && (
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-600 dark:text-zinc-400">
                Hi! Ask me anything or tap any quick action above to check slots, revenue, or platform radar.
              </div>
            )}

            {!isThinking && activeResponse && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                  {activeResponse.text}
                </p>

                {activeResponse.card && (
                  <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {activeResponse.card.title}
                        </h5>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                          {activeResponse.card.subtitle}
                        </p>
                      </div>
                      {activeResponse.card.badge && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                          activeResponse.card.badge === 'Action Required' || activeResponse.card.badge === 'Investigate'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {activeResponse.card.badge}
                        </span>
                      )}
                    </div>

                    {activeResponse.card.actionLabel && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCardAction(
                            activeResponse.card?.actionTarget,
                            activeResponse.card?.data
                          )
                        }
                        className="w-full py-1.5 px-3 rounded-xl bg-[#E8342A] hover:bg-[#D42B22] text-white text-xs font-bold transition-all active:scale-98 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>{activeResponse.card.actionLabel}</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Text Input Bar */}
          <form
            onSubmit={handleCustomSubmit}
            className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60"
          >
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={`Ask ${customName} anything…`}
              className="flex-1 bg-transparent px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none placeholder:text-zinc-400"
            />
            <button
              type="submit"
              disabled={!customInput.trim() || isThinking}
              className="w-7 h-7 rounded-xl bg-[#E8342A] disabled:opacity-40 text-white flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer shrink-0"
              aria-label="Send to Qbe"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}

      {/* ================= 5. ONCE-DAILY CENTER "NEWS READER" EXECUTIVE BRIEFING ================= */}
      {showAdminBriefing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Qbe Daily Executive Briefing"
          className="qbe-root fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleDismissBriefing}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#141417] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-[28px] shadow-2xl p-6 sm:p-7 flex flex-col gap-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E8342A]/10 flex items-center justify-center shrink-0">
                  <Qbi mood="excited" size={44} animate={true} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8342A]/10 text-[#E8342A] text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    <Newspaper size={11} />
                    <span>Daily Executive Briefing</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50 leading-tight">
                    Good Morning, Admin!
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Live QGo platform growth &amp; telemetry pulse · {briefingData?.date || 'Today'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissBriefing}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            {isLoadingBriefing ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-zinc-500 text-xs">
                <Loader2 size={22} className="text-[#E8342A] animate-spin" />
                <span>Qbe is assembling your morning briefing…</span>
              </div>
            ) : briefingData ? (
              <div className="space-y-3.5">
                {/* 1. Growth Pulse */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Users size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Customer &amp; Owner Growth
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                        {briefingData.newCustomersToday > 0
                          ? `+${briefingData.newCustomersToday} new customer(s) today`
                          : `${briefingData.totalCustomers} registered customers`}
                        {' · '}
                        {briefingData.newOwnersToday > 0
                          ? `+${briefingData.newOwnersToday} new owner(s)`
                          : `${briefingData.totalOwners} venue owners`}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold shrink-0">
                    Active
                  </span>
                </div>

                {/* 2. Bookings & Revenue Pulse */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Bookings &amp; Revenue Pulse
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                        {briefingData.todayBookingsCount} bookings today · ₹{briefingData.totalGmv.toLocaleString('en-IN')} GMV
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {briefingData.pendingApprovalsCount} venue(s) pending administrative review
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold shrink-0">
                    Healthy
                  </span>
                </div>

                {/* 3. System Health & Radar */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      briefingData.activeAlertsCount > 0
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {briefingData.activeAlertsCount > 0 ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <ShieldCheck size={18} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Platform Reliability &amp; Alerts
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                        {briefingData.activeAlertsCount > 0
                          ? `${briefingData.activeAlertsCount} active problem intimation(s) require review`
                          : 'All platform systems operating normally'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                    briefingData.activeAlertsCount > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {briefingData.activeAlertsCount > 0 ? 'Review Needed' : 'All Clear'}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {briefingData && briefingData.pendingApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDismissBriefing();
                      window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'approvals' }));
                    }}
                    className="py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Review Approvals ({briefingData.pendingApprovalsCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleDismissBriefing();
                    window.dispatchEvent(new CustomEvent('qgo-admin-navigate', { detail: 'bookings' }));
                  }}
                  className="py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  View Bookings
                </button>
              </div>
              <button
                type="button"
                onClick={handleDismissBriefing}
                className="py-2 px-4 rounded-xl bg-[#E8342A] hover:bg-[#D42B22] text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Got it, Qbe</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const QbiLayer: React.FC = () => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <QbiBoundary>
      <QbiLayerContent />
    </QbiBoundary>,
    document.body
  );
};

export const QbeLayer = QbiLayer;
