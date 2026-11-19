import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe2, 
  UserCircle, 
  CalendarDays, 
  Heart, 
  Headphones, 
  ShieldCheck, 
  LogOut, 
  ChevronRight, 
  Camera, 
  Sun, 
  Moon, 
  CheckCircle2, 
  X,
  Store,
  ArrowRight,
  Pencil,
  Check,
  Bug
} from 'lucide-react';
import { BetaBugReportModal } from '../../../../components/common/BetaBugReportModal';
import { useAuth } from '../../../../context/AuthContext';
import { useTheme } from '../../../../context/ThemeContext';
import { useQbiScreen, useQbePreferences } from '../../../../components/qbi';
import { Qbi } from '../../../../components/qbi/Qbi';
import { haptics } from '../../../../utils/haptics';
import { api } from '../../../../services/api';
import { CustomerTabKey } from '../../../../components/navigation/LiquidBottomNav';
import { ProfileSubView } from '../../types';
import { AccountSubView } from './AccountSubView';
import { RefundsSubView } from './RefundsSubView';
import { SupportSubView } from './SupportSubView';
import { PrivacySubView } from './PrivacySubView';
import { TermsSubView } from './TermsSubView';
import { OwnerOnboardingWizard } from '../../../../components/owner/OwnerOnboardingWizard';

export interface ProfileViewProps {
  onLogout: () => void;
  onNavigateTab: (tab: CustomerTabKey) => void;
}

export function ProfileView({ 
  onLogout, 
  onNavigateTab 
}: ProfileViewProps) {
  useQbiScreen('profile');
  const { user, setUser, language, setLanguage, logout, switchRole, t } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const { prefs, updatePref, customName, setCustomName } = useQbePreferences();
  const [isEditingQbeName, setIsEditingQbeName] = useState(false);
  const [tempQbeName, setTempQbeName] = useState(customName);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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

  const [subView, setSubView] = useState<ProfileSubView>('main');
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isLogoutSheetOpen, setIsLogoutSheetOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSwitchingOwner, setIsSwitchingOwner] = useState(false);
  const hasExistingVenue = user?.role === 'owner' || user?.activeRole === 'owner' || Boolean(user?.salonId);

  const handleSwitchToOwner = async () => {
    haptics.light();
    setIsSwitchingOwner(true);
    try {
      const res = await switchRole('owner');
      if (res.success) {
        return;
      }
      setIsOnboardingOpen(true);
    } catch {
      setIsOnboardingOpen(true);
    } finally {
      setIsSwitchingOwner(false);
    }
  };

  // Subview history integration for native hardware/swipe back
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.profileSubView) {
        setSubView(e.state.profileSubView);
      } else {
        setSubView('main');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToSubView = (target: ProfileSubView) => {
    haptics.light();
    window.history.pushState({ profileSubView: target }, '', `#${target}`);
    setSubView(target);
  };

  const handleBackToMain = () => {
    haptics.light();
    if (window.location.hash) {
      window.history.back();
    }
    setSubView('main');
  };

  // User display metadata
  const displayName = user?.name || user?.displayName || 'Customer';
  const displayEmail = user?.email || 'customer@gmail.com';
  const initial = (displayName.trim().charAt(0) || displayEmail.charAt(0) || 'K').toUpperCase();

  return (
    <div className="w-full min-h-[100dvh] bg-[#F5F5F7] dark:bg-[#000000] text-[#111111] dark:text-[#FFFFFF] transition-colors pb-32">
      <AnimatePresence mode="wait">
        {subView === 'main' && (
          <motion.div
            key="profile-main"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col w-full px-4 pt-4"
          >
            {/* Header Card */}
            <div className="w-full rounded-[2rem] bg-[#FFFFFF] dark:bg-[#1C1C1E] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] p-5 mb-4 relative overflow-hidden shadow-sm dark:shadow-none transition-colors">
              {/* Decorative Big "Q" Watermark (pointer-events-none, strictly layered behind) */}
              <div 
                aria-hidden="true" 
                className="absolute top-1/2 right-[-24px] -translate-y-1/2 w-48 h-48 opacity-[0.06] dark:opacity-[0.04] pointer-events-none select-none z-0"
              >
                <svg viewBox="0 0 280 280" fill="currentColor" className="w-full h-full text-[#E73229]">
                  <path
                    fillRule="evenodd"
                    d="M206.17,268.40C199.35,265.00 197.67,262.56 189.03,243.50C185.04,234.70 179.18,221.88 176.01,215.00C165.22,191.58 164.00,188.37 164.00,183.45C164.00,169.27 173.12,160.02 187.13,160.01C192.25,160.00 191.64,159.77 219.00,171.75C229.73,176.44 245.02,183.13 253.00,186.62C269.59,193.87 272.98,196.70 275.51,205.38C277.17,211.11 276.86,215.72 274.42,221.50C272.34,226.39 231.86,266.10 226.26,268.74C219.67,271.83 212.83,271.72 206.17,268.40ZM115.50,265.40C89.09,260.44 62.23,245.63 43.22,225.55C8.68,189.06 -1.42,137.47 16.96,91.41C51.41,5.11 163.48,-19.84 231.08,43.75C256.48,67.65 271.98,103.21 272.00,137.62C272.00,151.97 268.24,173.00 265.67,173.00C264.99,173.00 254.11,168.39 241.51,162.75L218.60,152.50L218.44,138.50C218.26,123.62 217.07,117.85 211.71,105.83C201.96,83.99 179.77,66.12 156.20,61.12C149.37,59.68 130.63,59.68 123.80,61.12C96.06,67.01 73.24,87.73 64.46,115.00C60.64,126.87 60.35,145.53 63.80,157.44C70.27,179.80 85.38,197.66 106.08,207.44C118.56,213.34 124.53,214.51 141.65,214.43L156.80,214.36L158.88,218.93C160.01,221.44 164.75,231.83 169.40,242.00C174.06,252.19 177.48,260.89 177.01,261.37C172.65,265.84 132.05,268.50 115.50,265.40Z"
                  />
                </svg>
              </div>

              {/* Edit Button (Top Right, min 44px hit area) */}
              <motion.button 
                type="button"
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={() => navigateToSubView('account')}
                aria-label="Edit personal details"
                className="absolute top-4 right-4 w-11 h-11 bg-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.08)] dark:bg-[rgba(255,255,255,0.08)] dark:hover:bg-[rgba(255,255,255,0.14)] rounded-2xl flex items-center justify-center text-[#5C5C5C] dark:text-[#AEAEB2] transition-colors z-20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E73229]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </motion.button>

              {/* Interactive Card Body */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center pt-2">
                {/* Avatar Circle with Custom DP Upload */}
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="relative group cursor-pointer mb-3 select-none"
                  title="Click to change profile photo"
                >
                  {user?.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt={displayName}
                      className="w-[68px] h-[68px] rounded-full object-cover shadow-[0_4px_16px_rgba(231,50,41,0.32)]"
                    />
                  ) : (
                    <div className="w-[68px] h-[68px] rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] flex items-center justify-center text-3xl font-black text-[#FFFFFF] shadow-[0_4px_16px_rgba(231,50,41,0.32)]">
                      {initial}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={20} />
                  </div>
                </button>

                <h2 className="text-xl font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight mb-0.5">
                  {displayName}
                </h2>

                <div className="flex items-center justify-center gap-1.5 text-[#6B7280] dark:text-[#8E8E93] mb-4">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span className="text-xs font-medium">{displayEmail}</span>
                </div>

                {/* THEME SEGMENTED CONTROL (LIGHT / SYSTEM / DARK) */}
                <div 
                  role="radiogroup" 
                  aria-label="App Theme Mode"
                  className="flex items-center bg-[#EFEFEF] dark:bg-[#2C2C2E] rounded-full p-1 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] relative shadow-inner"
                >
                  {(['light', 'system', 'dark'] as const).map((mode) => {
                    const isSelected = themeMode === mode;
                    return (
                      <motion.button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        onClick={() => {
                          haptics.selection();
                          setThemeMode(mode);
                        }}
                        className={`relative z-10 flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors min-h-[34px] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E73229] ${
                          isSelected
                            ? 'text-[#FFFFFF]'
                            : 'text-[#6B7280] dark:text-[#8E8E93] hover:text-[#111111] dark:hover:text-[#FFFFFF]'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="profileThemeActivePill"
                            className="absolute inset-0 bg-[#111111] dark:bg-[#3A3A3C] rounded-full shadow-sm z-[-1]"
                            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          />
                        )}
                        {mode === 'light' && <Sun size={12} strokeWidth={2.5} />}
                        {mode === 'dark' && <Moon size={12} strokeWidth={2.5} />}
                        {mode === 'light' ? t.light : mode === 'dark' ? t.dark : t.system}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ─── QBE SMART ASSISTANT & SLOT REMINDERS CARD ─── */}
            <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-4 mb-3 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#E73229]/10 flex items-center justify-center shrink-0">
                    <Qbi mood="happy" size={32} />
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
                          <h3 className="text-sm font-bold text-[#0A0A0A] dark:text-white truncate">
                            {customName} Smart Assistant
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
                            <Pencil size={12} />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-snug mt-0.5">
                      Timely slot reminders before game time &amp; instant turf help
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.customerEnabled && prefs.enabled}
                  aria-label="Toggle Qbe Smart Assistant"
                  onClick={() => {
                    haptics.selection();
                    const nextVal = !(prefs.customerEnabled && prefs.enabled);
                    updatePref('customerEnabled', nextVal);
                    if (!prefs.enabled) updatePref('enabled', true);
                  }}
                  className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                    prefs.customerEnabled && prefs.enabled ? 'bg-[#E73229]' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <motion.div
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`w-5 h-5 rounded-full bg-white shadow-md ${
                      prefs.customerEnabled && prefs.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* ─── SWITCH TO OWNER / LIST VENUE PROMINENT CARD ─── */}
            <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10 border border-red-200/80 dark:border-red-500/30 rounded-2xl p-4 mb-3 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#E73229]/15 text-[#E73229] flex items-center justify-center shrink-0">
                    <Store size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#0A0A0A] dark:text-white truncate">
                      Switch to Owner Mode
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                      List &amp; manage your turf ground or salon
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchToOwner}
                  disabled={isSwitchingOwner}
                  className="px-3.5 py-2 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white font-bold text-xs shrink-0 transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSwitchingOwner ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{hasExistingVenue ? 'Open Dashboard' : 'Get Started'}</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Menu Cards (in order specified) */}
            <div className="flex flex-col gap-2.5 mb-2">
              {[
                {
                  id: 'language',
                  label: t.language,
                  sub: language === 'ta' ? t.switchToEnglish : t.switchToTamil,
                  icon: <Globe2 size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => {
                    haptics.light();
                    setIsLanguageSheetOpen(true);
                  },
                },
                {
                  id: 'account',
                  label: t.account,
                  sub: t.accountDesc,
                  icon: <UserCircle size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => navigateToSubView('account'),
                },
                {
                  id: 'booking',
                  label: t.yourBooking,
                  sub: t.yourBookingDesc,
                  icon: <CalendarDays size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => {
                    haptics.light();
                    onNavigateTab('booking');
                  },
                },
                {
                  id: 'refunds',
                  label: t.refunds,
                  sub: t.refundsDesc,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E73229" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 8h8M8 12h8M9 8v10M11 12l4 4" />
                    </svg>
                  ),
                  onClick: () => navigateToSubView('refunds'),
                },
                {
                  id: 'favorites',
                  label: t.favouriteVenues,
                  sub: t.favouriteVenuesDesc,
                  icon: <Heart size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => {
                    haptics.light();
                    onNavigateTab('favorites');
                  },
                },
                {
                  id: 'support',
                  label: t.support,
                  sub: t.supportDesc,
                  icon: <Headphones size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => navigateToSubView('support'),
                },
                {
                  id: 'privacy',
                  label: t.privacyPolicy,
                  sub: t.privacyPolicyDesc,
                  icon: <ShieldCheck size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => navigateToSubView('privacy'),
                },
                {
                  id: 'terms',
                  label: t.termsOfUse,
                  sub: t.termsOfUseDesc,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E73229" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M12 12v4M12 16h.01" />
                    </svg>
                  ),
                  onClick: () => navigateToSubView('terms'),
                },
                {
                  id: 'bug_report',
                  label: 'Report Bug / Beta Feedback',
                  sub: 'Found an issue? Report directly to dev team',
                  icon: <Bug size={20} strokeWidth={2.2} className="text-[#E73229]" />,
                  onClick: () => {
                    haptics.light();
                    setIsBugReportOpen(true);
                  },
                },
              ].map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-xs border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] text-left cursor-pointer transition-colors min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E73229]"
                  aria-label={`${item.label}: ${item.sub}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FDECEA] dark:bg-[rgba(231,50,41,0.14)] flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-0.5 truncate tracking-tight">
                      {item.label}
                    </h3>
                    <p className="text-xs font-medium text-[#6B7280] dark:text-[#8E8E93] truncate">
                      {item.sub}
                    </p>
                  </div>
                  <ChevronRight size={18} strokeWidth={2.4} className="text-[#767676] dark:text-[#8E8E93] shrink-0" />
                </motion.button>
              ))}

              {/* Logout Button Card */}
              <motion.button
                type="button"
                onClick={() => {
                  haptics.light();
                  setIsLogoutSheetOpen(true);
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 8 * 0.035, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-3.5 flex items-center gap-3.5 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs text-left mt-1 cursor-pointer transition-colors min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E73229]"
                aria-label="Logout: Sign out from your account"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FBEAE8] dark:bg-[rgba(231,50,41,0.14)] flex items-center justify-center shrink-0">
                  <LogOut size={20} strokeWidth={2.4} className="text-[#B3261E] dark:text-[#F0554A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#B3261E] dark:text-[#F0554A] mb-0.5 tracking-tight">
                    {t.logout}
                  </h3>
                  <p className="text-xs font-medium text-[#6B7280] dark:text-[#8E8E93]">
                    {t.logoutDesc}
                  </p>
                </div>
                <ChevronRight size={18} strokeWidth={2.4} className="text-[#767676] dark:text-[#8E8E93] shrink-0" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* --- SUBVIEW 1: ACCOUNT --- */}
        {subView === 'account' && (
          <AccountSubView 
            user={user} 
            setUser={setUser} 
            onBack={handleBackToMain} 
          />
        )}

        {/* --- SUBVIEW 2: REFUNDS & WALLET --- */}
        {subView === 'refunds' && (
          <RefundsSubView 
            onBack={handleBackToMain} 
          />
        )}

        {/* --- SUBVIEW 3: SUPPORT --- */}
        {subView === 'support' && (
          <SupportSubView 
            onBack={handleBackToMain} 
          />
        )}

        {/* --- SUBVIEW 4: PRIVACY POLICY --- */}
        {subView === 'privacy' && (
          <PrivacySubView 
            onBack={handleBackToMain} 
          />
        )}

        {/* --- SUBVIEW 5: TERMS OF USE --- */}
        {subView === 'terms' && (
          <TermsSubView 
            onBack={handleBackToMain} 
          />
        )}
      </AnimatePresence>

      {/* --- BOTTOM SHEET 1: LANGUAGE SWITCHER --- */}
      <AnimatePresence>
        {isLanguageSheetOpen && (
          <motion.div
            key="language-sheet-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[120] flex items-end justify-center"
          >
            {/* Dimmed Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLanguageSheetOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            {/* Bottom Sheet */}
            <motion.div
              key="language-sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 380 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 60 || info.velocity.y > 200) {
                  setIsLanguageSheetOpen(false);
                }
              }}
              className="relative w-full max-w-[480px] bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-t-[28px] p-6 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] shadow-2xl z-10 pb-8 touch-pan-y"
              role="dialog"
              aria-modal="true"
              aria-label="Language Selector"
            >
              {/* Drag Handle */}
              <button
                type="button"
                onClick={() => setIsLanguageSheetOpen(false)}
                className="w-full flex justify-center py-1 mb-4 cursor-pointer focus:outline-none"
                aria-label="Dismiss sheet"
              >
                <div className="w-12 h-1.5 bg-[#CFCFCF] dark:bg-[#48484A] rounded-full" />
              </button>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight">
                    {t.selectLanguage}
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#8E8E93]">
                    {language === 'ta' ? 'Select Language' : 'மொழியைத் தேர்ந்தெடுக்கவும்'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLanguageSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#5C5C5C] dark:text-[#AEAEB2] cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2.5 mt-3">
                {[
                  { code: 'en', label: 'English', sublabel: t.defaultLanguage || 'Default Language' },
                  { code: 'ta', label: 'தமிழ்', sublabel: 'Tamil' },
                ].map((opt) => {
                  const isSelected = (language || 'en').toLowerCase().startsWith(opt.code);
                  return (
                    <motion.button
                      key={opt.code}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        haptics.selection();
                        const nextLang = opt.code as 'en' | 'ta';
                        setLanguage(nextLang);
                        try {
                          localStorage.setItem('qgo_lang', nextLang);
                          localStorage.setItem('qgo_language', nextLang);
                        } catch {}
                        setIsLanguageSheetOpen(false);
                      }}
                      className={`w-full p-4 rounded-2xl flex items-center justify-between border text-left transition-colors cursor-pointer min-h-[54px] ${
                        isSelected
                          ? 'bg-[#FDECEA] dark:bg-[rgba(231,50,41,0.14)] border-[#E73229]'
                          : 'bg-[#F7F7F7] dark:bg-[#2C2C2E] border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-[#111111] dark:text-[#FFFFFF]">
                          {opt.label}
                        </div>
                        <div className="text-xs text-[#6B7280] dark:text-[#8E8E93]">
                          {opt.sublabel}
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 size={20} className="text-[#E73229]" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-[rgba(0,0,0,0.20)] dark:border-[rgba(255,255,255,0.30)]" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BOTTOM SHEET 2: LOGOUT CONFIRMATION --- */}
      <AnimatePresence>
        {isLogoutSheetOpen && (
          <motion.div
            key="logout-sheet-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[120] flex items-end justify-center"
          >
            {/* Dimmed Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutSheetOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            {/* Bottom Sheet */}
            <motion.div
              key="logout-sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 380 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 60 || info.velocity.y > 200) {
                  setIsLogoutSheetOpen(false);
                }
              }}
              className="relative w-full max-w-[480px] bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-t-[28px] p-6 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] shadow-2xl z-10 pb-8 text-center touch-pan-y"
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirm Sign Out"
            >
              {/* Drag Handle */}
              <button
                type="button"
                onClick={() => setIsLogoutSheetOpen(false)}
                className="w-full flex justify-center py-1 mb-4 cursor-pointer focus:outline-none"
                aria-label="Dismiss sheet"
              >
                <div className="w-12 h-1.5 bg-[#CFCFCF] dark:bg-[#48484A] rounded-full" />
              </button>

              <div className="w-14 h-14 rounded-full bg-[#FBEAE8] dark:bg-[rgba(231,50,41,0.14)] flex items-center justify-center mx-auto mb-3">
                <LogOut size={26} className="text-[#B3261E] dark:text-[#F0554A]" strokeWidth={2.4} />
              </div>

              <h3 className="text-xl font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight mb-1">
                {t.confirmLogoutTitle}
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] max-w-xs mx-auto mb-6">
                {t.confirmLogoutSubtitle}
              </p>

              <div className="flex flex-col gap-2.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    haptics.warning();
                    setIsLogoutSheetOpen(false);
                    // Safe Supabase call if available
                    try {
                      (window as any).supabase?.auth?.signOut()?.catch?.(() => {});
                    } catch {}
                    logout();
                    onLogout();
                  }}
                  className="w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white font-bold py-3.5 rounded-2xl shadow-md min-h-[48px] cursor-pointer"
                >
                  {t.confirmLogout}
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    haptics.light();
                    setIsLogoutSheetOpen(false);
                  }}
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#111111] dark:text-[#FFFFFF] font-bold py-3.5 rounded-2xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] min-h-[48px] cursor-pointer"
                >
                  {t.stayLoggedIn}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Owner Onboarding Wizard Dedicated Full Page */}
      <OwnerOnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={async () => {
          setIsOnboardingOpen(false);
          await switchRole('owner').catch(console.error);
        }}
      />

      {/* Beta Tester Bug Report Modal */}
      <BetaBugReportModal
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
      />
    </div>
  );
}
