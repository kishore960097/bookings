import React, { useState, useEffect } from 'react';
import { Salon, OwnerCustomerSummary } from '../../types';
import { api } from '../../services/api';
import {
  Users,
  Search,
  Calendar,
  DollarSign,
  UserCheck,
  TrendingUp,
  XCircle,
  Phone,
  Clock} from 'lucide-react';

interface OwnerCustomersViewProps {
  salon: Salon;
}

export const OwnerCustomersView: React.FC<OwnerCustomersViewProps> = ({ salon }) => {
  const [customers, setCustomers] = useState<OwnerCustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getSalonCustomers(salon.id);
      if (res && res.customers) {
        setCustomers(res.customers);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [salon.id]);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const repeatCount = customers.filter((c) => c.totalBookings > 1).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ── 1. SUMMARY STATS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#FFFFFF] rounded-3xl p-5 border border-[rgba(23,23,23,0.12)] shadow-2xs">
          <div className="w-9 h-9 rounded-2xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)] block">Total Customers</span>
          <span className="text-2xl font-black text-[#171717] mt-1 block">{customers.length}</span>
        </div>

        <div className="bg-[#FFFFFF] rounded-3xl p-5 border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] shadow-2xs">
          <div className="w-9 h-9 rounded-2xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#FF9F1C] block">Total Customer Spend</span>
          <span className="text-2xl font-black text-[#FF9F1C] mt-1 block">₹{totalSpentAll.toLocaleString()}</span>
        </div>

        <div className="bg-[#FFFFFF] rounded-3xl p-5 border border-[rgba(23,23,23,0.12)] shadow-2xs">
          <div className="w-9 h-9 rounded-2xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <UserCheck className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)] block">Repeat Customers</span>
          <span className="text-2xl font-black text-[#171717] mt-1 block">{repeatCount}</span>
        </div>
      </div>

      {/* ── 2. SEARCH & LIST ── */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(23,23,23,0.12)]">
          <div>
            <h2 className="text-base font-black text-[#171717]">Customer Directory</h2>
            <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">Players and customers who have booked your business</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[rgba(23,23,23,0.70)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] bg-[rgba(23,23,23,0.05)]"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[rgba(23,23,23,0.70)]">
            <div className="w-8 h-8 border-3 border-[rgba(23,23,23,0.12)] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold">Loading customers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[rgba(23,23,23,0.70)] space-y-2">
            <Users className="w-10 h-10 mx-auto text-[rgba(23,23,23,0.70)] stroke-1" />
            <p className="text-sm font-bold text-[rgba(23,23,23,0.70)]">No customers found</p>
            <p className="text-xs text-[rgba(23,23,23,0.70)] max-w-sm mx-auto">
              Customers will automatically appear here when they book your business.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[rgba(23,23,23,0.12)] text-[11px] font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)] bg-[rgba(23,23,23,0.05)]">
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Phone Number</th>
                  <th className="py-3 px-3.5 text-center">Bookings</th>
                  <th className="py-3 px-3.5 text-right">Total Spent</th>
                  <th className="py-3 px-3.5">Last Booking</th>
                  <th className="py-3 px-3.5">Upcoming</th>
                  <th className="py-3 px-3.5 text-center">Cancellations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((c) => (
                  <tr key={c.customerId} className="hover:bg-[rgba(23,23,23,0.05)] transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-3.5 font-bold text-[#171717]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF9F1C] to-[#FF9F1C]/80 text-[#171717] font-black text-xs flex items-center justify-center">
                          {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <span>{c.name || 'Verified Customer'}</span>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-3.5 font-mono text-[rgba(23,23,23,0.70)]">
                      {c.phone || '—'}
                    </td>

                    {/* Total Bookings */}
                    <td className="py-3.5 px-3.5 text-center font-black text-[#171717]">
                      <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] text-[#171717] text-[11px]">
                        {c.totalBookings}
                      </span>
                    </td>

                    {/* Total Spent */}
                    <td className="py-3.5 px-3.5 text-right font-black text-[#FF9F1C] font-mono">
                      ₹{c.totalSpent.toLocaleString()}
                    </td>

                    {/* Last Booking */}
                    <td className="py-3.5 px-3.5 text-[rgba(23,23,23,0.70)] font-mono">
                      {c.lastBookingDate || '—'}
                    </td>

                    {/* Upcoming */}
                    <td className="py-3.5 px-3.5 font-mono text-[rgba(23,23,23,0.70)]">
                      {c.upcomingBookingDate ? (
                        <span className="text-[#FF9F1C] font-bold">{c.upcomingBookingDate}</span>
                      ) : (
                        <span className="text-[rgba(23,23,23,0.70)]">—</span>
                      )}
                    </td>

                    {/* Cancellations */}
                    <td className="py-3.5 px-3.5 text-center">
                      {c.cancellationCount > 0 ? (
                        <span className="text-[#FF9F1C] font-bold">{c.cancellationCount}</span>
                      ) : (
                        <span className="text-[rgba(23,23,23,0.70)]">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
