import { describe, it, expect } from 'vitest';
import { calculateNavVisibility } from '../src/features/customer/hooks/useScrollNavVisibility';
import { TABS, LiquidBottomNav } from '../src/components/navigation/LiquidBottomNav';

describe('calculateNavVisibility', () => {
  it('returns true when current scroll position is near the top (< 60px)', () => {
    expect(calculateNavVisibility(0, 0, false)).toBe(true);
    expect(calculateNavVisibility(30, 100, false)).toBe(true);
    expect(calculateNavVisibility(59, 20, false)).toBe(true);
  });

  it('returns false when scrolling down past delta threshold (> 8px)', () => {
    // Scrolled from 100 to 120 (delta = +20 > 8)
    expect(calculateNavVisibility(120, 100, true)).toBe(false);
  });

  it('returns true when scrolling up past delta threshold (< -8px)', () => {
    // Scrolled from 200 to 180 (delta = -20 < -8)
    expect(calculateNavVisibility(180, 200, false)).toBe(true);
  });

  it('retains current visibility state when delta is small (-8 <= delta <= 8)', () => {
    // Scrolled from 150 to 154 (delta = +4)
    expect(calculateNavVisibility(154, 150, true)).toBe(true);
    expect(calculateNavVisibility(154, 150, false)).toBe(false);

    // Scrolled from 150 to 146 (delta = -4)
    expect(calculateNavVisibility(146, 150, true)).toBe(true);
    expect(calculateNavVisibility(146, 150, false)).toBe(false);
  });
});

describe('LiquidBottomNav Configuration & Integrity', () => {
  it('exports LiquidBottomNav as a callable component function', () => {
    expect(typeof LiquidBottomNav).toBe('function');
  });

  it('defines 5 tabs with Bookings label instead of truncated My Bookings', () => {
    expect(TABS).toHaveLength(5);
    const bookingTab = TABS.find((t) => t.id === 'booking');
    expect(bookingTab).toBeDefined();
    expect(bookingTab?.label).toBe('Bookings');
  });

  it('includes center action tab for Book Turf with isCenterAction flag', () => {
    const centerTab = TABS.find((t) => t.id === 'add');
    expect(centerTab).toBeDefined();
    expect(centerTab?.isCenterAction).toBe(true);
  });
});
