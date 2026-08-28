import React, { useState } from 'react';
import { SalonHours, SalonHoliday } from '../../types';
import { Clock, Plus, X, ToggleLeft, ToggleRight, CalendarDays } from 'lucide-react';
import { TimeInput } from '../common/TimeInput';

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

  const todayStr = new Date().toISOString().split('T')[0];

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
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              day.isOpen
                ? 'bg-white border-slate-200'
                : 'bg-slate-50 border-slate-200 opacity-70'
            }`}
          >
            {/* Day label */}
            <div className="w-10 text-xs font-black text-slate-700 uppercase tracking-wider shrink-0">
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
                <ToggleRight className="w-6 h-6 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-slate-300" />
              )}
            </button>

            {day.isOpen ? (
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <TimeInput
                    value={day.openTime}
                    onChange={(val) => updateDay(day.dayOfWeek, { openTime: val })}
                    className="text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <TimeInput
                    value={day.closeTime}
                    onChange={(val) => updateDay(day.dayOfWeek, { closeTime: val })}
                    className="text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    ({fmt12(day.openTime)} – {fmt12(day.closeTime)})
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-semibold flex-1">Closed</span>
            )}
          </div>
        ))}
      </div>

      {/* Apply to weekdays shortcut */}
      <button
        type="button"
        onClick={applyToAllWeekdays}
        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
      >
        Apply Monday's hours to all weekdays (Mon–Fri)
      </button>

      {/* ── Closed / Holiday Dates Section ── */}
      {!compact && (
        <div className="border-t border-slate-100 pt-5 space-y-4">

          {/* Section Header */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              Closed / Holiday Dates
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Block specific dates — these override your weekly schedule.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsLeaveMode(false); setNewHolidayEndDate(''); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                !isLeaveMode
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300'
              }`}
            >
              🚫 Block Day
            </button>
            <button
              type="button"
              onClick={() => setIsLeaveMode(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isLeaveMode
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'
              }`}
            >
              🏖️ Add Leave
            </button>
          </div>

          {/* Form Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">

            {/* DATE field */}
            <div className="w-full sm:w-auto">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {isLeaveMode ? 'From Date' : 'Date'}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={newHolidayDate}
                  min={todayStr}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full sm:w-44 h-11 pl-3 pr-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 appearance-none"
                />
                <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* TO DATE (leave mode) */}
            {isLeaveMode && (
              <div className="w-full sm:w-auto">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  To Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={newHolidayEndDate}
                    min={newHolidayDate || todayStr}
                    onChange={(e) => setNewHolidayEndDate(e.target.value)}
                    className="w-full sm:w-44 h-11 pl-3 pr-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none"
                  />
                  <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* REASON field */}
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={newHolidayReason}
                onChange={(e) => setNewHolidayReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addHoliday(); }}
                placeholder={isLeaveMode ? 'e.g. Vacation, Training...' : 'e.g. Diwali, Maintenance...'}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            {/* BLOCK DATE button */}
            <div className="w-full sm:w-auto">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-transparent mb-1 select-none">
                .
              </label>
              <button
                type="button"
                onClick={addHoliday}
                disabled={!newHolidayDate || (isLeaveMode && !newHolidayEndDate)}
                className={`w-full sm:w-auto h-11 flex items-center justify-center gap-1.5 px-5 rounded-full text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
                  isLeaveMode
                    ? 'bg-amber-500 hover:bg-amber-600 active:scale-95'
                    : 'bg-rose-500 hover:bg-rose-600 active:scale-95'
                }`}
              >
                <Plus className="w-4 h-4" />
                {isLeaveMode ? 'Add Leave' : 'Block Date'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

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
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-rose-50 border-rose-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">{isLeave ? '🏖️' : '🚫'}</span>
                      <div>
                        <p className={`font-black text-sm ${isLeave ? 'text-amber-900' : 'text-rose-900'}`}>
                          {isLeave
                            ? `${formatDisplayDate(h.date)} → ${formatDisplayDate(h.endDate!)}`
                            : formatDisplayDate(h.date)}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${isLeave ? 'text-amber-700' : 'text-rose-600'}`}>
                          {h.reason}
                          <span className="ml-2 text-slate-400 font-normal">(auto-expires after date)</span>
                        </p>
                        <p className={`text-[10px] mt-1 font-bold uppercase tracking-wider ${isLeave ? 'text-amber-500' : 'text-rose-400'}`}>
                          {isLeave ? '🔒 All slots in this range are blocked' : '🔒 All slots on this day are blocked'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHoliday(h.date)}
                      className="p-1 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-700 transition-colors ml-2 shrink-0"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center rounded-xl border-2 border-dashed border-slate-200">
              <CalendarDays className="w-5 h-5 mx-auto text-slate-300 mb-1" />
              <p className="text-xs text-slate-400">No blocked dates. Add a date above to close your shop.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
