import { useState, useEffect, useRef } from 'react';

/**
 * Pure calculation helper for scroll visibility determination.
 */
export function calculateNavVisibility(
  currentScrollY: number,
  lastScrollY: number,
  currentlyVisible: boolean,
  topThreshold = 60,
  scrollDeltaThreshold = 8
): boolean {
  if (currentScrollY < topThreshold) {
    return true;
  }
  const delta = currentScrollY - lastScrollY;
  if (delta > scrollDeltaThreshold) {
    return false;
  }
  if (delta < -scrollDeltaThreshold) {
    return true;
  }
  return currentlyVisible;
}

/**
 * Hook to hide bottom navigation bar while scrolling down,
 * reveal it immediately when scrolling up, and keep it visible
 * whenever scrolling stops or when near the top of the page.
 */
export function useScrollNavVisibility(): boolean {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<number | null>(null);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible((prev) => calculateNavVisibility(currentScrollY, lastScrollY.current, prev));
          lastScrollY.current = Math.max(0, currentScrollY);
          ticking = false;
        });
        ticking = true;
      }

      // When scrolling stops, keep it visible
      if (scrollTimeout.current) {
        window.clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = window.setTimeout(() => {
        setVisible(true);
      }, 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        window.clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return visible;
}

