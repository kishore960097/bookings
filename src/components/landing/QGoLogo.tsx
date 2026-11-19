import React from 'react';

interface QGoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'wordmark';
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: 'text-lg', badge: 'text-[11px] px-1.5 py-0.5' },
  md: { icon: 32, text: 'text-xl', badge: 'text-[11px] px-2 py-0.5' },
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
      viewBox="0 0 280 280"
      fill="currentColor"
      role="img"
      aria-label="QGo Logo"
      className="text-[#E73229]"
    >
      <path
        fillRule="evenodd"
        d="M206.17,268.40C199.35,265.00 197.67,262.56 189.03,243.50C185.04,234.70 179.18,221.88 176.01,215.00C165.22,191.58 164.00,188.37 164.00,183.45C164.00,169.27 173.12,160.02 187.13,160.01C192.25,160.00 191.64,159.77 219.00,171.75C229.73,176.44 245.02,183.13 253.00,186.62C269.59,193.87 272.98,196.70 275.51,205.38C277.17,211.11 276.86,215.72 274.42,221.50C272.34,226.39 231.86,266.10 226.26,268.74C219.67,271.83 212.83,271.72 206.17,268.40ZM115.50,265.40C89.09,260.44 62.23,245.63 43.22,225.55C8.68,189.06 -1.42,137.47 16.96,91.41C51.41,5.11 163.48,-19.84 231.08,43.75C256.48,67.65 271.98,103.21 272.00,137.62C272.00,151.97 268.24,173.00 265.67,173.00C264.99,173.00 254.11,168.39 241.51,162.75L218.60,152.50L218.44,138.50C218.26,123.62 217.07,117.85 211.71,105.83C201.96,83.99 179.77,66.12 156.20,61.12C149.37,59.68 130.63,59.68 123.80,61.12C96.06,67.01 73.24,87.73 64.46,115.00C60.64,126.87 60.35,145.53 63.80,157.44C70.27,179.80 85.38,197.66 106.08,207.44C118.56,213.34 124.53,214.51 141.65,214.43L156.80,214.36L158.88,218.93C160.01,221.44 164.75,231.83 169.40,242.00C174.06,252.19 177.48,260.89 177.01,261.37C172.65,265.84 132.05,268.50 115.50,265.40Z"
      />
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
      <span className={`font-black tracking-tight text-[#171717] ${s.text} ${className}`}>
        Q<span style={{ color: '#E8342A' }}>Go</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Icon />
      <span className={`font-black tracking-tight text-[#171717] ${s.text}`}>
        Q<span style={{ color: '#E8342A' }}>Go</span>
      </span>
    </div>
  );
};
