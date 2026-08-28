import React from 'react';

interface QGoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'wordmark';
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: 'text-lg', badge: 'text-[9px] px-1.5 py-0.5' },
  md: { icon: 32, text: 'text-xl', badge: 'text-[10px] px-2 py-0.5' },
  lg: { icon: 40, text: 'text-2xl', badge: 'text-xs px-2 py-0.5' },
  xl: { icon: 52, text: 'text-3xl', badge: 'text-sm px-2.5 py-1' },
};

export const QGoLogo: React.FC<QGoLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
}) => {
  const s = sizes[size];

  const Icon = () => (
    <svg
      width={s.icon}
      height={s.icon}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Q shape */}
      <rect width="40" height="40" rx="10" fill="#2563EB" />
      {/* Q circle */}
      <circle cx="19" cy="19" r="10" stroke="white" strokeWidth="2.5" fill="none" />
      {/* Q tail — location pin style */}
      <line x1="26" y1="26" x2="31" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Inner dot — ticket perforation */}
      <circle cx="19" cy="19" r="3" fill="white" opacity="0.9" />
      {/* Ticket notch at bottom */}
      <path d="M14 34 Q19 36 24 34" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={className}>
        <Icon />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <span className={`font-black tracking-tight text-white ${s.text} ${className}`}>
        Q<span style={{ color: '#06B6D4' }}>Go</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Icon />
      <span className={`font-black tracking-tight text-white ${s.text}`}>
        Q<span style={{ color: '#06B6D4' }}>Go</span>
      </span>
    </div>
  );
};
