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
    if (compact) return null;
    const isLive = status === 'live';
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs ${
        isLive ? 'bg-[#FDECEA] text-[#B3231B] border border-[#F39887]/30' : 'bg-[#E7F5EE] text-[#16845B] border border-[#16845B]/30'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#E73229]' : 'bg-[#16845B]'} animate-pulse`} />
        {isLive ? 'LIVE' : 'APPROVED'}
      </div>
    );
  }

  if (status === 'draft') {
    const setupProgress = Math.min(100, Math.round(((salon.setupStep || 1) / 8) * 100));
    return (
      <div
        className={`rounded-2xl border border-[rgba(10,10,10,0.10)] bg-[#F7F7F7] p-4 space-y-3 ${
          compact ? 'p-3 space-y-2' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0A0A0A] flex items-center justify-center shrink-0 text-[#FFFFFF] font-bold text-xs">
            {setupProgress}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#0A0A0A]">Setup Incomplete</p>
            <p className="text-xs text-[#5C5C5C] mt-0.5">
              Complete your business setup to go live and receive bookings.
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-[#E2E2E2] rounded-full overflow-hidden">
          <div
            className="h-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] rounded-full transition-all duration-500"
            style={{ width: `${setupProgress}%` }}
          />
        </div>
        {onContinueSetup && (
          <button
            onClick={onContinueSetup}
            className="w-full py-2.5 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] hover:opacity-95 text-[#FFFFFF] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
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
      <div className="rounded-2xl border border-[rgba(10,10,10,0.10)] bg-[#F7F7F7] p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-[#5C5C5C] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-[#0A0A0A]">Under Review</p>
          <p className="text-xs text-[#5C5C5C] mt-0.5">
            Your business is being reviewed by QGo. We'll notify you once it's approved
            (usually within 24 hours).
          </p>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-2xl border border-[rgba(179,38,30,0.20)] bg-[#FBEAE8] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-[#B3261E] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#B3261E]">Submission Not Approved</p>
            <p className="text-xs text-[#5C5C5C] mt-0.5">
              Your business submission was not approved. Please review your details and resubmit.
            </p>
          </div>
        </div>
        {onResubmit && (
          <button
            onClick={onResubmit}
            className="w-full py-2.5 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] hover:opacity-95 text-[#FFFFFF] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
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
      <div className="rounded-2xl border border-[rgba(179,38,30,0.20)] bg-[#FBEAE8] p-4 flex items-start gap-3">
        <PauseCircle className="w-5 h-5 text-[#B3261E] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-[#B3261E]">Account Suspended</p>
          <p className="text-xs text-[#5C5C5C] mt-0.5">
            Your business has been suspended. Please contact QGo support for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'closed') {
    return (
      <div className="rounded-2xl border border-[rgba(10,10,10,0.10)] bg-[#FFFFFF] p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#767676] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-[#0A0A0A]">Business Closed</p>
          <p className="text-xs text-[#5C5C5C] mt-0.5">
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
    live: { label: 'LIVE', cls: 'bg-[#FDECEA] text-[#B3231B] border border-[#F39887]/30' },
    approved: { label: 'APPROVED', cls: 'bg-[#E7F5EE] text-[#16845B] border border-[#16845B]/30' },
    under_review: { label: 'UNDER REVIEW', cls: 'bg-[#0A0A0A] text-[#FFFFFF]' },
    draft: { label: 'SETUP INCOMPLETE', cls: 'bg-[#EFEFEF] text-[#5C5C5C] border border-[rgba(10,10,10,0.10)]' },
    rejected: { label: 'NOT APPROVED', cls: 'bg-[#FBEAE8] text-[#B3261E] border border-[rgba(179,38,30,0.20)]' },
    suspended: { label: 'SUSPENDED', cls: 'bg-[#FBEAE8] text-[#B3261E] border border-[rgba(179,38,30,0.20)]' },
    closed: { label: 'CLOSED', cls: 'bg-[#EFEFEF] text-[#5C5C5C] border border-[rgba(10,10,10,0.10)]' },
  };
  const badge = map[s] || map['draft'];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${badge.cls}`}>
      {s === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#E73229] animate-pulse" />
      )}
      {s === 'approved' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#16845B] animate-pulse" />
      )}
      {badge.label}
    </span>
  );
};
