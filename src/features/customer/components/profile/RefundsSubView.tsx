import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ShieldCheck, Receipt } from 'lucide-react';
import { haptics } from '../../../../utils/haptics';

export interface RefundsSubViewProps {
  onBack: () => void;
}

export function RefundsSubView({ onBack }: RefundsSubViewProps) {
  return (
    <motion.div
      key="subview-refunds"
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
          Refunds & Wallet
        </h2>
        <div className="w-12" />
      </div>

      {/* Wallet Balance Hero Card */}
      <div className="w-full bg-[linear-gradient(135deg,#1C1C1E_0%,#2C2C2E_100%)] text-white p-5 rounded-3xl shadow-lg border border-white/10 mb-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              QGo Instant Wallet
            </span>
            <span className="text-[10px] font-bold bg-[#E73229] px-2 py-0.5 rounded-full">
              ACTIVE
            </span>
          </div>
          <div className="text-3xl font-black tracking-tight mb-4">
            ₹0.00
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => haptics.light()}
              className="flex-1 bg-white/10 hover:bg-white/15 py-2.5 rounded-xl text-xs font-bold text-center transition-colors cursor-pointer"
            >
              + Add Money
            </button>
            <button 
              type="button" 
              onClick={() => haptics.light()}
              className="flex-1 bg-white text-[#111111] py-2.5 rounded-xl text-xs font-bold text-center transition-colors cursor-pointer"
            >
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Guarantee Notice */}
      <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-4 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E7F5EE] dark:bg-[rgba(22,132,91,0.2)] text-[#16845B] dark:text-[#4ADE80] flex items-center justify-center shrink-0">
            <ShieldCheck size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF] mb-1">
              100% Refund Protection
            </h4>
            <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] leading-relaxed">
              When a match is cancelled within policy hours or due to weather, your refund is processed automatically to your source account within 5-7 business days.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Refunds Section */}
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8E8E93] mb-2 px-1">
        Recent Activity
      </h3>
      <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-6 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs text-center">
        <Receipt size={32} className="text-[#6B7280] dark:text-[#8E8E93] mx-auto mb-2 opacity-50" />
        <p className="text-sm font-bold text-[#111111] dark:text-[#FFFFFF]">
          No pending refunds
        </p>
        <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-0.5">
          All your turf bookings are up to date and settled.
        </p>
      </div>
    </motion.div>
  );
}
