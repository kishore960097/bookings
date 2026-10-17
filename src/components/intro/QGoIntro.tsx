import React, { useEffect, useRef, useState } from 'react';
import { computeIntroFrame, introTimeline, REVEALS, type IntroVariant } from './introTimeline';
import { markIntroSeen, resolveIntroVariant } from './introState';
import './qgoIntro.css';

// ─── Logo path data (exact from qgo-logo.svg) ────────────────────────────────
// The Q element has two sub-paths: tail (first) and ring (second).
const Q_TAIL = 'M206.17,268.40C199.35,265.00 197.67,262.56 189.03,243.50C185.04,234.70 179.18,221.88 176.01,215.00C165.22,191.58 164.00,188.37 164.00,183.45C164.00,169.27 173.12,160.02 187.13,160.01C192.25,160.00 191.64,159.77 219.00,171.75C229.73,176.44 245.02,183.13 253.00,186.62C269.59,193.87 272.98,196.70 275.51,205.38C277.17,211.11 276.86,215.72 274.42,221.50C272.34,226.39 231.86,266.10 226.26,268.74C219.67,271.83 212.83,271.72 206.17,268.40Z';
const Q_RING = 'M115.50,265.40C89.09,260.44 62.23,245.63 43.22,225.55C8.68,189.06 -1.42,137.47 16.96,91.41C51.41,5.11 163.48,-19.84 231.08,43.75C256.48,67.65 271.98,103.21 272.00,137.62C272.00,151.97 268.24,173.00 265.67,173.00C264.99,173.00 254.11,168.39 241.51,162.75L218.60,152.50L218.44,138.50C218.26,123.62 217.07,117.85 211.71,105.83C201.96,83.99 179.77,66.12 156.20,61.12C149.37,59.68 130.63,59.68 123.80,61.12C96.06,67.01 73.24,87.73 64.46,115.00C60.64,126.87 60.35,145.53 63.80,157.44C70.27,179.80 85.38,197.66 106.08,207.44C118.56,213.34 124.53,214.51 141.65,214.43L156.80,214.36L158.88,218.93C160.01,221.44 164.75,231.83 169.40,242.00C174.06,252.19 177.48,260.89 177.01,261.37C172.65,265.84 132.05,268.50 115.50,265.40Z';
const G_PATH = 'M425.50,263.90C396.47,260.87 370.37,248.30 348.89,227.01C330.01,208.29 319.12,188.34 313.38,161.96C310.89,150.52 310.83,124.93 313.27,113.44C325.50,55.88 371.63,14.55 430.06,8.83C486.94,3.27 543.74,39.01 560.92,91.20C563.17,98.01 562.83,101.08 559.60,103.23C558.27,104.13 497.84,104.26 495.54,103.38C494.65,103.03 492.97,100.90 491.81,98.63C486.84,88.88 472.36,78.27 458.00,73.86C448.48,70.93 431.89,70.71 422.16,73.37C372.31,87.00 356.05,147.26 392.44,183.53C411.64,202.66 437.59,208.08 463.37,198.33C470.50,195.64 482.50,187.41 482.50,185.22C482.50,184.53 473.39,174.56 462.25,163.06C445.30,145.56 442.00,141.68 442.00,139.24C442.00,132.67 439.67,132.91 503.09,132.92C557.62,132.93 560.56,133.02 562.97,134.81C567.78,138.38 567.88,139.71 567.94,200.12C568.00,255.92 567.97,256.77 565.93,259.37C564.38,261.34 562.93,262.01 560.18,262.04C556.72,262.08 555.61,261.15 541.89,246.87L527.28,231.65L518.39,238.34C491.59,258.51 459.20,267.42 425.50,263.90Z';
const O_PATH = 'M644.50,229.91C641.75,229.36 634.80,226.64 629.05,223.85C611.98,215.55 599.24,200.65 593.35,182.07C591.17,175.21 590.46,158.27 592.03,150.78C597.30,125.68 615.21,105.74 640.00,97.36C644.39,95.88 648.43,95.51 660.00,95.54C673.98,95.57 674.79,95.69 682.64,98.82C705.76,108.03 721.63,126.39 726.09,149.08C727.99,158.70 726.81,176.03 723.64,185.33C716.63,205.84 701.76,220.47 680.02,228.24C673.56,230.55 652.68,231.53 644.50,229.91ZM671.94,192.88C693.44,183.48 698.41,155.69 681.40,140.02C674.33,133.50 669.06,131.50 659.00,131.53C651.26,131.55 649.93,131.86 644.17,134.96C629.93,142.62 623.41,159.12 628.61,174.36C630.40,179.62 638.54,189.18 643.40,191.73C651.89,196.19 663.34,196.65 671.94,192.88Z';

// ─── Palette (must not depend on currentColor in objects) ────────────────────
const P = introTimeline.palette;

// ─── SVG defs (shared between layers) ────────────────────────────────────────
const DEFS_SVG = `<defs>
  <filter id="qgi-felt" x="-25%" y="-25%" width="150%" height="160%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise"/>
    <feColorMatrix in="noise" type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" result="gray"/>
    <feBlend in="SourceGraphic" in2="gray" mode="multiply" result="mult"/>
    <feComposite in="mult" in2="SourceGraphic" operator="arithmetic" k1="0" k2="0.12" k3="0.88" k4="0" result="mixed"/>
    <feComposite in="mixed" in2="SourceGraphic" operator="in" result="felt"/>
    <feDropShadow in="felt" dx="0" dy="9" stdDeviation="8" flood-color="#000" flood-opacity="0.28"/>
  </filter>
  <linearGradient id="qgi-hi" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
</defs>`;

// ─── Object markups (exact from Appendix A) ───────────────────────────────────
function storefrontMarkup(): string {
  const stripes: string[] = [];
  const n = 6, w = 250 / n;
  for (let i = 0; i < n; i++) {
    const x = -125 + i * w;
    stripes.push(`<path d="M${x},-112 h${w} v62 a${w / 2},${w / 2} 0 0 1 ${-w},0 z" fill="${i % 2 ? '#FFFFFF' : P.redDeep}"/>`);
  }
  return `<rect x="-108" y="-60" width="216" height="168" rx="16" fill="${P.cream}"/>
    <rect x="-34" y="10" width="68" height="98" rx="14" fill="${P.red}"/>
    <circle cx="20" cy="62" r="5" fill="${P.cream}"/>
    <rect x="-96" y="-8" width="52" height="48" rx="10" fill="#FFFFFF" opacity=".95"/>
    <rect x="48" y="-8" width="52" height="48" rx="10" fill="#FFFFFF" opacity=".95"/>
    <rect x="-132" y="-128" width="264" height="26" rx="13" fill="${P.red}"/>
    ${stripes.join('')}
    <rect x="-132" y="-128" width="264" height="236" rx="18" fill="url(#qgi-hi)"/>`;
}

function ticketMarkup(): string {
  const w = 300, h = 190, r = 24, n = 28, a = w / 2, b = h / 2;
  const d = `M${-a + r},${-b} H${a - r} Q${a},${-b} ${a},${-b + r} V${-n} A${n},${n} 0 0 0 ${a},${n} V${b - r} Q${a},${b} ${a - r},${b} H${-a + r} Q${-a},${b} ${-a},${b - r} V${n} A${n},${n} 0 0 0 ${-a},${-n} V${-b + r} Q${-a},${-b} ${-a + r},${-b} Z`;
  return `<path d="${d}" fill="${P.red}"/>
    <path d="${d}" fill="url(#qgi-hi)"/>
    <line x1="92" y1="-70" x2="92" y2="70" stroke="${P.cream}" stroke-width="5" stroke-dasharray="2 13" stroke-linecap="round"/>
    <path d="M-29.09 -0.69Q-29.09 20.93 -36.5 32.07Q-43.92 43.21 -58.75 43.21Q-88.06 43.21 -88.06 -0.69Q-88.06 -16 -84.85 -25.69Q-81.64 -35.38 -75.22 -39.98Q-68.8 -44.58 -58.27 -44.58Q-43.13 -44.58 -36.11 -33.62Q-29.09 -22.66 -29.09 -0.69ZM-46.16 -0.69Q-46.16 -12.49 -47.31 -19.03Q-48.46 -25.57 -51 -28.42Q-53.55 -31.26 -58.39 -31.26Q-63.54 -31.26 -66.17 -28.39Q-68.8 -25.51 -69.92 -19Q-71.04 -12.49 -71.04 -0.69Q-71.04 11 -69.86 17.57Q-68.68 24.14 -66.11 26.98Q-63.54 29.83 -58.63 29.83Q-53.79 29.83 -51.16 26.83Q-48.52 23.84 -47.34 17.24Q-46.16 10.64 -46.16 -0.69ZM-16.19 42V29.35H4.94V-28.84L-15.52 -16.06V-29.45L5.85 -43.31H21.96V29.35H41.51V42Z" fill="${P.cream}"/>`;
}

function clockMarkup(): string {
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * Math.PI / 180;
    const r1 = i % 3 ? 58 : 52;
    const r2 = 64;
    ticks += `<line x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * r2).toFixed(2)}" y2="${(-Math.cos(a) * r2).toFixed(2)}" stroke="#333" stroke-width="${i % 3 ? 4 : 6}" stroke-linecap="round"/>`;
  }
  return `<circle r="88" fill="${P.cream}"/><circle r="72" fill="#FFFBF5"/>${ticks}
    <g class="qgi-hour"><line y1="6" y2="-38" stroke="${P.black}" stroke-width="9" stroke-linecap="round"/></g>
    <g class="qgi-min"><line y1="8" y2="-56" stroke="${P.black}" stroke-width="6" stroke-linecap="round"/></g>
    <circle r="8" fill="${P.red}"/>
    <circle r="88" fill="url(#qgi-hi)"/>`;
}

// ─── Layer SVG markup (one string per layer, reused by both) ──────────────────
function layerMarkup(W: number, H: number): string {
  return `<rect class="qgi-bg" width="${W}" height="${H}"/>
  <g class="qgi-logo" fill="currentColor" fill-rule="evenodd">
    <g class="qgi-Q">
      <path class="qgi-tail" d="${Q_TAIL}"/>
      <path d="${Q_RING}"/>
    </g>
    <g class="qgi-G"><path d="${G_PATH}"/></g>
    <g class="qgi-O"><path d="${O_PATH}"/></g>
    <g class="qgi-store" filter="url(#qgi-felt)"><g class="qgi-store-in">${storefrontMarkup()}</g></g>
    <g class="qgi-ticket" filter="url(#qgi-felt)"><g class="qgi-ticket-in">${ticketMarkup()}</g></g>
    <g class="qgi-clock" filter="url(#qgi-felt)"><g class="qgi-clock-in">${clockMarkup()}</g></g>
  </g>`;
}

// ─── Layout formula (reference §6) ───────────────────────────────────────────
function computeLayout(W: number, H: number) {
  const aspect = W / H;
  let Wf: number, M: number;
  if (W > H) {
    Wf = Math.min(0.32 * W, 0.45 * H);
    M = 1.0;
  } else if (aspect > 0.6) {
    Wf = 0.62 * W;
    M = 1.15;
  } else {
    Wf = 0.72 * W;
    M = 1.0;
  }
  const sf = Wf / introTimeline.vb.w;
  const cx = W / 2;
  const cy = H * 0.48;
  return { Wf, M, sf, cx, cy };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type QGoIntroProps = {
  ready: boolean;
  onDone: () => void;
};

interface LayerRefs {
  el:       HTMLDivElement;
  svg:      SVGSVGElement;
  bg:       SVGRectElement;
  logo:     SVGGElement;
  Q:        SVGGElement;
  tail:     SVGPathElement;
  G:        SVGGElement;
  O:        SVGGElement;
  store:    SVGGElement;
  storeIn:  SVGGElement;
  ticket:   SVGGElement;
  ticketIn: SVGGElement;
  clock:    SVGGElement;
  clockIn:  SVGGElement;
  hour:     SVGGElement;
  min:      SVGGElement;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const QGoIntro: React.FC<QGoIntroProps> = ({ ready, onDone }) => {
  const stageRef  = useRef<HTMLDivElement>(null);
  const tagRef    = useRef<HTMLParagraphElement>(null);
  const readyRef  = useRef(ready);
  const doneRef   = useRef(false);
  const recordedRef = useRef(false);
  const elapsedRef  = useRef(0);
  const onDoneRef   = useRef(onDone);
  onDoneRef.current = onDone;

  const [variant] = useState<IntroVariant>(() => resolveIntroVariant({
    search: window.location.search,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    local: window.localStorage,
    session: window.sessionStorage,
  }));

  readyRef.current = ready;

  useEffect(() => {
    if (variant === 'off') {
      const t = window.setTimeout(onDone, 0);
      return () => window.clearTimeout(t);
    }

    if (!recordedRef.current) {
      markIntroSeen(variant, new Date(), window.localStorage, window.sessionStorage);
      recordedRef.current = true;
    }

    const previousThemeColor =
      document.documentElement.dataset.qgoIntroThemeRestore ||
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    document.body.classList.add('qgo-intro-active');

    // ── Build DOM ────────────────────────────────────────────────────────────
    const stage = stageRef.current!;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const { Wf, M, sf, cx, cy } = computeLayout(W, H);

    // Shared defs (invisible SVG at top of stage)
    const defsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defsSvg.setAttribute('width', '0');
    defsSvg.setAttribute('height', '0');
    defsSvg.style.position = 'absolute';
    defsSvg.innerHTML = DEFS_SVG;
    stage.appendChild(defsSvg);

    // Two layers
    const layerEls: LayerRefs[] = [];
    for (let i = 0; i < 2; i++) {
      const el = document.createElement('div');
      el.className = 'qgi-layer';
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">${layerMarkup(W, H)}</svg>`;
      stage.appendChild(el);

      const q = <T extends Element>(sel: string) => el.querySelector<T>(sel)!;
      layerEls.push({
        el,
        svg:      q<SVGSVGElement>('svg'),
        bg:       q<SVGRectElement>('.qgi-bg'),
        logo:     q<SVGGElement>('.qgi-logo'),
        Q:        q<SVGGElement>('.qgi-Q'),
        tail:     q<SVGPathElement>('.qgi-tail'),
        G:        q<SVGGElement>('.qgi-G'),
        O:        q<SVGGElement>('.qgi-O'),
        store:    q<SVGGElement>('.qgi-store'),
        storeIn:  q<SVGGElement>('.qgi-store-in'),
        ticket:   q<SVGGElement>('.qgi-ticket'),
        ticketIn: q<SVGGElement>('.qgi-ticket-in'),
        clock:    q<SVGGElement>('.qgi-clock'),
        clockIn:  q<SVGGElement>('.qgi-clock-in'),
        hour:     q<SVGGElement>('.qgi-hour'),
        min:      q<SVGGElement>('.qgi-min'),
      });
    }

    // Tagline
    const tag = tagRef.current!;
    tag.style.fontSize  = `${(Wf * 0.066).toFixed(2)}px`;
    tag.style.top       = `${(cy + introTimeline.vb.cy * sf + Wf * 0.17).toFixed(2)}px`;
    tag.style.left      = '0';
    tag.style.right     = '0';
    tag.style.position  = 'absolute';
    tag.style.textAlign = 'center';

    // ── Per-frame letter and object transforms ────────────────────────────────
    const { vb, pivot } = introTimeline;

    let curFrame = computeIntroFrame(0, variant === 'off' ? 'reduced' : variant);

    function pivotScreen(k: 'q' | 'g' | 'o') {
      const f = curFrame;
      const sc = sf * (1 + (f.scale - 1) * M);
      const x  = cx + f.drift * W;
      const p  = pivot[k];
      return [x + (p[0] - vb.cx) * sc, cy + (p[1] - vb.cy) * sc] as [number, number];
    }

    function letterT(
      k: 'q' | 'g' | 'o',
      st: { sc: number; rot: number },
      dx = 0,
    ): string {
      const [px, py] = pivot[k];
      return `translate(${dx},0) translate(${px},${py}) rotate(${st.rot}) scale(${Math.max(st.sc, 0.0001)}) translate(${-px},${-py})`;
    }

    function objT(
      st: { x: number; y: number; sc: number; rot: number; sy: number },
      px: number, py: number,
    ): string {
      const sx = st.sc / (st.sy || 1);
      const sy = st.sc * (st.sy || 1);
      return `translate(${px + st.x},${py + st.y}) rotate(${st.rot}) scale(${sx},${sy})`;
    }

    function setLayer(
      L: LayerRefs,
      sty: { bg: string; fg: string },
      f: typeof curFrame,
    ) {
      const sc = sf * (1 + (f.scale - 1) * M);
      const x  = cx + f.drift * W;

      L.el.style.color = sty.fg;
      L.bg.setAttribute('fill', sty.bg);
      L.logo.setAttribute(
        'transform',
        `translate(${x},${cy}) scale(${sc}) translate(${-vb.cx},${-vb.cy})`,
      );
      L.logo.style.opacity = String(f.logoOpacity);

      // Q
      L.Q.setAttribute('transform', letterT('q', f.q));
      L.Q.style.display = f.q.vis ? '' : 'none';
      L.tail.setAttribute('transform', `translate(${f.tailNudge},0)`);

      // G
      L.G.setAttribute('transform', letterT('g', f.g, f.gNudge));
      L.G.style.display = f.g.vis ? '' : 'none';

      // O
      L.O.setAttribute('transform', letterT('o', f.o));
      L.O.style.display = f.o.vis ? '' : 'none';

      // Storefront
      if (f.store.vis) {
        L.store.style.display = '';
        L.storeIn.setAttribute('transform', objT(f.store, ...pivot.q));
      } else {
        L.store.style.display = 'none';
      }

      // Ticket
      if (f.ticket.vis) {
        L.ticket.style.display = '';
        L.ticketIn.setAttribute('transform', objT(f.ticket, ...pivot.g));
      } else {
        L.ticket.style.display = 'none';
      }

      // Clock
      if (f.clock.vis) {
        L.clock.style.display = '';
        L.clockIn.setAttribute('transform', objT(f.clock, ...pivot.o));
        if (f.clock.min !== undefined) {
          L.min.setAttribute('transform', `rotate(${f.clock.min})`);
        }
        if (f.clock.hour !== undefined) {
          L.hour.setAttribute('transform', `rotate(${f.clock.hour})`);
        }
      } else {
        L.clock.style.display = 'none';
      }
    }

    function paint(displayedTime: number) {
      const f = computeIntroFrame(
        displayedTime,
        variant === 'off' ? 'reduced' : (variant as Exclude<IntroVariant, 'off'>),
      );
      curFrame = f;

      // Determine base layer and active reveal
      let base: { bg: string; fg: string } = { bg: P.red, fg: P.cream };
      let activeReveal: (typeof REVEALS)[number] | null = null;
      let wipeR = 0;

      for (const r of REVEALS) {
        if (displayedTime >= r.start + r.dur) {
          base = { bg: r.bg, fg: r.fg };
        } else if (displayedTime >= r.start) {
          activeReveal = r;
          // wipe easing already baked into the frame values; compute raw progress for radius
          const raw = Math.max(0, Math.min(1, (displayedTime - r.start) / r.dur));
          // Use the wipe cubic-bezier: bez(0.76, 0, 0.24, 1) — we need the numeric value
          wipeR = f.blackReveal   // already wipe-eased in frame for black
            ?? f.redReveal
            ?? f.whiteReveal;
          // Pick the correct wipe value from frame
          if (r.bg === P.black)  wipeR = f.blackReveal;
          else if (r.bg === P.red)   wipeR = f.redReveal;
          else if (r.bg === P.white) wipeR = f.whiteReveal;
          else wipeR = raw;
        }
      }

      setLayer(layerEls[0], base, f);

      if (activeReveal) {
        const [ox, oy] = activeReveal.originKey === 'centre'
          ? [W / 2, H / 2]
          : pivotScreen(activeReveal.originKey === 'g' ? 'g' : 'o');
        const R = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
        setLayer(layerEls[1], { bg: activeReveal.bg, fg: activeReveal.fg }, f);
        layerEls[1].el.style.display = '';
        layerEls[1].el.style.clipPath = `circle(${(R * wipeR).toFixed(1)}px at ${ox.toFixed(1)}px ${oy.toFixed(1)}px)`;
      } else {
        layerEls[1].el.style.display = 'none';
      }

      tag.style.opacity   = String(f.tagOpacity);
      tag.style.transform = `translateY(${(f.tagY * sf * 3).toFixed(2)}px)`;

      if (themeMeta) {
        themeMeta.content = variant === 'full' ? base.bg : P.white;
      }
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let animationFrame = 0;
    let exitTimer      = 0;
    let startedAt      = performance.now();
    let exiting        = false;
    let forceFinal     = false;

    const searchParams = new URLSearchParams(window.location.search);
    const hasDebugFlag = searchParams.get('introDebug') === '1';
    const frozen = (import.meta.env.DEV && hasDebugFlag) ? searchParams.get('t') : null;
    const frozenTime = frozen && Number.isFinite(Number(frozen)) ? Math.max(0, Number(frozen)) : null;
    const minimum    = variant === 'full' ? introTimeline.duration.full
                     : variant === 'short' ? introTimeline.duration.short
                     : introTimeline.duration.reduced;
    const exitDuration = variant === 'full' ? introTimeline.duration.exit : 300;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    };

    const beginExit = () => {
      if (exiting) return;
      exiting = true;
      stageRef.current?.classList.add('qgo-intro--exiting');
      window.clearTimeout(exitTimer);
      exitTimer = window.setTimeout(finish, exitDuration);
    };

    // Hard fallback: intro must always exit within timeout
    exitTimer = window.setTimeout(beginExit, introTimeline.duration.timeout);

    const skip = () => {
      if (elapsedRef.current < 400 || exiting) return;
      forceFinal = true;
      beginExit();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        skip();
      }
    };

    const tick = (now: number) => {
      const elapsed       = frozenTime ?? now - startedAt;
      elapsedRef.current  = elapsed;
      const displayedTime = forceFinal
        ? introTimeline.duration.full
        : Math.min(elapsed, introTimeline.duration.full);
      paint(displayedTime);

      if (frozenTime === null) {
        if (
          elapsed >= introTimeline.duration.timeout ||
          (readyRef.current && (elapsed >= minimum || forceFinal))
        ) beginExit();
        if (!exiting) animationFrame = window.requestAnimationFrame(tick);
      }
    };

    // Paint initial frame before first RAF to prevent flash
    paint(0);

    window.addEventListener('keydown', onKeyDown);
    stageRef.current?.addEventListener('pointerup', skip);
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(exitTimer);
      window.removeEventListener('keydown', onKeyDown);
      stageRef.current?.removeEventListener('pointerup', skip);
      document.body.classList.remove('qgo-intro-active');
      delete document.documentElement.dataset.qgoIntroBackground;
      delete document.documentElement.dataset.qgoIntroThemeRestore;
      if (themeMeta && previousThemeColor) themeMeta.content = previousThemeColor;
      // Clean up DOM built by this effect
      while (stage.firstChild) stage.removeChild(stage.firstChild);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone, variant]);

  if (variant === 'off') return null;

  return (
    <div
      ref={stageRef}
      className="qgo-intro"
      role="status"
      aria-label="Loading QGo. Press Enter, Space, or Escape to skip after a moment."
    >
      <p
        ref={tagRef}
        className="qgo-intro__tagline"
        style={{ opacity: 0 }}
      >
        {introTimeline.taglines[0]}
      </p>
      <span className="qgo-intro__sr-only">Loading QGo</span>
    </div>
  );
};
