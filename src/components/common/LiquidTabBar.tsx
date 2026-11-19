import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { haptics } from '../../utils/haptics';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export type LiquidTab<T extends string = string> = TabItem<T>;

interface LiquidTabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  itemClassName?: string;
  pillClassName?: string;
  idPrefix?: string;
}

export function LiquidTabBar<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  itemClassName = '',
  pillClassName = '',
  idPrefix = 'tab',
}: LiquidTabBarProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current[activeTab];
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const left = activeEl.offsetLeft;
    const width = activeEl.offsetWidth;

    setIndicator({ left, width, ready: true });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, tabs]);

  useEffect(() => {
    const activeEl = tabRefs.current[activeTab];
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeTab, prefersReducedMotion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      updateIndicator();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`relative flex min-w-0 max-w-full items-center overflow-x-auto scrollbar-none p-1.5 gap-1.5 rounded-full select-none ${className}`}
      style={{
        scrollSnapType: 'x proximity',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Sliding Glass Indicator Pill */}
      {indicator.ready && (
        <div
          aria-hidden="true"
          className={`absolute top-1.5 bottom-1.5 pointer-events-none z-0 ${
            pillClassName || 'glass-pill'
          }`}
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: `${indicator.width}px`,
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), width 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      )}

      {/* Tabs */}
      {tabs.map((tab) => {
        const isSelected = tab.id === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            id={`${idPrefix}-${tab.id}`}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              haptics.selection();
              onChange(tab.id);
            }}
            className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[13px] sm:text-[14px] leading-normal whitespace-nowrap cursor-pointer transition-all duration-150 active:scale-[0.97] ${itemClassName}`}
            style={{
              scrollSnapAlign: 'center',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {Icon && (
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isSelected ? 'text-[#000000] dark:text-[#FFFFFF]' : 'text-[#444444] dark:text-[#A1A1AA]'
                }`}
              />
            )}
            <span
              className={`transition-colors ${
                isSelected
                  ? 'text-[#000000] dark:text-[#FFFFFF] font-semibold'
                  : 'text-[#444444] dark:text-[#A1A1AA] font-medium hover:text-[#000000] dark:hover:text-[#FFFFFF]'
              }`}
              style={{
                opacity: 1,
                fontWeight: isSelected ? 600 : 500,
                textShadow: 'none',
                filter: 'none',
                mixBlendMode: 'normal',
              }}
            >
              {tab.label}
            </span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                  isSelected
                    ? 'bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000]'
                    : 'bg-[#E73229] text-[#FFFFFF]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
