import React, { useState, useEffect } from 'react';
import { Salon, Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmt12 } from '../../utils/timeFormat';
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
} from 'lucide-react';

interface OwnerBookingsViewProps {
  salon: Salon;
}

export const OwnerBookingsView: React.FC<OwnerBookingsViewProps> = ({ salon }) => {
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

  const fetchBookings = async () => {
    setLoading(true);
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
    fetchBookings();
  }, [salon.id]);

  const todayStr = new Date().toISOString().split('T')[0];

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
    if (paymentFilter !== 'all' && b.paymentStatus !== paymentFilter) return false;

    return true;
  });

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    setActionLoading(true);
    setActionError('');
    try {
      await api.updateBookingStatus(bookingId, status);
      await fetchBookings();
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

  const handleCancelWithRefund = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking and process refund?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.cancelBooking(bookingId, 'Owner cancelled booking from management dashboard');
      await fetchBookings();
      setSelectedBooking(null);
    } catch (e: any) {
      setActionError(e?.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ── 1. TABS & SEARCH BAR ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Bookings' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'today', label: 'Today' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer name, booking ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Date Picker */}
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold">Loading bookings...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 space-y-2">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
          <p className="text-sm font-bold text-slate-800">No bookings found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Bookings will appear here when customers book your slots or services.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.map((b) => {
            const isConfirmed = b.status === 'confirmed';
            const isCheckedIn = b.status === 'checked_in';
            const isCompleted = b.status === 'completed';
            const isCancelled = b.status === 'cancelled';
            const shortId = `QGO-${b.id.split('_').pop()?.toUpperCase()}`;

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {shortId}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCancelled
                            ? 'bg-rose-100 text-rose-800'
                            : isCheckedIn
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {b.customerName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                      <span>{b.serviceName || b.resourceName || 'Turf Slot'}</span>
                      <span>•</span>
                      <span>{b.customerPhone}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 font-mono block">
                      ₹{b.amount}
                    </span>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider capitalize">
                      {b.paymentStatus === 'paid' ? 'Paid' : 'Pay at Shop'}
                    </span>
                  </div>
                </div>

                {/* Date & Slot Info */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-mono font-bold">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.scheduledDate || 'Today'} · {b.scheduledTime ? fmt12(b.scheduledTime) : 'Live Token'}</span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 text-xs font-bold">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-black text-indigo-600">
                  QGO-{selectedBooking.id.split('_').pop()?.toUpperCase()}
                </span>
                <h3 className="font-black text-lg text-slate-900">{selectedBooking.customerName}</h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Details Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Business / Turf:</span>
                <span className="font-bold text-slate-900">{selectedBooking.salonName} {selectedBooking.resourceName ? `(${selectedBooking.resourceName})` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date &amp; Slot Time:</span>
                <span className="font-bold text-slate-900 font-mono">{selectedBooking.scheduledDate} · {fmt12(selectedBooking.scheduledTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Phone:</span>
                <span className="font-bold text-slate-900 font-mono">{selectedBooking.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking Amount:</span>
                <span className="font-black text-slate-900 font-mono">₹{selectedBooking.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Status:</span>
                <span className="font-bold text-emerald-700 uppercase capitalize">{selectedBooking.paymentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking Status:</span>
                <span className="font-black uppercase text-indigo-700">{selectedBooking.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cancellation Policy:</span>
                <span className="font-bold text-slate-700">{selectedBooking.refundPercentage ?? 70}% Refund</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cancellation Deadline:</span>
                <span className="font-bold text-slate-700">{selectedBooking.cancellationDeadlineHours ?? 2} hours before slot</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reminder Notice:</span>
                <span className="font-bold text-slate-700">{selectedBooking.reminderMinutesBefore ?? 30} minutes before</span>
              </div>

              {selectedBooking.status === 'cancelled' && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Cancellation Reason:</span>
                    <span>{selectedBooking.cancellationReason || 'Cancelled'}</span>
                  </div>
                  {selectedBooking.refundAmount !== undefined && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Refund Amount:</span>
                      <span>₹{selectedBooking.refundAmount} ({selectedBooking.refundStatus || 'pending'})</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {actionError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {actionError}
              </div>
            )}

            {/* Owner Actions */}
            {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  {selectedBooking.status !== 'checked_in' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedBooking.id, 'checked_in')}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-500 shadow-2xs transition-colors"
                    >
                      Check In Customer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 shadow-2xs transition-colors"
                  >
                    Mark Completed
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCancelWithRefund(selectedBooking.id)}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
                >
                  Cancel Booking &amp; Process Refund
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
