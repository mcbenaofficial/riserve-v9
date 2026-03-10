import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Star, Send, CheckCircle, Smile, Meh, Frown, ThumbsUp, Heart, ChevronRight, ChevronLeft, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const POSITIVE_ASPECTS = [
  "Stylist's skill & expertise",
  "Friendliness & warmth",
  "Final result / look",
  "Cleanliness & hygiene",
  "Short wait / punctuality",
  "Value for money",
  "Nothing in particular"
];

const NEGATIVE_ASPECTS = [
  "Staff behaviour / empathy",
  "Service result / consistency",
  "Hygiene & safety",
  "Wait time / appointment",
  "Pricing / billing clarity",
  "Ambience / salon feel"
];

const STAFF_ISSUES = [
  "Rude/dismissive",
  "Inattentive",
  "Ignored preferences",
  "Pressured upsell",
  "Other"
];

const OUTCOME_ISSUES = [
  "Uneven / not as requested",
  "Didn't last",
  "Damage/irritation",
  "Other"
];

const CustomerFeedback = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [step, setStep] = useState('A'); // A, B, C, C_Detail, D, E, F
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  
  // Section A
  const [comparedToPrevious, setComparedToPrevious] = useState('');
  // Section B
  const [likedMost, setLikedMost] = useState([]);
  const [showStaffShoutout, setShowStaffShoutout] = useState(null);
  const [staffShoutout, setStaffShoutout] = useState('');
  // Section C
  const [areasFellShort, setAreasFellShort] = useState([]);
  const [shortcomingsDetails, setShortcomingsDetails] = useState({});
  // Section D
  const [escalationNotes, setEscalationNotes] = useState('');
  const [contactOptIn, setContactOptIn] = useState(null);
  const [contactNumber, setContactNumber] = useState('');
  const [contactTime, setContactTime] = useState('');
  // Section E
  const [likelyAgain, setLikelyAgain] = useState('');
  const [npsScore, setNpsScore] = useState(null);
  const [returnIncentive, setReturnIncentive] = useState('');
  // Section F
  const [suggestions, setSuggestions] = useState('');

  useEffect(() => {
    fetchBookingInfo();
  }, [bookingId]);

  const fetchBookingInfo = async () => {
    try {
      const res = await api.getFeedbackForBooking(bookingId);
      if (res.data.exists) {
        setExistingFeedback(res.data.feedback);
        setRating(res.data.feedback.rating);
      } else {
        setBooking(res.data.booking);
        if (res.data.booking?.customer_phone) {
          setContactNumber(res.data.booking.customer_phone);
        }
      }
    } catch (error) {
      setError('Booking not found');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    switch (step) {
      case 'A':
        if (rating === 0) return;
        setStep('B');
        break;
      case 'B':
        if (rating >= 4) {
          setStep('E'); // Happy path
        } else {
          setStep('C'); // Unhappy path
        }
        break;
      case 'C':
        if (areasFellShort.includes('Staff behaviour / empathy') || areasFellShort.includes('Service result / consistency')) {
          setStep('C_Detail'); // Need to collect more details for priority issues
        } else if (rating <= 2) {
           setStep('D'); // Jump straight to escalation if 1-2 stars and no priority areas selected
        } else {
           setStep('E'); // 3 stars and no priority areas selected -> just go to loyalty
        }
        break;
      case 'C_Detail':
        if (rating <= 2) {
          setStep('D');
        } else {
          setStep('E');
        }
        break;
      case 'D':
        setStep('E');
        break;
      case 'E':
        setStep('F');
        break;
      case 'F':
        handleSubmit();
        break;
      default:
        break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case 'B': setStep('A'); break;
      case 'C': setStep('B'); break;
      case 'C_Detail': setStep('C'); break;
      case 'D': 
        if (areasFellShort.includes('Staff behaviour / empathy') || areasFellShort.includes('Service result / consistency')) {
          setStep('C_Detail');
        } else {
          setStep('C');
        }
        break;
      case 'E':
        if (rating >= 4) setStep('B');
        else if (rating <= 2) setStep('D');
        else if (areasFellShort.includes('Staff behaviour / empathy') || areasFellShort.includes('Service result / consistency')) setStep('C_Detail');
        else setStep('C');
        break;
      case 'F': setStep('E'); break;
      default: break;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    // Prepare payload, cleaning up unused fields based on the path taken
    const payload = {
      booking_id: bookingId,
      rating,
      compared_to_previous: comparedToPrevious || null,
      liked_most: likedMost,
      staff_shoutout: staffShoutout || null,
      
      areas_fell_short: rating <= 3 ? areasFellShort : [],
      shortcomings_details: rating <= 3 ? shortcomingsDetails : {},
      
      escalation_notes: rating <= 2 ? escalationNotes : null,
      escalation_contact_opt_in: rating <= 2 ? (contactOptIn === 'yes') : false,
      escalation_contact_number: (rating <= 2 && contactOptIn === 'yes') ? contactNumber : null,
      escalation_contact_time: (rating <= 2 && contactOptIn === 'yes') ? contactTime : null,
      
      likely_to_visit_again: likelyAgain || null,
      nps_score: npsScore,
      return_incentive: returnIncentive || null,
      
      suggestions: suggestions || null,
      customer_name: booking?.customer || booking?.customer_name
    };

    try {
      await api.submitFeedback(bookingId, payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit feedback');
      setStep('E'); // Send them back a bit to see the error
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArrayItem = (item, array, setArray) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      // Logic for "Nothing in particular"
      if (item === "Nothing in particular") {
        setArray([item]);
      } else {
        setArray([...array.filter(i => i !== "Nothing in particular"), item]);
      }
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
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle size={48} className="text-green-500" />
          </motion.div>
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
          </div>
        </div>
      </div>
    );
  }

  const renderProgress = () => {
    let progress = 0;
    if (step === 'B') progress = 25;
    if (step === 'C' || step === 'C_Detail') progress = 50;
    if (step === 'D') progress = 65;
    if (step === 'E') progress = 80;
    if (step === 'F') progress = 100;
    
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mb-6 overflow-hidden">
         <motion.div 
            className="bg-[#5FA8D3] h-1.5 rounded-full" 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
         />
      </div>
    )
  }

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  };

  const currentEmoji = getEmoji(hoveredRating || rating);
  const EmojiIcon = currentEmoji.icon;

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B0D10] py-12 px-4 flex items-center justify-center overflow-hidden">
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full border border-[#D9DEE5] dark:border-[#1F2630] shadow-xl relative min-h-[500px] flex flex-col justify-between">
        
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={prevStep}
              className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${step === 'A' ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <ChevronLeft size={24} className="text-gray-500" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-[#5FA8D3] flex items-center justify-center shadow-md">
              <span className="text-lg font-bold text-white">Rs</span>
            </div>
            <div className="w-10"></div> {/* Spacer for balance */}
          </div>

          {step !== 'A' && renderProgress()}

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* SECTION A: Overall Rating */}
            {step === 'A' && (
              <motion.div key="A" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                <h1 className="text-2xl font-bold text-center text-[#0E1116] dark:text-[#E6E8EB] mb-2">
                  How was your experience?
                </h1>
                <p className="text-center text-[#6B7280] dark:text-[#7D8590] mb-8">
                  Hi {booking?.customer || booking?.customer_name || 'there'}! Your feedback helps us improve.
                </p>

                <div className="flex justify-center mb-4">
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${(hoveredRating || rating) > 0 ? 'bg-[#5FA8D3]/10 scale-110' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <EmojiIcon size={72} className={`transition-colors duration-300 ${(hoveredRating || rating) > 0 ? currentEmoji.color : 'text-gray-300'}`} />
                  </div>
                </div>

                <div className="h-8 mb-4">
                  {(hoveredRating || rating) > 0 && (
                    <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-center text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
                      {currentEmoji.label}
                    </motion.p>
                  )}
                </div>

                <div className="flex justify-center gap-2 md:gap-4 mb-8">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        setRating(star);
                        // Optional: auto-advance after rating if we don't need 'compared to previous'
                        // setTimeout(nextStep, 500);
                      }}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-3 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all transform hover:scale-110 active:scale-95"
                    >
                      <Star size={40} className={`transition-all duration-300 ${star <= (hoveredRating || rating) ? 'text-amber-400 fill-amber-400 drop-shadow-md' : 'text-gray-300 dark:text-gray-600'}`} />
                    </button>
                  ))}
                </div>

                {rating > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-6">
                    <label className="block text-sm font-medium text-center text-[#4B5563] dark:text-[#A9AFB8] mb-4">
                      Compared to previous visits? (Optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Much better', 'Same', 'Slightly worse', 'Much worse'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setComparedToPrevious(opt)}
                          className={`py-2 px-3 rounded-xl text-sm transition-all border ${comparedToPrevious === opt ? 'bg-[#5FA8D3] text-white border-[#5FA8D3]' : 'bg-white dark:bg-[#12161A] text-gray-700 dark:text-gray-300 border-[#D9DEE5] dark:border-[#1F2630] hover:border-[#5FA8D3]/50'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* SECTION B: What Went Well */}
            {step === 'B' && (
              <motion.div key="B" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-6">
                  What did you like most today?
                </h2>
                <div className="flex flex-wrap gap-2 mb-8">
                  {POSITIVE_ASPECTS.map(aspect => (
                    <button
                      key={aspect}
                      onClick={() => toggleArrayItem(aspect, likedMost, setLikedMost)}
                      className={`py-2 px-4 rounded-full text-sm font-medium transition-all ${likedMost.includes(aspect) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-2 ring-green-500/50' : 'bg-white dark:bg-[#12161A] text-gray-600 dark:text-gray-400 border border-[#D9DEE5] dark:border-[#1F2630] hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>

                <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-6">
                  <p className="text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-3">
                    Want to shout out any staff?
                  </p>
                  <div className="flex gap-4 mb-4">
                    <button 
                      onClick={() => setShowStaffShoutout('yes')}
                      className={`flex-1 py-2 rounded-xl border transition-colors ${showStaffShoutout === 'yes' ? 'bg-[#5FA8D3] text-white border-[#5FA8D3]' : 'bg-white dark:bg-transparent border-[#D9DEE5] dark:border-[#1F2630] text-gray-600 dark:text-gray-300'}`}
                    >Yes</button>
                    <button 
                      onClick={() => {setShowStaffShoutout('no'); setStaffShoutout('');}}
                      className={`flex-1 py-2 rounded-xl border transition-colors ${showStaffShoutout === 'no' ? 'bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white' : 'bg-white dark:bg-transparent border-[#D9DEE5] dark:border-[#1F2630] text-gray-600 dark:text-gray-300'}`}
                    >No</button>
                  </div>

                  <AnimatePresence>
                    {showStaffShoutout === 'yes' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <textarea
                          placeholder="Who helped you, and what did they do well?"
                          value={staffShoutout}
                          onChange={(e) => setStaffShoutout(e.target.value)}
                          className="w-full p-3 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#12161A] text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] outline-none resize-none"
                          rows={3}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* SECTION C: What Went Wrong */}
            {step === 'C' && (
              <motion.div key="C" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">
                  We're sorry to hear that.
                </h2>
                <p className="text-[#6B7280] dark:text-[#7D8590] mb-6 text-sm">Which areas fell short? (Select all that apply)</p>
                <div className="flex flex-wrap gap-2">
                  {NEGATIVE_ASPECTS.map(aspect => (
                    <button
                      key={aspect}
                      onClick={() => toggleArrayItem(aspect, areasFellShort, setAreasFellShort)}
                      className={`py-2 px-4 rounded-full text-sm font-medium transition-all ${areasFellShort.includes(aspect) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-2 ring-red-500/50' : 'bg-white dark:bg-[#12161A] text-gray-600 dark:text-gray-400 border border-[#D9DEE5] dark:border-[#1F2630] hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SECTION C_Detail: Follow-ups */}
            {step === 'C_Detail' && (
              <motion.div key="C_Detail" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                 <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-4">
                  Tell us a bit more
                </h2>

                {areasFellShort.includes("Staff behaviour / empathy") && (
                  <div className="bg-white dark:bg-[#12161A] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Staff Behaviour</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {STAFF_ISSUES.map(issue => {
                         const currentIssues = shortcomingsDetails.staff_issues || [];
                         const isSelected = currentIssues.includes(issue);
                         return (
                          <button
                            key={issue}
                            onClick={() => {
                              const updated = isSelected ? currentIssues.filter(i => i !== issue) : [...currentIssues, issue];
                              setShortcomingsDetails({...shortcomingsDetails, staff_issues: updated});
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'}`}
                          >{issue}</button>
                         )
                      })}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Did you raise it with anyone?</p>
                      <select 
                        value={shortcomingsDetails.staff_raised || ''}
                        onChange={(e) => setShortcomingsDetails({...shortcomingsDetails, staff_raised: e.target.value})}
                        className="w-full p-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0B0D10] text-gray-800 dark:text-white outline-none"
                      >
                         <option value="">Select an option...</option>
                         <option value="Yes-handled">Yes, and it was handled</option>
                         <option value="Yes-ignored">Yes, but it was ignored</option>
                         <option value="No-uncomfortable">No, felt uncomfortable</option>
                         <option value="No-later">No, prefer to report it now</option>
                      </select>
                    </div>
                  </div>
                )}

                {areasFellShort.includes("Service result / consistency") && (
                  <div className="bg-white dark:bg-[#12161A] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Service Outcome</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {OUTCOME_ISSUES.map(issue => {
                         const currentIssues = shortcomingsDetails.outcome_issues || [];
                         const isSelected = currentIssues.includes(issue);
                         return (
                           <button
                             key={issue}
                             onClick={() => {
                               const updated = isSelected ? currentIssues.filter(i => i !== issue) : [...currentIssues, issue];
                               setShortcomingsDetails({...shortcomingsDetails, outcome_issues: updated});
                             }}
                             className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'}`}
                           >{issue}</button>
                         )
                      })}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Did the stylist check in during service?</p>
                      <select 
                        value={shortcomingsDetails.stylist_checkin || ''}
                        onChange={(e) => setShortcomingsDetails({...shortcomingsDetails, stylist_checkin: e.target.value})}
                        className="w-full p-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0B0D10] text-gray-800 dark:text-white outline-none"
                      >
                         <option value="">Select an option...</option>
                         <option value="Regularly">Yes, regularly</option>
                         <option value="Once-twice">Just once or twice</option>
                         <option value="No">No, they didn't check in</option>
                      </select>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* SECTION D: Escalation */}
            {step === 'D' && (
              <motion.div key="D" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-4">
                  We want to make this right.
                </h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                    In your own words, what went wrong? (Optional)
                  </label>
                  <textarea
                    value={escalationNotes}
                    onChange={(e) => setEscalationNotes(e.target.value)}
                    placeholder="Provide details..."
                    maxLength={400}
                    className="w-full p-3 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#12161A] text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] outline-none resize-none"
                    rows={4}
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">{escalationNotes.length}/400</div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-start gap-3 mb-4">
                     <PhoneCall className="text-red-500 shrink-0 mt-1" size={20} />
                     <div>
                       <h4 className="font-semibold text-red-800 dark:text-red-400">Can we contact you to fix this?</h4>
                       <p className="text-sm text-red-600/80 dark:text-red-400/80">Our manager will reach out personally.</p>
                     </div>
                  </div>
                  
                  <div className="flex gap-4 mb-4">
                    <button 
                      onClick={() => setContactOptIn('yes')}
                      className={`flex-1 py-2 rounded-xl border font-medium transition-colors ${contactOptIn === 'yes' ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-[#12161A] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                    >Yes, please</button>
                    <button 
                      onClick={() => setContactOptIn('no')}
                      className={`flex-1 py-2 rounded-xl border font-medium transition-colors ${contactOptIn === 'no' ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white border-gray-300' : 'bg-white dark:bg-[#12161A] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                    >No, thanks</button>
                  </div>

                  <AnimatePresence>
                    {contactOptIn === 'yes' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                         <div>
                           <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Phone Number</label>
                           <input 
                             type="tel" 
                             value={contactNumber}
                             onChange={(e) => setContactNumber(e.target.value)}
                             className="w-full p-2.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-[#12161A] text-gray-800 dark:text-white outline-none focus:border-red-400 text-sm"
                           />
                         </div>
                         <div>
                           <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Preferred Time to Call</label>
                           <select 
                            value={contactTime}
                            onChange={(e) => setContactTime(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-[#12161A] text-gray-800 dark:text-white outline-none focus:border-red-400 text-sm"
                           >
                              <option value="">Anytime</option>
                              <option value="Morning">Morning (9AM - 12PM)</option>
                              <option value="Afternoon">Afternoon (12PM - 4PM)</option>
                              <option value="Evening">Evening (4PM - 7PM)</option>
                           </select>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

             {/* SECTION E: Loyalty */}
             {step === 'E' && (
              <motion.div key="E" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-6">
                  Just two quick questions...
                </h2>

                <div className="mb-8">
                   <p className="font-medium text-gray-800 dark:text-gray-200 mb-3">How likely are you to visit us again?</p>
                   <div className="flex flex-col gap-2">
                     {['Definitely', 'Likely', 'Unsure', 'Unlikely', 'Will not'].map(opt => (
                       <button
                         key={opt}
                         onClick={() => setLikelyAgain(opt)}
                         className={`py-2 px-4 rounded-xl text-left text-sm transition-all border ${likelyAgain === opt ? 'bg-[#5FA8D3]/10 border-[#5FA8D3] text-[#5FA8D3] dark:text-[#5FA8D3] font-semibold' : 'bg-white dark:bg-[#12161A] text-gray-700 dark:text-gray-300 border-[#D9DEE5] dark:border-[#1F2630] hover:border-gray-300 dark:hover:border-gray-600'}`}
                       >{opt}</button>
                     ))}
                   </div>
                   
                   <AnimatePresence>
                    {(likelyAgain === 'Unlikely' || likelyAgain === 'Will not') && (
                       <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}>
                         <input 
                            type="text"
                            placeholder="What would bring you back?"
                            value={returnIncentive}
                            onChange={(e) => setReturnIncentive(e.target.value)}
                            className="w-full py-2 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0B0D10] text-gray-800 dark:text-white outline-none focus:border-[#5FA8D3]"
                         />
                       </motion.div>
                    )}
                   </AnimatePresence>
                </div>

                <div>
                   <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">How likely are you to recommend us to a friend?</p>
                   <div className="flex justify-between text-xs text-gray-400 mb-2 px-1">
                     <span>Not likely</span>
                     <span>Very likely</span>
                   </div>
                   <div className="flex justify-between gap-1 sm:gap-2">
                     {[0,1,2,3,4,5,6,7,8,9,10].map(score => (
                        <button
                          key={score}
                          onClick={() => setNpsScore(score)}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${npsScore === score ? 'bg-[#5FA8D3] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                          {score}
                        </button>
                     ))}
                   </div>
                </div>
              </motion.div>
             )}

             {/* SECTION F: Suggestions */}
             {step === 'F' && (
              <motion.div key="F" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col h-full">
                <div>
                  <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">
                    Any final thoughts?
                  </h2>
                  <p className="text-[#6B7280] dark:text-[#7D8590] mb-6 text-sm">
                    Feel free to share any other feedback or suggestions.
                  </p>

                  <textarea
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    placeholder="Type here..."
                    maxLength={300}
                    className="w-full p-4 rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#12161A] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] outline-none resize-none"
                    rows={5}
                  />
                  <div className="text-right text-xs text-gray-400 mt-2">{suggestions.length}/300</div>
                </div>
              </motion.div>
             )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t border-[#D9DEE5] dark:border-[#1F2630]">
          <button
            onClick={step === 'F' ? handleSubmit : nextStep}
            disabled={submitting || (step === 'A' && rating === 0)}
            className="w-full py-4 px-6 rounded-2xl font-bold tracking-wide text-white transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0]"
          >
            {submitting ? (
              'Submitting...'
            ) : step === 'F' ? (
              <>
                <CheckCircle size={20} />
                Finish
              </>
            ) : (
              <>
                Next Step
                <ChevronRight size={20} />
              </>
            )}
          </button>
          <div className="text-center mt-4">
             <span className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold opacity-50">Powered by Ri'Serve</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomerFeedback;
