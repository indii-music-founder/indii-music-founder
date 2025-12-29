import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './page';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import PasswordResetForm from './components/auth/PasswordResetForm';
import VerifyEmail from './components/auth/VerifyEmail';
import { AuthProvider } from './components/auth/AuthProvider';
import AuthLayout from './components/layouts/AuthLayout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<AuthLayout><LoginForm /></AuthLayout>} />
            <Route path="/signup" element={<AuthLayout><SignupForm /></AuthLayout>} />
            <Route path="/reset-password" element={<AuthLayout><PasswordResetForm /></AuthLayout>} />
            <Route path="/verify-email" element={<AuthLayout><VerifyEmail /></AuthLayout>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
