'use client';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '@/lib/auth';
import { Loader2, CheckCircle } from 'lucide-react';

export default function PasswordResetForm() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await resetPassword(email);
            setIsSent(true);
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSent) {
        return (
            <div className="w-full max-w-md space-y-8 bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl text-center">
                <div className="flex justify-center">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">Check your email</h2>
                <p className="text-gray-400">
                    We sent a password reset link to <strong className="text-white">{email}</strong>
                </p>
                <div className="pt-4">
                    <Link
                        to="/login"
                        className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                    >
                        Back to Sign in
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md space-y-8 bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white">Reset Password</h2>
                <p className="mt-2 text-sm text-gray-400">
                    Enter your email to receive a reset link
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500 sm:text-sm transition-colors"
                        placeholder="you@example.com"
                    />
                </div>

                {error && (
                    <div className="rounded-md bg-red-500/10 p-4 border border-red-500/20">
                        <h3 className="text-sm font-medium text-red-400">Error</h3>
                        <p className="mt-1 text-sm text-red-300">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative flex w-full justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        'Send Reset Link'
                    )}
                </button>

                <div className="text-center text-sm">
                    <Link
                        to="/login"
                        className="font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        &larr; Back to Log in
                    </Link>
                </div>
            </form>
        </div>
    );
}
