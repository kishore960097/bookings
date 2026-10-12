import React from 'react';
import { Home, Ticket, CalendarDays, Heart, UserRound } from 'lucide-react';

export type CustomerTabKey = 'home' | 'turf' | 'booking' | 'favorites' | 'profile';

interface TabItem {
  id: CustomerTabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'turf', label: 'Turf', icon: Ticket },
  { id: 'booking', label: 'Booking', icon: CalendarDays },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

interface LiquidBottomNavProps {
  activeTab: CustomerTabKey;
  onTabChange: (tab: CustomerTabKey) => void;
  visible?: boolean;
}

export const LiquidBottomNav: React.FC<LiquidBottomNavProps> = ({
  activeTab,
  onTabChange,
  visible = true,
}) => {
  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div
      className={`fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none transition-all duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
      }`}
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
      role="navigation"
      aria-label="Bottom Navigation"
    >
      {/* ── Apple-Inspired Liquid Glass Floating Dock ── */}
      <nav
        className="liquid-glass-dock pointer-events-auto relative w-full max-w-[400px] h-[64px] px-2 py-1.5 flex items-center justify-between"
        style={{
          background: 'rgba(255, 255, 255, 0.62)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), 0 8px 32px -4px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.04)',
        }}
        role="tablist"
        aria-label="Navigation Tabs"
      >
        {/* Inner flex wrapper for 100% pixel-perfect indicator synchronization */}
        <div className="relative w-full h-full flex items-center">
          {/* ── Shared Animated Selection Capsule (280ms fluid ease-out) ── */}
          <div
            className="absolute top-0 bottom-0 w-1/5 pointer-events-none liquid-indicator-track z-0 flex items-center justify-center p-1"
            style={{
              transform: `translateX(${safeActiveIndex * 100}%)`,
            }}
            aria-hidden="true"
          >
            <div className="w-full h-full liquid-pill-indicator" />
          </div>

          {/* ── Five Navigation Items ── */}
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => onTabChange(tab.id)}
                className="relative z-10 w-1/5 flex-1 h-full min-w-0 flex flex-col items-center justify-center gap-0.5 liquid-tab-item rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]/40 select-none"
              >
                {/* Icon (Consistent Size & Alignment) */}
                <div
                  className={`transition-colors duration-200 flex items-center justify-center ${
                    isActive ? 'text-[#000000]' : 'text-[#000000]'
                  }`}
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.25 : 1.8}
                  />
                </div>

                {/* Refined Label Typography */}
                <span
                  className={`text-[10px] tracking-tight leading-tight transition-colors duration-200 truncate max-w-full px-1 ${
                    isActive ? 'text-[#000000] font-bold' : 'text-[rgba(0,0,0,0.70)] font-medium'
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
