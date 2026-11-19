import React from 'react';

/**
 * LiquidFlowBackground
 * GPU-optimized organic liquid mesh background.
 * Uses hardware-accelerated transforms and responsive blur radii
 * so mobile devices maintain a smooth 60-120 FPS without battery or GPU drain.
 */
export const LiquidFlowBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
      aria-hidden="true"
      style={{ contain: 'strict' }}
    >
      {/* Subtle Ambient Mesh Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 via-white/30 to-orange-50/40 dark:from-[#0B0B0E] dark:via-[#121217] dark:to-[#17171E]" />

      {/* Fluid Orb 1 - Brand Crimson/Rose (Top Left) */}
      <div
        className="absolute -top-16 -left-16 w-72 h-72 sm:w-96 sm:h-96 md:w-[38rem] md:h-[38rem] rounded-full bg-gradient-to-br from-[#E73229]/16 via-[#F43F5E]/12 to-transparent blur-xl sm:blur-2xl md:blur-3xl transform-gpu animate-liquid-flow-1"
        style={{ willChange: 'transform' }}
      />

      {/* Fluid Orb 2 - Coral/Peach (Top Right) */}
      <div
        className="absolute top-1/4 -right-16 w-64 h-64 sm:w-80 sm:h-80 md:w-[32rem] md:h-[32rem] rounded-full bg-gradient-to-bl from-[#FB923C]/14 via-[#F472B6]/10 to-transparent blur-xl sm:blur-2xl md:blur-3xl transform-gpu animate-liquid-flow-2"
        style={{ willChange: 'transform' }}
      />

      {/* Fluid Orb 3 - Soft Crimson Wave (Bottom Left) */}
      <div
        className="absolute bottom-12 -left-16 w-64 h-64 sm:w-80 sm:h-80 md:w-[34rem] md:h-[34rem] rounded-full bg-gradient-to-tr from-[#E73229]/12 via-[#F43F5E]/8 to-transparent blur-xl sm:blur-2xl md:blur-3xl transform-gpu animate-liquid-flow-3"
        style={{ willChange: 'transform' }}
      />

      {/* Fluid Orb 4 - Warm Peach/Amber (Bottom Right) */}
      <div
        className="absolute -bottom-16 right-1/4 w-60 h-60 sm:w-72 sm:h-72 md:w-[28rem] md:h-[28rem] rounded-full bg-gradient-to-tl from-[#FBBF24]/10 via-[#FB923C]/8 to-transparent blur-xl sm:blur-2xl md:blur-3xl transform-gpu animate-liquid-flow-1"
        style={{ willChange: 'transform' }}
      />
    </div>
  );
};
