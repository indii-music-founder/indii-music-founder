'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmail, signInWithGoogle, getStudioUrl } from '@/app/lib/auth';
import { Loader2 } from 'lucide-react';

export default function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await signInWithEmail(email, password);
            // Redirect to studio app
            window.location.href = getStudioUrl();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
            window.location.href = getStudioUrl();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to sign in with Google.');
            setIsLoading(false); // Only stop loading on error, otherwise we redirect
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white">Welcome back</h2>
                <p className="mt-2 text-sm text-gray-400">
                    Sign in to your account
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
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

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500 sm:text-sm transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <Link
                            href="/reset-password"
                            className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            Forgot your password?
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="rounded-md bg-red-500/10 p-4 border border-red-500/20">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-400">Error</h3>
                                <div className="mt-2 text-sm text-red-300">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative flex w-full justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            'Sign in'
                        )}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-[#0a0a0a] px-2 text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="flex w-full justify-center items-center gap-3 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 border border-white/10 transition-all"
                    >
                        <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                                d="M12.0003 20.45c4.65 0 8.05-3.15 8.05-8.05 0-.75-.05-1.45-.2-2.1h-7.85v3.95h4.5c-.2 1.15-1.25 3.35-4.5 3.35-2.7 0-4.95-2.2-4.95-4.95s2.25-4.95 4.95-4.95c1.25 0 2.35.45 3.2 1.25l3.1-3.1c-2-1.85-4.6-2.95-7.3-2.95-6.05 0-11 4.95-11 11s4.95 11 11 11z"
                                fill="currentColor"
                            />
                        </svg>
                        Sign in with Google
                    </button>
                </div>

                <div className="text-center text-sm">
                    <span className="text-gray-500">Don't have an account?</span>{' '}
                    <Link
                        href="/signup"
                        className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        Sign up for free
                    </Link>
                </div>
            </form>
        </div>
    );
}
