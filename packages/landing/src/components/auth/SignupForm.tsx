'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { signUpWithEmail, getStudioUrl, refreshEmailVerification, resendEmailVerification } from '@/lib/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { flushFounderFunnelQueue, trackFounderFunnelEvent } from '@/lib/founderFunnel';
import { Loader2 } from 'lucide-react';
import FounderPreviewContext from './FounderPreviewContext';

export default function SignupForm() {
    // const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
    const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

    // Detect founder traffic via ?source=founder query param
    const isFounderSource = typeof window !== 'undefined' &&
        (window.location.search.includes('source=founder') ||
         window.location.hostname.startsWith('founder'));
    const sourceSuffix = isFounderSource ? '?source=founder' : '';

    useEffect(() => {
        flushFounderFunnelQueue();
        if (isFounderSource) {
            void trackFounderFunnelEvent('founder_auth_viewed', {
                variant: 'signup',
            });
        }
    }, [isFounderSource]);

    useEffect(() => {
        // Skip if Firebase not initialized (SSR/build time)
        if (!auth) return;

        // An Auth session alone is not admission to Studio. Verified email is
        // required before any creative allowance can be requested server-side.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user?.emailVerified) {
                window.location.href = getStudioUrl();
            } else if (user) {
                setVerificationEmail(user.email || 'your email address');
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isFounderSource) {
                await trackFounderFunnelEvent('founder_auth_submitted', {
                    variant: 'signup',
                });
            }
            const user = await signUpWithEmail(email, password, displayName);
            if (isFounderSource) {
                await trackFounderFunnelEvent('founder_auth_completed', {
                    variant: 'signup',
                }, {
                    userId: user.uid,
                    email: user.email,
                });
            }
            if (user.emailVerified) {
                window.location.href = getStudioUrl();
                return;
            }
            setVerificationEmail(user.email || email);
            setVerificationNotice('We sent a verification link. Open it, then return here to continue.');
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to create account.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerificationCheck = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const isVerified = await refreshEmailVerification();
            if (!isVerified) {
                setError('Your email is not verified yet. Open the verification link, then try again.');
                return;
            }
            window.location.href = getStudioUrl();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to refresh your verification status.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await resendEmailVerification();
            setVerificationNotice('A fresh verification link has been sent.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to resend the verification email.');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="w-full max-w-md space-y-8 bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white">
                    {isFounderSource ? 'Create Your Founder Preview Account' : 'Create account'}
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                    {isFounderSource
                        ? 'Create your founder preview account to enter the guided walkthrough.'
                        : 'Start your journey with indii'
                    }
                </p>
            </div>

            <FounderPreviewContext variant="signup" />

            {verificationEmail ? (
                <div className="space-y-4 text-center">
                    <p className="text-sm text-gray-300">
                        Verify <span className="font-medium text-white">{verificationEmail}</span> before opening Studio.
                    </p>
                    {verificationNotice && <p className="text-sm text-emerald-300">{verificationNotice}</p>}
                    {error && <p className="text-sm text-red-300">{error}</p>}
                    <button
                        type="button"
                        onClick={handleVerificationCheck}
                        disabled={isLoading}
                        className="flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'I verified my email'}
                    </button>
                    <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isLoading}
                        className="w-full text-sm font-medium text-purple-300 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Send a new verification link
                    </button>
                </div>
            ) : (

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                            Full Name
                        </label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="mt-1 block w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500 sm:text-sm transition-colors"
                            placeholder="Your Name"
                        />
                    </div>

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
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500 sm:text-sm transition-colors"
                            placeholder="Min. 8 characters"
                        />
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
                        className="group relative flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            'Create account'
                        )}
                    </button>


                </div>

                <div className="text-center text-sm">
                    <span className="text-gray-500">Already have an account?</span>{' '}
                    <Link
                        to={`/login${sourceSuffix}`}
                        className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        Sign in
                    </Link>
                </div>
            </form>
            )}
        </div>
    );
}
