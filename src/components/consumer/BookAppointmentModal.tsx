import React, { useState, useEffect, useMemo } from 'react';
import { Salon, Service, Staff, Booking, TurfResource, isTurfBusiness } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NumberInput } from '../common/NumberInput';
import { useQueue } from '../../context/QueueContext';
import confetti from 'canvas-confetti';
import {
  X,
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon,
  ChevronRight,
  Layers,
  Zap} from 'lucide-react';

interface BookAppointmentModalProps {
  salon: Salon;
  preselectedService?: Service;
  preselectedTurfId?: string;
  onClose: () => void;
  onBookingSuccess: (booking: Booking) => void;
}

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  salon,
  preselectedService,
  preselectedTurfId,
  onClose,
  onBookingSuccess,
}) => {
  const { user, t } = useAuth();
  const { refreshActiveBooking } = useQueue();

  const isTurf = isTurfBusiness(salon.category, salon.bookingMode);

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [turfResources, setTurfResources] = useState<TurfResource[]>(salon.resources || []);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedService?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('any');
  const [selectedTurfId, setSelectedTurfId] = useState<string>(
    preselectedTurfId || (salon.resources && salon.resources[0]?.id) || 'turf_1'
  );

  // Dates: today + next advanceBookingDays
  const advanceDays = Math.max(7, salon.bookingSettings?.advanceBookingDays || 30);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Time period filter ('all' | 'morning' | 'evening')
  const [timePeriod, setTimePeriod] = useState<'all' | 'morning' | 'evening'>('all');

  // Time slots
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Customer contact info
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [numberOfPlayers, setNumberOfPlayers] = useState(isTurf ? 10 : 1);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load salon details (services, staff, resources)
  useEffect(() => {
    const loadSalonData = async () => {
      try {
        const detail = await api.getSalonDetail(salon.id);
        if (detail) {
          setServices(detail.services || []);
          setStaffList(detail.staff || []);
          if (detail.salon?.resources && detail.salon.resources.length > 0) {
            setTurfResources(detail.salon.resources);
            if (!preselectedTurfId) {
              setSelectedTurfId(detail.salon.resources[0].id);
            }
          }
          if (!selectedServiceId && detail.services && detail.services.length > 0) {
            setSelectedServiceId(detail.services[0].id);
          }
        }
      } catch (e) {
        console.error('Error loading salon details:', e);
      }
    };
    loadSalonData();
  }, [salon.id]);

  // Fetch live availability slots
  useEffect(() => {
    if (!salon.id) return;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      setError(null);
      try {
        const res = await api.getAvailability(
          salon.id,
          isTurf ? undefined : (selectedServiceId || undefined),
          isTurf ? undefined : (selectedStaffId === 'any' ? undefined : selectedStaffId),
          selectedDate,
          isTurf ? selectedTurfId : undefined
        );

        if (res && res.slots) {
          setSlots(res.slots);
          const firstAvail = res.slots.find((s: any) => s.available);
          if (firstAvail && !res.slots.some((s: any) => s.startTime === selectedTime && s.available)) {
            setSelectedSlot(firstAvail);
            setSelectedTime(firstAvail.startTime || (firstAvail as any).time || '');
          } else if (!firstAvail) {
            setSelectedSlot(null);
            setSelectedTime('');
          }
        }
      } catch (e) {
        console.error('Error fetching availability:', e);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [salon.id, selectedDate, selectedStaffId, selectedServiceId, selectedTurfId, isTurf]);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const currentTurf = turfResources.find((r) => r.id === selectedTurfId) || turfResources[0];

  // Filter slots based on morning vs evening
  const filteredSlots = useMemo(() => {
    if (timePeriod === 'all') return slots;
    return slots.filter((s) => {
      const timeVal = s.startTime || s.time || '00:00';
      const hour = parseInt(timeVal.split(':')[0], 10);
      if (timePeriod === 'morning') return hour < 14;
      return hour >= 14;
    });
  }, [slots, timePeriod]);

  // Calculate current price
  const currentPrice = useMemo(() => {
    if (isTurf) {
      if (selectedSlot?.price) return selectedSlot.price;
      return currentTurf?.pricePerHour || salon.startingPrice || 800;
    }
    return selectedService?.price || 0;
  }, [isTurf, selectedSlot, currentTurf, salon.startingPrice, selectedService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) {
      setError('Please select an available time slot.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await api.createBooking({
        salonId: salon.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        serviceId: isTurf ? 'srv_turf_slot' : selectedServiceId,
        staffId: isTurf ? undefined : (selectedStaffId === 'any' ? undefined : selectedStaffId),
        resourceId: isTurf ? selectedTurfId : undefined,
        mode: 'appointment',
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        slotEndTime: isTurf ? selectedSlot?.endTime : undefined,
        price: currentPrice,
        numberOfPlayers,
        notes,
      });

      if (res.success && res.booking) {
        try {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        } catch (e) {}
        await refreshActiveBooking();
        onBookingSuccess(res.booking);
      } else if (res.slotTaken) {
        setError('This time slot was just booked by another customer. Please choose another slot.');
        const reload = await api.getAvailability(
          salon.id,
          undefined,
          undefined,
          selectedDate,
          isTurf ? selectedTurfId : undefined
        );
        if (reload && reload.slots) setSlots(reload.slots);
      } else {
        setError(res.error || 'Failed to confirm booking. Please try another slot.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Next 14 days pill selector
  const nextDays = useMemo(() => {
    const daysToShow = Math.min(14, advanceDays);
    return Array.from({ length: daysToShow }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = idx === 0 ? 'TOD' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dayNum = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      return { dateStr, dayName, dayNum, month };
    });
  }, [advanceDays]);

  const formatSlotTime = (time: string) => {
    if (!time) return '';
    const [hourStr, minuteStr] = time.split(':');
    if (!hourStr || !minuteStr) return time;
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    const hourFormatted = hour.toString().padStart(2, '0');
    return `${hourFormatted}:${minuteStr} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-[#FFFFFF]" onClick={onClose} />

      <div className="relative w-full max-w-xl max-h-[92dvh] bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl shadow-lg z-10 border border-[rgba(23,23,23,0.12)] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header Banner */}
        <div
          className={`p-5 sm:p-6 text-[#171717] relative ${
            isTurf
              ? 'bg-gradient-to-r from-[#FF9F1C] via-[#FF9F1C]/90 to-[#FAF8F4]'
              : 'bg-gradient-to-r from-[#FF9F1C] via-[#FF9F1C]/90 to-[#FF9F1C]/80'
          }`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[rgba(23,23,23,0.05)] hover:bg-[rgba(23,23,23,0.05)] flex items-center justify-center text-[#171717] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="pr-8">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider mb-1.5 ${
                isTurf ? 'bg-[#FF9F1C] text-[#171717]' : 'bg-[#FF9F1C] text-[#171717]'
              }`}
            >
              {isTurf ? '🏟️ Book a Turf Slot' : '📅 Book Appointment'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{salon.name}</h2>
            <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">{salon.address}</p>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-[rgba(255,159,28,0.15)] border border-[rgba(23,23,23,0.12)] text-xs font-bold text-[#FF9F1C] flex items-center gap-2 animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── TURF SELECTOR (When Turf has multiple grounds) ── */}
          {isTurf && turfResources.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-2 uppercase tracking-wider">
                1. Select Turf / Ground
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {turfResources.map((t) => {
                  const isSelected = selectedTurfId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTurfId(t.id)}
                      className={`p-3 rounded-2xl border text-left transition-colors duration-150 ${
                        isSelected
                          ? 'bg-[#FF9F1C] text-[#171717] border-[#FF9F1C] shadow-sm ring-2 ring-[#FF9F1C]'
                          : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] text-[#171717] hover:border-[rgba(23,23,23,0.12)]'
                      }`}
                    >
                      <p className="font-black text-xs">{t.name}</p>
                      <p className={`text-[11px] ${isSelected ? 'text-[#FF9F1C]' : 'text-[rgba(23,23,23,0.70)]'}`}>
                        {t.type}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SALON: SERVICE & STYLIST SELECTOR ── */}
          {!isTurf && (
            <>
              <div>
                <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-2 uppercase tracking-wider">
                  1. Select Service
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {services.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedServiceId(srv.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-colors duration-150 ${
                        selectedServiceId === srv.id
                          ? 'bg-[#FF9F1C] text-[#171717] border-[#FF9F1C] shadow-xs'
                          : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] text-[#171717] hover:border-[rgba(23,23,23,0.12)]'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs">{srv.name}</p>
                        <p className={`text-[11px] ${selectedServiceId === srv.id ? 'text-[#FF9F1C]' : 'text-[rgba(23,23,23,0.70)]'}`}>
                          {srv.durationMinutes} min · {srv.category}
                        </p>
                      </div>
                      <span className={`text-xs font-black ${selectedServiceId === srv.id ? 'text-[#171717]' : 'text-[#FF9F1C]'}`}>
                        ₹{srv.price}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-2 uppercase tracking-wider">
                  2. Specialist
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffId('any')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors duration-150 ${
                      selectedStaffId === 'any'
                        ? 'bg-[#FF9F1C] text-[#171717] border-[#FF9F1C] shadow-xs'
                        : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] text-[rgba(23,23,23,0.70)] hover:bg-[rgba(23,23,23,0.05)]'
                    }`}
                  >
                    ✨ Any Specialist
                  </button>
                  {staffList.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStaffId(st.id)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors duration-150 flex items-center gap-1.5 ${
                        selectedStaffId === st.id
                          ? 'bg-[#FF9F1C] text-[#171717] border-[#FF9F1C] shadow-xs'
                          : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] text-[rgba(23,23,23,0.70)] hover:bg-[rgba(23,23,23,0.05)]'
                      }`}
                    >
                      <span>{st.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── DATE SELECTION PILLS ── */}
          <div>
            <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-2 uppercase tracking-wider">
              {isTurf ? (turfResources.length > 1 ? '2. Select Date' : '1. Select Date') : '3. Select Date'}
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {nextDays.map((d) => {
                const isSelected = selectedDate === d.dateStr;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`min-w-[56px] py-2.5 px-2 rounded-2xl border text-center transition-colors duration-150 shrink-0 ${
                      isSelected
                        ? isTurf
                          ? 'bg-[#FF9F1C] border-[#FF9F1C] text-[#171717] shadow-sm ring-2 ring-[#FF9F1C]'
                          : 'bg-[#FF9F1C] border-[#FF9F1C] text-[#171717] shadow-sm ring-2 ring-[#FF9F1C]'
                        : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] text-[rgba(23,23,23,0.70)] hover:border-[rgba(23,23,23,0.12)]'
                    }`}
                  >
                    <span className="block text-[11px] font-black uppercase tracking-wider opacity-80">
                      {d.dayName}
                    </span>
                    <span className="block text-base font-black leading-tight my-0.5">{d.dayNum}</span>
                    <span className="block text-[11px] font-bold opacity-75">{d.month}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── TIME SLOTS GRID ── */}
          <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-3xl border border-[rgba(23,23,23,0.12)]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-[#171717] uppercase tracking-wider">
                  Available Slots ({selectedDate})
                </h3>
                <p className="text-[11px] text-[rgba(23,23,23,0.70)]">
                  {isTurf ? `Slots for ${currentTurf?.name || 'Turf'}` : 'Select a start time'}
                </p>
              </div>

              {/* Morning vs Evening Filter */}
              <div className="flex items-center bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setTimePeriod('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors duration-150 ${
                    timePeriod === 'all'
                      ? isTurf
                        ? 'bg-[#FF9F1C] text-[#171717]'
                        : 'bg-[#FF9F1C] text-[#171717]'
                      : 'text-[rgba(23,23,23,0.70)]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTimePeriod('morning')}
                  className={`px-2.5 py-1 rounded-lg transition-colors duration-150 flex items-center gap-1 ${
                    timePeriod === 'morning'
                      ? isTurf
                        ? 'bg-[#FF9F1C] text-[#171717]'
                        : 'bg-[#FF9F1C] text-[#171717]'
                      : 'text-[rgba(23,23,23,0.70)]'
                  }`}
                >
                  <Sun size={11} className="text-[#FF9F1C]" />
                  <span>Morning</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimePeriod('evening')}
                  className={`px-2.5 py-1 rounded-lg transition-colors duration-150 flex items-center gap-1 ${
                    timePeriod === 'evening'
                      ? isTurf
                        ? 'bg-[#FF9F1C] text-[#171717]'
                        : 'bg-[#FF9F1C] text-[#171717]'
                      : 'text-[rgba(23,23,23,0.70)]'
                  }`}
                >
                  <Moon size={11} className="text-[#FF9F1C]" />
                  <span>Evening</span>
                </button>
              </div>
            </div>

            {loadingSlots ? (
              <div className="py-8 text-center text-xs text-[rgba(23,23,23,0.70)] flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[rgba(23,23,23,0.12)] border-t-emerald-600 rounded-full animate-spin" />
                <span>Checking real-time turf availability...</span>
              </div>
            ) : filteredSlots.length === 0 ? (
              <div className="py-8 text-center text-xs text-[rgba(23,23,23,0.70)] bg-[#FFFFFF] rounded-2xl border border-dashed border-[rgba(23,23,23,0.12)]">
                No available slots for this date/time range. Please pick another date or period.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredSlots.map((s: any) => {
                  const startTimeStr = s.startTime || s.time;
                  const endTimeStr = s.endTime;
                  const isSelected = selectedTime === startTimeStr;
                  const isAvailable = s.available;

                  if (!isAvailable) {
                    return (
                      <div
                        key={startTimeStr}
                        className="p-3 rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[#FFFFFF] text-[rgba(23,23,23,0.70)] text-left opacity-70 cursor-not-allowed"
                      >
                        <p className="text-xs font-black line-through">
                          {formatSlotTime(startTimeStr)}
                          {endTimeStr ? ` – ${formatSlotTime(endTimeStr)}` : ''}
                        </p>
                        <span className="inline-block text-[11px] font-black uppercase tracking-wider bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] px-1.5 py-0.5 rounded mt-1">
                          Booked
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={startTimeStr}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(s);
                        setSelectedTime(startTimeStr);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-colors duration-150 flex flex-col justify-between ${
                        isSelected
                          ? isTurf
                            ? 'bg-[#FF9F1C] text-[#171717] border-[#FF9F1C] shadow-md ring-2 ring-[#FF9F1C]'
                            : 'bg-[#FF9F1C] text-[#171717] border-[#FF9F1C] shadow-md ring-2 ring-[#FF9F1C]'
                          : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] hover:border-[#FF9F1C] text-[#171717]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black">
                          {formatSlotTime(startTimeStr)}
                          {endTimeStr ? ` – ${formatSlotTime(endTimeStr)}` : ''}
                        </p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {s.durationMinutes && (
                            <span className={`text-[11px] font-bold ${isSelected ? 'text-[#FF9F1C]' : 'text-[rgba(23,23,23,0.70)]'}`}>
                              {s.durationMinutes} min
                            </span>
                          )}
                          {s.isPeak && (
                            <span className="text-[11px] font-black uppercase tracking-wider bg-[#FF9F1C] text-[#FF9F1C] px-1 rounded">
                              Peak
                            </span>
                          )}
                        </div>
                      </div>

                      {s.price && (
                        <p className={`text-xs font-black mt-2 ${isSelected ? 'text-[#171717]' : 'text-[#FF9F1C]'}`}>
                          ₹{s.price}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── PLAYER COUNT & CONTACT DETAILS ── */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] bg-[#FAF8F4]"
                />
              </div>
            </div>



            <div>
              <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Football bibs needed, 5v5 friendly match"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] bg-[#FAF8F4]"
              />
            </div>
          </div>
        </div>

        {/* Bottom Booking Summary & Action */}
        <div className="p-4 sm:p-5 bg-[#FFFFFF] border-t border-[rgba(23,23,23,0.12)] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-left w-full sm:w-auto">
            <span className="text-[11px] uppercase font-bold text-[rgba(23,23,23,0.70)] block">Total Payable</span>
            <span className="text-xl font-black text-[#171717]">
              ₹{currentPrice}{' '}
              <span className="text-[11px] font-normal text-[rgba(23,23,23,0.70)] font-sans">
                (Pay at Venue)
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedTime}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isTurf
                ? 'bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717]'
                : 'bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717]'
            }`}
          >
            <span>{submitting ? 'Confirming Slot…' : 'Confirm & Book Slot'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
