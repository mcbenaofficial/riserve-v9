import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { theme, mode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] dark:bg-[#0B0D10] px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-[#D9DEE5] dark:border-[#1F2630]">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            {mode === 'zen' ? (
              <img src="/logo-zen.png" alt="Logo" className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-[#5FA8D3] shadow-lg">
                <strong className="text-3xl text-white">Rs</strong>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-[#6B7280] dark:text-[#7D8590]">
              {isRegistering ? "Join Ri'Serve Partner Portal" : 'Sign in to your account'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent bg-white/50 dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] transition-all placeholder:text-[#6B7280] dark:placeholder:text-[#7D8590]"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent bg-white/50 dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] transition-all placeholder:text-[#6B7280] dark:placeholder:text-[#7D8590]"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent bg-white/50 dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] transition-all placeholder:text-[#6B7280] dark:placeholder:text-[#7D8590]"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0]"
            >
              {loading ? 'Please wait...' : (isRegistering ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-sm text-[#6B7280] dark:text-[#7D8590] hover:text-[#0E1116] dark:hover:text-[#E6E8EB] transition-colors"
            >
              {isRegistering ? (
                <>
                  Already have an account? <span className="font-semibold text-[#5FA8D3]">Sign In</span>
                </>
              ) : (
                <>
                  Don't have an account? <span className="font-semibold text-[#5FA8D3]">Create One</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-[#6B7280] dark:text-[#7D8590]">
          © 2025 Ri'Serve Partner Portal. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
