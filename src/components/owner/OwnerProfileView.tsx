import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useQbePreferences } from '../qbi/qbePreferences';
import { Qbi } from '../qbi/Qbi';
import { haptics } from '../../utils/haptics';
import { api } from '../../services/api';
import {
  LogOut,
  User,
  Shield,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  FileText,
  Settings,
  Sun,
  Moon,
  Laptop,
  Globe,
  Pencil,
  Check,
  Camera,
  CheckCircle2,
  Mail,
  MessageSquare,
  ShieldCheck,
  Send,
  Bug,
} from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE_E164 } from '../../config/supportContact';
import { BetaBugReportModal } from '../common/BetaBugReportModal';

interface OwnerProfileViewProps {
  onOpenSettings: () => void;
}

type OwnerSubView = 'main' | 'personal' | 'security' | 'help' | 'terms';

export const OwnerProfileView: React.FC<OwnerProfileViewProps> = ({ onOpenSettings }) => {
  const { user, setUser, logout, language, setLanguage } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const { prefs, updatePref, customName, setCustomName } = useQbePreferences();

  const [subView, setSubView] = useState<OwnerSubView>('main');
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(customName);

  // Personal Info Form State
  const [ownerName, setOwnerName] = useState(user?.name || 'Business Owner');
  const [ownerPhone, setOwnerPhone] = useState(user?.phone || user?.phoneNumber || '');
  const [isSavedPersonal, setIsSavedPersonal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Support Ticket Form State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const isQbeActive = prefs.ownerEnabled && prefs.enabled;

  const handleToggleQbe = () => {
    haptics.selection();
    const next = !isQbeActive;
    updatePref('ownerEnabled', next);
    if (!prefs.enabled) updatePref('enabled', true);
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      setCustomName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && user) {
        const updated = { ...user, photoUrl: dataUrl };
        setUser(updated);
        try {
          localStorage.setItem('qgo_user', JSON.stringify(updated));
        } catch {}
        api.updateProfile({ photoUrl: dataUrl }).catch(() => {});
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    haptics.success();
    if (user) {
      const updated = {
        ...user,
        name: ownerName.trim(),
        displayName: ownerName.trim(),
        phone: ownerPhone.trim(),
        phoneNumber: ownerPhone.trim(),
      };
      setUser(updated);
      try {
        localStorage.setItem('qgo_user', JSON.stringify(updated));
      } catch {}
      api.updateProfile({ name: ownerName.trim(), phone: ownerPhone.trim() }).catch(() => {});
    }
    setIsSavedPersonal(true);
    setTimeout(() => setIsSavedPersonal(false), 2500);
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    haptics.success();
    setTicketSubmitted(true);
    setTicketSubject('');
    setTicketMessage('');
    setTimeout(() => setTicketSubmitted(false), 4000);
  };

  const getInitial = (name?: string) => (name ? name.charAt(0).toUpperCase() : 'O');

  // ── SUBVIEW: PERSONAL INFORMATION ──
  if (subView === 'personal') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(10,10,10,0.08)] dark:border-white/10">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#E73229] hover:underline cursor-pointer min-h-[44px]"
          >
            <ChevronLeft size={18} /> Back
          </button>
          <h2 className="text-base font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">Personal Information</h2>
          <div className="w-12" />
        </div>

        {/* Profile Avatar Upload */}
        <div className="flex flex-col items-center justify-center my-3">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer"
            title="Click to change profile photo"
          >
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user?.name || 'Owner Profile'}
                className="w-20 h-20 rounded-full object-cover shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] flex items-center justify-center text-3xl font-black text-[#FFFFFF] shadow-md">
                {getInitial(ownerName)}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera size={22} />
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center justify-center shadow-xs">
              <Pencil size={11} strokeWidth={2.5} />
            </div>
          </button>
          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] mt-2">
            Tap avatar to upload photo
          </p>
        </div>

        {isSavedPersonal && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-bold">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Profile details updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSavePersonal} className="space-y-4">
          <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] dark:border-white/15 bg-white dark:bg-[#212128] text-xs font-semibold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] dark:border-white/15 bg-white dark:bg-[#212128] text-xs font-semibold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mb-1.5">
                Authenticated Account Email
              </label>
              <input
                type="email"
                disabled
                value={user?.email || 'Authenticated with Phone/Google'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.08)] dark:border-white/10 bg-neutral-100 dark:bg-[#2A2A32] text-xs font-medium text-[rgba(10,10,10,0.60)] dark:text-neutral-400 cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            style={{ background: 'linear-gradient(180deg,#F0554A 0%,#E73229 50%,#D42B22 100%)' }}
            className="w-full py-3 rounded-2xl text-white font-bold text-xs shadow-md hover:opacity-95 transition-opacity cursor-pointer min-h-[44px]"
          >
            Save Changes
          </button>
        </form>
      </div>
    );
  }

  // ── SUBVIEW: SECURITY ──
  if (subView === 'security') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(10,10,10,0.08)] dark:border-white/10">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#E73229] hover:underline cursor-pointer min-h-[44px]"
          >
            <ChevronLeft size={18} /> Back
          </button>
          <h2 className="text-base font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">Security &amp; Sessions</h2>
          <div className="w-12" />
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">Account Protection</h3>
              <p className="text-xs text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mt-0.5">
                Your owner account is authenticated via Firebase Secure Tokens with rate-limited OTP and OAuth protection.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-[rgba(10,10,10,0.08)] dark:border-white/10 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="font-semibold text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">Current Session</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                Active Now
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="font-semibold text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">Login Method</span>
              <span className="font-mono font-bold text-[#0A0A0A] dark:text-white">
                {user?.phone ? 'Phone OTP' : user?.email ? 'Google OAuth' : 'QGo Secure Auth'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border border-red-200 dark:border-red-500/30 text-[#C9281F] dark:text-[#F0554A] hover:bg-red-50 dark:hover:bg-red-500/10 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
        >
          <LogOut size={16} />
          Sign Out of All Devices
        </button>
      </div>
    );
  }

  // ── SUBVIEW: HELP CENTER ──
  if (subView === 'help') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(10,10,10,0.08)] dark:border-white/10">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#E73229] hover:underline cursor-pointer min-h-[44px]"
          >
            <ChevronLeft size={18} /> Back
          </button>
          <h2 className="text-base font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">Owner Help Center</h2>
          <div className="w-12" />
        </div>

        {/* Direct Contact Cards */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://wa.me/${SUPPORT_PHONE_E164}?text=Hi%20QGo%20Team%2C%20I%20am%20a%20Turf%2FSalon%20Owner%20and%20need%20assistance.`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center text-center gap-2 hover:opacity-95 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <MessageSquare size={18} />
            </div>
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">WhatsApp Help</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Instant reply</span>
          </a>

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=QGo%20Owner%20Support%20Request`}
            className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-col items-center text-center gap-2 hover:opacity-95 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
              <Mail size={18} />
            </div>
            <span className="text-xs font-bold text-blue-900 dark:text-blue-100">Email Support</span>
            <span className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">{SUPPORT_EMAIL}</span>
          </a>
        </div>

        {/* Submit Ticket Form */}
        <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">Submit a Support Ticket</h3>
          <p className="text-xs text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">
            Describe any payout, calendar slot, or venue listing issue. Our partner operations team replies within 2 hours.
          </p>

          {ticketSubmitted && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 font-bold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Ticket submitted successfully! Ticket ID #TK-{Date.now().toString().slice(-4)}</span>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-3 pt-1">
            <input
              type="text"
              required
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Subject (e.g., Slot price adjustment / Bank payout)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] dark:border-white/15 bg-white dark:bg-[#212128] text-xs font-semibold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
            />
            <textarea
              required
              rows={3}
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              placeholder="Please provide specifics regarding the affected slot date, booking ID, or ground details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] dark:border-white/15 bg-white dark:bg-[#212128] text-xs font-medium text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
            />
            <button
              type="submit"
              style={{ background: 'linear-gradient(180deg,#F0554A 0%,#E73229 50%,#D42B22 100%)' }}
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send size={14} /> Submit Ticket
            </button>
          </form>
        </div>

        {/* FAQs */}
        <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">
            Partner FAQs
          </h3>
          <div className="space-y-2.5 text-xs divide-y divide-neutral-100 dark:divide-white/10">
            <div className="pt-2">
              <p className="font-bold text-[#0A0A0A] dark:text-white">When are slot advance payments settled?</p>
              <p className="text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mt-0.5">
                Advance collections are processed via Razorpay Route daily at 23:59 IST directly to your verified bank account.
              </p>
            </div>
            <div className="pt-2">
              <p className="font-bold text-[#0A0A0A] dark:text-white">How do I verify customer QR tickets?</p>
              <p className="text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mt-0.5">
                Tap the QR icon in your top bar. If the player selected Advance Booking, collect the displayed balance at your reception before marking the slot complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SUBVIEW: TERMS & PRIVACY ──
  if (subView === 'terms') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(10,10,10,0.08)] dark:border-white/10">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#E73229] hover:underline cursor-pointer min-h-[44px]"
          >
            <ChevronLeft size={18} /> Back
          </button>
          <h2 className="text-base font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">Terms &amp; Privacy</h2>
          <div className="w-12" />
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm space-y-4 text-xs leading-relaxed text-[#0A0A0A] dark:text-neutral-200">
          <div>
            <h3 className="font-bold text-sm text-[#0A0A0A] dark:text-white mb-1">Partner Venue Agreement</h3>
            <p className="text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">
              By registering your venue on QGo, you agree to honor all confirmed player reservations. Advance payments collected online are held securely in escrow until slot start time.
            </p>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-white/10">
            <h3 className="font-bold text-sm text-[#0A0A0A] dark:text-white mb-1">Cancellation &amp; Refund Policy</h3>
            <p className="text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">
              Cancellations made by players within the policy window or due to severe weather conditions are refunded automatically to the customer. Venues are notified instantly to reopen the slot.
            </p>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-white/10">
            <h3 className="font-bold text-sm text-[#0A0A0A] dark:text-white mb-1">Data Privacy</h3>
            <p className="text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">
              Customer contact information is strictly provided for match coordination and verification. QGo never sells or shares player or owner data with third parties.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ──
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Profile Header */}
      <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer mb-3 select-none"
          title="Click to upload profile photo"
        >
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user?.name || 'Owner Profile'}
              className="w-16 h-16 rounded-full object-cover shadow-md border border-[rgba(10,10,10,0.08)] dark:border-white/10"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] flex items-center justify-center text-2xl font-bold shadow-md border border-[rgba(10,10,10,0.08)] dark:border-white/10">
              {getInitial(user?.name)}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <Camera size={18} />
          </div>
        </button>

        <h2 className="text-[20px] font-bold text-[#0A0A0A] dark:text-[#F5F5F7]">{user?.name || 'Business Owner'}</h2>
        <p className="text-[13px] font-medium text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] mt-0.5">{user?.email || user?.phone || 'owner@qgo.app'}</p>
        <div className="mt-2.5 px-2.5 py-0.5 bg-[rgba(231,50,41,0.08)] dark:bg-red-500/15 text-[#C9281F] dark:text-[#F0554A] text-[10px] font-semibold uppercase tracking-wider rounded-full">
          Owner Account
        </div>
      </div>

      {/* Theme & Language Preferences Card */}
      <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm p-4 space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-white/70">
          Preferences
        </div>

        {/* Theme Mode */}
        <div>
          <label className="block text-xs font-bold text-[#0A0A0A] dark:text-[#F5F5F7] mb-2">Theme Mode</label>
          <div className="grid grid-cols-3 gap-2 bg-[#F5F5F7] dark:bg-[#212128] p-1 rounded-xl border border-[rgba(10,10,10,0.06)] dark:border-white/10">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'system', label: 'System', icon: Laptop },
              { id: 'dark', label: 'Dark', icon: Moon },
            ].map(({ id, label, icon: Icon }) => {
              const isSelected = themeMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setThemeMode(id as any)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-[#2C2C34] text-[#0A0A0A] dark:text-[#FFFFFF] shadow-xs'
                      : 'text-[rgba(10,10,10,0.70)] dark:text-neutral-300 hover:text-[#0A0A0A] dark:hover:text-white'
                  }`}
                >
                  <Icon size={14} className={isSelected ? 'text-[#0A0A0A] dark:text-[#FFFFFF]' : 'text-[rgba(10,10,10,0.70)] dark:text-neutral-300'} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-xs font-bold text-[#0A0A0A] dark:text-[#F5F5F7] mb-2 flex items-center gap-1.5">
            <Globe size={13} className="text-[#0A0A0A] dark:text-[#F5F5F7]" />
            <span>Language</span>
          </label>
          <div className="grid grid-cols-2 gap-2 bg-[#F5F5F7] dark:bg-[#212128] p-1 rounded-xl border border-[rgba(10,10,10,0.06)] dark:border-white/10">
            {[
              { code: 'en', label: 'English' },
              { code: 'ta', label: 'தமிழ் (Tamil)' },
            ].map(({ code, label }) => {
              const isSelected = language === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-white dark:bg-[#2C2C34] text-[#0A0A0A] dark:text-[#FFFFFF] shadow-xs'
                      : 'text-[rgba(10,10,10,0.70)] dark:text-neutral-300 hover:text-[#0A0A0A] dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── QBE SMART ASSISTANT TOGGLE & RENAME CARD ─── */}
      <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8342A]/10 flex items-center justify-center shrink-0">
              <Qbi mood="happy" size={28} animate={false} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      maxLength={15}
                      className="px-2 py-0.5 rounded-lg border border-red-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E73229]"
                      placeholder="Qbe"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="p-1 rounded-lg bg-[#E73229] text-white hover:bg-[#D42B22] cursor-pointer"
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-bold text-[#0A0A0A] dark:text-[#FFFFFF]">{customName} Assistant</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setTempName(customName);
                        setIsEditingName(true);
                      }}
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      title="Rename Assistant"
                    >
                      <Pencil size={11} />
                    </button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA]">
                Smart co-pilot for fast slot scheduling &amp; queue telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isQbeActive}
            aria-label="Toggle Qbe Smart Assistant"
            onClick={handleToggleQbe}
            className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
              isQbeActive ? 'bg-[#E73229]' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                isQbeActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Account Settings Menu */}
      <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-3.5 border-b border-[rgba(10,10,10,0.12)] dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-white/70">
          Account Settings
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {[
            {
              icon: User,
              label: 'Personal Information',
              desc: 'Update your name, phone number, and photo',
              action: () => setSubView('personal'),
            },
            {
              icon: Shield,
              label: 'Security',
              desc: 'Authenticated sessions and security controls',
              action: () => setSubView('security'),
            },
            {
              icon: Settings,
              label: 'Business Settings',
              desc: 'Manage your business details, working hours, and services',
              action: onOpenSettings,
            },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              className="w-full flex items-center p-3 sm:p-3.5 hover:bg-[rgba(10,10,10,0.05)] dark:hover:bg-white/5 transition-colors text-left group min-h-[44px] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[#FFFFFF] dark:bg-white/10 flex items-center justify-center mr-3 group-hover:bg-[rgba(10,10,10,0.05)] dark:group-hover:bg-white/15 shadow-2xs transition-colors shrink-0">
                <item.icon size={16} className="text-[rgba(10,10,10,0.70)] dark:text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#0A0A0A] dark:text-[#F5F5F7] truncate">{item.label}</div>
                <div className="text-[11px] font-medium text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] truncate">{item.desc}</div>
              </div>
              <ChevronRight size={15} className="text-[rgba(10,10,10,0.70)] dark:text-white/50 group-hover:text-[#C9281F] dark:group-hover:text-[#F0554A] transition-colors shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      {/* Support & About Menu */}
      <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-2xl border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-3.5 border-b border-[rgba(10,10,10,0.12)] dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] dark:text-white/70">
          Support &amp; About
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {[
            {
              icon: HelpCircle,
              label: 'Help Center',
              desc: 'FAQs and support tickets',
              action: () => setSubView('help'),
            },
            {
              icon: FileText,
              label: 'Terms & Privacy',
              desc: 'Partner agreements and legal policy',
              action: () => setSubView('terms'),
            },
            {
              icon: Bug,
              label: 'Report Bug / Beta Feedback',
              desc: 'Found an issue? Report directly to dev team',
              action: () => setIsBugReportOpen(true),
            },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              className="w-full flex items-center p-3 sm:p-3.5 hover:bg-[rgba(10,10,10,0.05)] dark:hover:bg-white/5 transition-colors text-left group min-h-[44px] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[#FFFFFF] dark:bg-white/10 flex items-center justify-center mr-3 group-hover:bg-[rgba(10,10,10,0.05)] dark:group-hover:bg-white/15 shadow-2xs transition-colors shrink-0">
                <item.icon size={16} className="text-[rgba(10,10,10,0.70)] dark:text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#0A0A0A] dark:text-[#F5F5F7] truncate">{item.label}</div>
                <div className="text-[11px] font-medium text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] truncate">{item.desc}</div>
              </div>
              <ChevronRight size={15} className="text-[rgba(10,10,10,0.70)] dark:text-white/50 group-hover:text-[#C9281F] dark:group-hover:text-[#F0554A] transition-colors shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border border-[rgba(10,10,10,0.12)] dark:border-red-500/30 text-[#C9281F] dark:text-[#F0554A] hover:bg-[rgba(231,50,41,0.08)] dark:hover:bg-red-500/10 font-semibold text-[13px] transition-colors min-h-[44px] cursor-pointer"
      >
        <LogOut size={16} />
        Log Out
      </button>

      {/* Beta Tester Bug Report Modal */}
      <BetaBugReportModal
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
      />
    </div>
  );
};
