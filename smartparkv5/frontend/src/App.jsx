import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import gsap from 'gsap';

// Pages - We will create these next
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import MallPage from './pages/MallPage';
import MyBookings from './pages/MyBookings';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppContent() {
  const appRef = useRef(null);

  useEffect(() => {
    // Initial fade in
    gsap.to(appRef.current, { opacity: 1, duration: 1, ease: 'power2.out' });
  }, []);

  return (
    <div ref={appRef} className="app-container" style={{ opacity: 0 }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/mall/:mallId" element={
          <ProtectedRoute>
            <MallPage />
          </ProtectedRoute>
        } />
        <Route path="/my-bookings" element={
          <ProtectedRoute>
            <MyBookings />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
