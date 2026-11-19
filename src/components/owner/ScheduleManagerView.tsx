import React, { useState, useEffect } from 'react';
import { Salon, TurfAvailabilitySchedule, GeneratedTurfSlot } from '../../types';
import { CalendarDays, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { getBusinessTodayStr } from '../../utils/timeFormat';

interface ScheduleManagerViewProps {
  salon: Salon;
  onUpdateSalon: (salon: Salon) => void;
}

export const ScheduleManagerView: React.FC<ScheduleManagerViewProps> = ({ salon, onUpdateSalon }) => {
  const [sourceDate, setSourceDate] = useState<string>(() => getBusinessTodayStr());
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
    <div className="w-full min-w-0 max-w-2xl mx-auto mt-4 px-3 sm:px-4">
      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold text-[#0A0A0A] truncate">Unblock / Open Future Slots</h2>
            <p className="text-[13px] text-[rgba(10,10,10,0.70)] font-medium truncate">Easily open slots for upcoming months using existing setups.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: Source */}
          <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[rgba(10,10,10,0.12)]">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-2">1. Select existing date to copy slots from</label>
            <input 
              type="date" 
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] rounded-xl px-3.5 py-2.5 text-[14px] font-medium focus:ring-2 focus:ring-[#E73229] focus:border-[#E73229] transition-colors duration-150 outline-none min-h-[40px]"
            />
            
            {fetchingSlots ? (
              <div className="mt-3 text-[13px] text-[rgba(10,10,10,0.70)]">Loading slots...</div>
            ) : sourceSlots.length > 0 ? (
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-[rgba(10,10,10,0.70)] uppercase tracking-wider mb-2">Existing Slot Setup ({sourceSlots.length} slots)</p>
                <div className="flex flex-wrap gap-1.5">
                  {sourceSlots.slice(0, 8).map((slot, i) => (
                    <div key={i} className="px-2.5 py-1 bg-[rgba(231,50,41,0.08)] text-[#C9281F] text-xs font-semibold rounded-lg flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {slot.startTime}
                    </div>
                  ))}
                  {sourceSlots.length > 8 && (
                    <div className="px-2.5 py-1 bg-[#FFFFFF] text-[rgba(10,10,10,0.70)] text-xs font-semibold rounded-lg border border-[rgba(10,10,10,0.12)]">
                      +{sourceSlots.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-[13px] text-[#C9281F] font-medium">No slots found on this date.</div>
            )}
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <div className="w-8 h-8 bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] rounded-full flex items-center justify-center text-[rgba(10,10,10,0.70)] shadow-sm">
              <ArrowRight className="w-4 h-4 rotate-90" />
            </div>
          </div>

          {/* Step 2: Target */}
          <div className="bg-[rgba(231,50,41,0.08)] p-4 rounded-xl border border-[rgba(10,10,10,0.12)]">
            <label className="block text-[13px] font-semibold text-[#0A0A0A] mb-2">2. Select future month to open</label>
            <input 
              type="month" 
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] rounded-xl px-3.5 py-2.5 text-[14px] font-medium focus:ring-2 focus:ring-[#E73229] focus:border-[#E73229] transition-colors duration-150 outline-none min-h-[40px]"
            />
          </div>

          {/* Action */}
          <button 
            disabled={loading || !sourceDate || !targetMonth || sourceSlots.length === 0}
            onClick={handleApply}
            className="w-full py-3 px-4 bg-[#E73229] hover:bg-[#D42B22] disabled:bg-[#ECECEF] disabled:text-[rgba(10,10,10,0.40)] disabled:cursor-not-allowed text-[#FFFFFF] rounded-xl font-semibold text-[13px] min-h-[40px] flex items-center justify-center gap-2 shadow-sm transition-colors duration-150"
          >
            {loading ? 'Applying...' : 'Apply & Open Slots'}
            {!loading && <CheckCircle2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
