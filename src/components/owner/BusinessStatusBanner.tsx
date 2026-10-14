import React from 'react';
import { Salon } from '../../types';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PauseCircle,
  ChevronRight,
} from 'lucide-react';

interface BusinessStatusBannerProps {
  salon: Salon;
  onContinueSetup?: () => void;
  onResubmit?: () => void;
  compact?: boolean;
}

export const BusinessStatusBanner: React.FC<BusinessStatusBannerProps> = ({
  salon,
  onContinueSetup,
  onResubmit,
  compact = false,
}) => {
  const status = salon.status || 'draft';

  if (status === 'live' || status === 'approved') {
    if (compact) return null; // Don't show the green banner in compact mode
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF9F1C] text-[#171717] text-xs font-black shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] animate-pulse" />
        LIVE
      </div>
    );
  }

  if (status === 'draft') {
    const setupProgress = Math.min(100, Math.round(((salon.setupStep || 1) / 8) * 100));
    return (
      <div
        className={`rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] p-4 space-y-3 ${
          compact ? 'p-3 space-y-2' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#FF9F1C] flex items-center justify-center shrink-0 text-[#171717] font-black text-xs">
            {setupProgress}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-[#FF9F1C]">Setup Incomplete</p>
            <p className="text-xs text-[#FF9F1C] mt-0.5">
              Complete your business setup to go live and receive bookings.
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-[rgba(255,159,28,0.15)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF9F1C] rounded-full transition-colors duration-150 duration-500"
            style={{ width: `${setupProgress}%` }}
          />
        </div>
        {onContinueSetup && (
          <button
            onClick={onContinueSetup}
            className="w-full py-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
          >
            Continue Setup
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (status === 'under_review') {
    return (
      <div className="rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-[#FF9F1C] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-[#FF9F1C]">Under Review</p>
          <p className="text-xs text-[#FF9F1C] mt-0.5">
            Your business is being reviewed by QGo. We'll notify you once it's approved
            (usually within 24 hours).
          </p>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-[#FF9F1C] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black text-[#FF9F1C]">Submission Not Approved</p>
            <p className="text-xs text-[#FF9F1C] mt-0.5">
              Your business submission was not approved. Please review your details and resubmit.
            </p>
          </div>
        </div>
        {onResubmit && (
          <button
            onClick={onResubmit}
            className="w-full py-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
          >
            Edit & Resubmit
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (status === 'suspended') {
    return (
      <div className="rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[rgba(255,159,28,0.15)] p-4 flex items-start gap-3">
        <PauseCircle className="w-5 h-5 text-[#FF9F1C] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-[#FF9F1C]">Account Suspended</p>
          <p className="text-xs text-[#FF9F1C] mt-0.5">
            Your business has been suspended. Please contact QGo support for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'closed') {
    return (
      <div className="rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[#FFFFFF] p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[rgba(23,23,23,0.70)] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-[rgba(23,23,23,0.70)]">Business Closed</p>
          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">
            This business is currently marked as closed.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

/** Inline status badge (for headers) */
export const StatusBadge: React.FC<{ status: Salon['status'] }> = ({ status }) => {
  const s = status || 'draft';
  const map: Record<string, { label: string; cls: string }> = {
    live: { label: 'LIVE', cls: 'bg-[#FF9F1C] text-[#171717]' },
    approved: { label: 'APPROVED', cls: 'bg-[#FF9F1C] text-[#171717]' },
    under_review: { label: 'UNDER REVIEW', cls: 'bg-[#FF9F1C] text-[#171717]' },
    draft: { label: 'SETUP INCOMPLETE', cls: 'bg-[#FF9F1C] text-[#FF9F1C]' },
    rejected: { label: 'NOT APPROVED', cls: 'bg-[#FF9F1C] text-[#171717]' },
    suspended: { label: 'SUSPENDED', cls: 'bg-[#FF9F1C] text-[#171717]' },
    closed: { label: 'CLOSED', cls: 'bg-[#FFFFFF] text-[#171717]' },
  };
  const badge = map[s] || map['draft'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${badge.cls}`}>
      {(s === 'live' || s === 'approved') && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] animate-pulse" />
      )}
      {badge.label}
    </span>
  );
};
