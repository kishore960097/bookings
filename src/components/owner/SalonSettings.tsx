import React, { useState } from 'react';
import { Salon, TurfResource, TurfAvailabilitySchedule, isTurfBusiness } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Check } from 'lucide-react';
import { BusinessSharePanel } from './BusinessSharePanel';
import { WorkingHoursEditor } from './WorkingHoursEditor';
import { TurfDetailsEditor } from './TurfDetailsEditor';
import { TurfAvailabilityBuilder } from './TurfAvailabilityBuilder';
import { OwnerBusinessProfileEditor } from './OwnerBusinessProfileEditor';

interface SalonSettingsProps {
  salon: Salon;
  onUpdateSalon: (updated: Salon) => void;
}

export const SalonSettings: React.FC<SalonSettingsProps> = ({ salon, onUpdateSalon }) => {
  useAuth();
  const isTurf = isTurfBusiness(salon.category, salon.bookingMode);

  // Non-turf hours
  const [workingHours, setWorkingHours] = useState(salon.workingHours || []);
  const [holidays, setHolidays] = useState(salon.holidays || []);

  // Turf resources and custom schedule
  const [resources, setResources] = useState<TurfResource[]>(salon.resources || []);
  const [turfSchedule, setTurfSchedule] = useState<TurfAvailabilitySchedule[]>(salon.turfSchedule || []);

  // Booking Rules & Policies
  const [advanceBookingDays, setAdvanceBookingDays] = useState(
    salon.bookingSettings?.advanceBookingDays || 30
  );
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(
    salon.bookingSettings?.minNoticeMinutes || 30
  );
  const [cancellationAllowed, setCancellationAllowed] = useState(
    salon.bookingSettings?.cancellationAllowed ?? true
  );
  const [cancellationDeadlineHours, setCancellationDeadlineHours] = useState(
    salon.bookingSettings?.cancellationDeadlineHours || 2
  );
  const [refundPercentage, setRefundPercentage] = useState(
    salon.bookingSettings?.refundPercentage ?? 70
  );
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(
    salon.bookingSettings?.reminderMinutesBefore ?? 30
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveTurfSettings = async () => {
    setSaving(true);
    try {
      const res = await api.updateSalon(salon.id, {
        resources,
        turfSchedule,
      } as any);
      if (res?.salon) {
        onUpdateSalon(res.salon);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Error saving turf settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBookingRules = async () => {
    setSaving(true);
    try {
      const res = await api.updateSalon(salon.id, {
        bookingSettings: {
          advanceBookingDays,
          minNoticeMinutes,
          cancellationAllowed,
          cancellationDeadlineHours,
          refundPercentage,
          reminderMinutesBefore,
          customerChoosesStaff: salon.bookingSettings?.customerChoosesStaff ?? false,
        },
      } as any);
      if (res?.salon) {
        onUpdateSalon(res.salon);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Error saving booking rules:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async () => {
    setSaving(true);
    try {
      const res = await api.updateSalon(salon.id, { workingHours } as any);
      if (res?.salon) {
        onUpdateSalon(res.salon);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Error saving hours:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. BUSINESS PROFILE — View/Edit mode with full field coverage & image management */}
      <OwnerBusinessProfileEditor salon={salon} onUpdateSalon={onUpdateSalon} />

      {/* 2. TURF RESOURCES & AVAILABILITY BUILDER OR WORKING HOURS */}
      {isTurf ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-neutral-900">Manage Turfs &amp; Grounds</h3>
                <p className="text-xs text-neutral-500">Add or edit playable pitches and capacities</p>
              </div>
            </div>
            <TurfDetailsEditor resources={resources} onChange={setResources} />
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-neutral-900">Turf Availability &amp; Slots</h3>
                <p className="text-xs text-neutral-500">Configure opening hours, slot durations, and custom prices</p>
              </div>
            </div>
            <TurfAvailabilityBuilder
              resources={resources}
              turfSchedule={turfSchedule}
              onChange={setTurfSchedule}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveTurfSettings}
              disabled={saving}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all uppercase tracking-wider"
            >
              {saving ? 'Saving...' : 'Save All Turf Settings'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-neutral-900">Working Hours</h3>
              <p className="text-xs text-neutral-500">Set when your business is open</p>
            </div>
          </div>
          <WorkingHoursEditor
            workingHours={workingHours}
            holidays={holidays}
            onChange={(h, hols) => {
              setWorkingHours(h);
              setHolidays(hols);
            }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveHours}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs shadow-md transition-colors"
            >
              {saving ? 'Saving...' : 'Save Working Hours'}
            </button>
          </div>
        </div>
      )}

      {/* 3. BOOKING RULES & PREFERENCES */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900">Booking Rules &amp; Cancellation Policies</h3>
            <p className="text-xs text-neutral-500">Configure advance booking horizon, cancellation deadlines, and refund percentages</p>
          </div>
          {saved && (
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-xl">
              <Check className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Advance Booking Days */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                How many days ahead can players book?
              </label>
              <select
                value={advanceBookingDays}
                onChange={(e) => setAdvanceBookingDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1 day ahead</option>
                <option value={3}>3 days ahead</option>
                <option value={7}>7 days ahead</option>
                <option value={14}>14 days ahead</option>
                <option value={30}>30 days ahead (Default · Recommended)</option>
                <option value={60}>60 days ahead</option>
                <option value={90}>90 days ahead</option>
              </select>
            </div>

            {/* Minimum Notice */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Minimum notice before slot start
              </label>
              <select
                value={minNoticeMinutes}
                onChange={(e) => setMinNoticeMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={0}>No minimum notice (Book anytime)</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before (Default)</option>
                <option value={60}>1 hour before</option>
                <option value={120}>2 hours before</option>
              </select>
            </div>
          </div>

          {/* Cancellation Allowed Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <div>
              <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Allow Player Cancellations?</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Enable customers to cancel bookings before deadline</p>
            </div>
            <button
              type="button"
              onClick={() => setCancellationAllowed(!cancellationAllowed)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                cancellationAllowed
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {cancellationAllowed ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {cancellationAllowed && (
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cancellation Deadline */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Cancellation Deadline
                  </label>
                  <select
                    value={cancellationDeadlineHours}
                    onChange={(e) => setCancellationDeadlineHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={0.5}>30 minutes before slot</option>
                    <option value={1}>1 hour before slot</option>
                    <option value={2}>2 hours before slot (Default)</option>
                    <option value={3}>3 hours before slot</option>
                    <option value={6}>6 hours before slot</option>
                    <option value={12}>12 hours before slot</option>
                    <option value={24}>24 hours before slot</option>
                  </select>
                </div>

                {/* Refund Percentage */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Cancellation Refund Percentage
                  </label>
                  <select
                    value={refundPercentage}
                    onChange={(e) => setRefundPercentage(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={100}>100% Refund (Full Refund)</option>
                    <option value={80}>80% Refund</option>
                    <option value={70}>70% Refund (Default · Recommended)</option>
                    <option value={60}>60% Refund</option>
                    <option value={50}>50% Refund</option>
                    <option value={40}>40% Refund</option>
                    <option value={30}>30% Refund</option>
                    <option value={20}>20% Refund</option>
                    <option value={10}>10% Refund</option>
                    <option value={0}>0% Refund / No Refund</option>
                  </select>
                </div>
              </div>

              {/* Policy Preview */}
              <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  💡 Policy Preview (on a ₹1,000 booking):
                </p>
                <p className="text-emerald-700 font-semibold">
                  • Customer receives: <strong>₹{Math.round((1000 * refundPercentage) / 100)}</strong> ({refundPercentage}% refund)
                </p>
                <p className="text-slate-500">
                  • Retained non-refundable fee: <strong>₹{1000 - Math.round((1000 * refundPercentage) / 100)}</strong> ({100 - refundPercentage}%)
                </p>
              </div>
            </div>
          )}

          {/* Booking Reminder Notification */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
              Booking Reminder Notification
            </label>
            <select
              value={reminderMinutesBefore}
              onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={15}>15 minutes before slot</option>
              <option value={30}>30 minutes before slot (Default)</option>
              <option value={60}>1 hour before slot</option>
              <option value={120}>2 hours before slot</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveBookingRules}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors uppercase tracking-wider"
          >
            {saving ? 'Saving...' : 'Save Booking Rules'}
          </button>
        </div>
      </div>

      {/* 4. SHARE YOUR BUSINESS */}
      {(salon.status === 'live' || salon.status === 'approved') && (
        <BusinessSharePanel salon={salon} />
      )}
    </div>
  );
};
