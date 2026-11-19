import React, { useState } from 'react';
import { Salon, TurfResource, TurfAvailabilitySchedule, isTurfBusiness } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Check, ShoppingBag, ArrowRight, Pencil } from 'lucide-react';
import { useQbePreferences } from '../qbi/qbePreferences';
import { Qbi } from '../qbi/Qbi';
import { haptics } from '../../utils/haptics';
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
  const { switchRole } = useAuth();
  const { prefs, updatePref, customName, setCustomName } = useQbePreferences();
  const [isEditingQbeName, setIsEditingQbeName] = useState(false);
  const [tempQbeName, setTempQbeName] = useState(customName);
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
      {/* ─── ROLE SWITCHER: SWITCH TO CUSTOMER VIEW ─── */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-orange-200/80 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E73229]/15 text-[#E73229] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0A0A0A]">Switch to Customer View</h3>
              <p className="text-xs text-[rgba(10,10,10,0.70)] mt-1 max-w-xl">
                Browse, explore, and book slots at other venues as a customer. You can switch back to your Owner dashboard anytime from your Customer profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await switchRole('consumer');
              if (!res.success) {
                alert(res.error || 'Failed to switch to customer view');
              }
            }}
            className="px-5 py-3 rounded-2xl bg-[#E73229] hover:bg-[#D42B22] text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Switch to Customer</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ─── QBE BUSINESS ASSISTANT & SLOT ALERTS CARD ─── */}
      <div className="bg-white dark:bg-[#17171C] rounded-3xl p-6 border border-zinc-200/80 dark:border-white/10 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#E8342A]/10 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Qbi mood="happy" size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isEditingQbeName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tempQbeName}
                      onChange={(e) => setTempQbeName(e.target.value)}
                      placeholder="Assistant Name"
                      className="px-2 py-0.5 text-xs font-bold rounded-lg border border-[#E73229] bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 w-28 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tempQbeName.trim()) setCustomName(tempQbeName.trim());
                        setIsEditingQbeName(false);
                      }}
                      className="p-1 rounded-md bg-[#E73229] text-white hover:opacity-90"
                      title="Save name"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-base font-extrabold text-[#0A0A0A] dark:text-[#F5F5F7]">
                      {customName} Business Assistant &amp; Slot Alerts
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setTempQbeName(customName);
                        setIsEditingQbeName(true);
                      }}
                      className="p-1 text-zinc-400 hover:text-[#E73229] transition-colors"
                      title="Rename Assistant"
                      aria-label="Rename Assistant"
                    >
                      <Pencil size={13} />
                    </button>
                  </>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ml-1 ${
                    prefs.ownerEnabled && prefs.enabled
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {prefs.ownerEnabled && prefs.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mt-1 max-w-xl leading-relaxed">
                Receive automated operational alerts 15 minutes before customer slots start, live arrival notifications, and instant daily balance summaries.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.ownerEnabled && prefs.enabled}
            aria-label="Toggle Qbe Business Assistant"
            onClick={() => {
              haptics.selection();
              const nextVal = !(prefs.ownerEnabled && prefs.enabled);
              updatePref('ownerEnabled', nextVal);
              if (!prefs.enabled) updatePref('enabled', true);
            }}
            className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
              prefs.ownerEnabled && prefs.enabled ? 'bg-[#E8342A]' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                prefs.ownerEnabled && prefs.enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 1. BUSINESS PROFILE — View/Edit mode with full field coverage & image management */}
      <OwnerBusinessProfileEditor salon={salon} onUpdateSalon={onUpdateSalon} />

      {/* 2. TURF RESOURCES & AVAILABILITY BUILDER OR WORKING HOURS */}
      {isTurf ? (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-[#0A0A0A]">Manage Turfs &amp; Grounds</h3>
                <p className="text-xs text-[rgba(10,10,10,0.70)]">Add or edit playable pitches and capacities</p>
              </div>
            </div>
            <TurfDetailsEditor resources={resources} onChange={setResources} />
          </div>

          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-[#0A0A0A]">Turf Availability &amp; Slots</h3>
                <p className="text-xs text-[rgba(10,10,10,0.70)]">Configure opening hours, slot durations, and custom prices</p>
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
              className="px-5 py-2.5 min-h-[40px] rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-[#FFFFFF] font-semibold text-[13px] shadow-sm transition-colors duration-150 uppercase tracking-wider"
            >
              {saving ? 'Saving...' : 'Save All Turf Settings'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] shadow-sm p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[15px] text-[#0A0A0A]">Working Hours</h3>
              <p className="text-[13px] text-[rgba(10,10,10,0.70)]">Set when your business is open</p>
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
              className="px-5 py-2.5 min-h-[40px] rounded-xl bg-[#FFFFFF] hover:bg-[rgba(10,10,10,0.05)] text-[#0A0A0A] font-semibold text-[13px] border border-[rgba(10,10,10,0.12)] shadow-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save Working Hours'}
            </button>
          </div>
        </div>
      )}

      {/* 3. BOOKING RULES & PREFERENCES */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(10,10,10,0.12)]">
          <div>
            <h3 className="font-bold text-[15px] text-[#0A0A0A]">Booking Rules &amp; Cancellation Policies</h3>
            <p className="text-[13px] text-[rgba(10,10,10,0.70)]">Configure advance booking horizon, cancellation deadlines, and refund percentages</p>
          </div>
          {saved && (
            <span className="text-xs text-[#C9281F] font-bold flex items-center gap-1 bg-[rgba(231,50,41,0.08)] px-3 py-1 rounded-xl">
              <Check className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            {/* Advance Booking Days */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                How many days ahead can players book?
              </label>
              <select
                value={advanceBookingDays}
                onChange={(e) => setAdvanceBookingDays(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#E73229] min-h-[40px]"
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
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                Minimum notice before slot start
              </label>
              <select
                value={minNoticeMinutes}
                onChange={(e) => setMinNoticeMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#E73229] min-h-[40px]"
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
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] min-w-0">
            <div>
              <p className="text-[13px] font-bold text-[#0A0A0A] uppercase tracking-wider">Allow Player Cancellations?</p>
              <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5">Enable customers to cancel bookings before deadline</p>
            </div>
            <button
              type="button"
              onClick={() => setCancellationAllowed(!cancellationAllowed)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                cancellationAllowed
                  ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] shadow-2xs'
                  : 'bg-[#FFFFFF] text-[rgba(10,10,10,0.70)] border border-[rgba(10,10,10,0.12)]'
              }`}
            >
              {cancellationAllowed ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {cancellationAllowed && (
            <div className="p-3 sm:p-4 rounded-xl border border-[rgba(10,10,10,0.12)] bg-[rgba(231,50,41,0.08)] space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                {/* Cancellation Deadline */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                    Cancellation Deadline
                  </label>
                  <select
                    value={cancellationDeadlineHours}
                    onChange={(e) => setCancellationDeadlineHours(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#E73229] min-h-[40px]"
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
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                    Cancellation Refund Percentage
                  </label>
                  <select
                    value={refundPercentage}
                    onChange={(e) => setRefundPercentage(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#E73229] min-h-[40px]"
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
              <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] text-xs space-y-1">
                <p className="font-bold text-[#0A0A0A]">
                  💡 Policy Preview (on a ₹1,000 booking):
                </p>
                <p className="text-[#C9281F] font-semibold">
                  • Customer receives: <strong>₹{Math.round((1000 * refundPercentage) / 100)}</strong> ({refundPercentage}% refund)
                </p>
                <p className="text-[rgba(10,10,10,0.70)]">
                  • Retained non-refundable fee: <strong>₹{1000 - Math.round((1000 * refundPercentage) / 100)}</strong> ({100 - refundPercentage}%)
                </p>
              </div>
            </div>
          )}

          {/* Booking Reminder Notification */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
              Booking Reminder Notification
            </label>
            <select
              value={reminderMinutesBefore}
              onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#E73229] min-h-[40px]"
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
            className="px-5 py-2.5 min-h-[40px] rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-[#FFFFFF] font-semibold text-[13px] shadow-sm transition-colors uppercase tracking-wider"
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
