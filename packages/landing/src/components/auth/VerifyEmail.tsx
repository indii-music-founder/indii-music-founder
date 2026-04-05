import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';

// NOTE: This component was originally in (auth)/verify-email/page.tsx
export default function VerifyEmail() {
    // In a real app, useSearchParams from react-router-dom would be used to get tokens
    // but here we just show the static UI for the landing page.
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email');

    return (
        <div className="w-full max-w-md space-y-8 bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
             <h2 className="text-3xl font-bold tracking-tight text-white">Check your email</h2>
             <p className="mt-2 text-sm text-gray-400">
                 We've sent a verification link to <span className="font-semibold text-white">{email || 'your email'}</span>.
             </p>
             <p className="text-xs text-gray-500 mt-4">
                 Click the link in the email to activate your account.
             </p>
             <div className="mt-8">
                 <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm font-medium">
                     Back to Sign in
                 </Link>
             </div>
        </div>
    );
}
