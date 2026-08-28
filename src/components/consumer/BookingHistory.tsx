import React, { useState, useEffect } from 'react';
import { Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'qrcode';
import {
  Calendar,
  Clock,
  Ticket,
  CheckCircle2,
  XCircle,
  Star,
  RefreshCw,
  ChevronRight,
  MapPin,
} from 'lucide-react';

interface BookingHistoryProps {
  onSelectBooking: (bookingId: string) => void;
  onBookAgain: (salonId: string) => void;
  onRate: (booking: Booking) => void;
}

export const BookingHistory: React.FC<BookingHistoryProps> = ({
  onSelectBooking,
  onBookAgain,
  onRate,
}) => {
  const { user, t } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'completed' | 'cancelled'>('active');

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.getBookings();
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
  }, [user]);

  const activeBookings = bookings.filter(
    (b) => (b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'in_progress') && b.mode === 'token'
  );

  const upcomingBookings = bookings.filter(
    (b) => (b.status === 'confirmed' || b.status === 'checked_in') && b.mode === 'appointment'
  );

  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled' || b.status === 'no_show');

  const getListForTab = () => {
    switch (activeTab) {
      case 'active':
        return activeBookings;
      case 'upcoming':
        return upcomingBookings;
      case 'completed':
        return completedBookings;
      case 'cancelled':
        return cancelledBookings;
      default:
        return [];
    }
  };

  const list = getListForTab();

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 pb-28 md:pb-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t.myBookings}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View your upcoming appointments, active tokens, and past visits
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'active'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>{t.active}</span>
          {activeBookings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-[10px] flex items-center justify-center font-black">
              {activeBookings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'upcoming'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>{t.upcoming}</span>
          {upcomingBookings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-black">
              {upcomingBookings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.completed}
        </button>

        <button
          onClick={() => setActiveTab('cancelled')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'cancelled'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.cancelled}
        </button>
      </div>

      {/* List content */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-indigo-600" />
          <span className="text-xs font-medium">Loading your bookings...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
          <p className="text-sm font-bold text-slate-800">{t.noBookings}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                        booking.mode === 'appointment'
                          ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {booking.mode === 'appointment' ? 'Appointment' : 'Live Token'}
                    </span>

                    <span className="text-xs font-mono font-bold text-slate-500">
                      #{booking.tokenNumber?.split('-').pop()}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900">{booking.salonName}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {booking.serviceName} • {booking.staffName || 'Any Stylist'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-base font-black text-slate-900 block">
                    {t.rupees}
                    {booking.amount}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    {booking.paymentStatus === 'paid' ? 'Paid' : 'Pay at Shop'}
                  </span>
                </div>
              </div>

              {/* Status Row */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-500 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {booking.mode === 'appointment' ? (
                    <span>
                      {booking.scheduledDate} at {booking.scheduledTime}
                    </span>
                  ) : (
                    <span>Joined at {new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {(booking.status === 'confirmed' || booking.status === 'checked_in') && (
                    <button
                      onClick={() => onSelectBooking(booking.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Ticket className="w-3.5 h-3.5 text-amber-300" />
                      <span>{t.viewTicket}</span>
                    </button>
                  )}

                  {booking.status === 'completed' && (
                    <>
                      <button
                        onClick={() => onRate(booking)}
                        className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-bold text-xs uppercase tracking-wider hover:bg-amber-100 flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{t.rateService}</span>
                      </button>
                      <button
                        onClick={() => onBookAgain(booking.salonId)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-800"
                      >
                        {t.bookAgain}
                      </button>
                    </>
                  )}

                  {booking.status === 'cancelled' && (
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 inline-block">
                        Cancelled
                      </span>
                      {booking.refundAmount !== undefined && (
                        <p className="text-[10px] font-bold text-emerald-700 mt-1">
                          Refund: ₹{booking.refundAmount} ({booking.refundPercentage || 70}%) · {booking.refundStatus || 'Pending'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
