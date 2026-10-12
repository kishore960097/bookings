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
  mood = 'hello',
  size = 120,
  color = QBI_BODY,
  animate = true,
  className,
  title,
}) => {
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
      <g className={animate ? `qbi-anim qbi-anim--${mood}` : undefined}>
        {mood === 'hello' && (
          <>
            <rect
              x="112"
              y="30"
              width="30"
              height="95"
              rx="15"
              fill={color}
              transform="rotate(-8 127 125)"
            />
            <rect
              x="158"
              y="34"
              width="30"
              height="92"
              rx="15"
              fill={color}
              transform="rotate(8 173 126)"
            />
            <path d={BODY} fill={color} />
            <path
              d="M100 190 Q115 210 130 190"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M170 190 Q185 210 200 190"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M135 222 Q150 238 165 222"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <ellipse cx="86" cy="222" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
            <ellipse cx="214" cy="222" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
          </>
        )}

        {mood === 'waiting' && (
          <>
            <rect
              x="112"
              y="40"
              width="30"
              height="85"
              rx="15"
              fill={color}
              transform="rotate(-18 127 125)"
            />
            <rect
              x="158"
              y="34"
              width="30"
              height="92"
              rx="15"
              fill={color}
              transform="rotate(6 173 126)"
            />
            <path d={BODY} fill={color} />
            <path
              d="M100 194 H130"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M170 194 H200"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <ellipse
              cx="150"
              cy="226"
              rx="9"
              ry="7"
              fill={QBI_MOUTH}
              stroke={QBI_INK}
              strokeWidth="5"
            />
            <ellipse cx="86" cy="220" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
            <ellipse cx="214" cy="220" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
            <text
              className="qbi-z qbi-z1"
              x="236"
              y="86"
              fontFamily="inherit"
              fontSize="34"
              fontWeight="700"
              fill={QBI_INK}
            >
              z
            </text>
            <text
              className="qbi-z qbi-z2"
              x="258"
              y="58"
              fontFamily="inherit"
              fontSize="26"
              fontWeight="700"
              fill={QBI_INK}
              opacity="0.7"
            >
              z
            </text>
          </>
        )}

        {mood === 'booked' && (
          <>
            <path
              d="M40 70 L45 84 L59 89 L45 94 L40 108 L35 94 L21 89 L35 84 Z"
              fill={QBI_SPARK}
            />
            <path
              d="M262 60 L266 71 L277 75 L266 79 L262 90 L258 79 L247 75 L258 71 Z"
              fill={QBI_SPARK}
            />
            <rect
              x="112"
              y="30"
              width="30"
              height="95"
              rx="15"
              fill={color}
              transform="rotate(-12 127 125)"
            />
            <rect
              x="158"
              y="34"
              width="30"
              height="92"
              rx="15"
              fill={color}
              transform="rotate(12 173 126)"
            />
            <path d={BODY} fill={color} />
            <path
              d="M100 192 Q115 172 130 192"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M170 192 Q185 172 200 192"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M128 212 Q150 244 172 212 Z"
              fill={QBI_MOUTH}
              stroke={QBI_INK}
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <ellipse cx="86" cy="214" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
            <ellipse cx="214" cy="214" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.8" />
          </>
        )}

        {mood === 'oops' && (
          <>
            <rect
              x="112"
              y="44"
              width="30"
              height="80"
              rx="15"
              fill={color}
              transform="rotate(-22 127 125)"
            />
            <rect
              x="158"
              y="48"
              width="30"
              height="78"
              rx="15"
              fill={color}
              transform="rotate(22 173 126)"
            />
            <path d={BODY} fill={color} />
            <circle cx="115" cy="190" r="8" fill={QBI_INK} />
            <circle cx="185" cy="190" r="8" fill={QBI_INK} />
            <path
              d="M100 168 Q115 160 130 168"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M170 168 Q185 160 200 168"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M134 232 Q150 218 166 232"
              fill="none"
              stroke={QBI_INK}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M232 128 C246 148 252 158 252 168 a14 14 0 0 1 -28 0 C224 158 230 148 232 128 Z"
              fill={QBI_DROP}
              stroke={QBI_INK}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <ellipse cx="86" cy="216" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.6" />
            <ellipse cx="214" cy="216" rx="16" ry="10" fill={QBI_BLUSH} opacity="0.6" />
          </>
        )}
      </g>
    </svg>
  );
};
