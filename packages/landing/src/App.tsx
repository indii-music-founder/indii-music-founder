import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './page';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import PasswordResetForm from './components/auth/PasswordResetForm';
import VerifyEmail from './components/auth/VerifyEmail';
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
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/record" element={<FieldRecorder />} />
  </Routes>
);

const GeneralRoutes = () => (
  <Routes>
    <Route path="/" element={
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">indii.music</h1>
          <p className="text-xl text-gray-400">The general public platform is coming soon.</p>
        </div>
      </div>
    } />
    <Route path="/login" element={<AuthLayout><LoginForm /></AuthLayout>} />
    <Route path="/signup" element={<AuthLayout><SignupForm /></AuthLayout>} />
    <Route path="/reset-password" element={<AuthLayout><PasswordResetForm /></AuthLayout>} />
    <Route path="/verify-email" element={<AuthLayout><VerifyEmail /></AuthLayout>} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/terms" element={<Terms />} />
  </Routes>
);

function App() {
  const isFounderEnv = import.meta.env.VITE_FOUNDER_MODE === 'true';
  const isFounderDomain = window.location.hostname.startsWith('founder');
  const isFounder = isFounderEnv || isFounderDomain;

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
