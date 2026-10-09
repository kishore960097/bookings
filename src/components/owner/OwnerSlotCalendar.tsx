import React, { useState, useEffect } from 'react';
import { Salon, GeneratedTurfSlot, Booking } from '../../types';
import { api } from '../../services/api';
import { formatTime12Hour } from '../../utils/timeFormat';
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
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [weekSlotsMap, setWeekSlotsMap] = useState<Record<string, GeneratedTurfSlot[]>>({});
  const [daySlots, setDaySlots] = useState<GeneratedTurfSlot[]>([]);
  const [loading, setLoading] = useState(true);

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

  const isSlotPast = (dateStr: string, startTime: string) => {
    const now = new Date();
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const startM = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    return currentMinutesToday >= startM + 10;
  };

  // Calculate current week days (Sun-Sat)
  const getWeekDates = (dateStr: string) => {
    const curr = new Date(`${dateStr}T00:00:00Z`);
    const first = curr.getUTCDate() - curr.getUTCDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(curr);
      next.setUTCDate(first + i);
      days.push(next.toISOString().split('T')[0]);
    }
    return days;
  };

  const weekDates = getWeekDates(selectedDate);

  const fetchSlots = async () => {
    setLoading(true);
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
    fetchSlots();
  }, [salon.id, selectedDate, viewMode]);

  const handlePrev = () => {
    const d = new Date(`${selectedDate}T00:00:00Z`);
    if (viewMode === 'day') d.setUTCDate(d.getUTCDate() - 1);
    else d.setUTCDate(d.getUTCDate() - 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNext = () => {
    const d = new Date(`${selectedDate}T00:00:00Z`);
    if (viewMode === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else d.setUTCDate(d.getUTCDate() + 7);
    setSelectedDate(d.toISOString().split('T')[0]);
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
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ── TOP CONTROL BAR ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Navigation buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-black text-xs text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
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
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            Today
          </button>
        </div>

        {/* View mode toggle & Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap items-center gap-1">
            {(['day', 'week', 'month'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  viewMode === m ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
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
            className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
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
            className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Unblock Date</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span>Edit Base Schedule</span>
          </button>
          
          {onOpenSchedules && (
            <button
              onClick={onOpenSchedules}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span>Open Slots</span>
            </button>
          )}
        </div>
      </div>

      {/* ── CALENDAR VIEW ── */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold">Loading slot schedule...</p>
        </div>
      ) : viewMode === 'week' ? (
        /* WEEK MATRIX VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-7 gap-3 text-center pb-3 border-b border-slate-100">
            {weekDates.map((dateStr) => {
              const d = new Date(`${dateStr}T00:00:00Z`);
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const isSelected = dateStr === selectedDate;
              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`w-11 h-11 sm:w-14 sm:h-14 mx-auto rounded-full flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : isToday
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-black'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none mb-1">{dayNames[d.getUTCDay()]}</p>
                  <p className="text-sm sm:text-base font-black leading-none">{d.getUTCDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Slots Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
            {weekDates.map((dateStr) => {
              const slots = weekSlotsMap[dateStr] || [];
              return (
                <div key={dateStr} className={`space-y-2 min-h-[300px] bg-slate-50/50 p-2 rounded-2xl border border-slate-100 ${dateStr === selectedDate ? 'block' : 'hidden sm:block'}`}>
                  <div className="text-[11px] font-black text-slate-600 text-center pb-1 border-b border-slate-200/60">
                    {slots.length} Slots
                  </div>

                  {slots.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-400 font-medium">
                      Closed / No Slots
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-1 gap-2">
                      {slots.map((slot) => {
                        const isBooked = slot.isBooked;
                        const isBlocked = slot.isBlocked;
                        const isPast = isSlotPast(dateStr, slot.startTime);

                        return (
                          <div
                            key={slot.id}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSelectedSlot(slot);
                            }}
                            className={`p-1.5 sm:p-2.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] shadow-2xs flex flex-col justify-between overflow-hidden ${
                              isBooked
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : isBlocked
                                ? 'bg-slate-200 border-slate-300 text-slate-600 opacity-60'
                                : 'bg-white border-slate-200 hover:border-emerald-400 text-slate-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between font-mono font-bold mb-1 sm:mb-0 gap-0.5">
                              <span className="text-[9px] sm:text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">{formatTime12Hour(slot.startTime)}</span>
                              <span className="text-[9px] sm:text-[10px] font-black text-slate-500">₹{slot.price}</span>
                            </div>

                            <div className="mt-1 flex items-center justify-between">
                              <span
                                className={`text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded truncate ${
                                  isPast && isBooked
                                    ? 'bg-blue-100 text-blue-800'
                                    : isBooked
                                    ? 'bg-rose-200 text-rose-900'
                                    : isBlocked || !slot.available
                                    ? 'bg-slate-300 text-slate-700'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isPast && isBooked ? 'COMPLETED' : isBooked ? 'BOOKED' : isBlocked ? 'BLOCKED' : !slot.available ? 'CLOSED' : 'AVAILABLE'}
                              </span>
                              {slot.customerName && (
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 truncate max-w-[40px] ml-1">
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
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-base text-slate-900">Slots for {selectedDate}</h3>
            <span className="text-xs font-bold text-slate-500">{daySlots.length} Total Slots</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {daySlots.map((slot) => {
              const isBooked = slot.isBooked;
              const isBlocked = slot.isBlocked;
              const isPast = isSlotPast(selectedDate, slot.startTime);

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-2.5 sm:p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] flex flex-col gap-1.5 overflow-hidden justify-between h-full ${
                    isBooked
                      ? 'bg-rose-50 border-rose-200'
                      : isBlocked
                      ? 'bg-slate-100 border-slate-200 opacity-70'
                      : 'bg-white border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[10px] sm:text-sm text-slate-900 truncate">
                        {formatTime12Hour(slot.startTime)}
                      </span>
                      <span className="font-black text-[10px] sm:text-sm text-slate-900 font-mono shrink-0">₹{slot.price}</span>
                    </div>
                    <span className="text-[9px] sm:text-xs text-slate-500 font-bold">
                      to {formatTime12Hour(slot.endTime)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 sm:pt-2 border-t border-slate-100 mt-auto">
                    <span
                      className={`text-[8px] sm:text-[10px] font-black uppercase px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md truncate ${
                        isPast && isBooked
                          ? 'bg-blue-100 text-blue-800'
                          : isBooked
                          ? 'bg-rose-200 text-rose-900'
                          : isBlocked || !slot.available
                          ? 'bg-slate-300 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isPast && isBooked ? 'COMPLETED' : isBooked ? 'BOOKED' : isBlocked ? 'BLOCKED' : !slot.available ? 'CLOSED' : 'AVAILABLE'}
                    </span>
                    {slot.customerName ? (
                      <span className="font-bold text-slate-800 text-[9px] sm:text-xs truncate max-w-[60px] sm:max-w-[100px] ml-1">{slot.customerName}</span>
                    ) : (
                      <span className="text-slate-400 text-[9px] sm:text-xs">—</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Slot Details</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedDate} · {formatTime12Hour(selectedSlot.startTime)} – {formatTime12Hour(selectedSlot.endTime)}</p>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Time Range:</span>
                <span className="font-bold text-slate-900 font-mono">{formatTime12Hour(selectedSlot.startTime)} – {formatTime12Hour(selectedSlot.endTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-bold text-slate-900">{selectedSlot.durationMinutes} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Price:</span>
                <span className="font-black text-slate-900 font-mono">₹{selectedSlot.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                    selectedSlot.isBooked
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : selectedSlot.isBlocked || !selectedSlot.available
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {selectedSlot.isBooked ? 'BOOKED' : selectedSlot.isBlocked ? 'BLOCKED' : !selectedSlot.available ? 'CLOSED' : 'AVAILABLE'}
                </span>
              </div>

              {selectedSlot.isBooked && (
                <>
                  <div className="pt-2 border-t border-slate-200 flex justify-between">
                    <span className="text-slate-500">Customer Name:</span>
                    <span className="font-bold text-slate-900">{selectedSlot.customerName || 'Customer'}</span>
                  </div>
                  {selectedSlot.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-bold text-slate-900 font-mono">{selectedSlot.customerPhone}</span>
                    </div>
                  )}
                  {selectedSlot.bookingId && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Booking ID:</span>
                      <span className="font-bold text-indigo-700 font-mono">
                        QGO-{selectedSlot.bookingId.split('_').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment:</span>
                    <span className="font-bold text-emerald-700 capitalize">{selectedSlot.paymentStatus || 'Pay at Shop'}</span>
                  </div>
                </>
              )}
            </div>

            {slotActionError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
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
                  className="w-full py-3 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-sm transition-colors"
                >
                  {slotActionLoading ? 'Processing...' : 'Cancel Booking & Process Refund'}
                </button>
              ) : selectedSlot.isBlocked ? (
                <button
                  type="button"
                  onClick={handleUnblockSlot}
                  disabled={slotActionLoading}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{slotActionLoading ? 'Unblocking...' : 'Unblock Slot'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBlockSlot}
                  disabled={slotActionLoading}
                  className="w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 shadow-sm transition-colors flex items-center justify-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">Block Specific Date</h3>
                <p className="text-xs text-slate-500">Make all slots unavailable for an entire date</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Select Dates to Block
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {blockDates.map(d => (
                    <span key={d} className="px-2 py-1 bg-rose-100 text-rose-800 text-[10px] rounded flex items-center gap-1 font-bold">
                      {d} 
                      <XCircle 
                        className="w-3 h-3 cursor-pointer hover:text-rose-950" 
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Reason for Closure
                </label>
                <input
                  type="text"
                  value={blockDateReason}
                  onChange={(e) => setBlockDateReason(e.target.value)}
                  placeholder="e.g. Private Event, Maintenance, Personal Holiday"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              {blockDateConflicts && blockDateConflicts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Active Bookings Conflict ({blockDateConflicts.length})</span>
                  </div>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    There are {blockDateConflicts.length} active customer bookings on this date. Blocking this date will cancel them and issue full 100% refunds.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockDateModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBlockDateSubmit(Boolean(blockDateConflicts && blockDateConflicts.length > 0))}
                disabled={blockDateLoading}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 shadow-sm"
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
