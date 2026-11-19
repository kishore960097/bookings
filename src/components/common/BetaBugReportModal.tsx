import React, { useState } from 'react';
import { Bug, X, Send, CheckCircle2, AlertCircle, Smartphone, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CURRENT_APP_VERSION } from '../../config/appVersion';
import { haptics } from '../../utils/haptics';

interface BetaBugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BetaBugReportModal: React.FC<BetaBugReportModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<'UI / Layout' | 'Booking / Payment' | 'QR Scanner' | 'GPS / Location' | 'Other'>('UI / Layout');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState(user?.phone || user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Please describe the issue or feedback');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const deviceInfo = [
        `App Version: v${CURRENT_APP_VERSION}`,
        `Screen: ${window.innerWidth}x${window.innerHeight}`,
        `Device: ${navigator.userAgent}`,
        `Role: ${user?.role || user?.activeRole || 'unknown'}`,
        `Contact: ${contactInfo || 'N/A'}`,
      ].join(' • ');

      const res = await api.submitTicket({
        title: `[Beta Bug - ${category}] ${description.trim().slice(0, 45)}...`,
        subject: `[Beta Bug - ${category}] ${description.trim().slice(0, 45)}...`,
        description: `${description.trim()}\n\n[Metadata: ${deviceInfo}]`,
        message: `${description.trim()}\n\n[Metadata: ${deviceInfo}]`,
        category,
        priority: 'high',
      });

      if (res && res.success) {
        haptics.success();
        setSubmittedTicketId(res.ticket?.id || 'QGO-BETA');
      } else {
        setErrorMessage(res?.error || 'Failed to submit bug report');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error submitting bug report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    haptics.light();
    setSubmittedTicketId(null);
    setDescription('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-report-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-2xl rounded-[32px] p-6 sm:p-7 border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-4 text-zinc-900 dark:text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E73229] to-[#FF5E55] text-white flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0">
              <Bug size={24} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-[#E73229] dark:text-red-400 text-[10px] font-black uppercase tracking-wider">
                <Sparkles size={11} />
                <span>Beta Tester Hub</span>
              </div>
              <h3 id="bug-report-title" className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
                Report Bug / Feedback
              </h3>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {submittedTicketId ? (
          <div className="py-6 flex flex-col items-center text-center gap-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="font-extrabold text-base text-zinc-900 dark:text-zinc-50">
              Report Submitted!
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs leading-relaxed">
              Thank you for helping us polish QGo. Ticket reference{' '}
              <strong className="font-mono text-[#E73229]">#{submittedTicketId}</strong> has been logged to the dev team.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 px-6 py-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Category Selector */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-1.5">
                Issue Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {(['UI / Layout', 'Booking / Payment', 'QR Scanner', 'GPS / Location', 'Other'] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-2 px-2.5 rounded-xl font-bold text-[11px] transition-all text-center ${
                        category === cat
                          ? 'bg-[#E73229] text-white shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-1.5">
                Describe the Issue or Suggestion
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What were you trying to do?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
            </div>

            {/* Contact info */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-1.5">
                Your Contact (Phone or Email)
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Optional: Phone number or email for follow-up"
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
            </div>

            {/* Auto metadata notice */}
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 pt-1">
              <Smartphone size={13} className="shrink-0" />
              <span>App v{CURRENT_APP_VERSION} &amp; screen dimensions will be attached automatically.</span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim()}
                className="px-5 py-2.5 rounded-full bg-[#E73229] hover:bg-[#BA070D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black shadow-md shadow-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
