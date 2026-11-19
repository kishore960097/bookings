import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, RefreshCw, Send, CheckCircle2, ShieldCheck, ThumbsUp } from 'lucide-react';
import { Salon, Review } from '../../types';
import { api } from '../../services/api';
import { formatDateTimeIST, sanitizeCustomerName } from '../../utils/timeFormat';
import { QGoLoader } from '../common/QGoLoader';

interface OwnerReviewsViewProps {
  salon: Salon;
}

export const OwnerReviewsView: React.FC<OwnerReviewsViewProps> = ({ salon }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await api.getSalonReviews(salon.id);
      if (res && res.success) {
        setReviews(res.reviews || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [salon.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Distribution calculations
  const totalReviews = reviews.length;
  const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sumRatings = 0;

  for (const r of reviews) {
    const rate = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
    ratingCounts[rate] = (ratingCounts[rate] || 0) + 1;
    sumRatings += r.rating;
  }

  const averageRating = totalReviews > 0 ? (sumRatings / totalReviews).toFixed(1) : '0.0';

  const handleSendReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await api.replyToReview(reviewId, replyText.trim());
      if (res && res.success) {
        showToast('Response published to customer!');
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, ownerResponse: replyText.trim() } : r))
        );
        setReplyingReviewId(null);
        setReplyText('');
      } else {
        showToast(res?.error || 'Failed to submit response');
      }
    } catch (e: any) {
      showToast(e?.message || 'Error submitting response');
    } finally {
      setSubmittingReply(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (filterRating === 'all') return true;
    return Math.round(r.rating) === filterRating;
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 py-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#121318] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-white/10 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[28px] bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#E73229] font-bold uppercase tracking-wider">
              Customer Experience &amp; Ratings
            </span>
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            Ratings &amp; Verified Reviews
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real customer ratings calculated dynamically from confirmed booking checkouts.
          </p>
        </div>

        <button
          onClick={fetchReviews}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-[#E73229]' : ''} />
          <span>Refresh Reviews</span>
        </button>
      </div>

      {/* Google-Style Star Rating Summary & Distribution Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-[28px] bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        {/* Big Score Block */}
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl text-center border border-zinc-100 dark:border-zinc-800/80">
          {totalReviews > 0 ? (
            <>
              <span className="text-5xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
                {averageRating}
              </span>
              <div className="flex items-center gap-1 my-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={18}
                    className={
                      star <= Math.round(Number(averageRating))
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-zinc-300 dark:text-zinc-700'
                    }
                  />
                ))}
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                Based on {totalReviews} verified {totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-2">
                <Star size={24} className="text-amber-500" />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                New Venue
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                No customer reviews yet. Ratings will automatically appear after customer check-ins.
              </span>
            </>
          )}
        </div>

        {/* 5-to-1 Distribution Bars */}
        <div className="md:col-span-2 flex flex-col justify-center gap-2.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars] || 0;
            const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-8 font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  {stars} <Star size={11} className="fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterRating('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            filterRating === 'all'
              ? 'bg-[#121318] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
          }`}
        >
          All ({reviews.length})
        </button>
        {[5, 4, 3, 2, 1].map((st) => (
          <button
            key={st}
            onClick={() => setFilterRating(st)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterRating === st
                ? 'bg-[#121318] dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <span>{st}★</span>
            <span className="opacity-70 font-normal">({ratingCounts[st] || 0})</span>
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center">
            <QGoLoader variant="container" minHeight="160px" text="Loading customer reviews…" />
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-12 text-center rounded-[28px] bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
            <MessageSquare size={36} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold text-sm">No reviews matching the filter.</p>
            <p className="text-xs mt-1">Try switching to "All" to view all customer reviews.</p>
          </div>
        ) : (
          filteredReviews.map((r) => {
            const customerName = sanitizeCustomerName(r.customerName);
            const isReplying = replyingReviewId === r.id;

            return (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3"
              >
                {/* Header: User & Rating */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#E73229]/10 text-[#E73229] font-black text-xs flex items-center justify-center shrink-0 uppercase">
                      {customerName.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                        {customerName}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        {formatDateTimeIST(r.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/80">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      {r.rating}.0
                    </span>
                  </div>
                </div>

                {/* Comment Text */}
                {r.comment ? (
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    "{r.comment}"
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No written comment provided.</p>
                )}

                {/* Owner Existing Response */}
                {r.ownerResponse && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#E73229]">
                      <ShieldCheck size={13} />
                      <span>Response from Venue Owner</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {r.ownerResponse}
                    </p>
                  </div>
                )}

                {/* Reply Button & Inline Form */}
                {!r.ownerResponse && (
                  <div>
                    {!isReplying ? (
                      <button
                        onClick={() => {
                          setReplyingReviewId(r.id);
                          setReplyText('');
                        }}
                        className="text-xs font-bold text-[#E73229] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare size={12} />
                        <span>Reply to Customer</span>
                      </button>
                    ) : (
                      <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a polite response to this customer..."
                          rows={2}
                          className="w-full p-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#E73229]"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingReviewId(null)}
                            className="px-3 py-1 rounded-full text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!replyText.trim() || submittingReply}
                            onClick={() => handleSendReply(r.id)}
                            className="px-4 py-1 rounded-full bg-[#E73229] hover:bg-[#BA070D] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                          >
                            <Send size={11} />
                            <span>Post Reply</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
