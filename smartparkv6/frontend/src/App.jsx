import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
  const routeRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // Initial fade in
    gsap.to(appRef.current, { opacity: 1, duration: 0.2, ease: 'power1.out' });
  }, []);

  useLayoutEffect(() => {
    if (!routeRef.current) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const ctx = gsap.context(() => {
      gsap.fromTo(
        routeRef.current,
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.16, ease: 'power1.out' }
      );
    }, routeRef);

    return () => ctx.revert();
  }, [location.pathname]);

  return (
    <div ref={appRef} className="app-container" style={{ opacity: 0 }}>
      <div ref={routeRef} key={location.pathname} className="sp-route-shell">
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
