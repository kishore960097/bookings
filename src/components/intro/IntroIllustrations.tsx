import React from 'react';
import type { LetterState, ObjState } from './introTimeline';

// ─── QGo Wordmark with Independent Letter Transforms ────────────────────────
export interface QGoWordmarkProps {
  color?: string;
  qState?: LetterState;
  gState?: LetterState;
  oState?: LetterState;
  tailNudge?: number;
  gNudge?: number;
  className?: string;
}

export const QGoWordmark: React.FC<QGoWordmarkProps> = ({
  color = 'currentColor',
  qState = { vis: 1, sc: 1, rot: 0 },
  gState = { vis: 1, sc: 1, rot: 0 },
  oState = { vis: 1, sc: 1, rot: 0 },
  tailNudge = 0,
  gNudge = 0,
  className,
}) => {
  return (
    <svg
      viewBox="0 0 734 278"
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        color,
        overflow: 'visible',
      }}
      shapeRendering="geometricPrecision"
      role="img"
      aria-label="QGo Logo"
    >
      <g fill="currentColor" fillRule="evenodd">
        {/* Letter Q: Pivot at (140, 137) */}
        <g
          id="qgo-q"
          style={{
            display: qState.vis === 1 ? 'block' : 'none',
            transform: `translate(140px, 137px) rotate(${qState.rot}deg) scale(${qState.sc}) translate(-140px, -137px)`,
            transformOrigin: '140px 137px',
          }}
        >
          {/* Q Tail Accent (receives signature +8px horizontal spring nudge) */}
          <path
            id="qgo-q-tail"
            style={{
              transform: `translate(${tailNudge}px, 0px)`,
              transformOrigin: '206px 268px',
            }}
            d="M206.17,268.40C199.35,265.00 197.67,262.56 189.03,243.50C185.04,234.70 179.18,221.88 176.01,215.00C165.22,191.58 164.00,188.37 164.00,183.45C164.00,169.27 173.12,160.02 187.13,160.01C192.25,160.00 191.64,159.77 219.00,171.75C229.73,176.44 245.02,183.13 253.00,186.62C269.59,193.87 272.98,196.70 275.51,205.38C277.17,211.11 276.86,215.72 274.42,221.50C272.34,226.39 231.86,266.10 226.26,268.74C219.67,271.83 212.83,271.72 206.17,268.40Z"
          />
          {/* Q Main Ring */}
          <path
            id="qgo-q-ring"
            d="M115.50,265.40C89.09,260.44 62.23,245.63 43.22,225.55C8.68,189.06 -1.42,137.47 16.96,91.41C51.41,5.11 163.48,-19.84 231.08,43.75C256.48,67.65 271.98,103.21 272.00,137.62C272.00,151.97 268.24,173.00 265.67,173.00C264.99,173.00 254.11,168.39 241.51,162.75L218.60,152.50L218.44,138.50C218.26,123.62 217.07,117.85 211.71,105.83C201.96,83.99 179.77,66.12 156.20,61.12C149.37,59.68 130.63,59.68 123.80,61.12C96.06,67.01 73.24,87.73 64.46,115.00C60.64,126.87 60.35,145.53 63.80,157.44C70.27,179.80 85.38,197.66 106.08,207.44C118.56,213.34 124.53,214.51 141.65,214.43L156.80,214.36L158.88,218.93C160.01,221.44 164.75,231.83 169.40,242.00C174.06,252.19 177.48,260.89 177.01,261.37C172.65,265.84 132.05,268.50 115.50,265.40Z"
          />
        </g>

        {/* Letter G: Pivot at (440, 137) (receives signature arrow spring nudge) */}
        <g
          id="qgo-g"
          style={{
            display: gState.vis === 1 ? 'block' : 'none',
            transform: `translate(440px, 137px) rotate(${gState.rot}deg) scale(${gState.sc}) translate(-440px, -137px) translate(${gNudge}px, 0px)`,
            transformOrigin: '440px 137px',
          }}
        >
          <path
            d="M425.50,263.90C396.47,260.87 370.37,248.30 348.89,227.01C330.01,208.29 319.12,188.34 313.38,161.96C310.89,150.52 310.83,124.93 313.27,113.44C325.50,55.88 371.63,14.55 430.06,8.83C486.94,3.27 543.74,39.01 560.92,91.20C563.17,98.01 562.83,101.08 559.60,103.23C558.27,104.13 497.84,104.26 495.54,103.38C494.65,103.03 492.97,100.90 491.81,98.63C486.84,88.88 472.36,78.27 458.00,73.86C448.48,70.93 431.89,70.71 422.16,73.37C372.31,87.00 356.05,147.26 392.44,183.53C411.64,202.66 437.59,208.08 463.37,198.33C470.50,195.64 482.50,187.41 482.50,185.22C482.50,184.53 473.39,174.56 462.25,163.06C445.30,145.56 442.00,141.68 442.00,139.24C442.00,132.67 439.67,132.91 503.09,132.92C557.62,132.93 560.56,133.02 562.97,134.81C567.78,138.38 567.88,139.71 567.94,200.12C568.00,255.92 567.97,256.77 565.93,259.37C564.38,261.34 562.93,262.01 560.18,262.04C556.72,262.08 555.61,261.15 541.89,246.87L527.28,231.65L518.39,238.34C491.59,258.51 459.20,267.42 425.50,263.90Z"
          />
        </g>

        {/* Letter o: Pivot at (659, 163) */}
        <g
          id="qgo-o"
          style={{
            display: oState.vis === 1 ? 'block' : 'none',
            transform: `translate(659px, 163px) rotate(${oState.rot}deg) scale(${oState.sc}) translate(-659px, -163px)`,
            transformOrigin: '659px 163px',
          }}
        >
          <path
            d="M644.50,229.91C641.75,229.36 634.80,226.64 629.05,223.85C611.98,215.55 599.24,200.65 593.35,182.07C591.17,175.21 590.46,158.27 592.03,150.78C597.30,125.68 615.21,105.74 640.00,97.36C644.39,95.88 648.43,95.51 660.00,95.54C673.98,95.57 674.79,95.69 682.64,98.82C705.76,108.03 721.63,126.39 726.09,149.08C727.99,158.70 726.81,176.03 723.64,185.33C716.63,205.84 701.76,220.47 680.02,228.24C673.56,230.55 652.68,231.53 644.50,229.91ZM671.94,192.88C693.44,183.48 698.41,155.69 681.40,140.02C674.33,133.50 669.06,131.50 659.00,131.53C651.26,131.55 649.93,131.86 644.17,134.96C629.93,142.62 623.41,159.12 628.61,174.36C630.40,179.62 638.54,189.18 643.40,191.73C651.89,196.19 663.34,196.65 671.94,192.88Z"
          />
        </g>
      </g>
    </svg>
  );
};

// ─── Scene 1: Soft-3D Cream Storefront (Replaces Q at 140, 137) ───────────────
export interface StorefrontIllustrationProps {
  state: ObjState;
}

export const StorefrontIllustration: React.FC<StorefrontIllustrationProps> = ({ state }) => {
  if (!state.vis) return null;

  return (
    <g
      id="intro-storefront"
      style={{
        transform: `translate(140px, 137px) translate(${state.x}px, ${state.y}px) rotate(${state.rot}deg) scale(${state.sc}, ${state.sc * (state.sy ?? 1)}) translate(-140px, -137px)`,
        transformOrigin: '140px 137px',
      }}
    >
      <defs>
        <linearGradient id="storeBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF4E6" />
          <stop offset="100%" stopColor="#F5D2B8" />
        </linearGradient>
        <linearGradient id="doorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#B5221B" />
          <stop offset="100%" stopColor="#871410" />
        </linearGradient>
      </defs>

      {/* Tactile Soft Drop Shadow */}
      <ellipse cx="140" cy="232" rx="86" ry="10" fill="rgba(0,0,0,0.22)" />

      {/* Building Body */}
      <rect
        x="48"
        y="56"
        width="184"
        height="166"
        rx="26"
        fill="url(#storeBodyGrad)"
        stroke="#E2B797"
        strokeWidth="2"
      />

      {/* Roof Overhang / Eave */}
      <rect x="36" y="46" width="208" height="20" rx="10" fill="#A81818" />
      <rect x="40" y="48" width="200" height="6" rx="3" fill="#E8342A" opacity="0.65" />

      {/* Scalloped Red-and-White Striped Awning */}
      <g id="awning-stripes">
        {/* Stripe 1 (Red) */}
        <path d="M 46 66 L 76 66 L 76 108 Q 61 122 46 108 Z" fill="#E8342A" />
        {/* Stripe 2 (Cream) */}
        <path d="M 76 66 L 106 66 L 106 108 Q 91 122 76 108 Z" fill="#FFE9D6" />
        {/* Stripe 3 (Red) */}
        <path d="M 106 66 L 136 66 L 136 108 Q 121 122 106 108 Z" fill="#E8342A" />
        {/* Stripe 4 (Cream) */}
        <path d="M 136 66 L 166 66 L 166 108 Q 151 122 136 108 Z" fill="#FFE9D6" />
        {/* Stripe 5 (Red) */}
        <path d="M 166 66 L 196 66 L 196 108 Q 181 122 166 108 Z" fill="#E8342A" />
        {/* Stripe 6 (Cream) */}
        <path d="M 196 66 L 226 66 L 226 108 Q 211 122 196 108 Z" fill="#FFE9D6" />
      </g>
      {/* Soft shadow cast by awning */}
      <rect x="48" y="114" width="184" height="6" fill="rgba(168,24,24,0.14)" />

      {/* Display Window with Warm Glow */}
      <rect
        x="62"
        y="126"
        width="68"
        height="76"
        rx="14"
        fill="#FFF9EE"
        stroke="#E2B797"
        strokeWidth="2.5"
      />
      {/* Window Mullions */}
      <line x1="96" y1="126" x2="96" y2="202" stroke="#E2B797" strokeWidth="2" opacity="0.7" />
      <line x1="62" y1="164" x2="130" y2="164" stroke="#E2B797" strokeWidth="2" opacity="0.7" />
      {/* Warm Glow reflection */}
      <path d="M 66 130 L 110 130 L 76 198 L 66 198 Z" fill="#FFFFFF" opacity="0.45" />

      {/* Shop Door */}
      <rect
        x="146"
        y="122"
        width="68"
        height="100"
        rx="12"
        fill="url(#doorGrad)"
        stroke="#6E100D"
        strokeWidth="1.5"
      />
      {/* Door Glass Window */}
      <rect
        x="156"
        y="132"
        width="48"
        height="44"
        rx="8"
        fill="#FFE9D6"
        stroke="#8A1814"
        strokeWidth="1.5"
      />
      {/* Door Handle */}
      <circle cx="156" cy="184" r="4" fill="#F8C040" stroke="#C99418" strokeWidth="1" />
    </g>
  );
};

// ─── Scene 2: Tactile Red Perforated Ticket (Replaces G at 440, 137) ──────────
export interface TicketIllustrationProps {
  state: ObjState;
}

export const TicketIllustration: React.FC<TicketIllustrationProps> = ({ state }) => {
  if (!state.vis) return null;

  return (
    <g
      id="intro-ticket"
      style={{
        transform: `translate(440px, 137px) translate(${state.x}px, ${state.y}px) rotate(${state.rot}deg) scale(${state.sc}) translate(-440px, -137px)`,
        transformOrigin: '440px 137px',
      }}
    >
      <defs>
        <linearGradient id="ticketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F2483C" />
          <stop offset="100%" stopColor="#C9241B" />
        </linearGradient>
      </defs>

      {/* Tactile Shadow */}
      <ellipse cx="440" cy="242" rx="76" ry="9" fill="rgba(0,0,0,0.3)" />

      {/* Perforated Ticket Body with Rounded Notches on Sides */}
      <path
        d="M 374 38 L 506 38 A 20 20 0 0 1 526 58 L 526 123 A 14 14 0 0 0 526 151 L 526 216 A 20 20 0 0 1 506 236 L 374 236 A 20 20 0 0 1 354 216 L 354 151 A 14 14 0 0 0 354 123 L 354 58 A 20 20 0 0 1 374 38 Z"
        fill="url(#ticketGrad)"
        stroke="#FFAEA8"
        strokeWidth="1.5"
      />

      {/* Top Header Labels */}
      <text
        x="440"
        y="74"
        textAnchor="middle"
        fill="#FFE9D6"
        fontSize="12.5"
        fontWeight="800"
        fontFamily="Plus Jakarta Sans, Inter, sans-serif"
        letterSpacing="0.12em"
        opacity="0.9"
      >
        QGO • PASS
      </text>
      <text
        x="440"
        y="98"
        textAnchor="middle"
        fill="#FFE9D6"
        fontSize="10.5"
        fontWeight="700"
        fontFamily="Plus Jakarta Sans, Inter, sans-serif"
        letterSpacing="0.08em"
        opacity="0.75"
      >
        NOW SERVING
      </text>

      {/* Horizontal Perforation Dotted Line */}
      <line
        x1="372"
        y1="137"
        x2="508"
        y2="137"
        stroke="#FFE9D6"
        strokeWidth="2.5"
        strokeDasharray="5 5"
        strokeLinecap="round"
        opacity="0.65"
      />

      {/* Large Bold Cream '01' Number */}
      <text
        x="440"
        y="212"
        textAnchor="middle"
        fill="#FFE9D6"
        fontSize="72"
        fontWeight="900"
        fontFamily="Plus Jakarta Sans, Inter, sans-serif"
        letterSpacing="-0.04em"
      >
        01
      </text>
    </g>
  );
};

// ─── Scene 3: Soft-3D Cream Analog Clock (Replaces o at 659, 163) ─────────────
export interface ClockIllustrationProps {
  state: ObjState & { min?: number; hour?: number };
}

export const ClockIllustration: React.FC<ClockIllustrationProps> = ({ state }) => {
  if (!state.vis) return null;

  const minAngle = state.min ?? 0;
  const hourAngle = state.hour ?? 30;

  // 12 hour tick marks
  const hourTicks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const isQuarter = i % 3 === 0;
    const innerR = isQuarter ? 48 : 51;
    const outerR = 56;
    const x1 = 659 + Math.sin(angle) * innerR;
    const y1 = 163 - Math.cos(angle) * innerR;
    const x2 = 659 + Math.sin(angle) * outerR;
    const y2 = 163 - Math.cos(angle) * outerR;
    return {
      id: i,
      x1,
      y1,
      x2,
      y2,
      strokeWidth: isQuarter ? 3.5 : 2,
      stroke: isQuarter ? '#0B0B0B' : '#767676',
    };
  });

  return (
    <g
      id="intro-clock"
      style={{
        transform: `translate(659px, 163px) translate(${state.x}px, ${state.y}px) rotate(${state.rot}deg) scale(${state.sc}) translate(-659px, -163px)`,
        transformOrigin: '659px 163px',
      }}
    >
      <defs>
        <radialGradient id="clockBezelGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFF7EC" />
          <stop offset="70%" stopColor="#FFE0C4" />
          <stop offset="100%" stopColor="#E2BD9C" />
        </radialGradient>
      </defs>

      {/* Tactile Shadow */}
      <ellipse cx="659" cy="236" rx="58" ry="7" fill="rgba(0,0,0,0.2)" />

      {/* Outer Cream Bezel */}
      <circle
        cx="659"
        cy="163"
        r="70"
        fill="url(#clockBezelGrad)"
        stroke="#E5BA97"
        strokeWidth="2"
      />

      {/* Off-White Inner Dial Face */}
      <circle cx="659" cy="163" r="59" fill="#FFFDF8" stroke="#F0D4BB" strokeWidth="1.5" />

      {/* 12 Hour Ticks */}
      {hourTicks.map((tick) => (
        <line
          key={tick.id}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke={tick.stroke}
          strokeWidth={tick.strokeWidth}
          strokeLinecap="round"
        />
      ))}

      {/* Animated Hour Hand (Settle around 30° = 1:00) */}
      <line
        x1="659"
        y1="163"
        x2="659"
        y2="131"
        stroke="#0B0B0B"
        strokeWidth="4.5"
        strokeLinecap="round"
        style={{
          transform: `rotate(${hourAngle}deg)`,
          transformOrigin: '659px 163px',
        }}
      />

      {/* Animated Minute Hand (Sweeps 360°) */}
      <line
        x1="659"
        y1="163"
        x2="659"
        y2="114"
        stroke="#E8342A"
        strokeWidth="3"
        strokeLinecap="round"
        style={{
          transform: `rotate(${minAngle}deg)`,
          transformOrigin: '659px 163px',
        }}
      />

      {/* Center Pin & Cap */}
      <circle cx="659" cy="163" r="5" fill="#E8342A" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="659" cy="163" r="2" fill="#FFE9D6" />
    </g>
  );
};
