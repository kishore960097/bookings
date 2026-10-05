import React, { useState, useMemo } from 'react';
import {
  DaySlotConfig,
  TurfAvailabilitySchedule,
  TurfResource,
  TurfSlotItem,
  SlotBreak,
  CustomSlot,
  TimePricingPeriod,
  SalonHoliday,
} from '../../types';
import {
  Clock,
  Plus,
  Trash2,
  Copy,
  Calendar,
  Zap,
  Check,
  AlertCircle,
  X,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Layers,
  Info,
  DollarSign,
  Coffee,
  Sun,
  Moon,
  Pencil,
  CheckCircle2} from 'lucide-react';

import { NumberInput } from '../common/NumberInput';
import { TimeInput } from '../common/TimeInput';
import { DurationInput } from '../common/DurationInput';
import {
  format12Hour,
  isMinuteInInterval,
  minutesToTime,
  timeToMinutes,
} from '../../../packages/shared/src/time';

interface TurfAvailabilityBuilderProps {
  resources?: TurfResource[];
  turfSchedule?: TurfAvailabilitySchedule[];
  onChange: (schedule: TurfAvailabilitySchedule[]) => void;
  holidays?: SalonHoliday[];
  onHolidayChange?: (holidays: SalonHoliday[]) => void;
  activeScheduleId?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hour (60 min)', value: 60 },
  { label: '2 hours (120 min)', value: 120 },
  { label: 'Custom', value: -1 },
];

// Generate automatic slot items for a day given Day & Night pricing
function generateDayNightSlots(
  dayIndex: number,
  dayStartTime: string,
  dayEndTime: string,
  dayPrice: number,
  nightStartTime: string,
  nightEndTime: string,
  nightPrice: number,
  durationMinutes: number,
  breaks: SlotBreak[] = [],
  existingSlots: TurfSlotItem[] = []
): TurfSlotItem[] {
  if (durationMinutes <= 0) return [];

  const openM = timeToMinutes(dayStartTime);   // e.g. 06:00 = 360
  // Night end wraps to next day if nightEnd <= nightStart
  const nightEndM = timeToMinutes(nightEndTime);
  const nightStartM = timeToMinutes(nightStartTime);

  // Effective close: if night wraps midnight (nightEnd < nightStart), add 1440
  let effectiveCloseM: number;
  if (nightEndM <= nightStartM) {
    // overnight — e.g. 18:00 → 06:00 next day
    effectiveCloseM = openM + ((nightEndM + 1440 - openM) % 1440 || 1440);
  } else {
    // same-day night (e.g. 06:00 → 22:00)
    effectiveCloseM = openM + (nightEndM - openM);
  }

  // Preserve existing customized slot prices or statuses
  const existingCustomMap = new Map<string, TurfSlotItem>();
  existingSlots.forEach((s) => {
    if (s.isCustomized || s.source === 'custom') {
      existingCustomMap.set(s.startTime, s);
      existingCustomMap.set(s.id, s);
    }
  });

  const slots: TurfSlotItem[] = [];

  for (let startOffset = openM; startOffset < effectiveCloseM; startOffset += durationMinutes) {
    const endOffset = startOffset + durationMinutes;
    // Don't exceed the owner's configured close time
    if (endOffset > effectiveCloseM) break;

    const startM = startOffset % 1440;
    const endM = endOffset % 1440;
    const startStr = minutesToTime(startM);
    const endStr = minutesToTime(endM);
    const actualDuration = endOffset - startOffset;

    // Check break overlap
    const inBreak = breaks.some((brk) => {
      let bStart = timeToMinutes(brk.startTime);
      let bEnd = timeToMinutes(brk.endTime);
      if (bEnd <= bStart) bEnd += 1440;
      if (bStart < openM) {
        bStart += 1440;
        bEnd += 1440;
      }
      return startOffset < bEnd && endOffset > bStart;
    });
    if (inBreak) continue;

    // ─── Price & Period Assignment (Based on Slot Start Time) ───
    let slotPrice = dayPrice;
    let periodType: 'day' | 'night' = 'day';

    const isNight = isMinuteInInterval(startM, nightStartTime, nightEndTime);
    if (isNight) {
      slotPrice = nightPrice;
      periodType = 'night';
    } else {
      slotPrice = dayPrice;
      periodType = 'day';
    }

    // Preserve customized price if this slot was previously manually edited
    const prevCustom =
      existingCustomMap.get(startStr) ||
      existingCustomMap.get(`slot_${dayIndex}_${startOffset}_${endOffset}`);
    if (prevCustom && prevCustom.isCustomized) {
      slotPrice = prevCustom.price;
    }

    const slotId = `slot_${dayIndex}_${startOffset}_${endOffset}`;

    slots.push({
      id: slotId,
      dayOfWeek: dayIndex,
      startTime: startStr,
      endTime: endStr,
      durationMinutes: actualDuration,
      price: slotPrice,
      status: prevCustom?.status || 'active',
      source: prevCustom?.source || 'generated',
      isCustomized: prevCustom?.isCustomized || false,
      periodType,
      pricingPeriodName: periodType === 'day' ? 'Day' : 'Night',
      createdAt: prevCustom?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Include standalone custom slots
  existingSlots
    .filter((s) => s.source === 'custom')
    .forEach((cs) => {
      if (!slots.some((s) => s.id === cs.id || s.startTime === cs.startTime)) {
        slots.push(cs);
      }
    });

  return slots;
}

function createDefaultDays(): DaySlotConfig[] {
  return DAY_NAMES.map((name, i) => {
    const isWeekend = i === 0 || i === 6;
    const dayPrice = isWeekend ? 800 : 600;
    const nightPrice = isWeekend ? 1200 : 1000;
    const dayStart = '06:00';
    const dayEnd = '18:00';
    const nightStart = '18:00';
    const nightEnd = '06:00';
    const duration = 60;

    const initialSlots = generateDayNightSlots(
      i,
      dayStart,
      dayEnd,
      dayPrice,
      nightStart,
      nightEnd,
      nightPrice,
      duration,
      [],
      []
    );

    const timePricingPeriods: TimePricingPeriod[] = [
      { id: 'p_day', name: 'Day', startTime: dayStart, endTime: dayEnd, price: dayPrice, isActive: true },
      { id: 'p_night', name: 'Night', startTime: nightStart, endTime: nightEnd, price: nightPrice, isActive: true },
    ];

    return {
      dayOfWeek: i,
      dayName: name,
      isOpen: true,
      openTime: dayStart,
      closeTime: nightEnd,
      slotDurationMinutes: duration,
      defaultPrice: dayPrice,
      allowPartialSlot: false,
      bufferMinutes: 0,
      breaks: [],
      timePricingPeriods,
      slots: initialSlots,
    };
  });
}

export const TurfAvailabilityBuilder: React.FC<TurfAvailabilityBuilderProps> = ({
  resources = [],
  turfSchedule = [],
  onChange,
  holidays = [],
  onHolidayChange,
}) => {
  const activeTurfList =
    resources.length > 0
      ? resources
      : [{ id: 'turf_1', salonId: '', name: 'Turf 1', type: '7-a-side Football', isActive: true }];

  const [selectedTurfId, setSelectedTurfId] = useState<string>(activeTurfList[0]?.id || 'turf_1');

  // Resolve current schedule for selected turf
  const currentSchedule = useMemo(() => {
    const existing = activeScheduleId ? turfSchedule.find((s) => s.id === activeScheduleId) : turfSchedule.find((s) => s.resourceId === selectedTurfId && !s.id && !s.validFrom && !s.validTo);
    if (existing) return existing;
    const def = turfSchedule.find((s) => s.resourceId === 'default' || !s.resourceId);
    if (def) return { ...def, resourceId: selectedTurfId };
    return {
      resourceId: selectedTurfId,
      days: createDefaultDays(),
      specialDates: [],
    };
  }, [turfSchedule, selectedTurfId]);

  const days: DaySlotConfig[] = currentSchedule.days || createDefaultDays();

  // Active day view tab (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const [activeDayView, setActiveDayView] = useState<number>(1); // Monday default

  // ─── 1. Day & Night Pricing State ───
  const [dayStartTime, setDayStartTime] = useState<string>('06:00');
  const [dayEndTime, setDayEndTime] = useState<string>('18:00');
  const [dayPrice, setDayPrice] = useState<number>(600);

  const [nightStartTime, setNightStartTime] = useState<string>('18:00');
  const [nightEndTime, setNightEndTime] = useState<string>('06:00');
  const [nightPrice, setNightPrice] = useState<number>(1000);

  // ─── 2. Slot Duration State ───
  const [durationPreset, setDurationPreset] = useState<number>(60);
  const [customDurationMinutes, setCustomDurationMinutes] = useState<number>(120);

  // ─── 3. Generation Range & Days Selection ───
  const [generationRange, setGenerationRange] = useState<'days' | 'week' | 'month'>('week');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // Default All 7 Days

  // Modals
  const [showAddBreakModal, setShowAddBreakModal] = useState<boolean>(false);
  const [breakStart, setBreakStart] = useState<string>('13:00');
  const [breakEnd, setBreakEnd] = useState<string>('14:00');
  const [breakReason, setBreakReason] = useState<string>('Maintenance & Watering');

  const [showAddCustomSlotModal, setShowAddCustomSlotModal] = useState<boolean>(false);
  const [csStartTime, setCsStartTime] = useState<string>('07:30');
  const [csEndTime, setCsEndTime] = useState<string>('09:00');
  const [csPrice, setCsPrice] = useState<number>(1200);
  const [csLabel, setCsLabel] = useState<string>('Special Slot');

  // Confirmation Modals
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState<boolean>(false);
  const [confirmBulkAction, setConfirmBulkAction] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Inline editing state for individual slot price or time
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<number>(600);
  const [editingTimeSlotId, setEditingTimeSlotId] = useState<string | null>(null);
  const [editStartTimeVal, setEditStartTimeVal] = useState<string>('06:00');
  const [editEndTimeVal, setEditEndTimeVal] = useState<string>('08:00');

  // Resolved slot duration in minutes
  const activeDurationMinutes = durationPreset === -1 ? customDurationMinutes : durationPreset;

  // ─── Persistence Helper ───
  const updateDays = (newDays: DaySlotConfig[]) => {
    const updatedSchedule: TurfAvailabilitySchedule = {
      ...currentSchedule,
      resourceId: selectedTurfId,
      days: newDays,
    };

    const existingIndex = activeScheduleId ? turfSchedule.findIndex(s => s.id === activeScheduleId) : turfSchedule.findIndex(s => s.resourceId === selectedTurfId && !s.id && !s.validFrom && !s.validTo);
    let newScheduleList: TurfAvailabilitySchedule[];
    if (existingIndex >= 0) {
      newScheduleList = [...turfSchedule];
      newScheduleList[existingIndex] = updatedSchedule;
    } else {
      newScheduleList = [...turfSchedule, updatedSchedule];
    }
    onChange(newScheduleList);
  };

  // ─── Day Selection Actions ───
  const handleSelectEntireWeek = () => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setGenerationRange('week');
  };

  const toggleDaySelection = (dayNum: number) => {
    if (selectedDays.includes(dayNum)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayNum));
      }
    } else {
      setSelectedDays([...selectedDays, dayNum].sort());
    }
  };

  // ─── Validation ───
  const validationError = useMemo(() => {
    if (activeDurationMinutes <= 0 || activeDurationMinutes > 360) {
      return 'Slot duration must be between 15 and 360 minutes.';
    }
    if (dayPrice <= 0 || nightPrice <= 0) {
      return 'Day price and Night price must be greater than ₹0.';
    }
    return null;
  }, [activeDurationMinutes, dayPrice, nightPrice]);

  // Check if any customized slots exist on selected days
  const hasCustomizedSlotsOnSelectedDays = useMemo(() => {
    return days.some((d) => {
      if (!selectedDays.includes(d.dayOfWeek)) return false;
      return (d.slots || []).some((s) => s.isCustomized || s.source === 'custom' || s.status === 'disabled');
    });
  }, [days, selectedDays]);

  // ─── Automatic Slot Generation Execution ───
  const executeGeneration = () => {
    const targetDayIndices =
      generationRange === 'week' || generationRange === 'month'
        ? [0, 1, 2, 3, 4, 5, 6]
        : selectedDays;

    const timePricingPeriods: TimePricingPeriod[] = [
      { id: 'p_day', name: 'Day', startTime: dayStartTime, endTime: dayEndTime, price: dayPrice, isActive: true },
      { id: 'p_night', name: 'Night', startTime: nightStartTime, endTime: nightEndTime, price: nightPrice, isActive: true },
    ];

    const newDays = days.map((d) => {
      if (!targetDayIndices.includes(d.dayOfWeek)) {
        return d;
      }

      const generated = generateDayNightSlots(
        d.dayOfWeek,
        dayStartTime,
        dayEndTime,
        dayPrice,
        nightStartTime,
        nightEndTime,
        nightPrice,
        activeDurationMinutes,
        d.breaks || [],
        d.slots || []
      );

      return {
        ...d,
        isOpen: true,
        openTime: dayStartTime,
        closeTime: nightEndTime,
        slotDurationMinutes: activeDurationMinutes,
        defaultPrice: dayPrice,
        allowPartialSlot: false,
        timePricingPeriods,
        slots: generated,
      };
    });

    updateDays(newDays);
    setConfirmRegenerateOpen(false);
  };

  const handleGenerateClick = () => {
    if (validationError) return;
    if (hasCustomizedSlotsOnSelectedDays) {
      setConfirmRegenerateOpen(true);
    } else {
      executeGeneration();
    }
  };

  // ─── Active Day Helpers ───
  const activeDay = days.find((d) => d.dayOfWeek === activeDayView) || days[1];
  const activeDaySlots = activeDay.slots || [];

  // Toggle Day Open / Closed
  const toggleDayOpen = () => {
    const newDays = days.map((d) => {
      if (d.dayOfWeek === activeDayView) {
        return { ...d, isOpen: !d.isOpen };
      }
      return d;
    });
    updateDays(newDays);
  };

  // ─── Slot Level Actions ───
  const handleToggleSlotStatus = (slotId: string) => {
    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedSlots: TurfSlotItem[] = (d.slots || []).map((s) => {
        if (s.id === slotId) {
          const nextStatus: 'active' | 'disabled' = s.status === 'active' ? 'disabled' : 'active';
          return { ...s, status: nextStatus, updatedAt: new Date().toISOString() };
        }
        return s;
      });
      return { ...d, slots: updatedSlots };
    });
    updateDays(newDays);
  };

  const handleDeleteSlot = (slotId: string) => {
    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      return {
        ...d,
        slots: (d.slots || []).filter((s) => s.id !== slotId),
      };
    });
    updateDays(newDays);
  };

  const handleSaveSlotPrice = (slotId: string) => {
    if (editPriceVal <= 0) return;
    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedSlots = (d.slots || []).map((s) => {
        if (s.id === slotId) {
          return {
            ...s,
            price: editPriceVal,
            isCustomized: true,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      return { ...d, slots: updatedSlots };
    });
    updateDays(newDays);
    setEditingSlotId(null);
  };

  const handleSaveSlotTime = (slotId: string) => {
    const startM = timeToMinutes(editStartTimeVal);
    const endM = timeToMinutes(editEndTimeVal);
    if (endM <= startM && endM !== 0) return;

    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedSlots = (d.slots || []).map((s) => {
        if (s.id === slotId) {
          const dur = endM > startM ? endM - startM : endM + 1440 - startM;
          return {
            ...s,
            startTime: editStartTimeVal,
            endTime: editEndTimeVal,
            durationMinutes: dur,
            source: 'custom' as const,
            isCustomized: true,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      return { ...d, slots: updatedSlots };
    });
    updateDays(newDays);
    setEditingTimeSlotId(null);
  };

  const handleDuplicateSlot = (slot: TurfSlotItem) => {
    const startM = timeToMinutes(slot.endTime);
    const endM = (startM + slot.durationMinutes) % 1440;
    const newSlot: TurfSlotItem = {
      id: `slot_dup_${Date.now()}`,
      dayOfWeek: slot.dayOfWeek,
      startTime: minutesToTime(startM),
      endTime: minutesToTime(endM),
      durationMinutes: slot.durationMinutes,
      price: slot.price,
      status: 'active',
      source: 'custom',
      isCustomized: true,
      periodType: slot.periodType,
      pricingPeriodName: slot.pricingPeriodName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedSlots = [...(d.slots || []), newSlot];
      return { ...d, slots: updatedSlots };
    });
    updateDays(newDays);
  };

  // ─── Break Management ───
  const handleAddBreak = () => {
    const bStart = timeToMinutes(breakStart);
    const bEnd = timeToMinutes(breakEnd);
    if (bEnd <= bStart) {
      alert('Break end time must be after break start time.');
      return;
    }

    const openM = timeToMinutes(dayStartTime);
    const nightEndM = timeToMinutes(nightEndTime);
    const nightStartM = timeToMinutes(nightStartTime);
    const effectiveCloseM = nightEndM <= nightStartM
      ? openM + ((nightEndM + 1440 - openM) % 1440 || 1440)
      : openM + (nightEndM - openM);

    // Validate break is within owner's configured hours
    const bStartOffset = bStart >= openM ? bStart : bStart + 1440;
    const bEndOffset = bEnd > bStart ? bEnd : bEnd + 1440;
    if (bStartOffset < openM || bEndOffset > effectiveCloseM) {
      alert(`Break must be within your business hours (${format12Hour(dayStartTime)} – ${format12Hour(nightEndTime)}).`);
      return;
    }

    // Check overlap with existing breaks on this day
    const existingBreaks = activeDay.breaks || [];
    const hasBreakOverlap = existingBreaks.some((brk) => {
      const eStart = timeToMinutes(brk.startTime);
      const eEnd = timeToMinutes(brk.endTime);
      return bStart < eEnd && bEnd > eStart;
    });
    if (hasBreakOverlap) {
      alert('This break time overlaps with an existing break. Please choose a different time.');
      return;
    }

    const newBreak: SlotBreak = {
      id: `break_${Date.now()}`,
      startTime: breakStart,
      endTime: breakEnd,
      reason: breakReason || 'Break / Maintenance',
    };

    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedBreaks = [...(d.breaks || []), newBreak];
      const filteredSlots = (d.slots || []).filter((s) => {
        const sStart = timeToMinutes(s.startTime);
        const sEnd = timeToMinutes(s.endTime);
        return !(sStart < bEnd && sEnd > bStart);
      });
      return { ...d, breaks: updatedBreaks, slots: filteredSlots };
    });

    updateDays(newDays);
    setShowAddBreakModal(false);
  };

  const handleDeleteBreak = (breakIndex: number) => {
    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedBreaks = (d.breaks || []).filter((_, idx) => idx !== breakIndex);
      return { ...d, breaks: updatedBreaks };
    });
    updateDays(newDays);
  };

  // ─── Custom Slot Creation ───
  const handleAddCustomSlot = () => {
    const cStart = timeToMinutes(csStartTime);
    const cEnd = timeToMinutes(csEndTime);
    if (csPrice <= 0) return;

    const hasOverlap = (activeDay.slots || []).some((s) => {
      if (s.status === 'disabled') return false;
      const sStart = timeToMinutes(s.startTime);
      const sEnd = timeToMinutes(s.endTime);
      return cStart < sEnd && cEnd > sStart;
    });

    if (hasOverlap) {
      alert('This custom slot overlaps an existing active slot on this day.');
      return;
    }

    const dur = cEnd > cStart ? cEnd - cStart : cEnd + 1440 - cStart;
    const isNight = isMinuteInInterval(cStart, nightStartTime, nightEndTime);

    const newCustomSlot: TurfSlotItem = {
      id: `cs_${Date.now()}`,
      dayOfWeek: activeDayView,
      startTime: csStartTime,
      endTime: csEndTime,
      durationMinutes: dur,
      price: csPrice,
      status: 'active',
      source: 'custom',
      isCustomized: true,
      periodType: isNight ? 'night' : 'day',
      pricingPeriodName: isNight ? 'Night' : 'Day',
      label: csLabel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedSlots = [...(d.slots || []), newCustomSlot];
      return { ...d, slots: updatedSlots };
    });

    updateDays(newDays);
    setShowAddCustomSlotModal(false);
  };

  // ─── Bulk Action Shortcuts ───
  const handleApplyToWeekdays = () => {
    const sourceDay = days.find((d) => d.dayOfWeek === activeDayView) || days[1];
    setConfirmBulkAction({
      open: true,
      title: `Apply ${sourceDay.dayName} to Weekdays (Mon–Fri)`,
      description: `This will copy ${sourceDay.dayName}'s schedule and pricing to Monday through Friday. Continue?`,
      onConfirm: () => {
        const weekdaysList = [1, 2, 3, 4, 5];
        const newDays = days.map((d) => {
          if (!weekdaysList.includes(d.dayOfWeek)) return d;
          return {
            ...sourceDay,
            dayOfWeek: d.dayOfWeek,
            dayName: d.dayName,
            slots: (sourceDay.slots || []).map((s) => ({
              ...s,
              id: `slot_${d.dayOfWeek}_${s.startTime.replace(':', '')}_${s.endTime.replace(':', '')}`,
              dayOfWeek: d.dayOfWeek,
            })),
          };
        });
        updateDays(newDays);
        setConfirmBulkAction((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleApplyToAllDays = () => {
    const sourceDay = days.find((d) => d.dayOfWeek === activeDayView) || days[1];
    setConfirmBulkAction({
      open: true,
      title: `Apply ${sourceDay.dayName} to All 7 Days`,
      description: `This will copy ${sourceDay.dayName}'s schedule and pricing to Sunday through Saturday. Continue?`,
      onConfirm: () => {
        const newDays = days.map((d) => {
          return {
            ...sourceDay,
            dayOfWeek: d.dayOfWeek,
            dayName: d.dayName,
            slots: (sourceDay.slots || []).map((s) => ({
              ...s,
              id: `slot_${d.dayOfWeek}_${s.startTime.replace(':', '')}_${s.endTime.replace(':', '')}`,
              dayOfWeek: d.dayOfWeek,
            })),
          };
        });
        updateDays(newDays);
        setConfirmBulkAction((prev) => ({ ...prev, open: false }));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* ── MULTI-TURF SELECTOR ── */}
      {activeTurfList.length > 1 && (
        <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Configuring Turf Schedule
              </p>
              <p className="text-[11px] text-slate-500">
                Each turf ground maintains its own independent schedule &amp; pricing.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {activeTurfList.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTurfId(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  selectedTurfId === t.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          1. PRICING & SLOT SETTINGS (CLEAN DAY + NIGHT UI)
         ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </span>
            <h3 className="font-black text-base text-slate-900">PRICING &amp; SLOT SETTINGS</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Day and Night pricing. QGo automatically assigns prices to each slot based on start time.
          </p>
        </div>

        {/* ── DAY & NIGHT PRICING CARDS ── */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {/* DAY PRICING CARD */}
          <div className="h-full min-h-[160px] p-3 sm:p-4 rounded-3xl border-[1.5px] border-amber-300 bg-amber-50/20 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-3">
                <div className="flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                  <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider">DAY</span>
                </div>
                <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Daytime
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center bg-white px-1 py-1.5 rounded-xl border border-amber-200 shadow-sm">
                  <span className="text-[8px] font-black uppercase text-slate-500 mb-0.5">START</span>
                  <TimeInput
                    value={dayStartTime}
                    onChange={setDayStartTime}
                    className="text-[10px] sm:text-[11px] font-black text-slate-900 bg-transparent text-center outline-none w-full"
                  />
                </div>
                <div className="flex flex-col items-center bg-white px-1 py-1.5 rounded-xl border border-amber-200 shadow-sm">
                  <span className="text-[8px] font-black uppercase text-slate-500 mb-0.5">END</span>
                  <TimeInput
                    value={dayEndTime}
                    onChange={setDayEndTime}
                    className="text-[10px] sm:text-[11px] font-black text-slate-900 bg-transparent text-center outline-none w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center mt-2 bg-white px-2 py-1.5 rounded-xl border border-amber-200 shadow-sm">
              <span className="text-[8px] font-black uppercase text-slate-500 mb-0.5">PRICE</span>
              <div className="flex items-center">
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 mr-0.5">₹</span>
                <NumberInput
                  min={1}
                  step={50}
                  value={dayPrice}
                  onChange={(val) => setDayPrice(Math.max(1, val))}
                  className="text-[10px] sm:text-[11px] font-black text-emerald-700 bg-transparent text-center outline-none w-16 p-0 border-none"
                />
              </div>
            </div>
          </div>


          {/* NIGHT PRICING CARD */}
          <div className="h-full min-h-[160px] p-3 sm:p-4 rounded-3xl border-[1.5px] border-indigo-300 bg-indigo-50/20 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-3">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-600 fill-indigo-600 shrink-0" />
                  <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wider">NIGHT</span>
                </div>
                <span className="text-[8px] font-black uppercase bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Overnight
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center bg-white px-1 py-1.5 rounded-xl border border-indigo-200 shadow-sm">
                  <span className="text-[8px] font-black uppercase text-slate-500 mb-0.5">START</span>
                  <TimeInput
                    value={nightStartTime}
                    onChange={setNightStartTime}
                    className="text-[10px] sm:text-[11px] font-black text-slate-900 bg-transparent text-center outline-none w-full"
                  />
                </div>
                <div className="flex flex-col items-center bg-white px-1 py-1.5 rounded-xl border border-indigo-200 shadow-sm">
                  <span className="text-[8px] font-black uppercase text-slate-500 mb-0.5">END</span>
                  <TimeInput
                    value={nightEndTime}
                    onChange={setNightEndTime}
                    className="text-[10px] sm:text-[11px] font-black text-slate-900 bg-transparent text-center outline-none w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center mt-2 bg-white px-2 py-1.5 rounded-xl border border-indigo-200 shadow-sm">
              <span className="text-[8px] font-black uppercase text-slate-500 mb-0.5">PRICE</span>
              <div className="flex items-center">
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 mr-0.5">₹</span>
                <NumberInput
                  min={1}
                  step={50}
                  value={nightPrice}
                  onChange={(val) => setNightPrice(Math.max(1, val))}
                  className="text-[10px] sm:text-[11px] font-black text-indigo-700 bg-transparent text-center outline-none w-16 p-0 border-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── SLOT DURATION ── */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
            SLOT DURATION
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((dp) => {
              const isSelected = durationPreset === dp.value;
              return (
                <button
                  key={dp.label}
                  type="button"
                  onClick={() => setDurationPreset(dp.value)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-black transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {dp.label}
                </button>
              );
            })}
          </div>

          {durationPreset === -1 && (
            <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 max-w-sm flex items-center justify-between">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                Custom Duration
              </label>
              <DurationInput
                value={customDurationMinutes}
                onChange={(val) => setCustomDurationMinutes(Math.max(15, val))}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-emerald-700"
              />
            </div>
          )}
        </div>

        {/* ── GENERATION RANGE ── */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
            GENERATION RANGE
          </label>
          <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setGenerationRange('days')}
              className={`py-2.5 px-3 rounded-xl border text-xs font-black text-center transition-all ${
                generationRange === 'days'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Selected Days ({selectedDays.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setGenerationRange('week');
                setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
              }}
              className={`py-2.5 px-3 rounded-xl border text-xs font-black text-center transition-all ${
                generationRange === 'week'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Entire Week (7 Days)
            </button>
            <button
              type="button"
              onClick={() => {
                setGenerationRange('month');
                setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
              }}
              className={`py-2.5 px-3 rounded-xl border text-xs font-black text-center transition-all ${
                generationRange === 'month'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Full Month (30 Days)
            </button>
          </div>
        </div>

        {/* ── SELECT DAYS ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              SELECT DAYS
            </label>
            <button
              type="button"
              onClick={handleSelectEntireWeek}
              className="text-xs font-black text-emerald-700 hover:text-emerald-800 underline"
            >
              Select Entire Week
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAY_SHORT.map((shortName, idx) => {
              const isSelected = selectedDays.includes(idx);
              return (
                <button
                  key={shortName}
                  type="button"
                  onClick={() => toggleDaySelection(idx)}
                  className={`py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-center font-black text-[10px] sm:text-xs transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-400/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ── GENERATE SLOTS BUTTON ── */}
        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={Boolean(validationError)}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          
          <span>
            GENERATE SLOTS (
            {generationRange === 'month'
              ? 'FULL MONTH · 30 DAYS'
              : generationRange === 'week'
              ? 'ENTIRE WEEK · 7 DAYS'
              : `${selectedDays.length} DAYS`}
            )
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          2. SCHEDULE & GENERATED SLOTS PREVIEW
         ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-base text-slate-900">
              SCHEDULE &amp; GENERATED SLOTS PREVIEW
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Day slots (☀️) and Night slots (🌙) are visually distinguished with their assigned pricing.
            </p>
          </div>
        </div>

        {/* Day Tabs: SUN | MON | TUE | WED | THU | FRI | SAT */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((d) => {
            const isTabActive = activeDayView === d.dayOfWeek;
            const activeSlotsCount = (d.slots || []).filter((s) => s.status === 'active').length;
            return (
              <button
                key={d.dayOfWeek}
                type="button"
                onClick={() => setActiveDayView(d.dayOfWeek)}
                className={`w-11 h-11 sm:w-14 sm:h-14 mx-auto rounded-full flex flex-col items-center justify-center transition-all ${
                  isTabActive
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-700 ring-offset-1'
                    : d.isOpen
                    ? 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                    : 'bg-slate-100 border border-slate-200 text-slate-400'
                }`}
              >
                <span className="block text-[9px] sm:text-[10px] font-black tracking-wider uppercase leading-none mb-1">
                  {DAY_SHORT[d.dayOfWeek]}
                </span>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black leading-none ${
                    !d.isOpen
                      ? 'bg-red-100 text-red-700'
                      : isTabActive
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {d.isOpen ? `${activeSlotsCount}` : 'Off'}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Active Day Header & Controls Removed as requested ── */}

        {/* Closed Day Alert */}
        {!activeDay.isOpen && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-black">{activeDay.dayName} is currently marked as CLOSED.</p>
              <p className="mt-0.5 text-amber-700">
                All slots on this day are disabled and will not be displayed or bookable by customers.
              </p>
            </div>
          </div>
        )}

        {/* ── Breaks List ── */}
        {(activeDay.breaks || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Scheduled Breaks ({activeDay.breaks?.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeDay.breaks?.map((brk, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-amber-200 bg-amber-50/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="font-black text-amber-950">
                        {format12Hour(brk.startTime)} – {format12Hour(brk.endTime)}
                      </p>
                      <p className="text-[10px] text-amber-700">{brk.reason || 'Break / Maintenance'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteBreak(idx)}
                    className="p-1.5 text-amber-700 hover:text-red-600 rounded-lg"
                    title="Delete break"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Generated Slots Grid with Day & Night Color Styling ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">
              Generated Slots ({activeDaySlots.length} Total ·{' '}
              {activeDaySlots.filter((s) => s.status === 'active').length} Active)
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                <Sun className="w-3 h-3 text-amber-500 fill-amber-400" /> Day Slot (₹{dayPrice})
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200">
                <Moon className="w-3 h-3 text-indigo-600 fill-indigo-400" /> Night Slot (₹{nightPrice})
              </span>
            </div>
          </div>

          {activeDaySlots.length === 0 ? (
            <div className="py-12 text-center rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-xs font-black text-slate-600">No slots generated for {activeDay.dayName} yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click &ldquo;GENERATE SLOTS&rdquo; above to automatically create the schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {activeDaySlots.map((slot) => {
                const isActive = slot.status === 'active';
                const isEditingPrice = editingSlotId === slot.id;
                const isEditingTime = editingTimeSlotId === slot.id;
                const isNightSlot = slot.periodType === 'night' || isMinuteInInterval(timeToMinutes(slot.startTime), nightStartTime, nightEndTime);

                return (
                  <div
                    key={slot.id}
                    className={`p-2 rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
                      !isActive
                        ? 'bg-slate-100/80 border-slate-200 text-slate-400 opacity-75'
                        : isNightSlot
                        ? 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-400 shadow-2xs'
                        : 'bg-amber-50/30 border-amber-200/80 hover:border-amber-400 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top Header Badge */}
                      <div className="flex items-center justify-between gap-0.5 mb-1.5">
                        <div className="flex items-center gap-0.5">
                          {isNightSlot ? (
                            <Moon className="w-3 h-3 text-indigo-600 fill-indigo-400" />
                          ) : (
                            <Sun className="w-3 h-3 text-amber-500 fill-amber-400" />
                          )}

                          <span
                            className={`text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded-sm leading-none ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isActive ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>

                      {/* Slot Time Range */}
                      {isEditingTime ? (
                        <div className="space-y-1 py-1">
                          <TimeInput
                            value={editStartTimeVal}
                            onChange={setEditStartTimeVal}
                            className="w-full px-1 py-0.5 text-[10px] border rounded bg-white font-mono font-bold"
                          />
                          <TimeInput
                            value={editEndTimeVal}
                            onChange={setEditEndTimeVal}
                            className="w-full px-1 py-0.5 text-[10px] border rounded bg-white font-mono font-bold"
                          />
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => handleSaveSlotTime(slot.id)} className="flex-1 py-0.5 bg-emerald-600 text-white rounded text-[8px] font-black">Save</button>
                            <button onClick={() => setEditingTimeSlotId(null)} className="flex-1 py-0.5 bg-slate-200 text-slate-700 rounded text-[8px] font-black">Esc</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                        <div className="font-black text-[10px] text-slate-900 font-mono leading-snug flex flex-col py-1">
                          <span>{format12Hour(slot.startTime).replace(' AM','a').replace(' PM','p')}</span>
                          <span className="text-slate-400 text-[8px] leading-none ml-1">to</span>
                          <span>{format12Hour(slot.endTime).replace(' AM','a').replace(' PM','p')}</span>
                        </div>
                        </div>
                      )}

                      {/* Slot Price */}
                      <div className="mt-1.5">
                        {isEditingPrice ? (
                          <div className="flex items-center gap-0.5">
                            <NumberInput
                              min={1}
                              step={50}
                              value={editPriceVal}
                              onChange={setEditPriceVal}
                              className="w-12 px-1 py-0.5 rounded border border-emerald-400 text-[10px] font-bold bg-white"
                              autoFocus
                            />
                            <button onClick={() => handleSaveSlotPrice(slot.id)} className="p-0.5 bg-emerald-600 text-white rounded"><Check className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-black font-sans leading-none ${isNightSlot ? 'text-indigo-900' : 'text-emerald-700'}`}>
                              ₹{slot.price}
                            </span>
                            <button onClick={() => { setEditingSlotId(slot.id); setEditPriceVal(slot.price); }} className="text-slate-400 hover:text-emerald-600">
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between text-slate-400">
                      <button onClick={() => handleToggleSlotStatus(slot.id)} className={`p-1 rounded hover:text-slate-700 ${isActive ? 'hover:bg-slate-200' : 'text-emerald-600 hover:bg-emerald-100'}`} title={isActive ? "Disable" : "Enable"}>
                        <ToggleLeft className={`w-3.5 h-3.5 ${isActive ? 'rotate-180 text-emerald-600' : ''}`} />
                      </button>
                      <button onClick={() => { setEditingTimeSlotId(slot.id); setEditStartTimeVal(slot.startTime); setEditEndTimeVal(slot.endTime); }} className="p-1 rounded hover:bg-slate-200 hover:text-slate-700" title="Edit Time">
                        <Clock className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDuplicateSlot(slot)} className="p-1 rounded hover:bg-slate-200 hover:text-slate-700" title="Duplicate">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="p-1 rounded hover:bg-red-100 hover:text-red-600" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          3. MODALS (CONFIRMATIONS, BREAKS, CUSTOM SLOTS)
         ══════════════════════════════════════════════════════ */}

      {/* REGENERATE CONFIRMATION MODAL */}
      {confirmRegenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-black text-base text-slate-900">Regenerate Schedule?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Regenerating slots will replace the current generated schedule for the selected days.
              Do you want to continue?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRegenerateOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeGeneration}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 shadow-sm"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION CONFIRMATION MODAL */}
      {confirmBulkAction.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Copy className="w-5 h-5" />
              </div>
              <h3 className="font-black text-base text-slate-900">{confirmBulkAction.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmBulkAction.description}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBulkAction((p) => ({ ...p, open: false }))}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkAction.onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 shadow-sm"
              >
                Continue &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD BREAK MODAL */}
      {showAddBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-500" />
                <h3 className="font-black text-sm text-slate-900">Add Break for {activeDay.dayName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBreakModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Break Start Time
                </label>
                <TimeInput
                  value={breakStart}
                  onChange={setBreakStart}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Break End Time
                </label>
                <TimeInput
                  value={breakEnd}
                  onChange={setBreakEnd}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                Reason / Note
              </label>
              <input
                type="text"
                value={breakReason}
                onChange={(e) => setBreakReason(e.target.value)}
                placeholder="e.g. Maintenance, Watering & Cleaning"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBreakModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBreak}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs"
              >
                Save Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOM SLOT MODAL */}
      {showAddCustomSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <h3 className="font-black text-sm text-slate-900">
                  + Custom Slot ({activeDay.dayName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomSlotModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Start Time
                </label>
                <TimeInput
                  value={csStartTime}
                  onChange={setCsStartTime}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  End Time
                </label>
                <TimeInput
                  value={csEndTime}
                  onChange={setCsEndTime}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Slot Price (₹)
                </label>
                <NumberInput
                  min={1}
                  step={50}
                  value={csPrice}
                  onChange={setCsPrice}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  value={csLabel}
                  onChange={(e) => setCsLabel(e.target.value)}
                  placeholder="e.g. Early Bird, Night Match"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCustomSlotModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomSlot}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-sm"
              >
                Add Custom Slot
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
