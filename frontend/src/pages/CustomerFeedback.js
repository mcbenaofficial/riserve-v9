import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Star, Send, CheckCircle, Smile, Meh, Frown, ThumbsUp, Heart } from 'lucide-react';

const CustomerFeedback = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchBookingInfo();
  }, [bookingId]);

  const fetchBookingInfo = async () => {
    try {
      const res = await api.getFeedbackForBooking(bookingId);
      if (res.data.exists) {
        setExistingFeedback(res.data.feedback);
        setRating(res.data.feedback.rating);
        setComment(res.data.feedback.comment || '');
      } else {
        setBooking(res.data.booking);
      }
    } catch (error) {
      setError('Booking not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.submitFeedback(bookingId, {
        booking_id: bookingId,
        rating,
        comment: comment.trim() || null,
        customer_name: booking?.customer || booking?.customer_name
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const getEmoji = (value) => {
    switch (value) {
      case 1: return { icon: Frown, color: 'text-red-500', label: 'Very Unhappy' };
      case 2: return { icon: Frown, color: 'text-orange-500', label: 'Unhappy' };
      case 3: return { icon: Meh, color: 'text-yellow-500', label: 'Neutral' };
      case 4: return { icon: Smile, color: 'text-lime-500', label: 'Happy' };
      case 5: return { icon: Heart, color: 'text-green-500', label: 'Very Happy' };
      default: return { icon: Star, color: 'text-gray-300', label: '' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B0D10] flex items-center justify-center">
        <div className="text-[#6B7280]">Loading...</div>
      </div>
    );
  }

  if (error && !booking && !existingFeedback) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B0D10] flex items-center justify-center p-4">
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full text-center border border-[#D9DEE5] dark:border-[#1F2630]">
          <Frown size={64} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">Oops!</h2>
          <p className="text-[#6B7280] dark:text-[#7D8590]">{error}</p>
        </div>
      </div>
    );
  }

  if (existingFeedback || submitted) {
    const displayRating = existingFeedback?.rating || rating;
    const EmojiIcon = getEmoji(displayRating).icon;

    return (
      <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B0D10] flex items-center justify-center p-4">
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full text-center border border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">Thank You!</h2>
          <p className="text-[#6B7280] dark:text-[#7D8590] mb-6">
            {submitted ? 'Your feedback has been submitted.' : 'You have already submitted feedback for this booking.'}
          </p>

          <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-2xl p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <EmojiIcon size={32} className={getEmoji(displayRating).color} />
              <span className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
                {getEmoji(displayRating).label}
              </span>
            </div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={24}
                  className={star <= displayRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                />
              ))}
            </div>
            {(existingFeedback?.comment || comment) && (
              <p className="mt-4 text-sm text-[#4B5563] dark:text-[#A9AFB8] italic">
                "{existingFeedback?.comment || comment}"
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentEmoji = getEmoji(hoveredRating || rating);
  const EmojiIcon = currentEmoji.icon;

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B0D10] flex items-center justify-center p-4">
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-[#D9DEE5] dark:border-[#1F2630]">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-[#5FA8D3] flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">Rs</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-[#0E1116] dark:text-[#E6E8EB] mb-2">
          How was your experience?
        </h1>
        <p className="text-center text-[#6B7280] dark:text-[#7D8590] mb-8">
          Hi {booking?.customer || booking?.customer_name || 'there'}, we'd love your feedback!
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Emoji Display */}
        <div className="flex justify-center mb-4">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${(hoveredRating || rating) > 0
              ? 'bg-[#5FA8D3]/10'
              : 'bg-gray-100 dark:bg-gray-800'
            }`}>
            <EmojiIcon
              size={64}
              className={`transition-all ${(hoveredRating || rating) > 0 ? currentEmoji.color : 'text-gray-300'
                }`}
            />
          </div>
        </div>

        {(hoveredRating || rating) > 0 && (
          <p className="text-center text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-4">
            {currentEmoji.label}
          </p>
        )}

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="p-2 rounded-xl hover:bg-[#F6F7F9] dark:hover:bg-[#0B0D10] transition-all transform hover:scale-110"
            >
              <Star
                size={36}
                className={`transition-all ${star <= (hoveredRating || rating)
                    ? 'text-amber-400 fill-amber-400 drop-shadow-lg'
                    : 'text-gray-300 dark:text-gray-600'
                  }`}
              />
            </button>
          ))}
        </div>

        {/* Comment Box */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
            Any comments? (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more about your experience..."
            rows={3}
            className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white/50 dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0]"
        >
          {submitting ? (
            'Submitting...'
          ) : (
            <>
              <Send size={20} />
              Submit Feedback
            </>
          )}
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-[#6B7280] dark:text-[#7D8590] mt-6">
          Powered by Ri'Serve
        </p>
      </div>
    </div>
  );
};

export default CustomerFeedback;
