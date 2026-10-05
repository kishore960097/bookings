import React, { useState } from 'react';
import { Salon, DashboardOverviewData, GeneratedTurfSlot } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fmt12 } from '../../utils/timeFormat';
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
  Eye} from 'lucide-react';

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

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ── 1. BUSINESS PROFILE & APPROVAL HEADER ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-2xl font-black shadow-md shrink-0">
            {salon.logoUrl ? (
              <img src={salon.logoUrl} alt={salon.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              salon.name.charAt(0)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">{salon.name}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Approved · Live
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-medium">
              <span>{salon.category}</span>
              <span>•</span>
              <span>{salon.address}</span>
            </p>
          </div>
        </div>

        {/* Header Ratings & Stats */}
        <div className="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div className="text-center px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Rating</span>
            <div className="flex items-center justify-center gap-1 text-sm font-black text-slate-900 mt-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{salon.rating > 0 ? salon.rating.toFixed(1) : 'New'}</span>
            </div>
          </div>

          <div className="text-center px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Total Bookings</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">
              {(overview?.completedBookingsCount || 0) + (overview?.todayBookingsCount || 0)}
            </span>
          </div>

          <div className="text-center px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100">
            <span className="text-[10px] font-black uppercase text-emerald-700 block tracking-wider">Today's Bookings</span>
            <span className="text-sm font-black text-emerald-900 mt-0.5 block">
              {overview?.todayBookingsCount || 0}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. DASHBOARD SUMMARY METRIC CARDS (REAL DB DATA) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Today's Bookings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Today's Bookings</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {overview?.todayBookingsCount || 0}
          </span>
        </div>

        {/* Card 2: Today's Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/30 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Today's Revenue</span>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">
            ₹{(overview?.todayRevenue || 0).toLocaleString()}
          </span>
        </div>

        {/* Card 3: Upcoming Bookings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Upcoming</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {overview?.upcomingBookingsCount || 0}
          </span>
        </div>

        {/* Card 4: Available Slots */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Available Slots</span>
          <span className="text-2xl font-black text-amber-800 mt-1 block">
            {overview?.availableSlotsCount || 0}
          </span>
        </div>

        {/* Card 5: Completed Bookings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Completed</span>
          <span className="text-2xl font-black text-teal-900 mt-1 block">
            {overview?.completedBookingsCount || 0}
          </span>
        </div>

        {/* Card 6: Cancelled Bookings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
          <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-2">
            <XCircle className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Cancelled</span>
          <span className="text-2xl font-black text-red-800 mt-1 block">
            {overview?.cancelledBookingsCount || 0}
          </span>
        </div>
      </div>

      {/* ── 3. TODAY'S SLOTS SECTION ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900">Today's Schedule &amp; Slots</h2>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              📅 {overview?.todayFormatted || 'Today'} · Live slot availability
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('slots')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Weekly Calendar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Slot Table / Cards */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-slate-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold">Loading today's slots...</p>
          </div>
        ) : !overview?.todaySlots || overview.todaySlots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Layers className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-700">No slots configured for today</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Configure your daily hours or generate recurring slots in the Slots &amp; Calendar section.
            </p>
            <button
              onClick={() => onNavigateTab('slots')}
              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-wider"
            >
              Configure Schedule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table Layout */}
            <table className="w-full text-left text-xs hidden md:table">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-3.5">Time Range</th>
                  <th className="py-3 px-3.5">Pitch / Arena</th>
                  <th className="py-3 px-3.5 text-right">Price</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {overview.todaySlots.map((slot) => {
                  const isBooked = slot.isBooked;
                  const isBlocked = slot.isBlocked;
                  const isAvailable = slot.available && !isBooked && !isBlocked;

                  return (
                    <tr
                      key={slot.id}
                      onClick={() => onSelectSlot(slot)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Time */}
                      <td className="py-3.5 px-3.5 font-bold text-slate-900 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={slot.periodType === 'day' ? 'text-amber-600' : 'text-indigo-600'}>
                            {slot.periodType === 'day' ? '☀️' : '🌙'}
                          </span>
                          <span>{fmt12(slot.startTime)} – {fmt12(slot.endTime)}</span>
                        </div>
                      </td>

                      {/* Resource */}
                      <td className="py-3.5 px-3.5 text-slate-600 font-semibold">
                        {slot.resourceName || 'Main Pitch'}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-3.5 text-right font-black text-slate-900 font-mono">
                        ₹{slot.price}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3.5 text-center">
                        {isBooked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                            BOOKED
                          </span>
                        ) : isBlocked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                            BLOCKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            AVAILABLE
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-3.5 text-slate-700">
                        {slot.customerName ? (
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center">
                              {slot.customerName.charAt(0)}
                            </span>
                            <span>{slot.customerName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3.5 text-right">
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-600 text-[11px] font-bold transition-colors inline-flex items-center gap-1"
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

            {/* Mobile Card Layout */}
            <div className="md:hidden grid grid-cols-2 gap-2">
              {overview.todaySlots.map((slot) => {
                const isBooked = slot.isBooked;
                const isBlocked = slot.isBlocked;

                return (
                  <div
                    key={slot.id}
                    onClick={() => onSelectSlot(slot)}
                    className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-colors cursor-pointer flex flex-col gap-1.5 overflow-hidden justify-between h-full"
                  >
                    {/* Top Row: Time & Price */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 font-bold text-slate-900 font-mono text-[10px]">
                          <span className={slot.periodType === 'day' ? 'text-amber-600' : 'text-indigo-600'}>
                            {slot.periodType === 'day' ? '☀️' : '🌙'}
                          </span>
                          <span className="truncate">{fmt12(slot.startTime)}</span>
                        </div>
                        <div className="font-black text-slate-900 font-mono text-[10px] shrink-0">
                          ₹{slot.price}
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold ml-4">
                        to {fmt12(slot.endTime)}
                      </span>
                    </div>
                    
                    {/* Middle Row: Arena & Customer */}
                    <div className="flex items-center justify-between text-[9px] mt-auto pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500 font-semibold uppercase tracking-wide truncate max-w-[50px]">
                        {slot.resourceName || 'Main Pitch'}
                      </span>
                      {slot.customerName && (
                        <span className="font-bold text-slate-800 truncate max-w-[60px]">{slot.customerName}</span>
                      )}
                    </div>

                    {/* Bottom Row: Status & Action */}
                    <div className="flex items-center justify-between">
                      {isBooked ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 truncate">
                          BOOKED
                        </span>
                      ) : isBlocked ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 truncate">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 truncate">
                          AVAILABLE
                        </span>
                      )}
                      <button
                        type="button"
                        className="px-1.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[9px] font-black inline-flex items-center gap-0.5 shrink-0"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigateTab('bookings')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-all group"
        >
          <Calendar className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-black text-slate-900">Manage Bookings</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">View &amp; process all customer bookings</p>
        </button>

        <button
          onClick={() => onNavigateTab('slots')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-all group"
        >
          <Layers className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-black text-slate-900">Slots &amp; Calendar</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Recurring schedules, pricing &amp; block slots</p>
        </button>

        <button
          onClick={() => onNavigateTab('customers')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all group"
        >
          <Users className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-black text-slate-900">Customers CRM</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Player spend history &amp; contacts</p>
        </button>

        <button
          onClick={() => onNavigateTab('earnings')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 text-left transition-all group"
        >
          <TrendingUp className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-black text-slate-900">Earnings &amp; Reports</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Gross revenue, refunds &amp; CSV export</p>
        </button>
      </div>
    </div>
  );
};
