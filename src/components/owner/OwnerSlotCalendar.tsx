import React, { useState, useEffect } from 'react';
import { Salon, GeneratedTurfSlot, Booking } from '../../types';
import { api } from '../../services/api';
import { formatTime12Hour, getBusinessTodayStr, shiftDateStr } from '../../utils/timeFormat';
import { haptics } from '../../utils/haptics';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Filter,
  DollarSign,
  User,
  Phone} from 'lucide-react';

interface OwnerSlotCalendarProps {
  salon: Salon;
  onOpenSettings: () => void;
  onOpenSchedules?: () => void;
}

export const OwnerSlotCalendar: React.FC<OwnerSlotCalendarProps> = ({ salon, onOpenSettings, onOpenSchedules }) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState<string>(() => getBusinessTodayStr());
  const [weekSlotsMap, setWeekSlotsMap] = useState<Record<string, GeneratedTurfSlot[]>>({});
  const [daySlots, setDaySlots] = useState<GeneratedTurfSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [clockTick, setClockTick] = useState(0);

  // Selected slot for detail modal
  const [selectedSlot, setSelectedSlot] = useState<GeneratedTurfSlot | null>(null);
  const [slotActionLoading, setSlotActionLoading] = useState(false);
  const [slotActionError, setSlotActionError] = useState('');

  // Block date modal state
  const [showBlockDateModal, setShowBlockDateModal] = useState(false);
  const [blockDates, setBlockDates] = useState<string[]>([]);
  const [blockDateReason, setBlockDateReason] = useState('Personal Holiday / Private Event');
  const [blockDateConflicts, setBlockDateConflicts] = useState<Booking[] | null>(null);
  const [blockDateLoading, setBlockDateLoading] = useState(false);

  // Real-time 30s clock evaluation tick
  useEffect(() => {
    const t = window.setInterval(() => setClockTick((v) => v + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const isSlotPast = (dateStr: string, startTime: string) => {
    const now = new Date();
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
    const todayStr = getBusinessTodayStr();
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const parts = (startTime || '00:00').split(':').map(Number);
    const startM = (parts[0] || 0) * 60 + (parts[1] || 0);
    return currentMinutesToday >= startM;
  };

  // Calculate current week days (Sun-Sat)
  const getWeekDates = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(shiftDateStr(dateStr, i - dayOfWeek));
    }
    return days;
  };

  const weekDates = getWeekDates(selectedDate);

  const fetchSlots = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (viewMode === 'day') {
        const res = await api.getAvailability(salon.id, { date: selectedDate });
        if (res && res.slots) {
          setDaySlots(res.slots);
        }
      } else {
        // Fetch for all days in week
        const promises = weekDates.map((d) => api.getAvailability(salon.id, { date: d }));
        const results = await Promise.all(promises);
        const map: Record<string, GeneratedTurfSlot[]> = {};
        results.forEach((r, idx) => {
          map[weekDates[idx]] = r?.slots || [];
        });
        setWeekSlotsMap(map);
      }
    } catch (e) {
      console.error('Error fetching calendar slots:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSlots();
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchSlots(false);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [salon.id, selectedDate, viewMode]);

  const handlePrev = () => {
    setSelectedDate(shiftDateStr(selectedDate, viewMode === 'day' ? -1 : -7));
  };

  const handleNext = () => {
    setSelectedDate(shiftDateStr(selectedDate, viewMode === 'day' ? 1 : 7));
  };

  const handleBlockSlot = async () => {
    if (!selectedSlot) return;
    setSlotActionLoading(true);
    setSlotActionError('');
    try {
      const res = await api.blockSlot(salon.id, {
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        reason: 'Blocked by owner',
      });
      if (res && res.success) {
        setSelectedSlot(null);
        fetchSlots();
      } else {
        setSlotActionError(res?.message || 'Failed to block slot');
      }
    } catch (e: any) {
      setSlotActionError(e?.message || 'Error blocking slot');
    } finally {
      setSlotActionLoading(false);
    }
  };

  const handleUnblockSlot = async () => {
    if (!selectedSlot) return;
    setSlotActionLoading(true);
    setSlotActionError('');
    try {
      const res = await api.unblockSlot(salon.id, {
        date: selectedDate,
        startTime: selectedSlot.startTime,
      });
      if (res && res.success) {
        setSelectedSlot(null);
        fetchSlots();
      }
    } catch (e: any) {
      setSlotActionError(e?.message || 'Error unblocking slot');
    } finally {
      setSlotActionLoading(false);
    }
  };

  const handleCancelBookedSlot = async () => {
    if (!selectedSlot || !selectedSlot.bookingId) return;
    if (!window.confirm(`Are you sure you want to cancel the booking for ${selectedSlot.customerName || 'Customer'} and process their refund?`)) {
      return;
    }
    setSlotActionLoading(true);
    setSlotActionError('');
    try {
      await api.cancelBooking(selectedSlot.bookingId, 'Owner cancelled slot from calendar');
      setSelectedSlot(null);
      fetchSlots();
    } catch (e: any) {
      setSlotActionError(e?.message || 'Failed to cancel booking');
    } finally {
      setSlotActionLoading(false);
    }
  };

  const handleBlockDateSubmit = async (forceCancel = false) => {
    if (blockDates.length === 0) return;
    setBlockDateLoading(true);
    try {
      const res = await api.blockDate(salon.id, {
        dates: blockDates,
        reason: blockDateReason,
        forceCancelBookings: forceCancel,
      });
      if (res.success) {
        setShowBlockDateModal(false);
        setBlockDateConflicts(null);
        fetchSlots();
      } else if ((res as any).hasConflicts) {
        setBlockDateConflicts((res as any).affectedBookings);
      }
    } catch (e) {
      console.error('Error blocking date:', e);
    } finally {
      setBlockDateLoading(false);
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── TOP CONTROL BAR ── */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Navigation buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl border border-[rgba(10,10,10,0.12)] hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] font-semibold text-[13px] text-[#0A0A0A] hover:bg-[rgba(10,10,10,0.05)] transition-colors cursor-pointer min-h-[36px]">
            <CalendarIcon className="w-4 h-4 text-[rgba(10,10,10,0.70)]" />
            <span>{selectedDate}</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
            />
          </div>
          <button
            onClick={handleNext}
            className="p-2 rounded-xl border border-[rgba(10,10,10,0.12)] hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedDate(getBusinessTodayStr())}
            className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] font-semibold text-[13px] transition-colors min-h-[36px]"
          >
            Today
          </button>
        </div>

        {/* View mode toggle & Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
          <div className="bg-[#FFFFFF] p-1 rounded-xl flex flex-wrap items-center gap-1">
            {(['day', 'week'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 min-h-[36px] ${
                  viewMode === m ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-2xs' : 'text-[rgba(10,10,10,0.70)] hover:text-[#0A0A0A]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setBlockDates([selectedDate]);
              setBlockDateConflicts(null);
              setShowBlockDateModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] text-[#C9281F] hover:bg-[rgba(231,50,41,0.08)] font-semibold text-[13px] flex items-center gap-1.5 transition-colors min-h-[40px]"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Block Date</span>
          </button>

          <button
            onClick={async () => {
              if (window.confirm(`Are you sure you want to unblock ${selectedDate}?`)) {
                try {
                  setLoading(true);
                  await api.unblockDate(salon.id, { dates: [selectedDate] });
                  await fetchSlots();
                } catch (e) {
                  alert('Failed to unblock date');
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] text-[#C9281F] hover:bg-[rgba(231,50,41,0.08)] font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Unblock Date</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span>Edit Base Schedule</span>
          </button>
          
          {onOpenSchedules && (
            <button
              onClick={onOpenSchedules}
              className="px-3.5 py-2 rounded-xl bg-[#E73229] hover:bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span>Open Slots</span>
            </button>
          )}
        </div>
      </div>

      {/* ── CALENDAR VIEW ── */}
      {loading ? (
        <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] p-16 text-center text-[rgba(10,10,10,0.70)]">
          <div className="w-8 h-8 border-3 border-[rgba(10,10,10,0.12)] border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold">Loading slot schedule...</p>
        </div>
      ) : viewMode === 'week' ? (
        /* WEEK MATRIX VIEW */
        <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-7 gap-3 text-center pb-3 border-b border-[rgba(10,10,10,0.12)]">
            {weekDates.map((dateStr) => {
              const d = new Date(`${dateStr}T00:00:00Z`);
              const isToday = dateStr === getBusinessTodayStr();
              const isSelected = dateStr === selectedDate;
              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
                    isSelected
                      ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] shadow-md'
                      : isToday
                      ? 'bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] text-[#C9281F] font-bold'
                      : 'hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)]'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5">{dayNames[d.getUTCDay()]}</p>
                  <p className="text-[13px] font-bold leading-none">{d.getUTCDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Slots Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {weekDates.map((dateStr) => {
              const slots = weekSlotsMap[dateStr] || [];
              return (
                <div key={dateStr} className={`space-y-1.5 min-h-[300px] bg-[rgba(10,10,10,0.05)] p-1.5 rounded-2xl border border-[rgba(10,10,10,0.12)] ${dateStr === selectedDate ? 'block' : 'hidden sm:block'}`}>
                  <div className="text-[10px] font-bold text-[rgba(10,10,10,0.70)] text-center pb-1 border-b border-[rgba(10,10,10,0.12)]/60">
                    {slots.length} Slots
                  </div>

                  {slots.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-[rgba(10,10,10,0.70)] font-medium">
                      Closed / No Slots
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-1 gap-1.5">
                      {slots.map((slot) => {
                        const isBooked = Boolean(slot.isBooked);
                        const isBlocked = Boolean(slot.isBlocked);
                        const isPast = isSlotPast(dateStr, slot.startTime);
                        const isCompleted = slot.status === 'completed' || slot.bookingStatus === 'completed' || (isPast && isBooked);
                        const isClosed = !isBooked && !isBlocked && (isPast || !slot.available);

                        return (
                          <div
                            key={slot.id}
                            onClick={() => {
                              haptics.selection();
                              setSelectedDate(dateStr);
                              setSelectedSlot(slot);
                            }}
                            className={`p-1.5 rounded-xl border cursor-pointer transition-all duration-150 active:scale-[0.97] hover:scale-[1.01] shadow-2xs flex flex-col justify-between overflow-hidden min-w-0 ${
                              isCompleted
                                ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                                : isBooked
                                ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400'
                                : isBlocked
                                ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 opacity-80'
                                : isClosed
                                ? 'bg-zinc-100/60 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 opacity-60'
                                : 'bg-[#FFFFFF] dark:bg-zinc-900 border-[rgba(10,10,10,0.12)] dark:border-zinc-800 hover:border-[#E73229] text-[#0A0A0A] dark:text-zinc-100'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between font-mono font-semibold mb-0.5 gap-0.5 min-w-0">
                              <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">{formatTime12Hour(slot.startTime)}</span>
                              <span className="text-[10px] font-bold text-[rgba(10,10,10,0.70)] dark:text-zinc-400">₹{slot.price}</span>
                            </div>

                            <div className="mt-0.5 flex items-center justify-between gap-1 min-w-0">
                              <span
                                className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded truncate ${
                                  isCompleted
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                    : isBooked
                                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                    : isBlocked
                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                                    : isClosed
                                    ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                                }`}
                              >
                                {isCompleted ? 'COMPL' : isBooked ? 'BOOK' : isBlocked ? 'BLOCK' : isClosed ? 'CLOSE' : 'AVAIL'}
                              </span>
                              {slot.customerName && (
                                <span className="text-[10px] font-semibold text-[rgba(10,10,10,0.70)] dark:text-zinc-300 truncate max-w-[40px]">
                                  {slot.customerName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DAY LIST VIEW */
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-3 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[15px] text-[#0A0A0A]">Slots for {selectedDate}</h3>
            <span className="text-xs font-semibold text-[rgba(10,10,10,0.70)]">{daySlots.length} Total Slots</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {daySlots.map((slot) => {
              const isBooked = Boolean(slot.isBooked);
              const isBlocked = Boolean(slot.isBlocked);
              const isPast = isSlotPast(selectedDate, slot.startTime);
              const isCompleted = slot.status === 'completed' || slot.bookingStatus === 'completed' || (isPast && isBooked);
              const isClosed = !isBooked && !isBlocked && (isPast || !slot.available);

              return (
                <div
                  key={slot.id}
                  onClick={() => {
                    haptics.selection();
                    setSelectedSlot(slot);
                  }}
                  className={`p-2.5 rounded-2xl border cursor-pointer transition-all duration-150 active:scale-[0.97] hover:scale-[1.01] flex flex-col gap-1 overflow-hidden justify-between h-full min-w-0 ${
                    isCompleted
                      ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40'
                      : isBooked
                      ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                      : isBlocked
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 opacity-80'
                      : isClosed
                      ? 'bg-zinc-100/60 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 opacity-60'
                      : 'bg-[#FFFFFF] dark:bg-zinc-900 border-[rgba(10,10,10,0.12)] dark:border-zinc-800 hover:border-[#E73229]'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="font-mono font-semibold text-[11px] text-[#0A0A0A] dark:text-zinc-100 truncate">
                        {formatTime12Hour(slot.startTime)}
                      </span>
                      <span className="font-bold text-[13px] text-[#0A0A0A] dark:text-zinc-100 font-mono shrink-0">₹{slot.price}</span>
                    </div>
                    <span className="text-[10px] text-[rgba(10,10,10,0.70)] dark:text-zinc-400 font-medium truncate">
                      to {formatTime12Hour(slot.endTime)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[rgba(10,10,10,0.12)] dark:border-zinc-800 mt-auto gap-1 min-w-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded truncate ${
                        isCompleted
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : isBooked
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : isBlocked
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                          : isClosed
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                      }`}
                    >
                      {isCompleted ? 'COMPLETED' : isBooked ? 'BOOKED' : isBlocked ? 'BLOCKED' : isClosed ? 'CLOSED' : 'AVAILABLE'}
                    </span>
                    {slot.customerName ? (
                      <span className="font-bold text-[#0A0A0A] dark:text-zinc-100 text-[11px] sm:text-xs truncate max-w-[60px] sm:max-w-[100px] ml-1">{slot.customerName}</span>
                    ) : (
                      <span className="text-[rgba(10,10,10,0.70)] dark:text-zinc-400 text-[11px] sm:text-xs">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. SLOT DETAIL MODAL ── */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
          <div className="bg-[#FFFFFF] dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 max-w-md w-full shadow-lg border border-[rgba(10,10,10,0.12)] dark:border-zinc-800 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(10,10,10,0.12)] dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-[18px] text-[#0A0A0A] dark:text-zinc-100">Slot Details</h3>
                <p className="text-[11px] text-[rgba(10,10,10,0.70)] dark:text-zinc-400 font-mono">{selectedDate} · {formatTime12Hour(selectedSlot.startTime)} – {formatTime12Hour(selectedSlot.endTime)}</p>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1.5 rounded-xl hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] dark:text-zinc-400 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-zinc-800/50 border border-[rgba(10,10,10,0.12)] dark:border-zinc-700 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[rgba(10,10,10,0.70)] dark:text-zinc-400">Time Range:</span>
                <span className="font-semibold text-[#0A0A0A] dark:text-zinc-100 font-mono">{formatTime12Hour(selectedSlot.startTime)} – {formatTime12Hour(selectedSlot.endTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgba(10,10,10,0.70)] dark:text-zinc-400">Duration:</span>
                <span className="font-semibold text-[#0A0A0A] dark:text-zinc-100">{selectedSlot.durationMinutes} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgba(10,10,10,0.70)] dark:text-zinc-400">Price:</span>
                <span className="font-bold text-[#0A0A0A] dark:text-zinc-100 font-mono">₹{selectedSlot.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgba(10,10,10,0.70)] dark:text-zinc-400">Status:</span>
                <span
                  className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                    selectedSlot.status === 'completed' || selectedSlot.bookingStatus === 'completed'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : selectedSlot.isBooked
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                      : selectedSlot.isBlocked
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : !selectedSlot.available
                      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {selectedSlot.status === 'completed' || selectedSlot.bookingStatus === 'completed' ? 'COMPLETED' : selectedSlot.isBooked ? 'BOOKED' : selectedSlot.isBlocked ? 'BLOCKED' : !selectedSlot.available ? 'CLOSED' : 'AVAILABLE'}
                </span>
              </div>

              {selectedSlot.isBooked && (
                <>
                  <div className="pt-2 border-t border-[rgba(10,10,10,0.12)] flex justify-between">
                    <span className="text-[rgba(10,10,10,0.70)]">Customer Name:</span>
                    <span className="font-bold text-[#0A0A0A]">{selectedSlot.customerName || 'Customer'}</span>
                  </div>
                  {selectedSlot.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-[rgba(10,10,10,0.70)]">Phone:</span>
                      <span className="font-bold text-[#0A0A0A] font-mono">{selectedSlot.customerPhone}</span>
                    </div>
                  )}
                  {selectedSlot.bookingId && (
                    <div className="flex justify-between">
                      <span className="text-[rgba(10,10,10,0.70)]">Booking ID:</span>
                      <span className="font-bold text-[#C9281F] font-mono">
                        QGO-{selectedSlot.bookingId.split('_').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[rgba(10,10,10,0.70)]">Payment:</span>
                    <span className="font-bold text-[#C9281F] capitalize">{selectedSlot.paymentStatus || 'Pay at Shop'}</span>
                  </div>
                </>
              )}
            </div>

            {slotActionError && (
              <div className="p-2.5 rounded-xl bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] text-[#C9281F] text-xs font-semibold">
                {slotActionError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {selectedSlot.isBooked ? (
                <button
                  type="button"
                  onClick={handleCancelBookedSlot}
                  disabled={slotActionLoading}
                  className="w-full py-2.5 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-semibold text-[13px] hover:bg-[#E73229] shadow-sm transition-colors min-h-[40px]"
                >
                  {slotActionLoading ? 'Processing...' : 'Cancel Booking & Process Refund'}
                </button>
              ) : selectedSlot.isBlocked ? (
                <button
                  type="button"
                  onClick={handleUnblockSlot}
                  disabled={slotActionLoading}
                  className="w-full py-2.5 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-semibold text-[13px] hover:bg-[#E73229] shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{slotActionLoading ? 'Unblocking...' : 'Unblock Slot'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBlockSlot}
                  disabled={slotActionLoading}
                  className="w-full py-2.5 rounded-xl bg-[#FFFFFF] text-[#0A0A0A] font-semibold text-[13px] hover:bg-[rgba(10,10,10,0.05)] shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <Lock className="w-4 h-4" />
                  <span>{slotActionLoading ? 'Blocking...' : 'Block This Slot'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. BLOCK DATE MODAL ── */}
      {showBlockDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
          <div className="bg-[#FFFFFF] rounded-2xl p-4 sm:p-5 max-w-md w-full shadow-lg border border-[rgba(10,10,10,0.12)] space-y-3 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-[#C9281F]">
              <div className="w-9 h-9 rounded-xl bg-[rgba(231,50,41,0.08)] flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-[18px] text-[#0A0A0A]">Block Specific Date</h3>
                <p className="text-[11px] text-[rgba(10,10,10,0.70)]">Make all slots unavailable for an entire date</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                  Select Dates to Block
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {blockDates.map(d => (
                    <span key={d} className="px-2 py-0.5 bg-[rgba(231,50,41,0.08)] text-[#C9281F] text-[11px] rounded flex items-center gap-1 font-semibold">
                      {d} 
                      <XCircle 
                        className="w-3 h-3 cursor-pointer hover:text-[#C9281F]" 
                        onClick={() => setBlockDates(blockDates.filter(bd => bd !== d))} 
                      />
                    </span>
                  ))}
                </div>
                <input
                  type="date"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !blockDates.includes(val)) {
                      setBlockDates([...blockDates, val]);
                    }
                    e.target.value = '';
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium min-h-[40px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                  Reason for Closure
                </label>
                <input
                  type="text"
                  value={blockDateReason}
                  onChange={(e) => setBlockDateReason(e.target.value)}
                  placeholder="e.g. Private Event, Maintenance"
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium min-h-[40px]"
                />
              </div>

              {blockDateConflicts && blockDateConflicts.length > 0 && (
                <div className="p-3 rounded-xl bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#C9281F]">
                    <AlertTriangle className="w-4 h-4 text-[#C9281F]" />
                    <span>Active Bookings Conflict ({blockDateConflicts.length})</span>
                  </div>
                  <p className="text-[#C9281F] text-[11px] leading-relaxed">
                    There are {blockDateConflicts.length} active customer bookings on this date. Blocking this date will cancel them and issue full 100% refunds.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockDateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[13px] font-semibold text-[rgba(10,10,10,0.70)] hover:bg-[rgba(10,10,10,0.05)] min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBlockDateSubmit(Boolean(blockDateConflicts && blockDateConflicts.length > 0))}
                disabled={blockDateLoading}
                className="flex-1 py-2.5 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-semibold text-[13px] hover:bg-[#E73229] shadow-sm min-h-[40px]"
              >
                {blockDateLoading
                  ? 'Processing...'
                  : blockDateConflicts && blockDateConflicts.length > 0
                  ? 'Confirm & Cancel Bookings'
                  : 'Block Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
