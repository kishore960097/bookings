import React from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { Home, CalendarDays, Plus, Heart, UserRound } from 'lucide-react';

export type CustomerTabKey = 'home' | 'turf' | 'booking' | 'add' | 'favorites' | 'profile';

interface TabItem {
  id: CustomerTabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  isCenterAction?: boolean;
}

const TABS: TabItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'booking', label: 'Booking', icon: CalendarDays },
  { id: 'add', label: 'Add', icon: Plus, isCenterAction: true },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

interface LiquidBottomNavProps {
  activeTab: CustomerTabKey;
  onTabChange: (tab: CustomerTabKey) => void;
  onPlusClick?: () => void;
  visible?: boolean;
}

export const LiquidBottomNav: React.FC<LiquidBottomNavProps> = ({
  activeTab,
  onTabChange,
  onPlusClick,
  visible = true,
}) => {
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}
      style={{
        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
      }}
      role="navigation"
      aria-label="Bottom Navigation"
    >
      {/* ── Floating Capsule Bottom Bar (Image 1 Style) ── */}
      <nav
        className="relative w-full h-[70px] bg-white rounded-full px-2 py-1.5 flex items-center justify-between border border-black/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] select-none"
        role="tablist"
        aria-label="Navigation Tabs"
      >
        <LayoutGroup id="liquid-bottom-nav">
          <div className="relative w-full h-full flex items-center justify-between">
            {TABS.map((tab) => {
              const isTabActive =
                tab.id === activeTab || (tab.id === 'home' && activeTab === 'turf');
              const Icon = tab.icon;

              // ── Center "Add" Button (Image 2 Style: Black squircle + bold white plus + "Add" text) ──
              if (tab.isCenterAction) {
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-label="Add"
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    onClick={() => {
                      if (onPlusClick) {
                        onPlusClick();
                      } else {
                        onTabChange(tab.id);
                      }
                    }}
                    className="relative z-20 flex-1 h-full min-w-0 flex flex-col items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full select-none"
                  >
                    {/* Black squircle as in Image 2 */}
                    <div className="w-11 h-11 -mt-3.5 rounded-[16px] bg-[#000000] text-white flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.30)] active:shadow-xs transition-shadow">
                      <Plus size={22} strokeWidth={2.8} className="text-white" />
                    </div>
                    {/* "Add" label underneath */}
                    <span className="text-[11px] tracking-tight leading-normal font-bold text-[#000000] mt-0.5">
                      {tab.label}
                    </span>
                  </motion.button>
                );
              }

              // ── Regular Navigation Items (Home, Booking, Favorites, Profile) ──
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isTabActive}
                  aria-label={tab.label}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  onClick={() => onTabChange(tab.id)}
                  className="relative z-10 flex-1 h-full min-w-0 flex flex-col items-center justify-center py-1 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full select-none"
                >
                  {/* ── iPhone-Style Smooth Gliding Active Pill (Orange Capsule from Image 1) ── */}
                  {isTabActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-x-1 inset-y-1 sm:inset-x-1.5 sm:inset-y-1 bg-[#FFA012] rounded-full shadow-[0_3px_12px_rgba(255,160,18,0.38)] -z-0 pointer-events-none"
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 34,
                        mass: 0.75,
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div className="relative z-10 flex items-center justify-center text-[#000000] mb-0.5">
                    <Icon size={20} strokeWidth={isTabActive ? 2.4 : 2.0} />
                  </div>

                  {/* Label */}
                  <span
                    className={`relative z-10 text-[11px] tracking-tight leading-normal text-[#000000] truncate max-w-full px-0.5 ${
                      isTabActive ? 'font-bold' : 'font-semibold'
                    }`}
                  >
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>
      </nav>
    </div>
  );
};
