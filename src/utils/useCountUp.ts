import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly interpolates from previous number to target number
 * Prevents flashing to 0 on periodic background refreshes
 */
export function useCountUp(target: number, duration = 500): number {
  const [count, setCount] = useState(target);
  const prevTargetRef = useRef(target);
  const startValRef = useRef(target);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCount(target);
      prevTargetRef.current = target;
      return;
    }

    if (prevTargetRef.current === target) {
      return;
    }

    const startVal = prevTargetRef.current;
    startValRef.current = startVal;
    prevTargetRef.current = target;

    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startVal + (target - startVal) * ease));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  return count;
}
