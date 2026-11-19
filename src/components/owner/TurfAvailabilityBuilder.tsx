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
  Eye,
  EyeOff,
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

// ─── Design Tokens: Day / Night Themes ───
const DAY_THEME = {
  bg: '#FDECEA',
  border: 'rgba(231,50,41,0.08)',
  accent: '#E73229',
  text: '#251B12',
  badgeBg: 'rgba(245,158,11,0.18)',
  badgeText: '#92400E',
  iconFill: '#E73229',
  muted: 'rgba(37,27,18,0.55)',
};
const NIGHT_THEME = {
  bg: '#F0EDFF',
  border: '#CFC7F7',
  accent: '#6554C0',
  text: '#282044',
  badgeBg: 'rgba(101,84,192,0.15)',
  badgeText: '#4C3C9E',
  iconFill: '#6554C0',
  muted: 'rgba(40,32,68,0.50)',
};

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
  activeScheduleId,
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

  // ─── 3. Payment Options State ───
  const [globalPaymentType, setGlobalPaymentType] = useState<'FULL' | 'ADVANCE' | 'BOTH'>('BOTH');
  const [globalAdvanceAmount, setGlobalAdvanceAmount] = useState<number>(400);

  // ─── 3. Generation Range & Days Selection ───
  const [generationRange, setGenerationRange] = useState<'days' | 'week'>('week');
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

  const [editingPaymentSlotId, setEditingPaymentSlotId] = useState<string | null>(null);
  const [editPaymentTypeVal, setEditPaymentTypeVal] = useState<'FULL' | 'ADVANCE' | 'BOTH'>('BOTH');
  const [editAdvanceAmountVal, setEditAdvanceAmountVal] = useState<number>(400);

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
      generationRange === 'week'
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

      const generatedWithPayment = generated.map(s => ({
        ...s,
        paymentType: globalPaymentType,
        advanceAmount: globalPaymentType === 'FULL' ? 0 : globalAdvanceAmount,
      }));

      return {
        ...d,
        isOpen: true,
        openTime: dayStartTime,
        closeTime: nightEndTime,
        slotDurationMinutes: activeDurationMinutes,
        defaultPrice: dayPrice,
        allowPartialSlot: false,
        timePricingPeriods,
        slots: generatedWithPayment,
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

  const handleSaveSlotPayment = (slotId: string) => {
    const newDays = days.map((d) => {
      if (d.dayOfWeek !== activeDayView) return d;
      const updatedSlots = (d.slots || []).map((s) => {
        if (s.id === slotId) {
          return { 
            ...s, 
            paymentType: editPaymentTypeVal, 
            advanceAmount: editPaymentTypeVal === 'FULL' ? 0 : editAdvanceAmountVal,
            isCustomized: true,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      return { ...d, slots: updatedSlots };
    });
    updateDays(newDays);
    setEditingPaymentSlotId(null);
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
    <div className="space-y-5">
      {/* ── MULTI-TURF SELECTOR ── */}
      {activeTurfList.length > 1 && (
        <div
          className="p-3 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 min-w-0"
          style={{ background: '#FDECEA', border: '1px solid rgba(231,50,41,0.08)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 shrink-0" style={{ color: '#E73229' }} />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#92400E' }}>
                Configuring Turf Schedule
              </p>
              <p className="text-[11px] truncate" style={{ color: 'rgba(37,27,18,0.65)' }}>
                Each turf ground maintains its own independent schedule &amp; pricing.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeTurfList.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTurfId(t.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={
                  selectedTurfId === t.id
                    ? { background: '#E73229', color: '#FFFFFF', border: '1.5px solid #E73229' }
                    : { background: '#FFFFFF', border: '1.5px solid rgba(231,50,41,0.08)', color: 'rgba(37,27,18,0.65)' }
                }
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          1. PRICING & SLOT SETTINGS (CLEAN DAY + NIGHT UI)
         ══════════════════════════════════════════════════════ */}
      <div
        className="rounded-2xl shadow-sm p-3 sm:p-4 space-y-3"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(10,10,10,0.08)',
          boxShadow: '0 2px 12px rgba(10,10,10,0.06)',
        }}
      >
        {/* Section header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="p-1.5 rounded-lg"
              style={{ background: 'rgba(231,50,41,0.08)', color: '#E73229' }}
            >
              <DollarSign className="w-3.5 h-3.5" />
            </span>
            <h3 className="font-bold text-[15px]" style={{ color: '#0A0A0A' }}>
              PRICING &amp; SLOT SETTINGS
            </h3>
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(10,10,10,0.60)' }}>
            Configure Day and Night pricing. QGo automatically assigns prices to each slot based on start time.
          </p>
        </div>

        {/* ── DAY & NIGHT PRICING CARDS ── */}
        <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 min-w-0">

          {/* DAYTIME PRICING CARD */}
          <div
            className="p-2.5 rounded-xl flex flex-col gap-2 relative overflow-hidden min-w-0"
            style={{
              background: DAY_THEME.bg,
              border: `1.5px solid ${DAY_THEME.border}`,
              boxShadow: '0 1px 6px rgba(245,158,11,0.10)',
            }}
          >
            <div className="flex items-center justify-between gap-1 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <Sun className="w-3.5 h-3.5 shrink-0" style={{ color: DAY_THEME.accent, fill: DAY_THEME.iconFill }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: DAY_THEME.accent }}>DAY</span>
              </div>
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink truncate"
                style={{ background: DAY_THEME.badgeBg, color: DAY_THEME.badgeText }}
              >DAYTIME</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 min-w-0">
              <div
                className="flex flex-col items-center py-1 px-1 rounded-lg min-w-0"
                style={{ background: '#FFFFFF', border: `1px solid ${DAY_THEME.border}` }}
              >
                <span className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: DAY_THEME.muted }}>START</span>
                <TimeInput
                  value={dayStartTime}
                  onChange={setDayStartTime}
                  className="text-[12px] font-bold bg-transparent text-center outline-none w-full p-0"
                  style={{ color: DAY_THEME.text }}
                />
              </div>
              <div
                className="flex flex-col items-center py-1 px-1 rounded-lg min-w-0"
                style={{ background: '#FFFFFF', border: `1px solid ${DAY_THEME.border}` }}
              >
                <span className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: DAY_THEME.muted }}>END</span>
                <TimeInput
                  value={dayEndTime}
                  onChange={setDayEndTime}
                  className="text-[12px] font-bold bg-transparent text-center outline-none w-full p-0"
                  style={{ color: DAY_THEME.text }}
                />
              </div>
            </div>
            <div
              className="flex items-center justify-between px-2 py-1.5 rounded-lg min-w-0 gap-2"
              style={{ background: '#FFFFFF', border: `1px solid ${DAY_THEME.border}` }}
            >
              <span className="text-[10px] font-semibold uppercase shrink-0" style={{ color: DAY_THEME.muted }}>PRICE</span>
              <div className="flex items-center justify-end min-w-0 flex-1 gap-0.5">
                <span className="text-[12px] font-bold shrink-0" style={{ color: DAY_THEME.accent }}>&#8377;</span>
                <NumberInput
                  min={1}
                  step={50}
                  value={dayPrice}
                  onChange={(val) => setDayPrice(Math.max(1, val))}
                  className="text-[12px] font-bold bg-transparent text-right outline-none w-16 p-0 border-none"
                  style={{ color: DAY_THEME.accent }}
                />
              </div>
            </div>
          </div>

          {/* OVERNIGHT PRICING CARD */}
          <div
            className="p-2.5 rounded-xl flex flex-col gap-2 relative overflow-hidden min-w-0"
            style={{
              background: NIGHT_THEME.bg,
              border: `1.5px solid ${NIGHT_THEME.border}`,
              boxShadow: '0 1px 6px rgba(101,84,192,0.10)',
            }}
          >
            <div className="flex items-center justify-between gap-1 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <Moon className="w-3.5 h-3.5 shrink-0" style={{ color: NIGHT_THEME.accent, fill: NIGHT_THEME.iconFill }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NIGHT_THEME.accent }}>NIGHT</span>
              </div>
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink truncate"
                style={{ background: NIGHT_THEME.badgeBg, color: NIGHT_THEME.badgeText }}
              >OVERNIGHT</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 min-w-0">
              <div
                className="flex flex-col items-center py-1 px-1 rounded-lg min-w-0"
                style={{ background: '#FFFFFF', border: `1px solid ${NIGHT_THEME.border}` }}
              >
                <span className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: NIGHT_THEME.muted }}>START</span>
                <TimeInput
                  value={nightStartTime}
                  onChange={setNightStartTime}
                  className="text-[12px] font-bold bg-transparent text-center outline-none w-full p-0"
                  style={{ color: NIGHT_THEME.text }}
                />
              </div>
              <div
                className="flex flex-col items-center py-1 px-1 rounded-lg min-w-0"
                style={{ background: '#FFFFFF', border: `1px solid ${NIGHT_THEME.border}` }}
              >
                <span className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: NIGHT_THEME.muted }}>END</span>
                <TimeInput
                  value={nightEndTime}
                  onChange={setNightEndTime}
                  className="text-[12px] font-bold bg-transparent text-center outline-none w-full p-0"
                  style={{ color: NIGHT_THEME.text }}
                />
              </div>
            </div>
            <div
              className="flex items-center justify-between px-2 py-1.5 rounded-lg min-w-0 gap-2"
              style={{ background: '#FFFFFF', border: `1px solid ${NIGHT_THEME.border}` }}
            >
              <span className="text-[10px] font-semibold uppercase shrink-0" style={{ color: NIGHT_THEME.muted }}>PRICE</span>
              <div className="flex items-center justify-end min-w-0 flex-1 gap-0.5">
                <span className="text-[12px] font-bold shrink-0" style={{ color: NIGHT_THEME.accent }}>&#8377;</span>
                <NumberInput
                  min={1}
                  step={50}
                  value={nightPrice}
                  onChange={(val) => setNightPrice(Math.max(1, val))}
                  className="text-[12px] font-bold bg-transparent text-right outline-none w-16 p-0 border-none"
                  style={{ color: NIGHT_THEME.accent }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── SLOT DURATION ── */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(10,10,10,0.60)' }}>
            SLOT DURATION
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((dp) => {
              const isSelected = durationPreset === dp.value;
              return (
                <button
                  key={dp.label}
                  type="button"
                  onClick={() => setDurationPreset(dp.value)}
                  className="px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors duration-150"
                  style={
                    isSelected
                      ? { background: '#E73229', color: '#FFFFFF', border: '1.5px solid #E73229', boxShadow: '0 1px 4px rgba(231,50,41,0.10)' }
                      : { background: '#FFFFFF', border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)' }
                  }
                >
                  {dp.label}
                </button>
              );
            })}
          </div>

          {durationPreset === -1 && (
            <div
              className="mt-2.5 p-3 rounded-xl flex items-center justify-between gap-3 min-w-0"
              style={{ background: '#FFFFFF', border: '1.5px solid rgba(10,10,10,0.08)' }}
            >
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(10,10,10,0.60)' }}>
                Custom Duration
              </label>
              <DurationInput
                value={customDurationMinutes}
                onChange={(val) => setCustomDurationMinutes(Math.max(15, val))}
                className="px-3 py-1.5 rounded-xl border border-[rgba(10,10,10,0.08)] text-xs font-semibold bg-[#FFFFFF]"
                style={{ color: '#E73229' }}
              />
            </div>
          )}
        </div>

        {/* ── PAYMENT OPTIONS ── */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(10,10,10,0.60)' }}>
            PAYMENT OPTIONS
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 w-full">
            {(
              [
                { value: 'FULL' as const, label: 'Full Payment Only' },
                { value: 'ADVANCE' as const, label: 'Advance Only' },
                { value: 'BOTH' as const, label: 'Allow Both' },
              ]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setGlobalPaymentType(value)}
                className="w-full py-2 px-2.5 rounded-xl border text-[13px] font-semibold text-center transition-colors duration-150"
                style={
                  globalPaymentType === value
                    ? { background: '#E73229', color: '#FFFFFF', border: '1.5px solid #E73229' }
                    : { background: '#FFFFFF', border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {(globalPaymentType === 'ADVANCE' || globalPaymentType === 'BOTH') && (
            <div
              className="mt-2.5 p-3 rounded-xl flex items-center justify-between gap-2 min-w-0"
              style={{ background: 'rgba(231,50,41,0.06)', border: '1.5px solid rgba(231,50,41,0.10)' }}
            >
              <label className="text-[12px] font-bold uppercase tracking-wide whitespace-nowrap min-w-0" style={{ color: '#E73229' }}>
                ADVANCE AMOUNT (&#8377;)
              </label>
              <div className="flex items-center gap-1 shrink-0 w-28 px-2.5 py-1.5 rounded-xl border bg-white" style={{ borderColor: 'rgba(10,10,10,0.12)' }}>
                <span className="text-xs font-bold text-[#E73229]">&#8377;</span>
                <NumberInput
                  min={0}
                  step={50}
                  value={globalAdvanceAmount}
                  onChange={setGlobalAdvanceAmount}
                  className="w-full text-xs font-bold text-right bg-transparent outline-none p-0 border-none"
                  style={{ color: '#E73229' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── GENERATION RANGE (2 Options: Selected Days & Entire Week) ── */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(10,10,10,0.60)' }}>
            GENERATION RANGE
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGenerationRange('days')}
              className="py-2 px-3 rounded-xl border text-[13px] font-semibold text-center transition-colors duration-150"
              style={
                generationRange === 'days'
                  ? { background: '#E73229', color: '#FFFFFF', border: '1.5px solid #E73229' }
                  : { background: '#FFFFFF', border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)' }
              }
            >
              Selected Days ({selectedDays.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setGenerationRange('week');
                setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
              }}
              className="py-2 px-3 rounded-xl border text-[13px] font-semibold text-center transition-colors duration-150"
              style={
                generationRange === 'week'
                  ? { background: '#E73229', color: '#FFFFFF', border: '1.5px solid #E73229' }
                  : { background: '#FFFFFF', border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)' }
              }
            >
              Entire Week (7 Days)
            </button>
          </div>
        </div>

        {/* ── SELECT DAYS ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(10,10,10,0.60)' }}>
              SELECT DAYS
            </label>
            <button
              type="button"
              onClick={handleSelectEntireWeek}
              className="text-[11px] font-bold underline"
              style={{ color: '#E73229' }}
            >
              Select All
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAY_SHORT.map((shortName, idx) => {
              const isSelected = selectedDays.includes(idx);
              return (
                <button
                  key={shortName}
                  type="button"
                  onClick={() => toggleDaySelection(idx)}
                  className="py-2 rounded-xl border text-center font-bold text-[10px] transition-colors duration-150"
                  style={
                    isSelected
                      ? {
                          background: '#E73229',
                          color: '#FFFFFF',
                          border: '1.5px solid #E73229',
                          boxShadow: '0 1px 4px rgba(231,50,41,0.10)',
                        }
                      : {
                          background: '#FFFFFF',
                          border: '1.5px solid rgba(10,10,10,0.08)',
                          color: 'rgba(10,10,10,0.55)',
                        }
                  }
                >
                  {shortName}
                </button>
              );
            })}
          </div>
        </div>

        {validationError && (
          <div
            className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2"
            style={{
              background: 'rgba(232,65,54,0.08)',
              border: '1.5px solid rgba(232,65,54,0.20)',
              color: '#E84136',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ── GENERATE SLOTS BUTTON (Centered 13px/600, 12px padding, no AI icons) ── */}
        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={Boolean(validationError)}
          className="w-full p-3 rounded-xl font-semibold text-[13px] uppercase tracking-wide flex items-center justify-center text-center transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: validationError ? 'rgba(231,50,41,0.12)' : 'linear-gradient(180deg,#F0554A 0%,#E73229 50%,#D42B22 100%)',
            color: validationError ? '#C9281F' : '#FFFFFF',
            boxShadow: validationError ? 'none' : '0 2px 10px rgba(231,50,41,0.28)',
          }}
        >
          <span className="text-center">
            GENERATE SLOTS &mdash; {generationRange === 'week' ? 'ENTIRE WEEK (7 DAYS)' : `${selectedDays.length} DAYS`}
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          2. SCHEDULE & GENERATED SLOTS PREVIEW
         ══════════════════════════════════════════════════════ */}
      <div
        className="rounded-2xl shadow-sm p-3 sm:p-4 space-y-3"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(10,10,10,0.08)',
          boxShadow: '0 2px 12px rgba(10,10,10,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5" style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
          <div className="min-w-0">
            <h3 className="font-bold text-[15px]" style={{ color: '#0A0A0A' }}>
              SCHEDULE &amp; GENERATED SLOTS
            </h3>
            <p className="text-[11px] text-[rgba(10,10,10,0.55)] mt-0.5 truncate">
              Day slots and Night slots with assigned pricing.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 shrink-0 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => setShowAddBreakModal(true)}
              className="h-9 px-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 min-w-[105px]"
              style={{ background: '#F5F5F7', border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.70)' }}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Add Break</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddCustomSlotModal(true)}
              className="h-9 px-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 min-w-[105px]"
              style={{ background: '#F5F5F7', border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.70)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom Slot</span>
            </button>
          </div>
        </div>

        {/* Day Tabs: 7 equal circles (weekday 10px + date 11px), selected with red ring */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isTabActive = activeDayView === d.dayOfWeek;
            const activeSlotsCount = (d.slots || []).filter((s) => s.status === 'active').length;
            return (
              <button
                key={d.dayOfWeek}
                type="button"
                onClick={() => setActiveDayView(d.dayOfWeek)}
                className="w-10 h-10 mx-auto rounded-full flex flex-col items-center justify-center transition-all duration-150 cursor-pointer"
                style={
                  isTabActive
                    ? {
                        background: '#FFFFFF',
                        color: '#0A0A0A',
                        boxShadow: '0 2px 8px rgba(231,50,41,0.15)',
                        outline: '2px solid #E73229',
                        outlineOffset: '2px',
                      }
                    : d.isOpen
                    ? {
                        background: '#FFFFFF',
                        border: '1.5px solid rgba(10,10,10,0.08)',
                        color: '#0A0A0A',
                      }
                    : {
                        background: '#F5F5F7',
                        border: '1.5px solid rgba(10,10,10,0.08)',
                        color: 'rgba(10,10,10,0.45)',
                      }
                }
              >
                <span className="block text-[10px] font-bold tracking-wider uppercase leading-none mb-0.5">
                  {DAY_SHORT[d.dayOfWeek]}
                </span>
                <span
                  className="inline-block text-[11px] font-bold leading-none"
                  style={
                    !d.isOpen
                      ? { color: 'rgba(10,10,10,0.40)' }
                      : isTabActive
                      ? { color: '#E73229' }
                      : { color: 'rgba(10,10,10,0.65)' }
                  }
                >
                  {d.isOpen ? `${activeSlotsCount}` : 'Off'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Closed Day Alert */}
        {!activeDay.isOpen && (
          <div
            className="p-3 rounded-xl text-xs flex items-start gap-2"
            style={{
              background: 'rgba(231,50,41,0.06)',
              border: '1.5px solid rgba(231,50,41,0.10)',
              color: '#A85200',
            }}
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#E73229' }} />
            <div>
              <p className="font-bold">{activeDay.dayName} is currently marked as CLOSED.</p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'rgba(168,82,0,0.75)' }}>
                All slots on this day are disabled and will not be displayed or bookable by customers.
              </p>
            </div>
          </div>
        )}

        {/* Breaks List */}
        {(activeDay.breaks || []).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(10,10,10,0.55)' }}>
              Scheduled Breaks ({activeDay.breaks?.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {activeDay.breaks?.map((brk, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl flex items-center justify-between text-xs"
                  style={{ background: '#FDECEA', border: '1px solid rgba(231,50,41,0.08)' }}
                >
                  <div className="flex items-center gap-2">
                    <Coffee className="w-3.5 h-3.5 shrink-0" style={{ color: '#E73229' }} />
                    <div>
                      <p className="font-bold text-[11px]" style={{ color: '#251B12' }}>
                        {format12Hour(brk.startTime)} &ndash; {format12Hour(brk.endTime)}
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(37,27,18,0.55)' }}>
                        {brk.reason || 'Break / Maintenance'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteBreak(idx)}
                    className="p-1 rounded-lg transition-colors duration-150"
                    title="Delete break"
                    style={{ color: 'rgba(37,27,18,0.40)' }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Generated Slots Grid ── */}
        <div>
          {/* Slot count + legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(10,10,10,0.55)' }}>
              GENERATED SLOTS&nbsp;
              <span style={{ color: '#0A0A0A' }}>
                ({activeDaySlots.length} total &middot; {activeDaySlots.filter((s) => s.status === 'active').length} active)
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: DAY_THEME.bg, border: `1px solid ${DAY_THEME.border}`, color: DAY_THEME.text }}
              >
                <Sun className="w-3 h-3 shrink-0" style={{ color: DAY_THEME.accent, fill: DAY_THEME.iconFill }} />
                <span>DAY &mdash; &#8377;{dayPrice}</span>
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: NIGHT_THEME.bg, border: `1px solid ${NIGHT_THEME.border}`, color: NIGHT_THEME.text }}
              >
                <Moon className="w-3 h-3 shrink-0" style={{ color: NIGHT_THEME.accent, fill: NIGHT_THEME.iconFill }} />
                <span>NIGHT &mdash; &#8377;{nightPrice}</span>
              </span>
            </div>
          </div>

          {activeDaySlots.length === 0 ? (
            <div
              className="py-10 text-center rounded-2xl border-2 border-dashed"
              style={{ borderColor: 'rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.40)' }}
            >
              <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">No slots generated for {activeDay.dayName} yet.</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(10,10,10,0.40)' }}>
                Click &ldquo;GENERATE SLOTS&rdquo; above to create the schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[300px]:grid-cols-2 gap-2">
              {activeDaySlots.map((slot) => {
                const isActive = slot.status === 'active';
                const isEditingPrice = editingSlotId === slot.id;
                const isEditingTime = editingTimeSlotId === slot.id;
                const isNightSlot =
                  slot.periodType === 'night' ||
                  isMinuteInInterval(timeToMinutes(slot.startTime), nightStartTime, nightEndTime);
                const theme = isNightSlot ? NIGHT_THEME : DAY_THEME;

                return (
                  <div
                    key={slot.id}
                    className="rounded-[14px] min-w-0 p-2.5 flex flex-col justify-between overflow-hidden transition-colors duration-150 relative"
                    style={
                      !isActive
                        ? {
                            background: 'rgba(10,10,10,0.04)',
                            border: '1.5px solid rgba(10,10,10,0.08)',
                            opacity: 0.70,
                          }
                        : {
                            background: theme.bg,
                            border: `1.5px solid ${theme.border}`,
                            boxShadow: isNightSlot
                              ? '0 1px 6px rgba(101,84,192,0.10)'
                              : '0 1px 6px rgba(245,158,11,0.10)',
                          }
                    }
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">

                      {/* TOP ROW: DAY/NIGHT badge + ON/OFF chip on one row (10px) */}
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          {isNightSlot ? (
                            <Moon className="w-3 h-3 shrink-0" style={{ color: theme.accent, fill: theme.iconFill }} />
                          ) : (
                            <Sun className="w-3 h-3 shrink-0" style={{ color: theme.accent, fill: theme.iconFill }} />
                          )}
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink truncate"
                            style={{ background: theme.badgeBg, color: theme.badgeText }}
                          >
                            {isNightSlot ? 'NIGHT' : 'DAY'}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0"
                          style={
                            isActive
                              ? { background: 'rgba(22,132,91,0.14)', color: '#16845B' }
                              : { background: 'rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.50)' }
                          }
                        >
                          {isActive ? 'ON' : 'OFF'}
                        </span>
                      </div>

                      {/* TIME: 11px tabular-nums (wrap to 2 lines if needed) */}
                      {isEditingTime ? (
                        <div className="space-y-1 my-1">
                          <TimeInput
                            value={editStartTimeVal}
                            onChange={setEditStartTimeVal}
                            className="w-full px-1 py-0.5 text-[11px] border rounded-lg bg-white font-mono font-bold"
                            style={{ borderColor: theme.border, color: theme.text }}
                          />
                          <TimeInput
                            value={editEndTimeVal}
                            onChange={setEditEndTimeVal}
                            className="w-full px-1 py-0.5 text-[11px] border rounded-lg bg-white font-mono font-bold"
                            style={{ borderColor: theme.border, color: theme.text }}
                          />
                          <div className="flex gap-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => handleSaveSlotTime(slot.id)}
                              className="flex-1 py-0.5 rounded-lg text-[10px] font-bold"
                              style={{ background: theme.accent, color: isNightSlot ? '#FFFFFF' : '#0A0A0A' }}
                            >Save</button>
                            <button
                              type="button"
                              onClick={() => setEditingTimeSlotId(null)}
                              className="flex-1 py-0.5 rounded-lg text-[10px] font-bold bg-white"
                              style={{ color: 'rgba(10,10,10,0.55)', border: `1px solid ${theme.border}` }}
                            >Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="text-[11px] font-bold font-mono tabular-nums leading-snug my-0.5 break-words"
                          style={{ color: isActive ? theme.text : 'rgba(10,10,10,0.50)' }}
                        >
                          {format12Hour(slot.startTime)} &ndash; {format12Hour(slot.endTime)}
                        </div>
                      )}

                      {/* PRICE: ₹ 15px bold */}
                      <div>
                        {isEditingPrice ? (
                          <div className="flex items-center gap-0.5">
                            <span className="text-[11px] font-bold" style={{ color: theme.accent }}>&#8377;</span>
                            <NumberInput
                              min={1}
                              step={50}
                              value={editPriceVal}
                              onChange={setEditPriceVal}
                              className="w-14 px-1 py-0.5 rounded-lg border text-[11px] font-bold bg-white"
                              style={{ borderColor: theme.accent, color: theme.text }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSlotPrice(slot.id)}
                              className="p-0.5 rounded-lg"
                              style={{ background: theme.accent, color: isNightSlot ? '#FFFFFF' : '#0A0A0A' }}
                            ><Check className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between min-w-0">
                            <span
                              className="text-[15px] font-bold leading-none shrink-0"
                              style={{ color: isActive ? theme.accent : 'rgba(10,10,10,0.40)' }}
                            >
                              &#8377;{slot.price}
                            </span>
                            <button
                              type="button"
                              onClick={() => { setEditingSlotId(slot.id); setEditPriceVal(slot.price); }}
                              className="p-0.5 rounded-md transition-colors duration-150 hover:bg-black/5"
                              title="Edit price"
                              style={{ color: 'rgba(10,10,10,0.40)' }}
                            ><Pencil className="w-2.5 h-2.5" /></button>
                          </div>
                        )}
                      </div>

                      {/* PAYMENT INFO: 'Adv or Full' / 'Adv: ₹x' 11px */}
                      <div
                        className="pt-1 my-0.5"
                        style={{ borderTop: `1px solid ${isActive ? theme.border : 'rgba(10,10,10,0.08)'}` }}
                      >
                        {editingPaymentSlotId === slot.id ? (
                          <div className="space-y-1 bg-white p-1 rounded-lg" style={{ border: `1px solid ${theme.border}` }}>
                            <select
                              value={editPaymentTypeVal}
                              onChange={(e) => setEditPaymentTypeVal(e.target.value as any)}
                              className="w-full text-[10px] px-1 py-0.5 rounded-lg bg-white"
                              style={{ border: `1px solid ${theme.border}`, color: theme.text }}
                            >
                              <option value="FULL">Full Payment</option>
                              <option value="ADVANCE">Advance Only</option>
                              <option value="BOTH">Allow Both</option>
                            </select>
                            {(editPaymentTypeVal === 'ADVANCE' || editPaymentTypeVal === 'BOTH') && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(10,10,10,0.55)' }}>Adv:</span>
                                <NumberInput
                                  min={0}
                                  step={50}
                                  value={editAdvanceAmountVal}
                                  onChange={setEditAdvanceAmountVal}
                                  className="flex-1 px-1 py-0.5 rounded-lg text-[10px] bg-white"
                                  style={{ border: `1px solid ${theme.border}` }}
                                />
                              </div>
                            )}
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveSlotPayment(slot.id)}
                                className="flex-1 py-0.5 rounded-lg text-[10px] font-bold"
                                style={{ background: theme.accent, color: isNightSlot ? '#FFFFFF' : '#0A0A0A' }}
                              >Save</button>
                              <button
                                type="button"
                                onClick={() => setEditingPaymentSlotId(null)}
                                className="flex-1 py-0.5 rounded-lg text-[10px] font-bold bg-white"
                                style={{ color: 'rgba(10,10,10,0.55)', border: `1px solid ${theme.border}` }}
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span
                                className="text-[11px] font-semibold leading-tight truncate"
                                style={{ color: isActive ? theme.muted : 'rgba(10,10,10,0.40)' }}
                              >
                                {slot.paymentType === 'FULL'
                                  ? 'Full Payment'
                                  : slot.paymentType === 'ADVANCE'
                                  ? 'Advance Only'
                                  : 'Adv or Full'}
                              </span>
                              {slot.paymentType !== 'FULL' && (
                                <span
                                  className="text-[11px] font-bold leading-tight"
                                  style={{ color: isActive ? theme.accent : 'rgba(10,10,10,0.35)' }}
                                >
                                  Adv: &#8377;{slot.advanceAmount || 0}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPaymentSlotId(slot.id);
                                setEditPaymentTypeVal(slot.paymentType || 'BOTH');
                                setEditAdvanceAmountVal(slot.advanceAmount || 400);
                              }}
                              className="p-0.5 rounded-md transition-colors duration-150 hover:bg-black/5 shrink-0"
                              title="Edit payment"
                              style={{ color: 'rgba(10,10,10,0.40)' }}
                            ><Pencil className="w-2.5 h-2.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ACTION ROW: 4 equal 32px icon buttons (eye, clock, copy, delete) */}
                    <div
                      className="grid grid-cols-4 gap-1 pt-1.5 mt-auto"
                      style={{
                        borderTop: `1px solid ${isActive ? theme.border : 'rgba(10,10,10,0.08)'}`,
                        background: isActive ? 'rgba(255,255,255,0.40)' : 'rgba(10,10,10,0.02)',
                        borderRadius: '0 0 12px 12px',
                        margin: '-2.5px -2.5px -2.5px -2.5px',
                        padding: '4px 2px 2px 2px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSlotStatus(slot.id)}
                        className="w-8 h-8 mx-auto flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                        title={isActive ? 'Disable slot' : 'Enable slot'}
                        style={{ color: isActive ? theme.accent : 'rgba(10,10,10,0.40)' }}
                      >
                        {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTimeSlotId(slot.id);
                          setEditStartTimeVal(slot.startTime);
                          setEditEndTimeVal(slot.endTime);
                        }}
                        className="w-8 h-8 mx-auto flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                        title="Edit time"
                        style={{ color: 'rgba(10,10,10,0.55)' }}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateSlot(slot)}
                        className="w-8 h-8 mx-auto flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                        title="Duplicate slot"
                        style={{ color: 'rgba(10,10,10,0.55)' }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="w-8 h-8 mx-auto flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                        title="Delete slot"
                        style={{ color: 'rgba(10,10,10,0.55)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          3. MODALS (CONFIRMATIONS, BREAKS, CUSTOM SLOTS)
         ══════════════════════════════════════════════════════ */}

      {/* REGENERATE CONFIRMATION MODAL */}
      {confirmRegenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.40)',   }}>
          <div
            className="rounded-2xl p-5 max-w-md w-full space-y-4"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', boxShadow: '0 20px 60px rgba(10,10,10,0.20)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(231,50,41,0.08)' }}>
                <AlertCircle className="w-4 h-4" style={{ color: '#E73229' }} />
              </div>
              <h3 className="font-bold text-sm" style={{ color: '#0A0A0A' }}>Regenerate Schedule?</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(10,10,10,0.65)' }}>
              Regenerating slots will replace the current generated schedule for the selected days. Do you want to continue?
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmRegenerateOpen(false)}
                className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors duration-150"
                style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)', background: '#F5F5F7' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeGeneration}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ background: '#E73229', color: '#FFFFFF' }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION CONFIRMATION MODAL */}
      {confirmBulkAction.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.40)' }}>
          <div
            className="rounded-2xl p-5 max-w-md w-full space-y-4"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', boxShadow: '0 20px 60px rgba(10,10,10,0.20)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(231,50,41,0.08)' }}>
                <Copy className="w-4 h-4" style={{ color: '#E73229' }} />
              </div>
              <h3 className="font-bold text-sm" style={{ color: '#0A0A0A' }}>{confirmBulkAction.title}</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(10,10,10,0.65)' }}>
              {confirmBulkAction.description}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmBulkAction((p) => ({ ...p, open: false }))}
                className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors duration-150"
                style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)', background: '#F5F5F7' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkAction.onConfirm}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ background: '#E73229', color: '#FFFFFF' }}
              >
                Continue &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD BREAK MODAL */}
      {showAddBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.40)' }}>
          <div
            className="rounded-2xl p-5 max-w-md w-full space-y-4"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', boxShadow: '0 20px 60px rgba(10,10,10,0.20)' }}
          >
            <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4" style={{ color: '#E73229' }} />
                <h3 className="font-bold text-sm" style={{ color: '#0A0A0A' }}>Add Break &mdash; {activeDay.dayName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBreakModal(false)}
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{ color: 'rgba(10,10,10,0.50)', background: '#F5F5F7' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                  START TIME
                </label>
                <TimeInput
                  value={breakStart}
                  onChange={setBreakStart}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-white"
                  style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: '#0A0A0A' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                  END TIME
                </label>
                <TimeInput
                  value={breakEnd}
                  onChange={setBreakEnd}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-white"
                  style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: '#0A0A0A' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                REASON / NOTE
              </label>
              <input
                type="text"
                value={breakReason}
                onChange={(e) => setBreakReason(e.target.value)}
                placeholder="e.g. Maintenance, Watering & Cleaning"
                className="w-full px-3 py-2 rounded-xl text-xs"
                style={{ border: '1.5px solid rgba(10,10,10,0.08)', background: '#F5F5F7', color: '#0A0A0A' }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddBreakModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)', background: '#F5F5F7' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBreak}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ background: '#E73229', color: '#FFFFFF' }}
              >
                Save Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOM SLOT MODAL */}
      {showAddCustomSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,0.40)' }}>
          <div
            className="rounded-2xl p-5 max-w-md w-full space-y-4"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.08)', boxShadow: '0 20px 60px rgba(10,10,10,0.20)' }}
          >
            <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid rgba(10,10,10,0.08)' }}>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: '#E73229' }} />
                <h3 className="font-bold text-sm" style={{ color: '#0A0A0A' }}>
                  Add Custom Slot &mdash; {activeDay.dayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomSlotModal(false)}
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{ color: 'rgba(10,10,10,0.50)', background: '#F5F5F7' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                  START TIME
                </label>
                <TimeInput
                  value={csStartTime}
                  onChange={setCsStartTime}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-white"
                  style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: '#0A0A0A' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                  END TIME
                </label>
                <TimeInput
                  value={csEndTime}
                  onChange={setCsEndTime}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-white"
                  style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: '#0A0A0A' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                  SLOT PRICE (&#8377;)
                </label>
                <NumberInput
                  min={1}
                  step={50}
                  value={csPrice}
                  onChange={setCsPrice}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-bold bg-white"
                  style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: '#0A0A0A' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'rgba(10,10,10,0.55)' }}>
                  LABEL (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={csLabel}
                  onChange={(e) => setCsLabel(e.target.value)}
                  placeholder="e.g. Early Bird"
                  className="w-full px-3 py-2 rounded-xl text-xs"
                  style={{ border: '1.5px solid rgba(10,10,10,0.08)', background: '#F5F5F7', color: '#0A0A0A' }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddCustomSlotModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ border: '1.5px solid rgba(10,10,10,0.08)', color: 'rgba(10,10,10,0.65)', background: '#F5F5F7' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomSlot}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ background: '#E73229', color: '#FFFFFF' }}
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
