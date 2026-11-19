import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronDown, MessageSquare, Phone, Headphones } from 'lucide-react';
import { haptics } from '../../../../utils/haptics';
import {
  SUPPORT_PHONE_E164,
  SUPPORT_WHATSAPP_NUMBER,
  SUPPORT_EMAIL,
} from '../../../../config/supportContact';

export interface SupportSubViewProps {
  onBack: () => void;
}

export function SupportSubView({ onBack }: SupportSubViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=Hi%20QGo%20Support`;
  const callUrl = `tel:${SUPPORT_PHONE_E164}`;
  const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=QGo%20Support`;

  const faqs = [
    {
      q: 'How do I cancel my turf booking?',
      a: 'Go to "Your Booking" from the profile or bottom navigation, select your scheduled slot, and click "Cancel Booking". Eligible refunds are credited automatically.',
    },
    {
      q: 'How long does a refund take to reflect?',
      a: 'UPI refunds are typically instant or within 24 hours. Credit and debit card refunds take 5 to 7 business days depending on your bank.',
    },
    {
      q: 'Can I reschedule my booking format or time?',
      a: 'Yes, slots can be rescheduled up to 4 hours before the match start time subject to pitch availability at the venue.',
    },
    {
      q: 'What happens in case of heavy rain or venue closure?',
      a: 'If a turf venue shuts down due to rain or unforeseen issues, you are entitled to an immediate 100% refund or a free slot reschedule.',
    },
  ];

  return (
    <motion.div
      key="subview-support"
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
          Help & Support
        </h2>
        <div className="w-12" />
      </div>

      {/* Quick Contact Buttons */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with QGo support on WhatsApp"
          whileTap={{ scale: 0.95 }}
          onClick={() => haptics.light()}
          className="bg-[#FFFFFF] dark:bg-[#1C1C1E] p-3.5 rounded-2xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex flex-col items-center justify-center text-center cursor-pointer min-h-[80px] no-underline"
        >
          <MessageSquare size={22} className="text-[#16845B] dark:text-[#4ADE80] mb-1.5" />
          <span className="text-xs font-bold text-[#111111] dark:text-[#FFFFFF]">WhatsApp</span>
        </motion.a>

        <motion.a
          href={callUrl}
          aria-label="Call QGo support"
          whileTap={{ scale: 0.95 }}
          onClick={() => haptics.light()}
          className="bg-[#FFFFFF] dark:bg-[#1C1C1E] p-3.5 rounded-2xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex flex-col items-center justify-center text-center cursor-pointer min-h-[80px] no-underline"
        >
          <Phone size={22} className="text-[#E73229] mb-1.5" />
          <span className="text-xs font-bold text-[#111111] dark:text-[#FFFFFF]">Call Us</span>
        </motion.a>

        <motion.a
          href={emailUrl}
          aria-label="Email QGo support"
          whileTap={{ scale: 0.95 }}
          onClick={() => haptics.light()}
          className="bg-[#FFFFFF] dark:bg-[#1C1C1E] p-3.5 rounded-2xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex flex-col items-center justify-center text-center cursor-pointer min-h-[80px] no-underline"
        >
          <Headphones size={22} className="text-[#0284C7] dark:text-[#38BDF8] mb-1.5" />
          <span className="text-xs font-bold text-[#111111] dark:text-[#FFFFFF]">Email</span>
        </motion.a>
      </div>

      {/* FAQ Accordion */}
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8E8E93] mb-2 px-1">
        Frequently Asked Questions
      </h3>
      <div className="flex flex-col gap-2.5">
        {faqs.map((faq, i) => {
          const isOpen = openFaq === i;
          return (
            <div
              key={i}
              className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setOpenFaq(isOpen ? null : i);
                }}
                className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-[#111111] dark:text-[#FFFFFF] cursor-pointer min-h-[50px]"
              >
                <span className="pr-2">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-[#767676] dark:text-[#8E8E93] shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 text-xs text-[#6B7280] dark:text-[#8E8E93] leading-relaxed border-t border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.06)]">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
