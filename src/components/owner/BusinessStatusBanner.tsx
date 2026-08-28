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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-black shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        LIVE
      </div>
    );
  }

  if (status === 'draft') {
    const setupProgress = Math.min(100, Math.round(((salon.setupStep || 1) / 8) * 100));
    return (
      <div
        className={`rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3 ${
          compact ? 'p-3 space-y-2' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0 text-white font-black text-xs">
            {setupProgress}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-amber-900">Setup Incomplete</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Complete your business setup to go live and receive bookings.
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${setupProgress}%` }}
          />
        </div>
        {onContinueSetup && (
          <button
            onClick={onContinueSetup}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
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
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-blue-900">Under Review</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Your business is being reviewed by QGo. We'll notify you once it's approved
            (usually within 24 hours).
          </p>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black text-red-900">Submission Not Approved</p>
            <p className="text-xs text-red-700 mt-0.5">
              Your business submission was not approved. Please review your details and resubmit.
            </p>
          </div>
        </div>
        {onResubmit && (
          <button
            onClick={onResubmit}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
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
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
        <PauseCircle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-orange-900">Account Suspended</p>
          <p className="text-xs text-orange-700 mt-0.5">
            Your business has been suspended. Please contact QGo support for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'closed') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-slate-700">Business Closed</p>
          <p className="text-xs text-slate-500 mt-0.5">
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
    live: { label: 'LIVE', cls: 'bg-emerald-500 text-white' },
    approved: { label: 'APPROVED', cls: 'bg-emerald-500 text-white' },
    under_review: { label: 'UNDER REVIEW', cls: 'bg-blue-500 text-white' },
    draft: { label: 'SETUP INCOMPLETE', cls: 'bg-amber-400 text-amber-900' },
    rejected: { label: 'NOT APPROVED', cls: 'bg-red-500 text-white' },
    suspended: { label: 'SUSPENDED', cls: 'bg-orange-500 text-white' },
    closed: { label: 'CLOSED', cls: 'bg-slate-400 text-white' },
  };
  const badge = map[s] || map['draft'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badge.cls}`}>
      {(s === 'live' || s === 'approved') && (
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      )}
      {badge.label}
    </span>
  );
};
