import React, { useState } from 'react';
import { SalonHours, SalonHoliday } from '../../types';
import { Clock, Plus, X, ToggleLeft, ToggleRight, CalendarDays } from 'lucide-react';
import { TimeInput } from '../common/TimeInput';
import { getBusinessTodayStr } from '../../utils/timeFormat';

interface WorkingHoursEditorProps {
  workingHours: SalonHours[];
  holidays: SalonHoliday[];
  onChange: (hours: SalonHours[], holidays: SalonHoliday[]) => void;
  compact?: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_HOURS: SalonHours[] = DAY_FULL.map((dayName, i) => ({
  dayOfWeek: i,
  dayName,
  openTime: '09:00',
  closeTime: '21:00',
  isOpen: i !== 0,
}));

function fmt12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${String(hr).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  // Convert YYYY-MM-DD to DD MMM YYYY
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const WorkingHoursEditor: React.FC<WorkingHoursEditorProps> = ({
  workingHours,
  holidays,
  onChange,
  compact = false,
}) => {
  const hours = workingHours.length === 7 ? workingHours : DEFAULT_HOURS;

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayEndDate, setNewHolidayEndDate] = useState('');
  const [newHolidayReason, setNewHolidayReason] = useState('');
  const [isLeaveMode, setIsLeaveMode] = useState(false);

  const todayStr = getBusinessTodayStr();

  // Auto-filter: remove holidays whose end date is in the past
  const activeHolidays = holidays.filter((h) => {
    const endDate = h.endDate || h.date;
    return endDate >= todayStr;
  });

  // Auto-sync: purge expired holidays from parent
  React.useEffect(() => {
    if (activeHolidays.length !== holidays.length) {
      onChange(hours, activeHolidays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDay = (dayIndex: number, updates: Partial<SalonHours>) => {
    const updated = hours.map((h) =>
      h.dayOfWeek === dayIndex ? { ...h, ...updates } : h
    );
    onChange(updated, holidays);
  };

  const applyToAllWeekdays = () => {
    const mon = hours.find((h) => h.dayOfWeek === 1);
    if (!mon) return;
    const updated = hours.map((h) =>
      h.dayOfWeek >= 1 && h.dayOfWeek <= 5
        ? { ...h, openTime: mon.openTime, closeTime: mon.closeTime, isOpen: mon.isOpen }
        : h
    );
    onChange(updated, holidays);
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    if (isLeaveMode && !newHolidayEndDate) return;
    const endDate = isLeaveMode && newHolidayEndDate ? newHolidayEndDate : newHolidayDate;
    const label = isLeaveMode ? (newHolidayReason || 'Leave') : (newHolidayReason || 'Closed');
    // Avoid duplicate dates
    const alreadyExists = holidays.some((h) => h.date === newHolidayDate);
    if (alreadyExists) return;
    const updated = [...holidays, { date: newHolidayDate, endDate, reason: label }];
    onChange(hours, updated);
    setNewHolidayDate('');
    setNewHolidayReason('');
    setNewHolidayEndDate('');
  };

  const removeHoliday = (date: string) => {
    onChange(hours, holidays.filter((h) => h.date !== date));
  };

  return (
    <div className="space-y-5">
      {/* ── Weekly Schedule ── */}
      <div className="space-y-2">
        {hours.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors duration-150 ${
              day.isOpen
                ? 'bg-[#FFFFFF] border-[rgba(10,10,10,0.12)]'
                : 'bg-[#FFFFFF] border-[rgba(10,10,10,0.12)] opacity-70'
            }`}
          >
            {/* Day label */}
            <div className="w-10 text-[11px] font-bold text-[rgba(10,10,10,0.70)] uppercase tracking-wider shrink-0">
              {DAY_LABELS[day.dayOfWeek]}
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => updateDay(day.dayOfWeek, { isOpen: !day.isOpen })}
              className="shrink-0"
              title={day.isOpen ? 'Mark as closed' : 'Mark as open'}
            >
              {day.isOpen ? (
                <ToggleRight className="w-6 h-6 text-[#C9281F]" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-[rgba(10,10,10,0.70)]" />
              )}
            </button>

            {day.isOpen ? (
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[rgba(10,10,10,0.70)]" />
                  <TimeInput
                    value={day.openTime}
                    onChange={(val) => updateDay(day.dayOfWeek, { openTime: val })}
                    className="text-xs font-semibold text-[#0A0A0A] border border-[rgba(10,10,10,0.12)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                  <span className="text-xs text-[rgba(10,10,10,0.70)]">to</span>
                  <TimeInput
                    value={day.closeTime}
                    onChange={(val) => updateDay(day.dayOfWeek, { closeTime: val })}
                    className="text-xs font-semibold text-[#0A0A0A] border border-[rgba(10,10,10,0.12)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                  <span className="text-[11px] text-[rgba(10,10,10,0.70)] hidden sm:inline">
                    ({fmt12(day.openTime)} – {fmt12(day.closeTime)})
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-[rgba(10,10,10,0.70)] font-semibold flex-1">Closed</span>
            )}
          </div>
        ))}
      </div>

      {/* Apply to weekdays shortcut */}
      <button
        type="button"
        onClick={applyToAllWeekdays}
        className="text-xs font-bold text-[#C9281F] hover:text-[#C9281F] underline underline-offset-2"
      >
        Apply Monday's hours to all weekdays (Mon–Fri)
      </button>

      {/* ── Closed / Holiday Dates Section ── */}
      {!compact && (
        <div className="border-t border-[rgba(10,10,10,0.12)] pt-5 space-y-4">

          {/* Section Header */}
          <div>
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)]">
              <CalendarDays className="w-4 h-4 text-[rgba(10,10,10,0.70)]" />
              Closed / Holiday Dates
            </h4>
            <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5">
              Block specific dates — these override your weekly schedule.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsLeaveMode(false); setNewHolidayEndDate(''); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors duration-150 cursor-pointer ${
                !isLeaveMode
                  ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] border-[#E73229] shadow-sm'
                  : 'bg-[#FFFFFF] text-[rgba(10,10,10,0.70)] border-[rgba(10,10,10,0.12)] hover:border-[rgba(10,10,10,0.20)]'
              }`}
            >
              🚫 Block Day
            </button>
            <button
              type="button"
              onClick={() => setIsLeaveMode(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors duration-150 cursor-pointer ${
                isLeaveMode
                  ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] border-[#E73229] shadow-sm'
                  : 'bg-[#FFFFFF] text-[rgba(10,10,10,0.70)] border-[rgba(10,10,10,0.12)] hover:border-[rgba(10,10,10,0.20)]'
              }`}
            >
              🏖️ Add Leave
            </button>
          </div>

          {/* Form Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">

            {/* DATE field */}
            <div className="w-full sm:w-auto">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                {isLeaveMode ? 'From Date' : 'Date'}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={newHolidayDate}
                  min={todayStr}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full sm:w-44 h-11 pl-3 pr-9 rounded-lg border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] text-xs font-semibold text-[rgba(10,10,10,0.70)] focus:outline-none focus:ring-2 focus:ring-[#E73229] appearance-none"
                />
                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(10,10,10,0.70)] pointer-events-none" />
              </div>
            </div>

            {/* TO DATE (leave mode) */}
            {isLeaveMode && (
              <div className="w-full sm:w-auto">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                  To Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={newHolidayEndDate}
                    min={newHolidayDate || todayStr}
                    onChange={(e) => setNewHolidayEndDate(e.target.value)}
                    className="w-full sm:w-44 h-11 pl-3 pr-9 rounded-lg border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] text-xs font-semibold text-[rgba(10,10,10,0.70)] focus:outline-none focus:ring-2 focus:ring-[#E73229] appearance-none"
                  />
                  <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(10,10,10,0.70)] pointer-events-none" />
                </div>
              </div>
            )}

            {/* REASON field */}
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={newHolidayReason}
                onChange={(e) => setNewHolidayReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addHoliday(); }}
                placeholder={isLeaveMode ? 'e.g. Vacation, Training...' : 'e.g. Diwali, Maintenance...'}
                className="w-full h-11 px-3 rounded-lg border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] text-xs font-semibold text-[rgba(10,10,10,0.70)] placeholder:text-[rgba(10,10,10,0.70)] focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
            </div>

            {/* BLOCK DATE button */}
            <div className="w-full sm:w-auto">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-transparent mb-1 select-none">
                .
              </label>
              <button
                type="button"
                onClick={addHoliday}
                disabled={!newHolidayDate || (isLeaveMode && !newHolidayEndDate)}
                className="w-full sm:w-auto h-11 flex items-center justify-center gap-1.5 px-5 rounded-full text-white text-xs font-bold transition-opacity duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] hover:opacity-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {isLeaveMode ? 'Add Leave' : 'Block Date'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[rgba(10,10,10,0.12)]" />

          {/* ── Active Blocked / Leave Dates List ── */}
          {activeHolidays.length > 0 ? (
            <div className="space-y-2">
              {activeHolidays.map((h) => {
                const isLeave = h.endDate && h.endDate !== h.date;
                return (
                  <div
                    key={h.date}
                    className={`flex items-start justify-between p-3 rounded-xl border text-xs ${
                      isLeave
                        ? 'bg-[rgba(231,50,41,0.08)] border-[rgba(10,10,10,0.12)]'
                        : 'bg-[rgba(231,50,41,0.08)] border-[rgba(10,10,10,0.12)]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">{isLeave ? '🏖️' : '🚫'}</span>
                      <div>
                        <p className={`font-bold text-[13px] ${isLeave ? 'text-[#C9281F]' : 'text-[#C9281F]'}`}>
                          {isLeave
                            ? `${formatDisplayDate(h.date)} → ${formatDisplayDate(h.endDate!)}`
                            : formatDisplayDate(h.date)}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${isLeave ? 'text-[#C9281F]' : 'text-[#C9281F]'}`}>
                          {h.reason}
                          <span className="ml-2 text-[rgba(10,10,10,0.70)] font-normal">(auto-expires after date)</span>
                        </p>
                        <p className={`text-[11px] mt-1 font-bold uppercase tracking-wider ${isLeave ? 'text-[#C9281F]' : 'text-[#C9281F]'}`}>
                          {isLeave ? '🔒 All slots in this range are blocked' : '🔒 All slots on this day are blocked'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHoliday(h.date)}
                      className="p-1 rounded-lg hover:bg-[rgba(10,10,10,0.05)] text-[rgba(10,10,10,0.70)] hover:text-[rgba(10,10,10,0.70)] transition-colors ml-2 shrink-0"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center rounded-xl border-2 border-dashed border-[rgba(10,10,10,0.12)]">
              <CalendarDays className="w-5 h-5 mx-auto text-[rgba(10,10,10,0.70)] mb-1" />
              <p className="text-xs text-[rgba(10,10,10,0.70)]">No blocked dates. Add a date above to close your shop.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
