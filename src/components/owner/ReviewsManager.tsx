import React, { useState, useEffect } from 'react';
import { Salon, Review } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Star, MessageSquare, CornerDownRight, Check, Send } from 'lucide-react';

interface ReviewsManagerProps {
  salon: Salon;
}

export const ReviewsManager: React.FC<ReviewsManagerProps> = ({ salon }) => {
  const { t } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadReviews = async () => {
    try {
      const detail = await api.getSalonDetail(salon.id);
      if (detail) {
        setReviews(detail.reviews);
      }
    } catch (e) {
      console.error('Error fetching reviews:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [salon.id]);

  const handleSendReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    try {
      await api.replyToReview(reviewId, replyText);
      setReplyingId(null);
      setReplyText('');
      loadReviews();
    } catch (e) {
      console.error('Error replying to review:', e);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-base text-neutral-900">
            Customer Feedback & Reviews ({reviews.length})
          </h3>
          <p className="text-xs text-neutral-500">
            Overall shop rating {salon.rating} / 5.0 • Reply directly to patrons
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-neutral-400">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center text-neutral-400 text-xs">No reviews submitted yet.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center">
                    {rev.customerName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-neutral-900">{rev.customerName}</h4>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-700 leading-relaxed pl-1">{rev.comment}</p>

              {/* Owner reply */}
              {rev.ownerResponse ? (
                <div className="p-3 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-700 space-y-1">
                  <span className="font-bold text-neutral-900 text-[11px] block">
                    Your Response:
                  </span>
                  <p className="text-neutral-600">{rev.ownerResponse}</p>
                </div>
              ) : replyingId === rev.id ? (
                <div className="p-3 rounded-xl bg-white border border-neutral-300 space-y-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a polite response to this customer..."
                    className="w-full text-xs p-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setReplyingId(null)}
                      className="px-3 py-1 text-xs text-neutral-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendReply(rev.id)}
                      className="px-3 py-1 bg-neutral-900 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Post Reply</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setReplyingId(rev.id);
                    setReplyText('');
                  }}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 pl-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Reply to customer</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
