import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

export interface TermsSubViewProps {
  onBack: () => void;
}

export function TermsSubView({ onBack }: TermsSubViewProps) {
  return (
    <motion.div
      key="subview-terms"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col w-full px-4 pt-3 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5 sticky top-0 bg-[#F5F5F7] dark:bg-[#000000] py-2 z-10 transition-colors">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#E73229] min-h-[44px] cursor-pointer"
        >
          <ChevronLeft size={20} strokeWidth={2.8} /> Back
        </motion.button>
        <h2 className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight">
          Terms of Use
        </h2>
        <div className="w-12" />
      </div>

      <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-5 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex flex-col gap-4 text-xs text-[#6B7280] dark:text-[#8E8E93] leading-relaxed">
        <p className="text-[11px] font-bold text-[#E73229] uppercase tracking-wider">
          Last Updated: October 2026
        </p>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            1. Booking & Admission
          </h4>
          <p>
            Users must present the QGo digital QR ticket at the turf entrance prior to starting the game. Admission is subject to venue management rules.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            2. Turf Ground Etiquette
          </h4>
          <p>
            Only appropriate sports footwear (turf shoes or rubber studs) is permitted on synthetic pitches. Metal cleats and outside food are strictly prohibited.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            3. Cancellation & No-Show Policy
          </h4>
          <p>
            Cancellations made 4 hours prior to the slot time receive full refund eligibility. Failure to arrive without notice will forfeit the booking amount.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            4. Limitation of Liability
          </h4>
          <p>
            Players participate at their own risk. QGo is a reservation platform and is not liable for physical sports injuries sustained on turf grounds.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
