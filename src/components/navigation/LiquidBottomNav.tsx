import React from 'react';
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
  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const isCenterActive = activeTab === 'add';

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-50 w-full bg-[#FFFFFF] border-t border-[#0B0B0B] pb-[env(safe-area-inset-bottom,0px)] pointer-events-auto transition-transform duration-200 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="navigation"
      aria-label="Bottom Navigation"
    >
      {/* ── Solid Docked Bottom Bar ── */}
      <nav
        className="liquid-glass-dock relative w-full max-w-xl mx-auto h-[60px] px-1 flex items-center justify-between"
        role="tablist"
        aria-label="Navigation Tabs"
      >
        {/* Inner flex wrapper */}
        <div className="relative w-full h-full flex items-center">
          {/* ── Shared Animated Vermilion Top Indicator Bar (≤200ms ease-out) ── */}
          {!isCenterActive && (
            <div
              className="absolute top-0 left-0 w-1/5 pointer-events-none liquid-indicator-track z-20 flex justify-center"
              style={{
                transform: `translateX(${safeActiveIndex * 100}%)`,
              }}
              aria-hidden="true"
            >
              <div className="w-10 h-[3px] bg-[#E8342A] rounded-b-sm" />
            </div>
          )}

          {/* ── Five Navigation Items ── */}
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;

            if (tab.isCenterAction) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label="Add Turf or Booking"
                  onClick={() => {
                    if (onPlusClick) {
                      onPlusClick();
                    } else {
                      onTabChange(tab.id);
                    }
                  }}
                  className="relative z-10 w-1/5 flex-1 min-h-[44px] h-full min-w-0 flex flex-col items-center justify-center gap-0.5 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0B] active:opacity-80 transition-opacity duration-150"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0B0B0B] text-[#FFF4E8] flex items-center justify-center">
                    <Plus size={20} strokeWidth={2.6} className="text-[#FFF4E8]" />
                  </div>
                  <span className="text-[11px] tracking-tight leading-tight font-bold text-[#0B0B0B] truncate max-w-full px-1">
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => onTabChange(tab.id)}
                className="relative z-10 w-1/5 flex-1 min-h-[44px] h-full min-w-0 flex flex-col items-center justify-center gap-1 liquid-tab-item cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0B] select-none active:opacity-80 transition-opacity duration-150"
              >
                {/* Icon */}
                <div
                  className={`flex items-center justify-center transition-colors duration-150 ${
                    isActive ? 'text-[#0B0B0B]' : 'text-[#6B665F]'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.9}
                  />
                </div>

                {/* Typography (min 11px) */}
                <span
                  className={`text-[11px] tracking-tight leading-tight transition-colors duration-150 truncate max-w-full px-1 ${
                    isActive ? 'text-[#0B0B0B] font-bold' : 'text-[#6B665F] font-semibold'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
