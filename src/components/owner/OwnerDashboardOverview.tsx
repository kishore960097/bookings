import React, { useState } from 'react';
import { Salon, DashboardOverviewData, GeneratedTurfSlot } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fmt12 } from '../../utils/timeFormat';
import { useCountUp } from '../../utils/useCountUp';
import {
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Star,
  ChevronRight,
  ShieldCheck,
  Layers,
  AlertCircle,
  Eye,
} from 'lucide-react';

interface OwnerDashboardOverviewProps {
  salon: Salon;
  overview: DashboardOverviewData | null;
  loading: boolean;
  onNavigateTab: (tab: string) => void;
  onSelectSlot: (slot: GeneratedTurfSlot) => void;
  onRefresh: () => void;
}

export const OwnerDashboardOverview: React.FC<OwnerDashboardOverviewProps> = ({
  salon,
  overview,
  loading,
  onNavigateTab,
  onSelectSlot,
  onRefresh,
}) => {
  const { t } = useAuth();

  // Animated count-up values for stat cards
  const countTodayBookings = useCountUp(overview?.todayBookingsCount || 0);
  const countTodayRevenue = useCountUp(overview?.todayRevenue || 0);
  const countUpcoming = useCountUp(overview?.upcomingBookingsCount || 0);
  const countAvailable = useCountUp(overview?.availableSlotsCount || 0);
  const countCompleted = useCountUp(overview?.completedBookingsCount || 0);
  const countCancelled = useCountUp(overview?.cancelledBookingsCount || 0);

  return (
    <div className="space-y-4 animate-tab-content">
      {/* ── 1. BUSINESS PROFILE & QUICK SCAN HEADER ── */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F0554A] to-[#E73229] flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0">
            {salon.logoUrl ? (
              <img src={salon.logoUrl} alt={salon.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              salon.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#000000] truncate">{salon.name}</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-[#C9281F] border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E73229] animate-pulse" />
                Approved · Live
              </span>
            </div>
            <p className="text-[13px] text-[#444444] mt-0.5 flex items-center gap-1.5 flex-wrap font-medium truncate">
              <span>{salon.category || 'Turf & Sports'}</span>
              <span>•</span>
              <span className="truncate">{salon.address || salon.city || 'Location available'}</span>
            </p>
          </div>
        </div>

        {/* Header Stats */}
        <div className="flex items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-black/10 shrink-0 flex-wrap">
          <div className="text-center px-3 py-1.5 rounded-xl glass">
            <span className="text-[11px] font-semibold text-[#444444] block">Rating</span>
            <div className="flex items-center justify-center gap-1 text-[13px] font-bold text-[#000000] mt-0.5">
              <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706]" />
              <span>{salon.rating > 0 ? salon.rating.toFixed(1) : 'New'}</span>
            </div>
          </div>

          <div className="text-center px-3 py-1.5 rounded-xl glass">
            <span className="text-[11px] font-semibold text-[#444444] block">Total Bookings</span>
            <span className="text-[13px] font-bold text-[#000000] mt-0.5 block">
              {(overview?.completedBookingsCount || 0) + (overview?.todayBookingsCount || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. DASHBOARD SUMMARY METRIC CARDS (REAL DB DATA) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Card 1: Today's Bookings */}
        <div
          className="glass-card p-3.5 rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] min-w-0 animate-card-stagger"
          style={{ animationDelay: '0ms' }}
        >
          <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E73229] flex items-center justify-center mb-1.5">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-semibold text-[#444444] block truncate">Today's Bookings</span>
          <span className="text-[22px] font-bold text-[#000000] mt-0.5 block leading-tight">
            {countTodayBookings}
          </span>
        </div>

        {/* Card 2: Today's Revenue */}
        <div
          className="glass-card p-3.5 rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] min-w-0 animate-card-stagger border-red-200"
          style={{ animationDelay: '40ms' }}
        >
          <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E73229] flex items-center justify-center mb-1.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-semibold text-[#444444] block truncate">Today's Revenue</span>
          <span className="text-[22px] font-bold text-[#000000] mt-0.5 block leading-tight">
            ₹{countTodayRevenue.toLocaleString()}
          </span>
        </div>

        {/* Card 3: Upcoming Bookings */}
        <div
          className="glass-card p-3.5 rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] min-w-0 animate-card-stagger"
          style={{ animationDelay: '80ms' }}
        >
          <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E73229] flex items-center justify-center mb-1.5">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-semibold text-[#444444] block truncate">Upcoming</span>
          <span className="text-[22px] font-bold text-[#000000] mt-0.5 block leading-tight">
            {countUpcoming}
          </span>
        </div>

        {/* Card 4: Available Slots */}
        <div
          className="glass-card p-3.5 rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] min-w-0 animate-card-stagger"
          style={{ animationDelay: '120ms' }}
        >
          <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E73229] flex items-center justify-center mb-1.5">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-semibold text-[#444444] block truncate">Available Slots</span>
          <span className="text-[22px] font-bold text-[#000000] mt-0.5 block leading-tight">
            {countAvailable}
          </span>
        </div>

        {/* Card 5: Completed Bookings */}
        <div
          className="glass-card p-3.5 rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] min-w-0 animate-card-stagger"
          style={{ animationDelay: '160ms' }}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-semibold text-[#444444] block truncate">Completed</span>
          <span className="text-[22px] font-bold text-[#000000] mt-0.5 block leading-tight">
            {countCompleted}
          </span>
        </div>

        {/* Card 6: Cancelled Bookings */}
        <div
          className="glass-card p-3.5 rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] min-w-0 animate-card-stagger"
          style={{ animationDelay: '200ms' }}
        >
          <div className="w-7 h-7 rounded-lg bg-red-50 text-[#C9281F] flex items-center justify-center mb-1.5">
            <XCircle className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-semibold text-[#444444] block truncate">Cancelled</span>
          <span className="text-[22px] font-bold text-[#000000] mt-0.5 block leading-tight">
            {countCancelled}
          </span>
        </div>
      </div>

      {/* ── 3. TODAY'S SLOTS SECTION ── */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-black/10">
          <div>
            <h2 className="text-[16px] font-bold text-[#000000]">Today's Schedule &amp; Slots</h2>
            <p className="text-[12px] font-medium text-[#444444] mt-0.5">
              📅 {overview?.todayFormatted || 'Today'} · Live slot availability
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('slots')}
              className="px-3 py-1.5 rounded-xl glass text-[#000000] hover:text-[#E73229] font-semibold text-[13px] flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
            >
              <span>Weekly Calendar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRefresh}
              className="px-3.5 py-1.5 rounded-xl glass-btn-primary text-white font-semibold text-[13px] shadow-sm transition-colors cursor-pointer min-h-[36px]"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Slot Table / Cards */}
        {loading ? (
          <div className="py-8 text-center text-[rgba(10,10,10,0.70)]">
            <div className="w-7 h-7 border-2 border-[rgba(10,10,10,0.12)] border-t-[#E73229] rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Loading today's slots...</p>
          </div>
        ) : !overview?.todaySlots || overview.todaySlots.length === 0 ? (
          <div className="py-8 text-center text-[rgba(10,10,10,0.70)] space-y-2">
            <Layers className="w-8 h-8 mx-auto text-[rgba(10,10,10,0.70)] stroke-1" />
            <p className="text-sm font-bold text-[rgba(10,10,10,0.70)]">No slots configured for today</p>
            <p className="text-xs text-[rgba(10,10,10,0.70)] max-w-sm mx-auto">
              Configure your daily hours or generate recurring slots in the Slots &amp; Calendar section.
            </p>
            <button
              onClick={() => onNavigateTab('slots')}
              className="mt-2 px-4 py-2 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-semibold text-[13px] uppercase tracking-wider min-h-[40px]"
            >
              Configure Schedule
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop Table Layout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs hidden md:table">
                <thead>
                  <tr className="border-b border-[rgba(10,10,10,0.12)] text-[10px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] bg-[rgba(10,10,10,0.05)]">
                    <th className="py-2.5 px-3">Time Range</th>
                    <th className="py-2.5 px-3">Pitch / Arena</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {overview.todaySlots.map((slot) => {
                    const isBooked = slot.isBooked;
                    const isBlocked = slot.isBlocked;

                    return (
                      <tr
                        key={slot.id}
                        onClick={() => onSelectSlot(slot)}
                        className="hover:bg-[rgba(10,10,10,0.05)] transition-colors cursor-pointer group"
                      >
                        {/* Time */}
                        <td className="py-2.5 px-3 font-semibold text-[#0A0A0A] font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#C9281F]">
                              {slot.periodType === 'day' ? '☀️' : '🌙'}
                            </span>
                            <span>{fmt12(slot.startTime)} – {fmt12(slot.endTime)}</span>
                          </div>
                        </td>

                        {/* Resource */}
                        <td className="py-2.5 px-3 text-[rgba(10,10,10,0.70)] font-medium text-[11px]">
                          {slot.resourceName || 'Main Pitch'}
                        </td>

                        {/* Price */}
                        <td className="py-2.5 px-3 text-right font-bold text-[#0A0A0A] font-mono text-[13px]">
                          ₹{slot.price}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          {slot.status === 'completed' || slot.bookingStatus === 'completed' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              COMPLETED
                            </span>
                          ) : isBooked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[rgba(231,50,41,0.08)] text-[#C9281F] border border-[rgba(10,10,10,0.12)]">
                              BOOKED
                            </span>
                          ) : isBlocked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ow-inner text-[rgba(10,10,10,0.70)]">
                              BLOCKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[rgba(231,50,41,0.08)] text-[#C9281F] border border-[rgba(10,10,10,0.12)]">
                              AVAILABLE
                            </span>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="py-2.5 px-3 text-[rgba(10,10,10,0.70)] text-[11px]">
                          {slot.customerName ? (
                            <div className="font-semibold text-[#0A0A0A] flex items-center gap-1.5 truncate">
                              <span className="w-5 h-5 rounded-full ow-inner text-[rgba(10,10,10,0.70)] text-[10px] font-bold flex items-center justify-center shrink-0">
                                {slot.customerName.charAt(0)}
                              </span>
                              <span className="truncate">{slot.customerName}</span>
                            </div>
                          ) : (
                            <span className="text-[rgba(10,10,10,0.70)] font-mono">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-lg ow-inner group-hover:bg-black/5 group-hover:text-[#0A0A0A] text-[rgba(10,10,10,0.70)] text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout - 2 columns */}
            <div className="md:hidden grid grid-cols-1 min-[300px]:grid-cols-2 gap-2">
              {overview.todaySlots.map((slot) => {
                const isBooked = slot.isBooked;
                const isBlocked = slot.isBlocked;

                return (
                  <div
                    key={slot.id}
                    onClick={() => onSelectSlot(slot)}
                    className="p-2.5 ow-card rounded-2xl shadow-sm transition-colors cursor-pointer flex flex-col gap-1.5 overflow-hidden justify-between h-full min-w-0"
                  >
                    {/* Top Row: Time & Price */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1 font-semibold text-[#0A0A0A] font-mono text-[11px] min-w-0 truncate">
                          <span className="text-[#C9281F] shrink-0">
                            {slot.periodType === 'day' ? '☀️' : '🌙'}
                          </span>
                          <span className="truncate">{fmt12(slot.startTime)}</span>
                        </div>
                        <div className="font-bold text-[#0A0A0A] font-mono text-[13px] shrink-0">
                          ₹{slot.price}
                        </div>
                      </div>
                      <span className="text-[10px] text-[rgba(10,10,10,0.70)] font-medium ml-4 truncate">
                        to {fmt12(slot.endTime)}
                      </span>
                    </div>
                    
                    {/* Middle Row: Arena & Customer */}
                    <div className="flex items-center justify-between text-[10px] mt-auto pt-1.5 border-t border-[rgba(10,10,10,0.12)] gap-1 min-w-0">
                      <span className="text-[rgba(10,10,10,0.70)] font-medium uppercase tracking-wide truncate">
                        {slot.resourceName || 'Main Pitch'}
                      </span>
                      {slot.customerName && (
                        <span className="font-semibold text-[#0A0A0A] truncate">{slot.customerName}</span>
                      )}
                    </div>

                    {/* Bottom Row: Status & Action */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      {isBooked ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[rgba(231,50,41,0.08)] text-[#C9281F] border border-[rgba(10,10,10,0.12)] truncate">
                          BOOKED
                        </span>
                      ) : isBlocked ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ow-inner text-[rgba(10,10,10,0.70)] truncate">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[rgba(231,50,41,0.08)] text-[#C9281F] border border-[rgba(10,10,10,0.12)] truncate">
                          AVAILABLE
                        </span>
                      )}
                      <button
                        type="button"
                        className="px-1.5 py-0.5 rounded-lg ow-inner text-[rgba(10,10,10,0.70)] text-[10px] font-semibold inline-flex items-center gap-0.5 shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. QUICK ACTION SHORTCUTS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => onNavigateTab('bookings')}
          className="p-3 rounded-2xl ow-card hover:bg-[rgba(231,50,41,0.08)] text-left transition-colors duration-150 group cursor-pointer min-w-0"
        >
          <Calendar className="w-4 h-4 text-[#C9281F] mb-1.5 transition-transform" />
          <h3 className="text-[13px] font-bold text-[#0A0A0A] truncate">Manage Bookings</h3>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5 truncate">View &amp; process bookings</p>
        </button>

        <button
          onClick={() => onNavigateTab('slots')}
          className="p-3 rounded-2xl ow-card hover:bg-[rgba(231,50,41,0.08)] text-left transition-colors duration-150 group cursor-pointer min-w-0"
        >
          <Layers className="w-4 h-4 text-[#C9281F] mb-1.5 transition-transform" />
          <h3 className="text-[13px] font-bold text-[#0A0A0A] truncate">Slots &amp; Calendar</h3>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5 truncate">Schedules &amp; block slots</p>
        </button>

        <button
          onClick={() => onNavigateTab('customers')}
          className="p-3 rounded-2xl ow-card hover:bg-[rgba(231,50,41,0.08)] text-left transition-colors duration-150 group cursor-pointer min-w-0"
        >
          <Users className="w-4 h-4 text-[#C9281F] mb-1.5 transition-transform" />
          <h3 className="text-[13px] font-bold text-[#0A0A0A] truncate">Customers CRM</h3>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5 truncate">Player spend &amp; contacts</p>
        </button>

        <button
          onClick={() => onNavigateTab('earnings')}
          className="p-3 rounded-2xl ow-card hover:bg-[rgba(231,50,41,0.08)] text-left transition-colors duration-150 group cursor-pointer min-w-0"
        >
          <TrendingUp className="w-4 h-4 text-[#C9281F] mb-1.5 transition-transform" />
          <h3 className="text-[13px] font-bold text-[#0A0A0A] truncate">Earnings &amp; Reports</h3>
          <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5 truncate">Gross revenue &amp; export</p>
        </button>
      </div>
    </div>
  );
};
