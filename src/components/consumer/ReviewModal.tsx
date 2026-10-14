import React, { useState } from 'react';
import { Salon, Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { X, Star, CheckCircle2, MessageSquare } from 'lucide-react';

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
      <div className="fixed inset-0 bg-[#FFFFFF]" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#FFFFFF] rounded-2xl p-6 sm:p-7 shadow-lg z-10 border border-[rgba(23,23,23,0.12)] animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[rgba(23,23,23,0.70)] hover:text-[#171717] hover:bg-[rgba(23,23,23,0.05)]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-[rgba(255,159,28,0.15)] border border-[rgba(23,23,23,0.12)] text-[#FF9F1C] flex items-center justify-center mx-auto mb-2">
            <Star className="w-6 h-6 fill-[#FF9F1C] text-[#FF9F1C]" />
          </div>
          <h2 className="text-lg font-black text-[#171717]">{t.writeReview}</h2>
          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">{salonName}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] text-xs font-semibold border border-[rgba(23,23,23,0.12)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Selector */}
          <div className="flex flex-col items-center justify-center py-2">
            <span className="text-xs font-bold text-[rgba(23,23,23,0.70)] mb-2 uppercase tracking-wider">{t.ratingLabel}</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="p-1 text-[#FF9F1C] transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating ?? rating)
                        ? 'fill-[#FF9F1C] text-[#FF9F1C]'
                        : 'text-[#171717]'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-[rgba(23,23,23,0.70)] mt-1 font-mono">
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
            <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)] mb-1 uppercase tracking-wider">Your Feedback</label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.reviewCommentPlaceholder}
              className="w-full p-3 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(23,23,23,0.05)] disabled:bg-[#FFFFFF] text-[#171717] font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>{submitting ? 'Submitting...' : t.submitReview}</span>
            <CheckCircle2 className="w-4 h-4 text-[#FF9F1C]" />
          </button>
        </form>
      </div>
    </div>
  );
};
