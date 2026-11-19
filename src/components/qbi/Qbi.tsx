import React from 'react';
import './qbi.css';
import {
  QBI_BODY,
  QBI_INK,
  QBI_BLUSH,
  QBI_MOUTH,
  QBI_SPARK,
  QBI_DROP,
  QBI_NAME,
  QbiMood,
} from './qbiTheme';

export interface QbiProps {
  mood?: QbiMood;
  size?: number;
  color?: string;
  animate?: boolean;
  className?: string;
  title?: string;
}

const BODY =
  'M45 250 C45 150 95 95 150 95 C205 95 255 150 255 250 C255 275 235 290 210 290 L90 290 C65 290 45 275 45 250 Z';

export const Qbi: React.FC<QbiProps> = ({
  mood = 'happy',
  size = 120,
  color = QBI_BODY,
  animate = true,
  className,
  title,
}) => {
  // Normalize mood aliases: waiting -> happy (always awake), hello -> happy, booked -> excited, oops -> sad
  const effectiveMood: 'happy' | 'sad' | 'excited' | 'thinking' =
    mood === 'excited' || mood === 'booked'
      ? 'excited'
      : mood === 'sad' || mood === 'oops'
      ? 'sad'
      : mood === 'thinking'
      ? 'thinking'
      : 'happy';

  return (
    <svg
      viewBox="0 0 300 300"
      width={size}
      height={size}
      role="img"
      aria-label={title || `${QBI_NAME} - ${mood}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <g className={animate ? `qbi-anim qbi-anim--${effectiveMood}` : undefined}>
        {/* ================= 1. HAPPY (Default Awake & Cheerful) ================= */}
        {effectiveMood === 'happy' && (
          <>
            <rect
              className={animate ? 'qbi-ear-l' : undefined}
              x="112"
              y="30"
              width="30"
              height="95"
              rx="15"
              fill={color}
              transform="rotate(-8 127 125)"
            />
            <rect
              className={animate ? 'qbi-ear-r' : undefined}
              x="158"
              y="34"
              width="30"
              height="92"
              rx="15"
              fill={color}
              transform="rotate(8 173 126)"
            />
            <path d={BODY} fill={color} />
            <g className={animate ? 'qbi-eyes' : undefined}>
              <circle cx="115" cy="192" r="9" fill={QBI_INK} />
              <circle cx="118" cy="189" r="3" fill="#FFFFFF" />
              <circle cx="185" cy="192" r="9" fill={QBI_INK} />
              <circle cx="188" cy="189" r="3" fill="#FFFFFF" />
            </g>
            <path
              d="M136 218 Q150 234 164 218"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <ellipse cx="86" cy="220" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
            <ellipse cx="214" cy="220" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
          </>
        )}

        {/* ================= 2. SAD (Concerned / Empathetic Frown) ================= */}
        {effectiveMood === 'sad' && (
          <>
            <rect
              className={animate ? 'qbi-ear-l' : undefined}
              x="112"
              y="44"
              width="30"
              height="80"
              rx="15"
              fill={color}
              transform="rotate(-22 127 125)"
            />
            <rect
              className={animate ? 'qbi-ear-r' : undefined}
              x="158"
              y="48"
              width="30"
              height="78"
              rx="15"
              fill={color}
              transform="rotate(22 173 126)"
            />
            <path d={BODY} fill={color} />
            {/* Angled concerned brows */}
            <path
              d="M104 176 L124 182"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M196 176 L176 182"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Downcast glossy eyes */}
            <g className={animate ? 'qbi-eyes' : undefined}>
              <circle cx="115" cy="194" r="8.5" fill={QBI_INK} />
              <circle cx="113" cy="196" r="3" fill="#FFFFFF" />
              <circle cx="185" cy="194" r="8.5" fill={QBI_INK} />
              <circle cx="183" cy="196" r="3" fill="#FFFFFF" />
            </g>
            {/* Empathetic small frown */}
            <path
              d="M138 230 Q150 220 162 230"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <ellipse cx="86" cy="220" rx="14" ry="8" fill={QBI_BLUSH} opacity="0.6" />
            <ellipse cx="214" cy="220" rx="14" ry="8" fill={QBI_BLUSH} opacity="0.6" />
          </>
        )}

        {/* ================= 3. EXCITED (Alert / Sparkle Eyes / Joyful Smile) ================= */}
        {effectiveMood === 'excited' && (
          <>
            <path
              className={animate ? 'qbi-sparkle' : undefined}
              d="M40 70 L45 84 L59 89 L45 94 L40 108 L35 94 L21 89 L35 84 Z"
              fill={QBI_SPARK}
            />
            <path
              className={animate ? 'qbi-sparkle' : undefined}
              d="M262 60 L266 71 L277 75 L266 79 L262 90 L258 79 L247 75 L258 71 Z"
              fill={QBI_SPARK}
            />
            <rect
              className={animate ? 'qbi-ear-l' : undefined}
              x="112"
              y="28"
              width="30"
              height="98"
              rx="15"
              fill={color}
              transform="rotate(-10 127 125)"
            />
            <rect
              className={animate ? 'qbi-ear-r' : undefined}
              x="158"
              y="32"
              width="30"
              height="95"
              rx="15"
              fill={color}
              transform="rotate(10 173 126)"
            />
            <path d={BODY} fill={color} />
            {/* Raised excited brows */}
            <path
              d="M102 172 Q115 166 128 172"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M172 172 Q185 166 198 172"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Star sparkle glint eyes */}
            <g className={animate ? 'qbi-eyes' : undefined}>
              <circle cx="115" cy="190" r="10.5" fill={QBI_INK} />
              <polygon
                points="115,183 117,188 122,190 117,192 115,197 113,192 108,190 113,188"
                fill="#FFFFFF"
              />
              <circle cx="185" cy="190" r="10.5" fill={QBI_INK} />
              <polygon
                points="185,183 187,188 192,190 187,192 185,197 183,192 178,190 183,188"
                fill="#FFFFFF"
              />
            </g>
            {/* Joyful open smile */}
            <path
              d="M128 212 Q150 244 172 212 Z"
              fill={QBI_MOUTH}
              stroke={QBI_INK}
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <ellipse cx="86" cy="214" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.9" />
            <ellipse cx="214" cy="214" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.9" />
          </>
        )}

        {/* ================= 4. THINKING (Scanning Pupils / Cocked Ear) ================= */}
        {effectiveMood === 'thinking' && (
          <>
            <rect
              className={animate ? 'qbi-ear-l' : undefined}
              x="112"
              y="34"
              width="30"
              height="92"
              rx="15"
              fill={color}
              transform="rotate(-24 127 125)"
            />
            <rect
              className={animate ? 'qbi-ear-r' : undefined}
              x="158"
              y="32"
              width="30"
              height="95"
              rx="15"
              fill={color}
              transform="rotate(6 173 126)"
            />
            <path d={BODY} fill={color} />
            {/* Inquiring brows */}
            <path
              d="M102 170 Q116 162 128 170"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M172 178 Q186 178 198 178"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Eye whites with scanning glancing pupils */}
            <g>
              <ellipse
                cx="115"
                cy="192"
                rx="9.5"
                ry="10.5"
                fill="#FFFFFF"
                stroke={QBI_INK}
                strokeWidth="3"
              />
              <circle
                className={animate ? 'qbi-thinking-pupil' : undefined}
                cx="117"
                cy="191"
                r="5.5"
                fill={QBI_INK}
              />
              <circle cx="119" cy="189" r="1.8" fill="#FFFFFF" />

              <ellipse
                cx="185"
                cy="192"
                rx="9.5"
                ry="10.5"
                fill="#FFFFFF"
                stroke={QBI_INK}
                strokeWidth="3"
              />
              <circle
                className={animate ? 'qbi-thinking-pupil' : undefined}
                cx="187"
                cy="191"
                r="5.5"
                fill={QBI_INK}
              />
              <circle cx="189" cy="189" r="1.8" fill="#FFFFFF" />
            </g>
            {/* Thoughtful side mouth */}
            <ellipse
              cx="154"
              cy="222"
              rx="6"
              ry="4"
              fill={QBI_MOUTH}
              stroke={QBI_INK}
              strokeWidth="4"
            />
            <ellipse cx="86" cy="220" rx="14" ry="8" fill={QBI_BLUSH} opacity="0.6" />
            <ellipse cx="214" cy="220" rx="14" ry="8" fill={QBI_BLUSH} opacity="0.6" />
          </>
        )}
      </g>
    </svg>
  );
};

export const Qbe = Qbi;
