import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './page';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import PasswordResetForm from './components/auth/PasswordResetForm';
import VerifyEmail from './components/auth/VerifyEmail';
import LoginBridge from './login-bridge/page';
import { AuthProvider } from './components/auth/AuthProvider';
import AuthLayout from './components/layouts/AuthLayout';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import FieldRecorder from './pages/FieldRecorder';

const FounderRoutes = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<AuthLayout><LoginForm /></AuthLayout>} />
    <Route path="/signup" element={<AuthLayout><SignupForm /></AuthLayout>} />
    <Route path="/reset-password" element={<AuthLayout><PasswordResetForm /></AuthLayout>} />
    <Route path="/verify-email" element={<AuthLayout><VerifyEmail /></AuthLayout>} />
    <Route path="/login-bridge" element={<LoginBridge />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/record" element={<FieldRecorder />} />
  </Routes>
);

const GeneralRoutes = () => (
  <Routes>
    <Route path="/" element={<Home founder={false} />} />
    <Route path="/login" element={<AuthLayout><LoginForm /></AuthLayout>} />
    <Route path="/signup" element={<AuthLayout><SignupForm /></AuthLayout>} />
    <Route path="/reset-password" element={<AuthLayout><PasswordResetForm /></AuthLayout>} />
    <Route path="/verify-email" element={<AuthLayout><VerifyEmail /></AuthLayout>} />
    <Route path="/login-bridge" element={<LoginBridge />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
  </Routes>
);

function App() {
  const isFounderEnv = import.meta.env.VITE_FOUNDER_MODE === 'true';
  const isFounderDomain = typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.startsWith('founder');
  const isLocalhost = typeof window !== 'undefined' && window.location && window.location.hostname && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const search = typeof window !== 'undefined' && window.location && typeof window.location.search === 'string'
    ? window.location.search
    : '';
  
  // Also check if they explicitly pass a query parameter like ?founder=true or ?thesis=true
  const hasQueryFlag = search.includes('founder=true') || search.includes('thesis=true');
  // Allow forcing the public marketing page anywhere (e.g. ?public=true on localhost).
  const forcePublic = search.includes('public=true');

  const isFounder = !forcePublic && (isFounderEnv || isFounderDomain || isLocalhost || hasQueryFlag);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          {isFounder ? <FounderRoutes /> : <GeneralRoutes />}
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
