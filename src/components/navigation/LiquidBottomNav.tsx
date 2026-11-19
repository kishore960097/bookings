import React from 'react';
import { createPortal } from 'react-dom';
import { motion, LayoutGroup, useReducedMotion } from 'motion/react';
import { Home, CalendarDays, Plus, Heart, UserRound } from 'lucide-react';
import { haptics } from '../../utils/haptics';

export type CustomerTabKey = 'home' | 'turf' | 'booking' | 'add' | 'favorites' | 'profile';

export interface TabItem {
  id: CustomerTabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  isCenterAction?: boolean;
}

export const TABS: TabItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'booking', label: 'Bookings', icon: CalendarDays },
  { id: 'add', label: 'Book', icon: Plus, isCenterAction: true },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

export interface LiquidBottomNavProps {
  activeTab: CustomerTabKey;
  onTabChange: (tab: CustomerTabKey) => void;
  onPlusClick?: () => void;
  visible?: boolean;
  labels?: Partial<Record<CustomerTabKey, string>>;
}

export const LiquidBottomNav: React.FC<LiquidBottomNavProps> = ({
  activeTab,
  onTabChange,
  onPlusClick,
  visible = true,
  labels,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const springEase = [0.34, 1.56, 0.64, 1] as const;

  const navContent = (
    <div
      className={`fixed left-0 right-0 bottom-0 z-50 flex justify-center pointer-events-none px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        visible
          ? 'translate-y-0 opacity-100'
          : `${prefersReducedMotion ? 'translate-y-0' : 'translate-y-24'} opacity-0`
      }`}
      role="navigation"
      aria-label="Bottom Navigation"
    >
      {/* Apple iOS Liquid Glass Floating Capsule */}
      <nav
        className="pointer-events-auto relative w-full max-w-[420px] h-[66px] rounded-full px-2.5 flex items-center justify-between select-none bg-white/45 dark:bg-zinc-900/45 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/70 dark:border-white/15 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.9),0_10px_30px_-8px_rgba(15,23,42,0.14)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_12px_32px_-8px_rgba(0,0,0,0.5)]"
        style={{
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          backdropFilter: 'blur(24px) saturate(180%)',
        }}
        role="tablist"
        aria-label="Navigation Tabs"
      >
        <LayoutGroup id="liquid-bottom-nav">
          <div className="relative w-full h-full flex items-center justify-between">
            {TABS.map((tab) => {
              const isTabActive =
                tab.id === activeTab || (tab.id === 'home' && activeTab === 'turf');
              const Icon = tab.icon;

              // ── Center Action Button (Raised Red Circle + Apple Rim + Ambient Glow + Book label) ──
              if (tab.isCenterAction) {
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    aria-label="Book Turf Slot"
                    whileTap={prefersReducedMotion ? { opacity: 0.75 } : { scale: 0.94 }}
                    transition={prefersReducedMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 500, damping: 25 }}
                    onClick={() => {
                      haptics.light();
                      if (onPlusClick) {
                        onPlusClick();
                      } else {
                        onTabChange(tab.id);
                      }
                    }}
                    className="relative z-20 flex-1 h-full min-w-0 min-h-[44px] flex flex-col items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E73229] rounded-full select-none active:scale-95 transition-transform duration-150"
                  >
                    <div
                      className="w-10 h-10 -mt-6 sm:-mt-7 rounded-full bg-[#E73229] text-white flex items-center justify-center ring-2 ring-white/75 dark:ring-white/20 shadow-[0_8px_20px_-4px_rgba(231,50,41,0.45)]"
                    >
                      <Plus size={20} strokeWidth={2.8} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                    </div>
                    <span className="text-[11px] leading-tight font-bold text-[#111111] dark:text-[#FFFFFF] mt-0.5 whitespace-nowrap drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
                      {labels?.[tab.id] || tab.label}
                    </span>
                  </motion.button>
                );
              }

              // ── Regular Navigation Items (Home, Bookings, Favorites, Profile) ──
              const rawLabel = labels?.[tab.id] || tab.label;
              const displayLabel = rawLabel === 'My Bookings' ? 'Bookings' : rawLabel;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isTabActive}
                  aria-current={isTabActive ? 'page' : undefined}
                  aria-label={displayLabel}
                  whileTap={prefersReducedMotion ? { opacity: 0.75 } : { scale: 0.92 }}
                  transition={prefersReducedMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 500, damping: 28 }}
                  onClick={() => {
                    haptics.selection();
                    onTabChange(tab.id);
                  }}
                  className="relative z-10 flex-1 h-full min-w-0 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E73229] rounded-full select-none active:scale-95 transition-transform duration-150"
                >
                  {isTabActive && (
                    <motion.div
                      layoutId={prefersReducedMotion ? undefined : 'activeTabPill'}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 1, scaleX: 1 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scaleX: [1, 1.25, 1] }}
                      className="absolute inset-x-1 inset-y-1 sm:inset-x-1.5 sm:inset-y-1 rounded-full z-0 pointer-events-none bg-[#E73229]/12 border border-[#E73229]/25 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.8)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      transition={{
                        duration: prefersReducedMotion ? 0.18 : 0.45,
                        ease: springEase,
                      }}
                    />
                  )}

                  {/* Icon: Accent Red when active, Crisp text when inactive */}
                  <div
                    className={`relative z-10 flex items-center justify-center mb-0.5 transition-colors ${
                      isTabActive
                        ? '!text-[#E73229] [&>svg]:!text-[#E73229] [&>svg]:!stroke-[#E73229] drop-shadow-[0_1px_2px_rgba(231,50,41,0.35)]'
                        : 'text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    <Icon size={19} strokeWidth={isTabActive ? 2.5 : 2.0} />
                  </div>

                  {/* Label: Accent Red when active, Crisp text when inactive */}
                  <span
                    className={`relative z-10 text-[11px] leading-tight whitespace-nowrap transition-colors ${
                      isTabActive
                        ? 'font-bold !text-[#E73229] drop-shadow-[0_1px_2px_rgba(231,50,41,0.25)]'
                        : 'font-semibold text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    {displayLabel}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>
      </nav>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) {
    return navContent;
  }

  return createPortal(navContent, document.body);
};
