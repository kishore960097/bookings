import React, { useState, useEffect } from 'react';
import { Salon, Booking, Staff } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Filter,
  CheckCircle2,
  XCircle,
  Phone,
  Scissors,
  Check,
  Search,
} from 'lucide-react';

interface BookingsCalendarProps {
  salon: Salon;
}

export const BookingsCalendar: React.FC<BookingsCalendarProps> = ({ salon }) => {
  const { t } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.getBookings({
        salonId: salon.id,
        date: selectedDate,
        staffId: selectedStaff === 'all' ? undefined : selectedStaff,
      });
      if (res && res.bookings) {
        setBookings(res.bookings);
      }
    } catch (e) {
      console.error('Error fetching salon bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const detail = await api.getSalonDetail(salon.id);
        if (detail) setStaffList(detail.staff);
      } catch (e) {}
    };
    loadStaff();
  }, [salon.id]);

  useEffect(() => {
    fetchBookings();
  }, [salon.id, selectedDate, selectedStaff]);

  const handleUpdateStatus = async (bookingId: string, status: any) => {
    try {
      await api.updateBookingStatus(bookingId, status);
      fetchBookings();
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.customerName.toLowerCase().includes(q) ||
      b.customerPhone.includes(q) ||
      b.tokenNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-[#FFFFFF] p-4 rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-[#FFFFFF] px-3 py-1.5 rounded-xl border border-[rgba(23,23,23,0.12)]">
            <CalendarIcon className="w-4 h-4 text-[rgba(23,23,23,0.70)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-[#171717] bg-transparent focus:outline-none"
            />
          </div>

          {/* Stylist Filter */}
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-bold text-[rgba(23,23,23,0.70)] bg-[#FFFFFF] focus:outline-none"
          >
            <option value="all">All Stylists</option>
            {staffList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[rgba(23,23,23,0.70)] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or token..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FAF8F4] border border-[rgba(23,23,23,0.12)] text-xs focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]"
          />
        </div>
      </div>

      {/* Bookings Table / List */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[rgba(23,23,23,0.12)] flex items-center justify-between">
          <h3 className="font-extrabold text-base text-[#171717]">
            Appointments & Tokens ({filteredBookings.length})
          </h3>
          <span className="text-xs text-[rgba(23,23,23,0.70)]">{selectedDate}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[rgba(23,23,23,0.70)]">Loading schedule...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-16 text-center text-[rgba(23,23,23,0.70)]">
            <CalendarIcon className="w-10 h-10 mx-auto stroke-1 text-[rgba(23,23,23,0.70)] mb-2" />
            <p className="text-sm font-bold text-[rgba(23,23,23,0.70)]">No bookings for this date</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 overflow-x-auto">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 hover:bg-[rgba(23,23,23,0.05)] transition-colors flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                {/* Time & Token */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] text-[#171717] flex flex-col items-center justify-center font-mono font-bold">
                    <span className="text-[11px] text-[rgba(23,23,23,0.70)]">
                      {b.mode === 'appointment' ? 'APT' : 'TKN'}
                    </span>
                    <span className="text-xs">#{b.tokenNumber?.split('-').pop()}</span>
                  </div>

                  <div>
                    <span className="font-bold text-[#171717] block">
                      {b.scheduledTime ? `${b.scheduledTime}${b.slotEndTime ? ` - ${b.slotEndTime}` : ''}` : new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[11px] text-[rgba(23,23,23,0.70)]">{b.mode}</span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="min-w-[150px]">
                  <span className="font-bold text-[#171717] block">{b.customerName}</span>
                  <a
                    href={`tel:${b.customerPhone}`}
                    className="text-[rgba(23,23,23,0.70)] hover:text-[#FF9F1C] flex items-center gap-1 mt-0.5 text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{b.customerPhone}</span>
                  </a>
                </div>

                {/* Service & Staff */}
                <div className="min-w-[140px]">
                  <span className="font-semibold text-[#171717] block">{b.serviceName}</span>
                  <span className="text-[11px] text-[rgba(23,23,23,0.70)]">
                    Stylist: <strong>{b.staffName || 'Any'}</strong>
                  </span>
                </div>

                {/* Amount & Payment */}
                <div className="min-w-[80px]">
                  <span className="font-extrabold text-[#171717] block">
                    {t.rupees}
                    {b.totalAmount || b.amount}
                  </span>
                  <span className="text-[11px] text-[#FF9F1C] font-semibold">
                    {b.paymentStatus === 'paid' ? 'Paid' : 'Pay at Shop'}
                  </span>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      b.status === 'completed'
                        ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                        : b.status === 'checked_in'
                        ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                        : b.status === 'confirmed'
                        ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                        : 'bg-[#FFFFFF] text-[rgba(23,23,23,0.70)]'
                    }`}
                  >
                    {b.status}
                  </span>

                  {b.status !== 'completed' && b.status !== 'cancelled' && (
                    <div className="flex items-center gap-1">
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(b.id, 'checked_in')}
                          className="px-2 py-1 bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] rounded-lg text-[11px] font-bold"
                          title="Check In"
                        >
                          Check In
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'completed')}
                        className="px-2 py-1 bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] rounded-lg text-[11px] font-bold"
                        title="Complete Service"
                      >
                        Served
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
