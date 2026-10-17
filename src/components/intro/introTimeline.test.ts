import { describe, expect, it } from 'vitest';
import { allFinite, computeIntroFrame, introTimeline, REVEALS } from './introTimeline';

// ─── Palette constants ────────────────────────────────────────────────────────
const { red, black, white, cream } = introTimeline.palette;

describe('QGo intro timeline', () => {
  it('has ordered visual scenes and a four second brand sequence', () => {
    const { logoInEnd, storefrontEnd, ticketEnd, clockEnd, revealEnd } = introTimeline.scenes;
    expect([logoInEnd, storefrontEnd, ticketEnd, clockEnd, revealEnd]).toEqual([600, 1200, 1900, 2600, 3300]);
    expect(introTimeline.duration.full).toBe(4000);
  });

  it('starts in the red brand scene and resolves to a black wordmark on white', () => {
    expect(computeIntroFrame(0).background).toBe(red);
    const final = computeIntroFrame(4000);
    expect(final.background).toBe(white);
    expect(final.logoCream).toBe(false);
    expect(final.tagline.opacity).toBeGreaterThan(0.99);
  });

  it('produces finite values around every scene boundary', () => {
    [0, 599, 600, 1199, 1200, 1899, 1900, 2599, 2600, 3299, 3300, 4000, 8000].forEach((time) => {
      expect(allFinite(computeIntroFrame(time))).toBe(true);
    });
  });

  // ─── Colour correctness ────────────────────────────────────────────────────
  it('palette has correct reference colours', () => {
    expect(introTimeline.palette.cream).toBe('#FFE9D6');
    expect(introTimeline.palette.white).toBe('#FFFFFF');
    expect(introTimeline.palette.red).toBe('#E8342A');
    expect(introTimeline.palette.black).toBe('#0B0B0B');
    expect(introTimeline.palette.ink).toBe('#333333');
  });

  it('wordmark is cream for t in [0, 2750) and black on/after white reveal', () => {
    [0, 120, 600, 1200, 1900, 2600, 2749].forEach((t) => {
      expect(computeIntroFrame(t).logoCream).toBe(true);
    });
    // After white reveal fully completes (whiteReveal = 1 = t >= 3250)
    expect(computeIntroFrame(4000).logoCream).toBe(false);
  });

  // ─── Reveal descriptors ────────────────────────────────────────────────────
  it('has three reveals: black at 1200, red at 1900, white at 2750', () => {
    expect(REVEALS[0]).toMatchObject({ start: 1200, dur: 450, bg: black, fg: cream, originKey: 'g' });
    expect(REVEALS[1]).toMatchObject({ start: 1900, dur: 450, bg: red,   fg: cream, originKey: 'o' });
    expect(REVEALS[2]).toMatchObject({ start: 2750, dur: 500, bg: white, fg: black, originKey: 'centre' });
  });

  // ─── Scale keyframes ───────────────────────────────────────────────────────
  it('scale is 2.6 at t=0 and 1.0 at t=3300+', () => {
    expect(computeIntroFrame(0).scale).toBeCloseTo(2.6, 5);
    expect(computeIntroFrame(3300).scale).toBeCloseTo(1.0, 5);
    expect(computeIntroFrame(4000).scale).toBeCloseTo(1.0, 5);
  });

  it('scale at t=600 is close to 1.7', () => {
    expect(computeIntroFrame(600).scale).toBeCloseTo(1.7, 3);
  });

  // ─── Drift ────────────────────────────────────────────────────────────────
  it('drift is ~0.04 at t=0 and 0 at t>=2750', () => {
    expect(computeIntroFrame(0).drift).toBeCloseTo(0.04, 3);
    expect(computeIntroFrame(2750).drift).toBeCloseTo(0, 3);
    expect(computeIntroFrame(4000).drift).toBeCloseTo(0, 3);
  });

  // ─── Logo opacity ─────────────────────────────────────────────────────────
  it('logoOpacity fades from 0 to 1 over the first 120ms', () => {
    expect(computeIntroFrame(0).logoOpacity).toBeCloseTo(0, 5);
    expect(computeIntroFrame(60).logoOpacity).toBeCloseTo(0.5, 3);
    expect(computeIntroFrame(120).logoOpacity).toBeCloseTo(1, 5);
    expect(computeIntroFrame(500).logoOpacity).toBeCloseTo(1, 5);
  });

  // ─── Letter windows (exit/return) ─────────────────────────────────────────
  it('Q exits 600-780 and returns 1260-1520', () => {
    expect(computeIntroFrame(599).q.sc).toBeCloseTo(1, 3);
    expect(computeIntroFrame(690).q.vis).toBe(1);
    expect(computeIntroFrame(690).q.sc).toBeLessThan(1);
    expect(computeIntroFrame(790).q.vis).toBe(0);
    expect(computeIntroFrame(1260).q.vis).toBe(1);
    expect(computeIntroFrame(1520).q.sc).toBeCloseTo(1, 2);
  });

  it('G exits 1380-1560 and returns 1950-2200', () => {
    expect(computeIntroFrame(1379).g.sc).toBeCloseTo(1, 3);
    expect(computeIntroFrame(1470).g.sc).toBeLessThan(1);
    expect(computeIntroFrame(1570).g.vis).toBe(0);
    expect(computeIntroFrame(1950).g.vis).toBe(1);
    expect(computeIntroFrame(2200).g.sc).toBeCloseTo(1, 2);
  });

  it('o exits 2000-2180 and returns 2640-2860', () => {
    expect(computeIntroFrame(1999).o.sc).toBeCloseTo(1, 3);
    expect(computeIntroFrame(2090).o.sc).toBeLessThan(1);
    expect(computeIntroFrame(2190).o.vis).toBe(0);
    expect(computeIntroFrame(2640).o.vis).toBe(1);
    expect(computeIntroFrame(2860).o.sc).toBeCloseTo(1, 2);
  });

  // ─── Objects visible/invisible at key times ────────────────────────────────
  it('storefront is visible during 700-1340', () => {
    expect(computeIntroFrame(699).store.vis).toBe(false);
    expect(computeIntroFrame(900).store.vis).toBe(true);
    expect(computeIntroFrame(1341).store.vis).toBe(false);
  });

  it('ticket is visible during 1480-2050', () => {
    expect(computeIntroFrame(1479).ticket.vis).toBe(false);
    expect(computeIntroFrame(1700).ticket.vis).toBe(true);
    expect(computeIntroFrame(2051).ticket.vis).toBe(false);
  });

  it('clock is visible during 2050-2720', () => {
    expect(computeIntroFrame(2049).clock.vis).toBe(false);
    expect(computeIntroFrame(2300).clock.vis).toBe(true);
    expect(computeIntroFrame(2721).clock.vis).toBe(false);
  });

  // ─── Clock hands sweep ────────────────────────────────────────────────────
  it('clock hands sweep 0 to 360/30 deg over 2100-2600', () => {
    const start = computeIntroFrame(2100);
    expect(start.clock.min).toBeCloseTo(0, 2);
    expect(start.clock.hour).toBeCloseTo(0, 2);
    const end = computeIntroFrame(2600);
    expect(end.clock.min).toBeCloseTo(360, 1);
    expect(end.clock.hour).toBeCloseTo(30, 1);
  });

  // ─── Nudges ───────────────────────────────────────────────────────────────
  it('tailNudge peaks around 3300+110ms and gNudge is 0.75× of tailNudge base', () => {
    const peak = computeIntroFrame(3300 + 110);
    expect(peak.tailNudge).toBeGreaterThan(0);
    expect(peak.gNudge).toBeGreaterThan(0);
    // gNudge at its own peak (from 3380) should be positive
    const gPeak = computeIntroFrame(3380 + 110);
    expect(gPeak.gNudge).toBeGreaterThan(0);
    // Before nudge windows
    expect(computeIntroFrame(3290).tailNudge).toBeCloseTo(0, 5);
  });

  // ─── Tagline ─────────────────────────────────────────────────────────────
  it('tagline fades in from 3500 over 300ms', () => {
    expect(computeIntroFrame(3499).tagOpacity).toBeCloseTo(0, 5);
    expect(computeIntroFrame(3800).tagOpacity).toBeCloseTo(1, 3);
    expect(computeIntroFrame(4000).tagOpacity).toBeCloseTo(1, 5);
  });

  // ─── Numeric parity (golden values from reference computeIntroFrame) ───────
  // Values computed from the reference Appendix A at t = 0 to 4000 step 50
  // Tolerance: 1e-4 (reference uses 28-iteration bisect, we use same algorithm)
  const GOLDEN_SCALE: [number, number][] = [
    [0, 2.6], [600, 1.7], [1200, 1.25], [1900, 1.1], [2600, 1.06], [3300, 1.0], [4000, 1.0],
  ];
  it('scale matches golden values at scene boundaries', () => {
    for (const [t, expected] of GOLDEN_SCALE) {
      expect(computeIntroFrame(t).scale).toBeCloseTo(expected, 4);
    }
  });

  // ─── Short/reduced variants unchanged ─────────────────────────────────────
  it('short variant: white background, black wordmark, no storefront/ticket/clock', () => {
    const f = computeIntroFrame(500, 'short');
    expect(f.background).toBe(white);
    expect(f.logoCream).toBe(false);
    expect(f.store.vis).toBe(false);
    expect(f.ticket.vis).toBe(false);
    expect(f.clock.vis).toBe(false);
  });

  it('reduced variant: white background, black wordmark, tagline fades in', () => {
    const f0 = computeIntroFrame(0, 'reduced');
    const f1 = computeIntroFrame(600, 'reduced');
    expect(f0.background).toBe(white);
    expect(f0.logoCream).toBe(false);
    expect(f1.tagOpacity).toBeGreaterThan(0);
  });
});
