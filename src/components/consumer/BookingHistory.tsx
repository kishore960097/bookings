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
        <h1 className="text-2xl font-black text-[#171717] tracking-tight">{t.myBookings}</h1>
        <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">
          View your upcoming appointments, active tokens, and past visits
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#FFFFFF] p-1 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-150 flex items-center justify-center gap-1.5 ${
            activeTab === 'active'
              ? 'bg-[#FFFFFF] text-[#171717] shadow-xs'
              : 'text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
          }`}
        >
          <span>{t.active}</span>
          {activeBookings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#FF9F1C] text-[#171717] text-[11px] flex items-center justify-center font-black">
              {activeBookings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-150 flex items-center justify-center gap-1.5 ${
            activeTab === 'upcoming'
              ? 'bg-[#FFFFFF] text-[#171717] shadow-xs'
              : 'text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
          }`}
        >
          <span>{t.upcoming}</span>
          {upcomingBookings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#FFFFFF] text-[#171717] text-[11px] flex items-center justify-center font-black">
              {upcomingBookings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-150 ${
            activeTab === 'completed'
              ? 'bg-[#FFFFFF] text-[#171717] shadow-xs'
              : 'text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
          }`}
        >
          {t.completed}
        </button>

        <button
          onClick={() => setActiveTab('cancelled')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-150 ${
            activeTab === 'cancelled'
              ? 'bg-[#FFFFFF] text-[#171717] shadow-xs'
              : 'text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
          }`}
        >
          {t.cancelled}
        </button>
      </div>

      {/* List content */}
      {loading ? (
        <div className="py-12 text-center text-[rgba(23,23,23,0.70)]">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-[#FF9F1C]" />
          <span className="text-xs font-medium">Loading your bookings...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-12 text-center text-[rgba(23,23,23,0.70)] shadow-xs">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-[rgba(23,23,23,0.70)] stroke-1" />
          <p className="text-sm font-bold text-[#171717]">{t.noBookings}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((booking) => (
            <div
              key={booking.id}
              className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-5 shadow-xs hover:border-[rgba(23,23,23,0.12)] transition-colors duration-150 flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[11px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                        booking.mode === 'appointment'
                          ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] border border-[rgba(23,23,23,0.12)]'
                          : 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] border border-[rgba(23,23,23,0.12)]'
                      }`}
                    >
                      {booking.mode === 'appointment' ? 'Appointment' : 'Live Token'}
                    </span>

                    <span className="text-xs font-mono font-bold text-[rgba(23,23,23,0.70)]">
                      #{booking.tokenNumber?.split('-').pop()}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[#171717]">{booking.salonName}</h3>
                  <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">
                    {booking.serviceName} • {booking.staffName || 'Any Stylist'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-base font-black text-[#171717] block">
                    {t.rupees}
                    {booking.amount}
                  </span>
                  <span className="text-[11px] font-bold text-[#FF9F1C] uppercase tracking-wider">
                    {booking.paymentStatus === 'paid' ? 'Paid' : 'Pay at Shop'}
                  </span>
                </div>
              </div>

              {/* Status Row */}
              <div className="pt-3 border-t border-[rgba(23,23,23,0.12)] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-[rgba(23,23,23,0.70)] font-mono">
                  <Clock className="w-3.5 h-3.5 text-[rgba(23,23,23,0.70)]" />
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
                      className="px-3.5 py-1.5 rounded-xl bg-[#FF9F1C] text-[#171717] font-bold text-xs uppercase tracking-wider hover:bg-[#FF9F1C] transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#FF9F1C]" />
                      <span>{t.viewTicket}</span>
                    </button>
                  )}

                  {booking.status === 'completed' && (
                    <>
                      <button
                        onClick={() => onRate(booking)}
                        className="px-3 py-1.5 rounded-xl border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] font-bold text-xs uppercase tracking-wider hover:bg-[rgba(255,159,28,0.15)] flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 fill-[#FF9F1C] text-[#FF9F1C]" />
                        <span>{t.rateService}</span>
                      </button>
                      <button
                        onClick={() => onBookAgain(booking.salonId)}
                        className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] text-[#171717] font-bold text-xs uppercase tracking-wider hover:bg-[rgba(23,23,23,0.05)]"
                      >
                        {t.bookAgain}
                      </button>
                    </>
                  )}

                  {booking.status === 'cancelled' && (
                    <div className="text-right">
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] inline-block">
                        Cancelled
                      </span>
                      {booking.refundAmount !== undefined && (
                        <p className="text-[11px] font-bold text-[#FF9F1C] mt-1">
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
