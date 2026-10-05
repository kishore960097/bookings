import React, { useState, useEffect } from 'react';
import { Salon, TurfAvailabilitySchedule, GeneratedTurfSlot } from '../../types';
import { CalendarDays, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../services/api';

interface ScheduleManagerViewProps {
  salon: Salon;
  onUpdateSalon: (salon: Salon) => void;
}

export const ScheduleManagerView: React.FC<ScheduleManagerViewProps> = ({ salon, onUpdateSalon }) => {
  const [sourceDate, setSourceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetMonth, setTargetMonth] = useState<string>('');
  const [sourceSlots, setSourceSlots] = useState<GeneratedTurfSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!sourceDate) return;
      setFetchingSlots(true);
      try {
        const res = await api.getTurfAvailability(salon.id, sourceDate);
        if (res.success) {
          setSourceSlots(res.slots || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setFetchingSlots(false);
      }
    };
    fetchSlots();
  }, [sourceDate, salon.id]);

  const handleApply = async () => {
    if (!sourceDate || !targetMonth) return;
    
    setLoading(true);
    try {
      // Find the schedule that is currently active for sourceDate
      const schedules = salon.turfSchedule || [];
      let activeSchedule = schedules.find((s) => {
        if (s.validFrom && sourceDate < s.validFrom) return false;
        if (s.validTo && sourceDate > s.validTo) return false;
        return true;
      });
      if (!activeSchedule) {
        activeSchedule = schedules.find((s) => !s.validFrom && !s.validTo) || schedules[0];
      }

      // If no active schedule found, we can't copy
      if (!activeSchedule) {
        alert("No existing schedule found to copy from.");
        setLoading(false);
        return;
      }

      // Calculate validFrom and validTo for the target month
      // targetMonth is in format YYYY-MM
      const [year, month] = targetMonth.split('-');
      const validFrom = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const validTo = `${year}-${month}-${lastDay}`;

      const newSchedule: TurfAvailabilitySchedule = {
        id: Math.random().toString(36).substring(2, 9),
        name: `Slots for ${year}-${month}`,
        validFrom,
        validTo,
        resourceId: activeSchedule.resourceId,
        days: JSON.parse(JSON.stringify(activeSchedule.days || [])), // Copy all 7 days
        specialDates: [],
      };

      const newScheduleList = [...schedules, newSchedule];
      const res = await api.updateSalon(salon.id, { turfSchedule: newScheduleList });
      if (res.success) {
        onUpdateSalon(res.salon);
        alert('Slots successfully opened for the selected month!');
        setTargetMonth('');
      }
    } catch (e) {
      alert('Failed to apply slots.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-2xs">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Unblock / Open Future Slots</h2>
            <p className="text-slate-500 font-medium">Easily open slots for upcoming months using existing setups.</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Step 1: Source */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <label className="block text-sm font-bold text-slate-900 mb-2">1. Select existing date to copy slots from</label>
            <input 
              type="date" 
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none"
            />
            
            {fetchingSlots ? (
              <div className="mt-4 text-sm text-slate-500">Loading slots...</div>
            ) : sourceSlots.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Existing Slot Setup ({sourceSlots.length} slots)</p>
                <div className="flex flex-wrap gap-2">
                  {sourceSlots.slice(0, 8).map((slot, i) => (
                    <div key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {slot.startTime}
                    </div>
                  ))}
                  {sourceSlots.length > 8 && (
                    <div className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">
                      +{sourceSlots.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-rose-500 font-medium">No slots found on this date.</div>
            )}
          </div>

          <div className="flex justify-center -my-4 relative z-10">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 shadow-sm">
              <ArrowRight className="w-5 h-5 rotate-90" />
            </div>
          </div>

          {/* Step 2: Target */}
          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
            <label className="block text-sm font-bold text-slate-900 mb-2">2. Select future month to open</label>
            <input 
              type="month" 
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none"
            />
          </div>

          {/* Action */}
          <button 
            disabled={loading || !sourceDate || !targetMonth || sourceSlots.length === 0}
            onClick={handleApply}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 transition-all"
          >
            {loading ? 'Applying...' : 'Apply & Open Slots'}
            {!loading && <CheckCircle2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};