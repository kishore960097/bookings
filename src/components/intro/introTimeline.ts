export type IntroVariant = 'full' | 'short' | 'reduced' | 'off';

// ─── Palette (reference spec §5) ─────────────────────────────────────────────
// Do NOT wire these to any global theme token.
const PAL = {
  red:    '#E8342A',
  redDeep:'#A81818',
  black:  '#0B0B0B',
  white:  '#FFFFFF',
  cream:  '#FFE9D6',
  ink:    '#333333',
} as const;

export const introTimeline = {
  palette: {
    red:    PAL.red,
    redDeep:PAL.redDeep,
    black:  PAL.black,
    white:  PAL.white,
    cream:  PAL.cream,
    ink:    PAL.ink,
  },
  duration: { full: 4000, exit: 400, short: 1100, reduced: 600, timeout: 8000 },
  easings: {
    enter:  'cubic-bezier(0.22, 1, 0.36, 1)',
    wipe:   'cubic-bezier(0.76, 0, 0.24, 1)',
    backOut:'cubic-bezier(0.34, 1.56, 0.64, 1)',
    inOut:  'cubic-bezier(0.65, 0, 0.35, 1)',
    inn:    'cubic-bezier(0.5, 0, 1, 1)',
  },
  // Named scene boundaries kept for test compatibility
  scenes: { logoInEnd: 600, storefrontEnd: 1200, ticketEnd: 1900, clockEnd: 2600, revealEnd: 3300 },
  taglines: ['Queue less. Go more.', 'Skip the wait. Just Go.', 'Book it. Queue it. Go.'],
  // Viewbox constants
  vb: { w: 734, h: 278, cx: 367, cy: 139 },
  pivot: { q: [140, 137] as [number, number], g: [440, 137] as [number, number], o: [659, 163] as [number, number] },
} as const;

// ─── Easing implementations (match reference Appendix A exactly) ──────────────
function makeBez(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 28; i++) {
      t = (lo + hi) / 2;
      const cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
      if (cx < x) lo = t; else hi = t;
    }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  };
}

const E = {
  enter:  makeBez(0.22, 1, 0.36, 1),
  wipe:   makeBez(0.76, 0, 0.24, 1),
  backOut:makeBez(0.34, 1.56, 0.64, 1),
  inOut:  makeBez(0.65, 0, 0.35, 1),
  inn:    makeBez(0.5, 0, 1, 1),
  lin:    (x: number) => x,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const prog    = (t: number, a: number, d: number) => clamp01((t - a) / d);
const lerp    = (a: number, b: number, p: number) => a + (b - a) * p;

// ─── Per-letter state (scale + rotate about own pivot) ───────────────────────
function letterState(
  t: number,
  exitAt: number, exitDur: number,
  retAt: number,  retDur: number,
): { vis: 1 | 0; sc: number; rot: number } {
  if (t < exitAt) return { vis: 1, sc: 1, rot: 0 };
  if (t < exitAt + exitDur) {
    const p = E.inn(prog(t, exitAt, exitDur));
    return { vis: 1, sc: 1 - p, rot: -25 * p };
  }
  if (t < retAt) return { vis: 0, sc: 0, rot: 0 };
  if (t < retAt + retDur) {
    const p = E.backOut(prog(t, retAt, retDur));
    return { vis: 1, sc: Math.max(p, 0), rot: -25 * (1 - p) };
  }
  return { vis: 1, sc: 1, rot: 0 };
}

// ─── Per-object state ─────────────────────────────────────────────────────────
function objState(
  t: number,
  eAt: number, eDur: number,
  cAt: number, cDur: number,
  from: { x: number; y: number; sc: number; rot: number },
): { vis: boolean; x: number; y: number; sc: number; rot: number; sy: number; u: number } {
  if (t < eAt || t >= cAt + cDur) return { vis: false, x: 0, y: 0, sc: 0, rot: 0, sy: 1, u: 0 };
  const u  = prog(t, eAt, eDur);
  const p  = E.backOut(u);
  const o = {
    vis: true,
    x:   from.x * (1 - p),
    y:   from.y * (1 - p),
    sc:  lerp(from.sc, 1, p),
    rot: from.rot * (1 - p),
    sy:  1,
    u,
  };
  if (t >= cAt) {
    const c = E.inn(prog(t, cAt, cDur));
    o.sc *= Math.max(0, 1 - c);
  }
  return o;
}

// ─── Reveal descriptors (two-layer system) ───────────────────────────────────
export type RevealDesc = {
  start: number;
  dur: number;
  bg: string;
  fg: string;
  /** origin key: 'g' | 'o' | 'centre' */
  originKey: 'g' | 'o' | 'centre';
};

export const REVEALS: readonly RevealDesc[] = [
  { start: 1200, dur: 450, bg: PAL.black, fg: PAL.cream, originKey: 'g' },
  { start: 1900, dur: 450, bg: PAL.red,   fg: PAL.cream, originKey: 'o' },
  { start: 2750, dur: 500, bg: PAL.white, fg: PAL.black, originKey: 'centre' },
];

// ─── Frame type ───────────────────────────────────────────────────────────────
export type LetterState = { vis: 1 | 0; sc: number; rot: number };
export type ObjState    = { vis: boolean; x: number; y: number; sc: number; rot: number; sy: number; u: number };

export type IntroFrame = {
  t: number;
  // Legacy fields kept for test compatibility
  background: string;
  blackReveal: number;
  redReveal: number;
  whiteReveal: number;
  logoCream: boolean;
  logoX: number;
  nudge: number;
  // Reference-spec fields
  scale:       number;
  drift:       number;  // fraction of viewport width (add to 50%)
  logoOpacity: number;
  q: LetterState;
  g: LetterState;
  o: LetterState;
  store:  ObjState;
  ticket: ObjState & { min?: undefined; hour?: undefined };
  clock:  ObjState & { min?: number; hour?: number };
  tailNudge: number;  // SVG units, for Q tail sub-path
  gNudge:    number;  // SVG units, for G letter
  tagOpacity: number;
  tagY:       number;  // px offset (before sf multiplication, ref: 8*(1-opacity))
  // Legacy compat
  logoScale: number;
  storefront: { opacity: number; x: number; y: number; scale: number; rotation: number };
  ticketLegacy: { opacity: number; x: number; y: number; rotation: number };
  clockLegacy:  { opacity: number; x: number; rotation: number; minute: number; hour: number };
  tagline: { opacity: number; y: number };
};

// ─── Pure frame function (matches reference computeIntroFrame exactly) ────────
export const computeIntroFrame = (
  time: number,
  variant: Exclude<IntroVariant, 'off'> = 'full',
): IntroFrame => {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);

  // ── SHORT / REDUCED variants (unchanged behaviour) ──────────────────────────
  if (variant === 'short' || variant === 'reduced') {
    const reveal = E.enter(prog(t, 0, variant === 'short' ? 350 : 300));
    const opacity = reveal;
    const tagOp   = variant === 'reduced' ? reveal : 0;
    return {
      t,
      background:  PAL.white,
      blackReveal: 0, redReveal: 0, whiteReveal: 1,
      logoCream:   false,
      logoX:       0,
      nudge:       variant === 'short' ? 8 * Math.sin(Math.PI * prog(t, 450, 320)) : 0,
      scale:       lerp(0.92, 1, reveal),
      drift:       0,
      logoOpacity: opacity,
      logoScale:   lerp(0.92, 1, reveal),
      q: { vis: 1, sc: 1, rot: 0 },
      g: { vis: 1, sc: 1, rot: 0 },
      o: { vis: 1, sc: 1, rot: 0 },
      store:  { vis: false, x: 0, y: 0, sc: 0, rot: 0, sy: 1, u: 0 },
      ticket: { vis: false, x: 0, y: 0, sc: 0, rot: 0, sy: 1, u: 0 },
      clock:  { vis: false, x: 0, y: 0, sc: 0, rot: 0, sy: 1, u: 0, min: 0, hour: 0 },
      tailNudge: 0, gNudge: 0,
      tagOpacity: tagOp,
      tagY:       8 * (1 - tagOp),
      storefront: { opacity: 0, x: -30, y: 0, scale: 0.8, rotation: 0 },
      ticketLegacy: { opacity: 0, x: 0, y: -70, rotation: 0 },
      clockLegacy:  { opacity: 0, x: 70, rotation: 0, minute: 0, hour: 0 },
      tagline: { opacity: tagOp, y: lerp(8, 0, tagOp) },
    };
  }

  // ── FULL variant ─────────────────────────────────────────────────────────────

  // Scale keyframes (6-stop, each segment eased with enter)
  const K: [number, number][] = [
    [0, 2.6], [600, 1.7], [1200, 1.25], [1900, 1.1], [2600, 1.06], [3300, 1.0],
  ];
  let scale = 1;
  if (t <= 0) {
    scale = K[0][1];
  } else if (t >= 3300) {
    scale = 1;
  } else {
    for (let i = 0; i < K.length - 1; i++) {
      if (t >= K[i][0] && t < K[i + 1][0]) {
        scale = lerp(K[i][1], K[i + 1][1], E.enter(prog(t, K[i][0], K[i + 1][0] - K[i][0])));
        break;
      }
    }
  }

  const drift       = 0.04 * (1 - E.inOut(prog(t, 0, 2750)));
  const logoOpacity = t < 120 ? t / 120 : 1;

  // Letters
  const q = letterState(t,  600, 180, 1260, 260);
  const g = letterState(t, 1380, 180, 1950, 250);
  const o = letterState(t, 2000, 180, 2640, 220);

  // Storefront (replaces Q)
  const store = objState(t, 700, 400, 1200, 140, { x: -140, y: 0, sc: 0.4, rot: -15 });
  if (store.vis && store.u > 0.5) {
    const w  = prog(store.u, 0.5, 0.5);
    const sy = 1 + 0.12 * Math.cos(w * 3 * Math.PI) * (1 - w);
    store.sy = sy;
  }

  // Ticket (replaces G)
  const ticket = objState(t, 1480, 420, 1900, 150, { x: 0, y: -190, sc: 0.4, rot: -14 });
  if (ticket.vis) {
    ticket.rot += 3 * Math.sin(ticket.u * 4 * Math.PI) * (1 - ticket.u);
  }

  // Clock (replaces o)
  const clock = objState(t, 2050, 350, 2600, 120, { x: 190, y: 0, sc: 0.4, rot: 90 }) as ObjState & { min?: number; hour?: number };
  if (clock.vis) {
    const m     = E.inOut(prog(t, 2100, 500));
    clock.min   = 360 * m;
    clock.hour  = 30 * m;
  }

  // Nudges (tail = Q's first sub-path, G nudge = 0.75×)
  const nud = (a: number) => {
    const u = prog(t, a, 220);
    return u > 0 && u < 1 ? 8 * Math.sin(Math.PI * E.enter(u)) : 0;
  };
  const tailNudge = nud(3300);
  const gNudge    = nud(3380) * 0.75;

  // Tagline
  const tu       = E.enter(prog(t, 3500, 300));
  const tagOpacity = tu;
  const tagY       = 8 * (1 - tu);

  // ── Dual-layer reveal progress (for renderer) ────────────────────────────
  const blackReveal = E.wipe(prog(t, 1200, 450));
  const redReveal   = E.wipe(prog(t, 1900, 450));
  const whiteReveal = E.wipe(prog(t, 2750, 500));

  // ── Background (legacy compat) ────────────────────────────────────────────
  const background =
    t < 1200 ? PAL.red :
    t < 1900 ? PAL.black :
    t < 2750 ? PAL.red :
    t < 3250 ? PAL.red  :  // inside white reveal = white, but base = red until fully revealed
    PAL.white;

  const logoCream = t < 2750 || (t < 3250 && whiteReveal < 1);

  return {
    t,
    background,
    blackReveal, redReveal, whiteReveal,
    logoCream,
    logoX: 0,  // drift handled via the drift field + reference layout
    nudge: tailNudge,
    scale,
    drift,
    logoOpacity,
    logoScale: scale,
    q, g, o,
    store,
    ticket,
    clock,
    tailNudge, gNudge,
    tagOpacity,
    tagY,
    // Legacy compat objects
    storefront: {
      opacity:  store.vis ? 1 : 0,
      x:        store.x,
      y:        store.y,
      scale:    store.sc,
      rotation: store.rot,
    },
    ticketLegacy: {
      opacity:  ticket.vis ? 1 : 0,
      x:        ticket.x,
      y:        ticket.y,
      rotation: ticket.rot,
    },
    clockLegacy: {
      opacity:  clock.vis ? 1 : 0,
      x:        clock.x,
      rotation: clock.rot,
      minute:   clock.min ?? 0,
      hour:     clock.hour ?? 0,
    },
    tagline: { opacity: tagOpacity, y: tagY },
  };
};

export const allFinite = (frame: IntroFrame): boolean =>
  Object.values(frame).every((value) =>
    typeof value === 'object' && value !== null
      ? Object.values(value).every((nested) => typeof nested !== 'number' || Number.isFinite(nested))
      : typeof value !== 'number' || Number.isFinite(value),
  );
