import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MICRO_FEATURES = [
  "Intelligent scheduling that anticipates demand",
  "Zero-touch operations across staff & resources",
  "Real-time visibility and control at scale"
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [featureIndex, setFeatureIndex] = useState(0);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % MICRO_FEATURES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDevBypass = async () => {
    setError('');
    setLoading(true);
    try {
      const axios = (await import('axios')).default;
      const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      const response = await axios.post(`${API_BASE}/api/auth/dev-bypass`);
      const { access_token, user: u } = response.data;
      localStorage.setItem('ridn_token', access_token);
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Dev bypass failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row relative bg-[#282524] overflow-hidden font-sans selection:bg-[#17A2B8]/30 selection:text-white dark">
      {/* 
        The 'dark' class above explicitly forces a dark context if tailwind themes rely on it.
        We are hardcoding dark aesthetics across both columns for the exact prompt specifications.
      */}

      {/* Global Image Background overlapping perfectly and fading into the right panel */}
      <motion.div
           className="absolute inset-0 bg-cover bg-center lg:bg-left-top"
           style={{ backgroundImage: `url('/dashboard-visual.png')` }}
           initial={{ scale: 1.05 }}
           animate={{ scale: 1 }}
           transition={{ duration: 15, ease: "easeOut" }}
      />
      {/* Desktop right fade */}
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-transparent via-[#282524]/70 to-[#282524] z-0 pointer-events-none" />
      {/* Bottom fade for text readability (Globally spanning to avoid vertical lines) */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#282524] via-[#282524]/40 to-transparent opacity-80 z-0 pointer-events-none" />
      {/* Slight uniform dim */}
      <div className="absolute inset-0 bg-[#282524]/20 z-0 pointer-events-none" />

      {/* LEFT SECTION - VISUAL TEXT OVERLAY */}
      <div className="w-full h-48 sm:h-56 lg:h-screen lg:w-[55%] relative flex flex-col z-10 pointer-events-none">

        {/* Content Wrapper */}
        <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-16 pointer-events-auto">
          {/* Logo */}
          <div className="flex items-center mb-6">
            <img src="/riserve-lockup-dark.png" alt="Ri'SERVE" className="h-[40px] lg:h-[48px] w-auto object-contain drop-shadow-[0_4px_20px_rgba(255,255,255,0.1)]" />
          </div>

          {/* Bottom Statement & Micro-features (Hidden on small mobile) */}
          <div className="hidden sm:block mt-auto pb-4">
            <h2 className="text-2xl lg:text-4xl font-light text-[#F3F4F6] tracking-wide leading-snug max-w-lg mb-6">
              Orchestrate every booking with precision.
            </h2>
            
            <div className="h-8 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={featureIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="text-[#9CA3AF] text-sm lg:text-[15px] font-light tracking-wide absolute"
                >
                  {MICRO_FEATURES[featureIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION - FORM (45%) */}
      <div className="w-full lg:w-[45%] flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16 relative z-20 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="w-full max-w-md bg-[#1C1A19]/90 backdrop-blur-md rounded-2xl p-8 sm:p-12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.5)] border border-[#363230]"
        >
          {/* Form Header */}
          <div className="mb-10 text-left">
            <h1 className="text-[28px] lg:text-[32px] font-semibold text-[#F3F4F6] tracking-[0.02em] mb-3">
              Sign in
            </h1>
            <p className="text-[#9CA3AF] font-light tracking-wide text-[15px]">
               Continue to Ri'SERVE.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8 p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-sm font-light tracking-wide text-center"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2.5">
              <label className="block text-[11px] font-medium text-[#7D8590] uppercase tracking-widest ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#141312] border border-[#363230] rounded-xl text-[#F3F4F6] placeholder:text-[#525252] focus:outline-none focus:border-[#17A2B8]/80 focus:ring-1 focus:ring-[#17A2B8]/50 focus:shadow-[0_0_15px_rgba(23,162,184,0.15)] transition-all font-light"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-[11px] font-medium text-[#7D8590] uppercase tracking-widest">
                  Password
                </label>
                <button type="button" className="text-xs text-[#525252] hover:text-[#17A2B8] transition-colors font-light">
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#141312] border border-[#363230] rounded-xl text-[#F3F4F6] placeholder:text-[#525252] focus:outline-none focus:border-[#17A2B8]/80 focus:ring-1 focus:ring-[#17A2B8]/50 focus:shadow-[0_0_15px_rgba(23,162,184,0.15)] transition-all font-light tracking-widest"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center space-x-3 pt-2 ml-1">
              <input 
                type="checkbox" 
                id="remember" 
                className="w-4 h-4 rounded border-[#363230] bg-[#141312] text-[#17A2B8] focus:ring-[#17A2B8]/30 cursor-pointer transition-colors"
              />
              <label htmlFor="remember" className="text-sm text-[#7D8590] cursor-pointer font-light select-none hover:text-[#D1D5DB] transition-colors">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full !mt-8 py-4 rounded-xl text-sm font-medium text-[#F3F4F6] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[#2E2A28] border border-transparent hover:border-[#17A2B8]/50 hover:bg-[#1A5B6B] hover:text-white hover:shadow-[0_0_20px_rgba(23,162,184,0.2)] hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden"
            >
              <span className="relative z-10 tracking-wide">{loading ? 'Authenticating...' : 'Sign in'}</span>
            </button>
          </form>

          {/* Dev Bypass Button */}
          <button
            onClick={handleDevBypass}
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl text-xs font-medium text-[#D4AF37] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[#D4AF37]/5 border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] active:translate-y-0 relative overflow-hidden tracking-widest uppercase"
          >
            ⚡ Dev Login — admin@ridn.com
          </button>
        </motion.div>

        {/* Footer Links outside the card */}
        <div className="mt-8 text-center text-[13px]">
          <span className="font-light text-[#6B7280] tracking-wide">
            Don’t have access yet? <Link to="/signup" className="text-[#17A2B8] font-normal hover:underline underline-offset-4 decoration-1">Request early access</Link>
          </span>
        </div>

      </div>
    </div>
  );
};

export default Login;
