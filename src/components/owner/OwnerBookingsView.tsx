import React, { useState, useEffect } from 'react';
import { Salon, Booking, GeneratedTurfSlot } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmt12, getBusinessTodayStr } from '../../utils/timeFormat';
import { normalizePaymentStatus } from '../../utils/paymentBreakdown';
import { LiquidTabBar } from '../common/LiquidTabBar';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Check,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Ticket,
  Plus,
  Send,
  X,
} from 'lucide-react';

interface OwnerBookingsViewProps {
  salon: Salon;
  onRefreshOverview?: () => void;
}

export const OwnerBookingsView: React.FC<OwnerBookingsViewProps> = ({ salon, onRefreshOverview }) => {
  const { t } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'today' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Detail Modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);

  const fetchBookings = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.getBookings({ salonId: salon.id });
      if (res && res.bookings) {
        setBookings(res.bookings);
      }
    } catch (e) {
      console.error('Error fetching bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookings();
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchBookings(false);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [salon.id]);

  const todayStr = getBusinessTodayStr();

  // Filtering
  const filteredBookings = bookings.filter((b) => {
    const bDate = b.scheduledDate || b.createdAt.split('T')[0];

    // Tab filter
    if (activeTab === 'upcoming' && (b.status !== 'confirmed' || bDate < todayStr)) return false;
    if (activeTab === 'today' && bDate !== todayStr) return false;
    if (activeTab === 'completed' && b.status !== 'completed') return false;
    if (activeTab === 'cancelled' && b.status !== 'cancelled') return false;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matchName = b.customerName?.toLowerCase().includes(q);
      const matchPhone = b.customerPhone?.includes(q);
      const matchId = b.id?.toLowerCase().includes(q) || b.tokenNumber?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId) return false;
    }

    // Additional dropdown filters
    if (dateFilter && bDate !== dateFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (paymentFilter !== 'all' && normalizePaymentStatus(b.paymentStatus) !== paymentFilter) return false;

    return true;
  });

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.updateBookingStatus(bookingId, status);
      if (res && res.success === false) {
        setActionError(res.error || 'Error updating status');
        return;
      }
      await fetchBookings();
      if (onRefreshOverview) onRefreshOverview();
      if (selectedBooking && selectedBooking.id === bookingId) {
        const updated = await api.getBooking(bookingId);
        if (updated?.booking) setSelectedBooking(updated.booking);
      }
    } catch (e: any) {
      setActionError(e?.message || 'Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCollectBalance = async (bookingId: string) => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.collectBalance(bookingId);
      if (res && res.success === false) {
        setActionError(res.error || 'Error collecting balance');
        return;
      }
      await fetchBookings();
      if (onRefreshOverview) onRefreshOverview();
      if (selectedBooking && selectedBooking.id === bookingId) {
        const updated = await api.getBooking(bookingId);
        if (updated?.booking) setSelectedBooking(updated.booking);
      }
    } catch (e: any) {
      setActionError(e?.message || 'Error collecting balance');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelWithRefund = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking and process refund?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.cancelBooking(bookingId, 'Owner cancelled booking from management dashboard');
      if (res && res.success === false) {
        setActionError(res.error || 'Failed to cancel booking');
        return;
      }
      await fetchBookings();
      if (onRefreshOverview) onRefreshOverview();
      setSelectedBooking(null);
    } catch (e: any) {
      setActionError(e?.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTicket = async (booking: Booking) => {
    const ticketText = [
      `QGo booking ticket — ${salon.name}`,
      `Booking ID: QGO-${booking.id.split('_').pop()?.toUpperCase()}`,
      `Customer: ${booking.customerName}`,
      `Slot: ${booking.scheduledDate || 'Today'} ${booking.scheduledTime ? `${fmt12(booking.scheduledTime)}${booking.slotEndTime ? ` - ${fmt12(booking.slotEndTime)}` : ''}` : ''}`,
      `Amount due at venue: ₹${booking.balanceAmount ?? booking.totalAmount ?? booking.amount}`,
      'GST: ₹0 | QGo convenience fee: ₹0',
      'Please show this ticket at the venue for check-in.',
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ title: `${salon.name} booking ticket`, text: ticketText });
      else {
        await navigator.clipboard.writeText(ticketText);
        window.alert('Ticket details copied. Send them to the customer by WhatsApp or SMS.');
      }
    } catch (shareError: any) {
      if (shareError?.name !== 'AbortError') setActionError('Could not share the ticket. Please try again.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#000000] tracking-tight">Bookings</h2>
          <p className="text-xs text-[#444444]">Manage customer slots, check-ins, and tickets</p>
        </div>
        <button
          type="button"
          onClick={() => setIsManualBookingOpen(true)}
          className="shrink-0 rounded-xl bg-[#E73229] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
        >
          <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Manual Booking</span>
        </button>
      </div>

      {/* ── 1. TABS & SEARCH BAR (LIQUID GLASS) ── */}
      <div className="glass-card p-3 sm:p-4 space-y-3">
        {/* Navigation Sub-Tabs with Liquid Gliding Indicator */}
        <div className="flex overflow-x-auto scrollbar-none w-full">
          <LiquidTabBar
            tabs={[
              { id: 'all', label: 'All Bookings' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'today', label: 'Today' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as any)}
            className="glass w-max max-w-full"
          />
        </div>

        {/* Search & Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-[#444444] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-[14px] text-[#000000] font-medium placeholder-[#666666] focus:outline-none min-h-[42px]"
            />
          </div>

          {/* Date Picker */}
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl glass-input text-[14px] text-[#000000] font-medium focus:outline-none min-h-[42px]"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl glass-input text-[14px] text-[#000000] font-medium focus:outline-none min-h-[42px]"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 2. BOOKINGS LIST ── */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[#444444]">
          <div className="w-7 h-7 border-2 border-red-500/30 border-t-[#E73229] rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold text-[#000000]">Loading bookings...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass-card p-12 text-center text-[#444444] space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-[#444444] stroke-1" />
          <p className="text-sm font-bold text-[#000000]">No bookings found</p>
          <p className="text-xs text-[#555555] max-w-sm mx-auto">
            Bookings will appear here when customers book your slots or services.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBookings.map((b) => {
            const isCompleted = b.status === 'completed';
            const isCancelled = b.status === 'cancelled';
            const isCheckedIn = b.status === 'checked_in';
            const shortId = `QGO-${b.id.split('_').pop()?.toUpperCase()}`;

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className="glass-card p-3 sm:p-4 cursor-pointer flex flex-col justify-between space-y-3 group min-w-0 hover:border-red-300 transition-all duration-150 active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[11px] font-mono font-bold text-[#000000] bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                        {shortId}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isCancelled
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : isCheckedIn
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-[15px] text-[#000000] group-hover:text-red-600 transition-colors truncate">
                      {b.customerName}
                    </h3>
                    <p className="text-[12px] text-[#444444] mt-0.5 flex items-center gap-1.5 font-medium truncate">
                      <span className="truncate">{b.serviceName || b.resourceName || 'Turf Slot'}</span>
                      <span>•</span>
                      <span className="shrink-0">{b.customerPhone}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[16px] font-bold text-[#000000] font-mono block">
                      ₹{b.totalAmount || b.amount}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider block">
                      {(() => {
                        const norm = normalizePaymentStatus(b.paymentStatus);
                        if (norm === 'paid') return <span className="text-emerald-700">Paid</span>;
                        if (norm === 'partially_paid') {
                          return (
                            <span className="text-amber-700">
                              Advance Paid {b.balanceAmount ? `(Bal ₹${b.balanceAmount})` : ''}
                            </span>
                          );
                        }
                        if (norm === 'refunded') return <span className="text-rose-700">Refunded</span>;
                        return <span className="text-[#333333]">Pay at Venue</span>;
                      })()}
                    </span>
                  </div>
                </div>

                {/* Date & Slot Info */}
                <div className="pt-2.5 border-t border-[rgba(0,0,0,0.06)] flex items-center justify-between text-[11px] text-[#444444]">
                  <div className="flex items-center gap-1.5 font-mono font-semibold truncate">
                    <Clock className="w-3.5 h-3.5 text-[#555555] shrink-0" />
                    <span className="truncate">{b.scheduledDate || 'Today'} · {b.scheduledTime ? `${fmt12(b.scheduledTime)}${b.slotEndTime ? ` - ${fmt12(b.slotEndTime)}` : ''}` : 'Live Token'}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[#000000] group-hover:text-red-600 text-[11px] font-bold shrink-0">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. BOOKING DETAIL MODAL ── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md transition-all duration-200">
          <div className="relative w-full max-w-lg mx-auto rounded-3xl bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] bg-gradient-to-r from-red-500/5 via-transparent to-transparent">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-bold text-[#E73229] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full border border-red-500/20 tracking-wide">
                    QGO-{selectedBooking.id.split('_').pop()?.toUpperCase()}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wider border ${
                      selectedBooking.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : selectedBooking.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        : selectedBooking.status === 'checked_in'
                        ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {selectedBooking.status}
                  </span>
                </div>
                <h3 className="font-bold text-xl text-[#0A0A0A] dark:text-[#F5F5F7] tracking-tight truncate">
                  {selectedBooking.customerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label="Close modal"
                className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#555555] dark:text-[#A1A1AA] hover:text-[#0A0A0A] dark:hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 overscroll-contain">
              {/* Customer & Slot Info Card */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 space-y-2.5 text-[13px] shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5 font-medium">
                    Business / Turf
                  </span>
                  <span className="font-bold text-[#0A0A0A] dark:text-[#F5F5F7] text-right truncate">
                    {selectedBooking.salonName} {selectedBooking.resourceName ? `(${selectedBooking.resourceName})` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5 font-medium">
                    Date &amp; Slot
                  </span>
                  <span className="font-bold text-[#0A0A0A] dark:text-[#F5F5F7] text-right">
                    {selectedBooking.scheduledDate} · {fmt12(selectedBooking.scheduledTime)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5 font-medium">
                    Customer Phone
                  </span>
                  {selectedBooking.customerPhone && selectedBooking.customerPhone !== 'Not provided' ? (
                    <a
                      href={`tel:${selectedBooking.customerPhone}`}
                      className="font-bold text-[#E73229] hover:underline flex items-center gap-1"
                    >
                      {selectedBooking.customerPhone}
                    </a>
                  ) : (
                    <span className="font-medium text-[#767676] dark:text-[#8E8E93]">Not provided</span>
                  )}
                </div>

                {selectedBooking.checkedInAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5 font-medium">
                      Checked In At
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {new Date(selectedBooking.checkedInAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Financial & Payment Card */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-white/90 dark:border-white/10 space-y-2.5 text-[13px] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] font-medium">Total Amount:</span>
                  <span className="font-bold text-[16px] text-[#0A0A0A] dark:text-[#F5F5F7]">
                    ₹{selectedBooking.totalAmount || selectedBooking.amount}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] font-medium">Paid Amount:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    ₹{selectedBooking.paidAmount ?? 0}
                  </span>
                </div>

                {(selectedBooking.balanceAmount ?? 0) > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
                    <span className="text-[#6B7280] dark:text-[#A1A1AA] font-medium">Balance Due:</span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="font-bold text-rose-700 dark:text-rose-400 text-sm">
                        ₹{selectedBooking.balanceAmount}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50">
                        {selectedBooking.balanceStatus || 'PENDING'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#6B7280] dark:text-[#A1A1AA] font-medium">Payment Mode:</span>
                  <span className="font-bold text-[#0A0A0A] dark:text-[#F5F5F7] uppercase text-xs px-2 py-0.5 rounded bg-black/5 dark:bg-white/10">
                    {normalizePaymentStatus(selectedBooking.paymentStatus).replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#767676] dark:text-[#8E8E93] pt-1">
                  <span>Cancellation Policy:</span>
                  <span>{selectedBooking.refundPercentage ?? 70}% Refund ({selectedBooking.cancellationDeadlineHours ?? 2}h before slot)</span>
                </div>

                {selectedBooking.status === 'cancelled' && (
                  <div className="pt-2 border-t border-rose-200/40 space-y-1">
                    <div className="flex justify-between text-rose-700 dark:text-rose-400 font-semibold text-xs">
                      <span>Cancellation Reason:</span>
                      <span>{selectedBooking.cancellationReason || 'Cancelled'}</span>
                    </div>
                    {selectedBooking.refundAmount !== undefined && (
                      <div className="flex justify-between text-rose-700 dark:text-rose-400 font-semibold text-xs">
                        <span>Refund Amount:</span>
                        <span>₹{selectedBooking.refundAmount} ({selectedBooking.refundStatus || 'pending'})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  {actionError}
                </div>
              )}

              {selectedBooking.bookingSource === 'owner_manual' && (
                <button
                  type="button"
                  onClick={() => handleSendTicket(selectedBooking)}
                  className="w-full rounded-xl border border-[#E73229]/20 bg-[#FDECEA] hover:bg-[#FCD8D4] py-3 text-xs font-bold text-[#B3231B] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" /> Send Customer Ticket
                </button>
              )}

              {/* Owner Actions */}
              {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'no_show' && (
                <div className="space-y-2.5 pt-1">
                  {selectedBooking.balanceStatus === 'PENDING' && (selectedBooking.balanceAmount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCollectBalance(selectedBooking.id)}
                      disabled={actionLoading}
                      className="w-full py-3 rounded-xl glass-btn-primary text-white font-bold text-sm shadow-md transition-transform active:scale-98 min-h-[44px] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-4 h-4 text-white" />
                      Mark Balance Collected (₹{selectedBooking.balanceAmount})
                    </button>
                  )}

                  <div className="flex gap-2.5 flex-col sm:flex-row">
                    {selectedBooking.status !== 'checked_in' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedBooking.id, 'checked_in')}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl glass-btn-primary text-white font-bold text-sm shadow-md transition-transform active:scale-98 min-h-[44px] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        Check In Customer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')}
                      disabled={actionLoading}
                      className="flex-1 py-3 rounded-xl glass-btn text-[#0A0A0A] dark:text-[#F5F5F7] font-bold text-sm shadow-sm transition-transform active:scale-98 min-h-[44px] cursor-pointer border border-black/10 dark:border-white/15 hover:bg-black/5 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Mark Completed
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCancelWithRefund(selectedBooking.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 font-semibold text-xs border border-rose-200 dark:border-rose-900/50 transition-colors min-h-[38px] cursor-pointer"
                  >
                    Cancel Booking &amp; Process Refund
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isManualBookingOpen && (
        <ManualBookingModal
          salon={salon}
          onClose={() => setIsManualBookingOpen(false)}
          onCreated={(booking) => {
            setIsManualBookingOpen(false);
            setSelectedBooking(booking);
            void fetchBookings();
            onRefreshOverview?.();
          }}
        />
      )}
    </div>
  );
};

function ManualBookingModal({ salon, onClose, onCreated }: {
  salon: Salon;
  onClose: () => void;
  onCreated: (booking: Booking) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [numberOfPlayers, setNumberOfPlayers] = useState('10');
  const [date, setDate] = useState(() => getBusinessTodayStr());
  const [resourceId, setResourceId] = useState('');
  const [resources, setResources] = useState<Array<{ id: string; name: string }>>([]);
  const [slots, setSlots] = useState<GeneratedTurfSlot[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    setSelectedSlotIds([]);
    setError('');
    api.getAvailability(salon.id, { date, resourceId: resourceId || undefined })
      .then((result) => {
        if (!active) return;
        const availableResources = (result.resources || []).map((resource: { id: string; name: string }) => ({ id: resource.id, name: resource.name }));
        setResources(availableResources);
        if (!resourceId && availableResources[0]?.id) setResourceId(availableResources[0].id);
        setSlots(result.slots || []);
      })
      .catch(() => active && setError('Could not load slots. Please try again.'))
      .finally(() => active && setLoadingSlots(false));
    return () => { active = false; };
  }, [salon.id, date, resourceId]);

  const sortSlotsChronologically = (items: GeneratedTurfSlot[]) => {
    return [...items].sort((a, b) => {
      const [hA, mA] = a.startTime.split(':').map(Number);
      const [hB, mB] = b.startTime.split(':').map(Number);
      let minA = hA * 60 + mA;
      let minB = hB * 60 + mB;
      // Handle midnight rollover (e.g. 23:00 followed by 00:00)
      if (minA < 360 && minB >= 720) minA += 1440;
      if (minB < 360 && minA >= 720) minB += 1440;
      return minA - minB;
    });
  };

  const selectedSlots = sortSlotsChronologically(slots.filter((slot) => selectedSlotIds.includes(slot.id)));
  const totalSlotAmount = selectedSlots.reduce((total, slot) => total + slot.price, 0);

  const toggleSlot = (slot: GeneratedTurfSlot) => {
    if (selectedSlotIds.includes(slot.id)) {
      setSelectedSlotIds((current) => current.filter((slotId) => slotId !== slot.id));
      setError('');
      return;
    }

    const nextSlots = sortSlotsChronologically([...selectedSlots, slot]);
    const areConsecutive = nextSlots.every((current, index) => index === 0 || nextSlots[index - 1].endTime === current.startTime);
    if (!areConsecutive) {
      setError('Select consecutive slots only. Remove a slot or choose the slots between them.');
      return;
    }

    setSelectedSlotIds((current) => [...current, slot.id]);
    setError('');
  };

  const createManualBooking = async () => {
    if (!customerName.trim() || selectedSlots.length === 0) {
      setError('Enter the customer name and select at least one available slot.');
      return;
    }
    const firstSlot = selectedSlots[0];
    const lastSlot = selectedSlots[selectedSlots.length - 1];
    setSaving(true);
    setError('');
    try {
      const result = await api.createManualBooking({
        salonId: salon.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || 'Not provided',
        resourceId: firstSlot.resourceId || resourceId || undefined,
        scheduledDate: date,
        scheduledTime: firstSlot.startTime,
        slotEndTime: lastSlot.endTime,
        numberOfPlayers: Math.max(1, Number(numberOfPlayers) || 1),
      });
      if (!result.success || !result.booking) {
        setError(result.error || 'This slot is no longer available. Refresh and select another slot.');
        return;
      }
      onCreated(result.booking);
    } catch (requestError: any) {
      setError(requestError?.message || 'Could not create the manual booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0A0A0A]">Manual Booking</h3>
            <p className="text-xs text-[#5C5C5C]">Customer pays the slot amount at the venue.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-[#F0F0F2] text-[#0A0A0A]" aria-label="Close manual booking"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#E73229]" />
            <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} inputMode="tel" placeholder="Phone number (optional)" className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#E73229]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={date} min={getBusinessTodayStr()} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#E73229]" />
            <input type="number" min="1" max="50" value={numberOfPlayers} onChange={(event) => setNumberOfPlayers(event.target.value)} placeholder="Players" className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#E73229]" />
          </div>
          {resources.length > 1 && <select value={resourceId} onChange={(event) => setResourceId(event.target.value)} className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm font-medium outline-none focus:border-[#E73229]">{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select>}

          <div className="rounded-2xl border border-black/10 p-3">
            <p className="mb-1 text-xs font-bold text-[#0A0A0A]">Choose available slots</p>
            <p className="mb-2 text-[11px] text-[#5C5C5C]">You can select multiple consecutive slots.</p>
            {loadingSlots ? <p className="py-4 text-center text-xs text-[#5C5C5C]">Loading slots...</p> : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.filter((slot) => slot.available && slot.status === 'available').map((slot) => {
                  const isSelected = selectedSlotIds.includes(slot.id);
                  return (
                  <button key={slot.id} type="button" onClick={() => toggleSlot(slot)} aria-pressed={isSelected} className={`rounded-xl border px-2 py-2 text-left text-xs ${isSelected ? 'border-[#E73229] bg-[#FDECEA] text-[#B3231B]' : 'border-black/10 bg-white text-[#0A0A0A]'}`}>
                    <span className="block font-bold">{fmt12(slot.startTime)} - {fmt12(slot.endTime)}</span>
                    <span className="mt-0.5 block font-semibold">₹{slot.price}</span>
                  </button>
                  );
                })}
              </div>
            )}
            {!loadingSlots && slots.length === 0 && <p className="py-3 text-center text-xs text-[#5C5C5C]">No slots available for this date.</p>}
          </div>

          <div className="rounded-2xl bg-[#F7F7F7] p-3 text-xs">
            <div className="flex justify-between font-semibold text-[#0A0A0A]"><span>Selected slots ({selectedSlots.length})</span><span>₹{totalSlotAmount}</span></div>
            <div className="mt-1 flex justify-between text-[#5C5C5C]"><span>GST</span><span>₹0</span></div>
            <div className="mt-1 flex justify-between text-[#5C5C5C]"><span>QGo convenience fee</span><span>₹0</span></div>
            <div className="mt-2 flex justify-between border-t border-black/10 pt-2 text-sm font-bold text-[#0A0A0A]"><span>Due at venue</span><span>₹{totalSlotAmount}</span></div>
          </div>
          {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
          <button type="button" disabled={saving || selectedSlots.length === 0} onClick={createManualBooking} className="w-full rounded-xl bg-[#E73229] py-3 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Creating booking...' : `Create Booking for ${selectedSlots.length} Slot${selectedSlots.length === 1 ? '' : 's'}`}</button>
        </div>
      </div>
    </div>
  );
}
