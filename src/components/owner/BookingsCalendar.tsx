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
      <div className="bg-white p-4 rounded-3xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200">
            <CalendarIcon className="w-4 h-4 text-neutral-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-neutral-800 bg-transparent focus:outline-none"
            />
          </div>

          {/* Stylist Filter */}
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 bg-white focus:outline-none"
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
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or token..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Bookings Table / List */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="font-extrabold text-base text-neutral-900">
            Appointments & Tokens ({filteredBookings.length})
          </h3>
          <span className="text-xs text-neutral-500">{selectedDate}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400">Loading schedule...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <CalendarIcon className="w-10 h-10 mx-auto stroke-1 text-neutral-300 mb-2" />
            <p className="text-sm font-bold text-neutral-700">No bookings for this date</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 overflow-x-auto">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 hover:bg-neutral-50/70 transition-colors flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                {/* Time & Token */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex flex-col items-center justify-center font-mono font-bold">
                    <span className="text-[10px] text-neutral-500">
                      {b.mode === 'appointment' ? 'APT' : 'TKN'}
                    </span>
                    <span className="text-xs">#{b.tokenNumber?.split('-').pop()}</span>
                  </div>

                  <div>
                    <span className="font-bold text-neutral-900 block">
                      {b.scheduledTime || new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-neutral-500">{b.mode}</span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="min-w-[150px]">
                  <span className="font-bold text-neutral-900 block">{b.customerName}</span>
                  <a
                    href={`tel:${b.customerPhone}`}
                    className="text-neutral-500 hover:text-amber-600 flex items-center gap-1 mt-0.5 text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{b.customerPhone}</span>
                  </a>
                </div>

                {/* Service & Staff */}
                <div className="min-w-[140px]">
                  <span className="font-semibold text-neutral-800 block">{b.serviceName}</span>
                  <span className="text-[11px] text-neutral-500">
                    Stylist: <strong>{b.staffName || 'Any'}</strong>
                  </span>
                </div>

                {/* Amount & Payment */}
                <div className="min-w-[80px]">
                  <span className="font-extrabold text-neutral-900 block">
                    {t.rupees}
                    {b.amount}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {b.paymentStatus === 'paid' ? 'Paid' : 'Pay at Shop'}
                  </span>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      b.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'checked_in'
                        ? 'bg-sky-100 text-sky-800'
                        : b.status === 'confirmed'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {b.status}
                  </span>

                  {b.status !== 'completed' && b.status !== 'cancelled' && (
                    <div className="flex items-center gap-1">
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(b.id, 'checked_in')}
                          className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold"
                          title="Check In"
                        >
                          Check In
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'completed')}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold"
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
