import React, { useState } from 'react';
import { AuthService } from '@/services/AuthService';
import { AuthLayout } from './components/AuthLayout';

interface ForgotPasswordProps {
    onNavigate: (screen: 'login') => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigate }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            await AuthService.sendPasswordReset(email);
            setMessage("Password reset email sent. Check your inbox.");
            setLoading(false);
        } catch (err: any) {
            console.error("Reset Error:", err);
            setError(err.message || "Failed to send reset email.");
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Reset Password" subtitle="Enter your email to receive a reset link">
            <form onSubmit={handleReset} className="space-y-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}
                {message && (
                    <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-3 rounded-md text-sm">
                        {message}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Email</label>
                    <input
                        type="email"
                        required
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="pt-4 text-center">
                    <button
                        type="button"
                        onClick={() => onNavigate('login')}
                        className="text-zinc-400 hover:text-white text-sm transition-colors"
                    >
                        &larr; Back to Login
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
};
