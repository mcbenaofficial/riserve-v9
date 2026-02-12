import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#222222]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#5FA8D3' }}>
            <strong className="text-3xl text-[#222222]">Ri</strong>
          </div>
          <p className="text-gray-600 dark:text-[#B5B5B5]">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
