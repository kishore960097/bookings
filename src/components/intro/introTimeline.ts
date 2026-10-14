export type IntroVariant = 'full' | 'short' | 'reduced' | 'off';

export const introTimeline = {
  palette: {
    red: '#E8342A',
    redDeep: '#A81818',
    black: '#0B0B0B',
    white: '#FFF4E8',
    cream: '#FFF4E8',
    ink: '#0B0B0B',
  },
  duration: { full: 4000, exit: 400, short: 1100, reduced: 600, timeout: 8000 },
  easings: { enter: 'cubic-bezier(0.22, 1, 0.36, 1)', wipe: 'cubic-bezier(0.76, 0, 0.24, 1)', backOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)', inOut: 'cubic-bezier(0.65, 0, 0.35, 1)' },
  scenes: { logoInEnd: 600, storefrontEnd: 1200, ticketEnd: 1900, clockEnd: 2600, revealEnd: 3300 },
  taglines: ['Queue less. Go more.', 'Skip the wait. Just Go.', 'Book it. Queue it. Go.'],
} as const;

export type IntroFrame = {
  background: string;
  blackReveal: number;
  redReveal: number;
  whiteReveal: number;
  logoScale: number;
  logoX: number;
  logoOpacity: number;
  logoCream: boolean;
  storefront: { opacity: number; x: number; y: number; scale: number; rotation: number };
  ticket: { opacity: number; x: number; y: number; rotation: number };
  clock: { opacity: number; x: number; rotation: number; minute: number; hour: number };
  tagline: { opacity: number; y: number };
  nudge: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const progress = (time: number, start: number, end: number) => clamp((time - start) / (end - start));
const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3);
const easeInOut = (value: number) => {
  const p = clamp(value);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
const lerp = (from: number, to: number, value: number) => from + (to - from) * value;

/** A side-effect-free description of every animated element at a given time. */
export const computeIntroFrame = (time: number, variant: Exclude<IntroVariant, 'off'> = 'full'): IntroFrame => {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);

  if (variant === 'short' || variant === 'reduced') {
    const minimum = variant === 'short' ? introTimeline.duration.short : introTimeline.duration.reduced;
    const reveal = easeOut(progress(t, 0, variant === 'short' ? 350 : 300));
    return {
      background: introTimeline.palette.white,
      blackReveal: 0, redReveal: 0, whiteReveal: 1,
      logoScale: lerp(0.92, 1, reveal), logoX: 0, logoOpacity: reveal, logoCream: false,
      storefront: { opacity: 0, x: -30, y: 0, scale: 0.8, rotation: 0 },
      ticket: { opacity: 0, x: 0, y: -70, rotation: 0 },
      clock: { opacity: 0, x: 70, rotation: 0, minute: 0, hour: 0 },
      tagline: { opacity: variant === 'reduced' ? reveal : 0, y: lerp(8, 0, reveal) },
      nudge: variant === 'short' ? 8 * Math.sin(Math.PI * progress(t, 450, 770)) : 0,
    };
  }

  const wordIn = easeOut(progress(t, 0, 600));
  const storefrontIn = easeOut(progress(t, 600, 960));
  const storefrontOut = progress(t, 1120, 1400);
  const ticketIn = easeOut(progress(t, 1200, 1500));
  const ticketOut = progress(t, 1830, 2020);
  const clockIn = easeOut(progress(t, 1900, 2220));
  const clockOut = progress(t, 2520, 2720);
  const settle = easeInOut(progress(t, 2600, 3300));
  const final = progress(t, 3300, 4000);
  const blackReveal = easeInOut(progress(t, 1200, 1450));
  const redReveal = easeInOut(progress(t, 1900, 2150));
  const whiteReveal = easeInOut(progress(t, 2600, 3300));

  const logoCream = t < 2600 || (t < 3300 && whiteReveal < 0.5);
  const logoScale = t < 600 ? lerp(2.6, 1.7, wordIn) : t < 1200 ? lerp(1.7, 1.25, progress(t, 600, 1200)) : t < 2600 ? 1.25 : lerp(1.25, 1, settle);
  const finalNudge = 8 * Math.sin(Math.PI * progress(t, 3360, 3550));

  return {
    background: t < 1200 ? introTimeline.palette.red : t < 1900 ? introTimeline.palette.black : t < 3300 ? introTimeline.palette.red : introTimeline.palette.white,
    blackReveal, redReveal, whiteReveal,
    logoScale,
    logoX: t < 600 ? lerp(-8, 0, wordIn) : 0,
    logoOpacity: 1,
    logoCream,
    storefront: {
      opacity: (1 - storefrontOut) * storefrontIn,
      x: lerp(-110, 0, storefrontIn) + 100 * storefrontOut,
      y: lerp(-10, 0, storefrontIn) - 20 * storefrontOut,
      scale: lerp(0.75, 1, storefrontIn),
      rotation: lerp(-10, 0, storefrontIn) + 12 * storefrontOut,
    },
    ticket: { opacity: ticketIn * (1 - ticketOut), x: 0, y: lerp(-105, 0, ticketIn) - 75 * ticketOut, rotation: lerp(-8, 0, ticketIn) + 10 * ticketOut },
    clock: { opacity: clockIn * (1 - clockOut), x: lerp(120, 0, clockIn) + 80 * clockOut, rotation: lerp(28, 0, clockIn) + 18 * clockOut, minute: 360 * easeInOut(progress(t, 2100, 2600)), hour: 30 * easeOut(progress(t, 2150, 2600)) },
    tagline: { opacity: easeOut(progress(t, 3500, 3800)), y: lerp(8, 0, easeOut(progress(t, 3500, 3800))) },
    nudge: t >= 3300 ? finalNudge : 0,
  };
};

export const allFinite = (frame: IntroFrame) => Object.values(frame).every((value) =>
  typeof value === 'object'
    ? Object.values(value).every((nested) => typeof nested !== 'number' || Number.isFinite(nested))
    : typeof value !== 'number' || Number.isFinite(value),
);
