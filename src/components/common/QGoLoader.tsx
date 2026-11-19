import React, { useEffect, useRef, useState, useId } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface QGoLoaderProps {
  /**
   * 'fullscreen': Fixed 100dvh overlay with safe-area insets (for page transitions, initial auth/session restoration, app reload)
   * 'container': Relative inline container (for section refreshes, venue lists, booking history)
   */
  variant?: 'fullscreen' | 'container';
  /** Optional custom text label underneath loader. If omitted, uses animated brand status cycle */
  text?: string;
  /** Whether to show colored brand background in container mode (default true) */
  showBackground?: boolean;
  /** Minimum container height for inline mode (default 280px) */
  minHeight?: string | number;
  /** Milliseconds delay before loader appears to prevent flickering on fast sub-120ms fetches (default 120ms) */
  debounceMs?: number;
  /** Optional boolean to control visibility with automatic debounce and fade-out */
  loading?: boolean;
  /** Additional custom classNames */
  className?: string;
}

// Color and timing constants from official QGo Loader specification
const L = 4400; // Loop duration in ms (4.4s 60fps seamless loop)
const N = 5; // 5 coupon chips
const GO = 3000;
const X = (s: number) => 110 + s * 100;
const Y = 345;
const SP = (i: number) => 60 + i * 120;
const T = (n: number) => 1450 + n * 300;
const pad = (n: number) => String(n).padStart(2, '0');

const CH: Array<[string, string, string]> = [
  ['#FF9F1C', '#171717', 'rgba(23,23,23,.35)'],
  ['#FFE9D6', '#E8342A', 'rgba(23,23,23,.3)'],
  ['#FFFFFF', '#171717', 'rgba(23,23,23,.3)'],
  ['#16845B', '#FFFFFF', 'rgba(255,233,214,.6)'],
  ['#E8342A', '#FFE9D6', '#FFE9D6'],
];

const R = [
  { a: 850, d: 450, bg: '#0B0B0B', fg: '#FFE9D6', o: [440, 137] },
  { a: 2050, d: 450, bg: '#E8342A', fg: '#FFE9D6', o: [659, 163] },
  { a: 3000, d: 500, bg: 'F', o: [367, 139] },
  { a: 4000, d: 400, bg: '#E8342A', fg: '#FFE9D6', o: [367, 139] },
];

const K = [
  [0, 1.14],
  [850, 1.08],
  [2050, 1.04],
  [3000, 1],
];

// Easing helpers
const C = (a: number, b: number, p: number) => a + (b - a) * p;
const cl = (x: number) => Math.max(0, Math.min(1, x));
const pg = (t: number, a: number, d: number) => cl((t - a) / d);
const oc = (x: number) => 1 - Math.pow(1 - x, 3);
const ic = (x: number) => x * x * x;
const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const bo = (x: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

const lt = (t: number, ea: number, ra: number, rd: number): [number, number] | null => {
  if (t < ea) return [1, 0];
  if (t < ea + 180) {
    const p = ic(pg(t, ea, 180));
    return [1 - p, -25 * p];
  }
  if (t < ra) return null;
  if (t < ra + rd) {
    const p = bo(pg(t, ra, rd));
    return [Math.max(p, 0.0001), -25 * (1 - p)];
  }
  return [1, 0];
};

const lx = (px: number, py: number, s: [number, number], dx: number, dy = 0) =>
  `translate(${dx},${dy}) translate(${px},${py}) rotate(${s[1]}) scale(${s[0]}) translate(${-px},${-py})`;

const ob = (
  t: number,
  ea: number,
  ed: number,
  ca: number,
  cd: number,
  f: { x: number; y: number; s: number; r: number }
) => {
  if (t < ea || t >= ca + cd) return null;
  const u = pg(t, ea, ed);
  const p = bo(u);
  const o = {
    x: f.x * (1 - p),
    y: f.y * (1 - p),
    s: C(f.s, 1, p),
    r: f.r * (1 - p),
    u,
  };
  if (t >= ca) o.s *= Math.max(0, 1 - ic(pg(t, ca, cd)));
  return o;
};

function chipPos(n: number, t: number) {
  const sp = pg(t, SP(n), 360);
  if (sp <= 0) return null;
  const sv = pg(t, T(n), 300);
  if (sv >= 1) return null;

  if (sv > 0) {
    const p = ic(sv);
    return {
      x: C(X(4), 659, p),
      y: C(Y, 215, p) - 30 * Math.sin(Math.PI * p),
      s: 1 - 0.95 * p,
      r: 60 * p,
    };
  }
  if (sp < 1) {
    const p = oc(sp);
    return {
      x: C(228, X(4 - n), p),
      y: C(222, Y, p) - 70 * Math.sin(Math.PI * p),
      s: C(0.3, 1, bo(sp)),
      r: C(-40, 0, oc(sp)),
    };
  }
  let slot = 4 - n;
  for (let m = 0; m < n; m++) slot += io(pg(t, T(m), 300));
  return { x: X(slot), y: Y, s: 1, r: 3 * Math.sin(t / 200 + n * 1.3) };
}

export function QGoLoader({
  variant = 'fullscreen',
  text,
  showBackground = true,
  minHeight,
  debounceMs = 120,
  loading = true,
  className = '',
}: QGoLoaderProps) {
  const { resolvedTheme } = useTheme();
  const rawId = useId();
  const uid = `qgo-${rawId.replace(/:/g, '')}`;

  // Anti-flicker debounce & exit fade
  const [shouldRender, setShouldRender] = useState(() => debounceMs <= 0 && loading);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let fadeTimer: NodeJS.Timeout | null = null;

    if (loading) {
      setIsFadingOut(false);
      if (debounceMs <= 0) {
        setShouldRender(true);
      } else {
        timer = setTimeout(() => {
          setShouldRender(true);
        }, debounceMs);
      }
    } else {
      if (shouldRender) {
        setIsFadingOut(true);
        fadeTimer = setTimeout(() => {
          setShouldRender(false);
          setIsFadingOut(false);
        }, 250);
      } else {
        setShouldRender(false);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [loading, debounceMs, shouldRender]);

  // SVG Element direct refs for 60-120fps GPU loop
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rvcRef = useRef<SVGCircleElement | null>(null);
  const AbRef = useRef<SVGRectElement | null>(null);
  const AuRef = useRef<SVGUseElement | null>(null);
  const BRef = useRef<SVGGElement | null>(null);
  const BbRef = useRef<SVGRectElement | null>(null);
  const BuRef = useRef<SVGUseElement | null>(null);
  const wRef = useRef<SVGGElement | null>(null);
  const qtRef = useRef<SVGPathElement | null>(null);
  const QRef = useRef<SVGGElement | null>(null);
  const GRef = useRef<SVGPathElement | null>(null);
  const ORef = useRef<SVGPathElement | null>(null);
  const rpRef = useRef<SVGCircleElement | null>(null);
  const tkRef = useRef<SVGGElement | null>(null);
  const tnRef = useRef<SVGTextElement | null>(null);
  const ckRef = useRef<SVGGElement | null>(null);
  const arcRef = useRef<SVGCircleElement | null>(null);
  const hhRef = useRef<SVGGElement | null>(null);
  const mhRef = useRef<SVGGElement | null>(null);
  const stRef = useRef<SVGTextElement | null>(null);

  const chipsRefs = useRef<(SVGGElement | null)[]>([]);
  const labelsRefs = useRef<(SVGTextElement | null)[]>([]);

  useEffect(() => {
    if (!shouldRender) return;

    let animId: number;
    let lastK = -1;
    let lastSt = '';
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Theme color resolution
    const isDark =
      resolvedTheme === 'dark' ||
      (typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark'));
    const fin = isDark ? ['#1C1A18', '#FFE9D6'] : ['#FFFFFF', '#0B0B0B'];

    const cr = (c: [string, string]) => [c[0], c[1], c[1], c[1], c[1]];
    const fc = [fin[0], fin[1], '#E8342A', fin[1], '#FF9F1C'];
    const sp = (u: SVGUseElement | null, c: (string | undefined)[]) => {
      if (!u) return;
      u.style.color = c[1] || '';
      u.style.setProperty('--q', c[2] || '');
      u.style.setProperty('--g', c[3] || '');
      u.style.setProperty('--o', c[4] || '');
    };

    const renderFrame = (t: number) => {
      const k = Math.floor(t / L);
      const tt = t - k * L;

      if (k !== lastK) {
        lastK = k;
        labelsRefs.current.forEach((l, n) => {
          if (l) l.textContent = pad(((k * N + n) % 99) + 1);
        });
      }

      let base = cr(['#E8342A', '#FFE9D6']);
      let act: any = null;
      let ap = 0;

      R.forEach((r) => {
        const c = r.bg === 'F' ? fc : cr([r.bg, r.fg]);
        if (tt >= r.a + r.d) base = c;
        else if (tt >= r.a) {
          act = [c, r];
          ap = io(pg(tt, r.a, r.d));
        }
      });

      if (AbRef.current) AbRef.current.setAttribute('fill', base[0]);
      if (containerRef.current && (variant === 'fullscreen' || showBackground)) {
        containerRef.current.style.backgroundColor = base[0];
      }
      sp(AuRef.current, base);

      if (act && BRef.current && BbRef.current && rvcRef.current) {
        BRef.current.style.display = '';
        BbRef.current.setAttribute('fill', act[0][0]);
        sp(BuRef.current, act[0]);
        rvcRef.current.setAttribute('cx', String(act[1].o[0]));
        rvcRef.current.setAttribute('cy', String(act[1].o[1]));
        rvcRef.current.setAttribute('r', String(2300 * ap));
      } else if (BRef.current) {
        BRef.current.style.display = 'none';
      }

      // Wordmark zoom breathing
      let sc = 1;
      if (tt < GO) {
        for (let i = 0; i < K.length - 1; i++) {
          if (tt >= K[i][0] && tt < K[i + 1][0]) {
            sc = C(K[i][1], K[i + 1][1], oc(pg(tt, K[i][0], K[i + 1][0] - K[i][0])));
            break;
          }
        }
      }
      if (wRef.current) {
        wRef.current.setAttribute(
          'transform',
          `translate(367 139) scale(${sc}) translate(-367 -139)`
        );
      }

      // Tail kick & wave
      let kick = 0;
      let fill = 0;
      let hf = 0;
      let pulse = 0;

      for (let i = 0; i < N; i++) {
        kick = Math.max(kick, Math.sin(Math.PI * pg(tt, SP(i), 170)));
        fill += oc(pg(tt, T(i) + 280, 240)) / N;
        hf += bo(pg(tt, T(i) + 280, 240)) / N;
        pulse += Math.sin(Math.PI * pg(tt, T(i) + 280, 200));
      }

      if (qtRef.current) {
        qtRef.current.setAttribute(
          'transform',
          `translate(${kick * 5},${kick * 5})`
        );
      }

      const wv = (i: number) => -12 * Math.sin(Math.PI * pg(tt, 60 + i * 90, 320));
      if (QRef.current) {
        QRef.current.setAttribute('transform', `translate(0,${wv(0)})`);
      }

      const g = lt(tt, 800, 3050, 250);
      const o = lt(tt, 950, 3080, 220);
      const gd = 16 * Math.sin(Math.PI * oc(pg(tt, 3300, 420)));

      if (GRef.current) {
        GRef.current.style.display = g ? '' : 'none';
        if (g) GRef.current.setAttribute('transform', lx(440, 137, g, gd, wv(1)));
      }
      if (ORef.current) {
        ORef.current.style.display = o ? '' : 'none';
        if (o) ORef.current.setAttribute('transform', lx(659, 163, o, 0, wv(2)));
      }

      const tk = ob(tt, 900, 400, GO, 150, { x: 0, y: -150, s: 0.4, r: -14 });
      const ck = ob(tt, 1050, 350, GO, 120, { x: 170, y: 0, s: 0.4, r: 90 });

      if (tkRef.current) {
        tkRef.current.style.display = tk ? '' : 'none';
        if (tk) {
          tkRef.current.setAttribute(
            'transform',
            `translate(${440 + tk.x},${137 + tk.y}) rotate(${
              tk.r + 3 * Math.sin(4 * Math.PI * tk.u) * (1 - tk.u)
            }) scale(${tk.s})`
          );
          const idx = Math.max(0, Math.min(N - 1, Math.floor((tt - T(0)) / 300)));
          const fu = idx > 0 ? pg(tt, T(0) + idx * 300, 260) : 1;
          const sy = Math.max(Math.abs(Math.cos(Math.PI * fu)), 0.02);
          if (tnRef.current) {
            tnRef.current.setAttribute(
              'transform',
              `translate(-16 -2) scale(1,${sy}) translate(16 2)`
            );
            tnRef.current.textContent = pad(
              ((k * N + (fu < 0.5 ? idx - 1 : idx)) % 99) + 1
            );
          }
        }
      }

      if (ckRef.current) {
        ckRef.current.style.display = ck ? '' : 'none';
        if (ck) {
          ckRef.current.setAttribute(
            'transform',
            `translate(${659 + ck.x},${163 + ck.y}) rotate(${ck.r}) scale(${
              ck.s * (1 + 0.06 * Math.min(pulse, 1))
            })`
          );
          if (mhRef.current) mhRef.current.setAttribute('transform', `rotate(${360 * hf})`);
          if (hhRef.current) hhRef.current.setAttribute('transform', `rotate(${30 * hf})`);
          if (arcRef.current) arcRef.current.setAttribute('stroke-dasharray', `${(fill * 100).toFixed(2)} 100`);
        }
      }

      // Coupons flying across
      chipsRefs.current.forEach((el, n) => {
        if (!el) return;
        const c = chipPos(n, tt);
        if (!c) {
          el.style.display = 'none';
          return;
        }
        el.style.display = '';
        el.setAttribute(
          'transform',
          `translate(${c.x.toFixed(1)},${c.y.toFixed(1)}) rotate(${c.r.toFixed(
            1
          )}) scale(${(c.s * 1.7).toFixed(3)})`
        );
      });

      // Target ring pulse
      if (rpRef.current) {
        const ai = Math.floor((tt - T(0) - 280) / 300);
        const ru = ai >= 0 && ai < N && ck ? pg(tt, T(0) + ai * 300 + 280, 520) : 0;
        rpRef.current.setAttribute('r', String(C(90, 170, oc(ru))));
        rpRef.current.setAttribute(
          'opacity',
          String(ru > 0 && ru < 1 ? 0.4 * (1 - ru) : 0)
        );
      }

      // Status text
      if (stRef.current) {
        const go = tt >= GO;
        const idx = Math.max(0, Math.min(N - 1, Math.floor((tt - T(0)) / 300)));
        const defaultStatus =
          tt < T(0)
            ? 'TAKING YOUR TOKEN…'
            : !go
            ? `NOW SERVING ${pad(((k * N + idx) % 99) + 1)}  ·  ${Math.round(
                fill * 100
              )}%`
            : 'GO!';
        const currentSt = text ? text.toUpperCase() : defaultStatus;

        if (currentSt !== lastSt) {
          lastSt = currentSt;
          stRef.current.textContent = currentSt;
          stRef.current.setAttribute('font-size', go && !text ? '44' : '22');
          stRef.current.setAttribute('font-weight', go && !text ? '800' : '700');
          stRef.current.setAttribute('letter-spacing', go && !text ? '8' : '5');
          stRef.current.setAttribute('fill', go && !text ? '#E8342A' : 'currentColor');
          stRef.current.setAttribute('fill-opacity', go && !text ? '1' : '0.85');
        }

        stRef.current.setAttribute(
          'transform',
          `translate(367 414) scale(${
            go && !text ? Math.max(bo(pg(tt, GO, 380)), 0.001) : 1
          }) translate(-367 -414)`
        );
      }
    };

    if (prefersReduced) {
      renderFrame(3600);
      if (stRef.current) stRef.current.textContent = text ? text.toUpperCase() : 'LOADING…';
    } else {
      const t0 = performance.now();
      const loop = (n: number) => {
        renderFrame(n - t0);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [shouldRender, resolvedTheme, text]);

  if (!shouldRender) return null;

  const isFullscreen = variant === 'fullscreen';

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-label={text || 'Loading QGo...'}
      className={`transition-opacity duration-250 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden w-full h-[100dvh]'
          : `relative w-full flex flex-col items-center justify-center overflow-hidden ${
              showBackground ? 'bg-[#E8342A] rounded-2xl shadow-sm my-3 p-6 sm:p-8' : 'p-4'
            }`
      } ${className}`}
      style={{
        backgroundColor: isFullscreen ? '#E8342A' : showBackground ? '#E8342A' : undefined,
        paddingTop: isFullscreen ? 'env(safe-area-inset-top, 0px)' : undefined,
        paddingBottom: isFullscreen ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        paddingLeft: isFullscreen ? 'env(safe-area-inset-left, 0px)' : undefined,
        paddingRight: isFullscreen ? 'env(safe-area-inset-right, 0px)' : undefined,
        minHeight: isFullscreen ? '100dvh' : minHeight || '260px',
      }}
    >
      <div className="w-full flex flex-col items-center justify-center">
        <svg
          viewBox="-16 -10 772 450"
          role="img"
          aria-label={text || 'QGo is loading'}
          shapeRendering="geometricPrecision"
          className="w-full h-auto overflow-visible select-none pointer-events-none max-w-[340px] xs:max-w-[390px] sm:max-w-[480px] md:max-w-[560px] lg:max-w-[640px] xl:max-w-[680px]"
          style={{
            filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.18))',
          }}
        >
          <defs>
            <clipPath id={`${uid}-rv`}>
              <circle ref={rvcRef} cx="0" cy="0" r="0" />
            </clipPath>
            <path
              id={`${uid}-cp`}
              d="M-23,-15H23V-5A5,5 0 0 0 23,5V15H-23V5A5,5 0 0 0 -23,-5Z"
            />
            <filter id={`${uid}-sh`} x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#000" floodOpacity="0.28" />
            </filter>

            <g id={`${uid}-c`}>
              <g ref={wRef}>
                <g fillRule="evenodd">
                  <g ref={QRef} fill="var(--q)">
                    <path d="M115.50,265.40C89.09,260.44 62.23,245.63 43.22,225.55C8.68,189.06 -1.42,137.47 16.96,91.41C51.41,5.11 163.48,-19.84 231.08,43.75C256.48,67.65 271.98,103.21 272.00,137.62C272.00,151.97 268.24,173.00 265.67,173.00C264.99,173.00 254.11,168.39 241.51,162.75L218.60,152.50L218.44,138.50C218.26,123.62 217.07,117.85 211.71,105.83C201.96,83.99 179.77,66.12 156.20,61.12C149.37,59.68 130.63,59.68 123.80,61.12C96.06,67.01 73.24,87.73 64.46,115.00C60.64,126.87 60.35,145.53 63.80,157.44C70.27,179.80 85.38,197.66 106.08,207.44C118.56,213.34 124.53,214.51 141.65,214.43L156.80,214.36L158.88,218.93C160.01,221.44 164.75,231.83 169.40,242.00C174.06,252.19 177.48,260.89 177.01,261.37C172.65,265.84 132.05,268.50 115.50,265.40Z" />
                    <path
                      ref={qtRef}
                      d="M206.17,268.40C199.35,265.00 197.67,262.56 189.03,243.50C185.04,234.70 179.18,221.88 176.01,215.00C165.22,191.58 164.00,188.37 164.00,183.45C164.00,169.27 173.12,160.02 187.13,160.01C192.25,160.00 191.64,159.77 219.00,171.75C229.73,176.44 245.02,183.13 253.00,186.62C269.59,193.87 272.98,196.70 275.51,205.38C277.17,211.11 276.86,215.72 274.42,221.50C272.34,226.39 231.86,266.10 226.26,268.74C219.67,271.83 212.83,271.72 206.17,268.40Z"
                    />
                  </g>
                  <path
                    ref={GRef}
                    fill="var(--g)"
                    d="M425.50,263.90C396.47,260.87 370.37,248.30 348.89,227.01C330.01,208.29 319.12,188.34 313.38,161.96C310.89,150.52 310.83,124.93 313.27,113.44C325.50,55.88 371.63,14.55 430.06,8.83C486.94,3.27 543.74,39.01 560.92,91.20C563.17,98.01 562.83,101.08 559.60,103.23C558.27,104.13 497.84,104.26 495.54,103.38C494.65,103.03 492.97,100.90 491.81,98.63C486.84,88.88 472.36,78.27 458.00,73.86C448.48,70.93 431.89,70.71 422.16,73.37C372.31,87.00 356.05,147.26 392.44,183.53C411.64,202.66 437.59,208.08 463.37,198.33C470.50,195.64 482.50,187.41 482.50,185.22C482.50,184.53 473.39,174.56 462.25,163.06C445.30,145.56 442.00,141.68 442.00,139.24C442.00,132.67 439.67,132.91 503.09,132.92C557.62,132.93 560.56,133.02 562.97,134.81C567.78,138.38 567.88,139.71 567.94,200.12C568.00,255.92 567.97,256.77 565.93,259.37C564.38,261.34 562.93,262.01 560.18,262.04C556.72,262.08 555.61,261.15 541.89,246.87L527.28,231.65L518.39,238.34C491.59,258.51 459.20,267.42 425.50,263.90Z"
                  />
                  <path
                    ref={ORef}
                    fill="var(--o)"
                    d="M644.50,229.91C641.75,229.36 634.80,226.64 629.05,223.85C611.98,215.55 599.24,200.65 593.35,182.07C591.17,175.21 590.46,158.27 592.03,150.78C597.30,125.68 615.21,105.74 640.00,97.36C644.39,95.88 648.43,95.51 660.00,95.54C673.98,95.57 674.79,95.69 682.64,98.82C705.76,108.03 721.63,126.39 726.09,149.08C727.99,158.70 726.81,176.03 723.64,185.33C716.63,205.84 701.76,220.47 680.02,228.24C673.56,230.55 652.68,231.53 644.50,229.91ZM671.94,192.88C693.44,183.48 698.41,155.69 681.40,140.02C674.33,133.50 669.06,131.50 659.00,131.53C651.26,131.55 649.93,131.86 644.17,134.96C629.93,142.62 623.41,159.12 628.61,174.36C630.40,179.62 638.54,189.18 643.40,191.73C651.89,196.19 663.34,196.65 671.94,192.88Z"
                  />
                </g>
                <circle
                  ref={rpRef}
                  cx="659"
                  cy="163"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  opacity="0"
                />
                <g ref={tkRef} style={{ display: 'none' }} filter={`url(#${uid}-sh)`}>
                  <path
                    d="M-92,-70H92Q110,-70 110,-52V-20A20,20 0 0 0 110,20V52Q110,70 92,70H-92Q-110,70 -110,52V20A20,20 0 0 0 -110,-20V-52Q-110,-70 -92,-70Z"
                    fill="#FFE9D6"
                    stroke="#FF9F1C"
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M82,-46V46"
                    stroke="#E8342A"
                    strokeWidth="5"
                    strokeDasharray="2 12"
                    strokeLinecap="round"
                  />
                  <text
                    ref={tnRef}
                    x="-16"
                    y="28"
                    textAnchor="middle"
                    fontSize="82"
                    fontWeight="800"
                    fill="#E8342A"
                    fontFamily="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
                  >
                    01
                  </text>
                </g>
                <g ref={ckRef} style={{ display: 'none' }} filter={`url(#${uid}-sh)`}>
                  <circle r="100" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="9" />
                  <circle
                    ref={arcRef}
                    r="100"
                    fill="none"
                    stroke="#FF9F1C"
                    strokeWidth="9"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="0 100"
                    transform="rotate(-90)"
                  />
                  <circle r="84" fill="#FFE9D6" />
                  <circle r="68" fill="#FFFBF5" />
                  <line x1="0" y1="-52" x2="0" y2="-64" stroke="#333" strokeWidth="6" strokeLinecap="round" />
                  <line x1="29" y1="-50.2" x2="32" y2="-55.4" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="50.2" y1="-29" x2="55.4" y2="-32" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="52" y1="0" x2="64" y2="0" stroke="#333" strokeWidth="6" strokeLinecap="round" />
                  <line x1="50.2" y1="29" x2="55.4" y2="32" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="29" y1="50.2" x2="32" y2="55.4" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="0" y1="52" x2="0" y2="64" stroke="#333" strokeWidth="6" strokeLinecap="round" />
                  <line x1="-29" y1="50.2" x2="-32" y2="55.4" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="-50.2" y1="29" x2="-55.4" y2="32" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="-52" y1="0" x2="-64" y2="0" stroke="#333" strokeWidth="6" strokeLinecap="round" />
                  <line x1="-50.2" y1="-29" x2="-55.4" y2="-32" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <line x1="-29" y1="-50.2" x2="-32" y2="-55.4" stroke="#333" strokeWidth="4" strokeLinecap="round" />
                  <g ref={hhRef}>
                    <line y1="6" y2="-36" stroke="#0B0B0B" strokeWidth="9" strokeLinecap="round" />
                  </g>
                  <g ref={mhRef}>
                    <line y1="8" y2="-54" stroke="#0B0B0B" strokeWidth="6" strokeLinecap="round" />
                  </g>
                  <circle r="8" fill="#E8342A" />
                </g>
                <g id={`${uid}-chips`}>
                  {CH.map((c, i) => (
                    <g
                      key={i}
                      ref={(el) => {
                        chipsRefs.current[i] = el;
                      }}
                      filter={`url(#${uid}-sh)`}
                      style={{ display: 'none' }}
                    >
                      <use
                        href={`#${uid}-cp`}
                        fill={c[0]}
                        stroke={c[2]}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      <text
                        ref={(el) => {
                          labelsRefs.current[i] = el;
                        }}
                        y="5.5"
                        textAnchor="middle"
                        fontSize="16"
                        fontWeight="800"
                        fill={c[1]}
                        fontFamily="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
                      >
                        01
                      </text>
                    </g>
                  ))}
                </g>
              </g>
              <text
                ref={stRef}
                x="367"
                y="426"
                textAnchor="middle"
                fontFamily="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
                fill="currentColor"
              />
            </g>
          </defs>

          {/* Layer A (Base) */}
          <g>
            <rect ref={AbRef} x="-3000" y="-3000" width="6000" height="6000" fill="#E8342A" />
            <use ref={AuRef} href={`#${uid}-c`} style={{ color: '#FFE9D6' }} />
          </g>

          {/* Layer B (Circle Expansion Reveal) */}
          <g ref={BRef} clipPath={`url(#${uid}-rv)`} style={{ display: 'none' }}>
            <rect ref={BbRef} x="-3000" y="-3000" width="6000" height="6000" fill="#0B0B0B" />
            <use ref={BuRef} href={`#${uid}-c`} />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default QGoLoader;
