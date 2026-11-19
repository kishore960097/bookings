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
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── 1. SUMMARY STATS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-[#FFFFFF] rounded-2xl p-3 sm:p-4 border border-[rgba(10,10,10,0.12)] shadow-2xs min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center mb-1.5">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] block truncate">Total Customers</span>
          <span className="text-[18px] font-bold text-[#0A0A0A] mt-0.5 block">{customers.length}</span>
        </div>

        <div className="bg-[#FFFFFF] rounded-2xl p-3 sm:p-4 border border-[rgba(10,10,10,0.12)] bg-[rgba(231,50,41,0.08)] shadow-2xs min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center mb-1.5">
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C9281F] block truncate">Total Customer Spend</span>
          <span className="text-[18px] font-bold text-[#C9281F] mt-0.5 block">₹{totalSpentAll.toLocaleString()}</span>
        </div>

        <div className="bg-[#FFFFFF] rounded-2xl p-3 sm:p-4 border border-[rgba(10,10,10,0.12)] shadow-2xs min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center mb-1.5">
            <UserCheck className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] block truncate">Repeat Customers</span>
          <span className="text-[18px] font-bold text-[#0A0A0A] mt-0.5 block">{repeatCount}</span>
        </div>
      </div>

      {/* ── 2. SEARCH & LIST ── */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[rgba(10,10,10,0.12)]">
          <div>
            <h2 className="text-[15px] font-bold text-[#0A0A0A]">Customer Directory</h2>
            <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5">Players and customers who have booked your business</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[rgba(10,10,10,0.70)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#E73229] bg-[rgba(10,10,10,0.05)] min-h-[40px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-[rgba(10,10,10,0.70)]">
            <div className="w-7 h-7 border-2 border-[rgba(10,10,10,0.12)] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Loading customers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[rgba(10,10,10,0.70)] space-y-2">
            <Users className="w-8 h-8 mx-auto text-[rgba(10,10,10,0.70)] stroke-1" />
            <p className="text-sm font-bold text-[rgba(10,10,10,0.70)]">No customers found</p>
            <p className="text-xs text-[rgba(10,10,10,0.70)] max-w-sm mx-auto">
              Customers will automatically appear here when they book your business.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(10,10,10,0.12)] text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] bg-[rgba(10,10,10,0.05)]">
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Phone Number</th>
                    <th className="py-2.5 px-3 text-center">Bookings</th>
                    <th className="py-2.5 px-3 text-right">Total Spent</th>
                    <th className="py-2.5 px-3">Last Booking</th>
                    <th className="py-2.5 px-3">Upcoming</th>
                    <th className="py-2.5 px-3 text-center">Cancellations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.map((c) => (
                    <tr key={c.customerId} className="hover:bg-[rgba(10,10,10,0.05)] transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-2.5 px-3 font-semibold text-[#0A0A0A]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[linear-gradient(135deg,#F0554A_0%,#E73229_100%)] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <span className="truncate">{c.name || 'Verified Customer'}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-mono text-[rgba(10,10,10,0.70)] text-[11px]">
                        {c.phone || '—'}
                      </td>

                      {/* Total Bookings */}
                      <td className="py-2.5 px-3 text-center font-bold text-[#0A0A0A]">
                        <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] text-[#0A0A0A] text-[10px]">
                          {c.totalBookings}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="py-2.5 px-3 text-right font-bold text-[#C9281F] font-mono text-[13px]">
                        ₹{c.totalSpent.toLocaleString()}
                      </td>

                      {/* Last Booking */}
                      <td className="py-2.5 px-3 text-[rgba(10,10,10,0.70)] font-mono text-[11px]">
                        {c.lastBookingDate || '—'}
                      </td>

                      {/* Upcoming */}
                      <td className="py-2.5 px-3 font-mono text-[rgba(10,10,10,0.70)] text-[11px]">
                        {c.upcomingBookingDate ? (
                          <span className="text-[#C9281F] font-semibold">{c.upcomingBookingDate}</span>
                        ) : (
                          <span className="text-[rgba(10,10,10,0.70)]">—</span>
                        )}
                      </td>

                      {/* Cancellations */}
                      <td className="py-2.5 px-3 text-center">
                        {c.cancellationCount > 0 ? (
                          <span className="text-[#C9281F] font-semibold text-[11px]">{c.cancellationCount}</span>
                        ) : (
                          <span className="text-[rgba(10,10,10,0.70)] text-[11px]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden space-y-2">
              {filtered.map((c) => (
                <div
                  key={c.customerId}
                  className="p-3 rounded-xl border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] space-y-2 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,#F0554A_0%,#E73229_100%)] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] text-[#0A0A0A] truncate">{c.name || 'Customer'}</div>
                        <div className="text-[10px] text-[rgba(10,10,10,0.70)] font-mono">{c.phone || '—'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-[14px] text-[#C9281F] font-mono">₹{c.totalSpent.toLocaleString()}</div>
                      <div className="text-[10px] text-[rgba(10,10,10,0.70)]">{c.totalBookings} booking{c.totalBookings !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[rgba(10,10,10,0.70)] font-mono pt-1.5 border-t border-[rgba(10,10,10,0.08)]">
                    <span>Last: {c.lastBookingDate || '—'}</span>
                    {c.cancellationCount > 0 && (
                      <span className="text-[#C9281F] font-semibold">{c.cancellationCount} cancelled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
