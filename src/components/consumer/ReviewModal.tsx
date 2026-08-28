import React, { useState } from 'react';
import { Salon, Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { X, Star, Sparkles, CheckCircle2, MessageSquare } from 'lucide-react';

interface ReviewModalProps {
  salon?: Salon;
  booking?: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  salon,
  booking,
  onClose,
  onSuccess,
}) => {
  const { t } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salonId = salon?.id || booking?.salonId;
  const salonName = salon?.name || booking?.salonName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking?.id) {
      setError('Reviews are available after a completed booking');
      return;
    }
    if (!salonId || !comment.trim()) {
      setError('Please provide a comment sharing your experience');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.submitReview({
        bookingId: booking?.id,
        salonId,
        staffId: booking?.staffId,
        rating,
        comment,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError('Failed to submit review');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 sm:p-7 shadow-2xl z-10 border border-slate-200 animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-2">
            <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
          </div>
          <h2 className="text-lg font-black text-slate-900">{t.writeReview}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{salonName}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Selector */}
          <div className="flex flex-col items-center justify-center py-2">
            <span className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">{t.ratingLabel}</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="p-1 text-amber-400 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating ?? rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-slate-500 mt-1 font-mono">
              {rating === 5
                ? 'Excellent (5/5)'
                : rating === 4
                ? 'Very Good (4/5)'
                : rating === 3
                ? 'Average (3/5)'
                : 'Could be better'}
            </span>
          </div>

          {/* Comment Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Your Feedback</label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.reviewCommentPlaceholder}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>{submitting ? 'Submitting...' : t.submitReview}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </button>
        </form>
      </div>
    </div>
  );
};
