import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

export interface PrivacySubViewProps {
  onBack: () => void;
}

export function PrivacySubView({ onBack }: PrivacySubViewProps) {
  return (
    <motion.div
      key="subview-privacy"
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
          Privacy Policy
        </h2>
        <div className="w-12" />
      </div>

      <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-5 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex flex-col gap-4 text-xs text-[#6B7280] dark:text-[#8E8E93] leading-relaxed">
        <p className="text-[11px] font-bold text-[#E73229] uppercase tracking-wider">
          Effective Date: October 2026
        </p>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            1. Information We Collect
          </h4>
          <p>
            QGo collects your name, phone number, email address, and precise GPS location when searching for nearby turfs and booking sports slots.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            2. How We Use Your Data
          </h4>
          <p>
            Your information is used solely to generate match tickets, confirm turf reservations with venue managers, issue refunds, and provide live customer support.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            3. Payment Data Security
          </h4>
          <p>
            All payment transactions are encrypted using 256-bit SSL and processed via RBI-compliant payment gateways. QGo never stores your raw credit card numbers or UPI PIN.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
            4. Your Rights & Data Deletion
          </h4>
          <p>
            You have the right to request access to your profile data or request complete account deletion by contacting support@qgo.in at any time.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
