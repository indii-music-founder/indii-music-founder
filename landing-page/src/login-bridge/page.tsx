'use client';

import { useEffect, useState, useRef } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, UserCredential } from 'firebase/auth';
import app from '../lib/firebase';

export default function LoginBridge() {
    const [status, setStatus] = useState<'loading' | 'ready' | 'authenticating' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!app) {
            setError('Firebase not initialized');
            setStatus('error');
            return;
        }
        const auth = getAuth(app);

        // Check if already logged in - but we need to force a fresh sign-in to get OAuth tokens
        // So we just set status to ready
        const unsubscribe = onAuthStateChanged(auth, () => {
            setStatus('ready');
        });

        return () => unsubscribe();
    }, []);

    const redirectToApp = (idToken: string, accessToken?: string) => {
        setStatus('success');
        try {
            // Redirect back to Electron app via deep link with OAuth credentials
            const params = new URLSearchParams();
            params.append('idToken', idToken);
            if (accessToken) params.append('accessToken', accessToken);

            const callbackUrl = `indii-os://auth/callback?${params.toString()}`;
            window.location.href = callbackUrl;
        } catch (err) {
            console.error('Failed to redirect:', err);
            setError('Failed to complete authentication');
            setStatus('error');
        }
    };

    const handleGoogleSignIn = async () => {
        setStatus('authenticating');
        setError(null);

        try {
            if (!app) throw new Error('Firebase not initialized');
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');

            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);

            if (!credential?.idToken) {
                throw new Error('No ID token in Google credential');
            }

            redirectToApp(credential.idToken, credential.accessToken);
        } catch (err: any) {
            console.error('Google Sign-In Error:', err);
            setError(err.message || 'Google sign-in failed');
            setStatus('error');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-sans">
            <div className="p-8 border border-neutral-800 rounded-xl bg-neutral-900/50 text-center max-w-md w-full">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-2">indiiOS</h1>
                    <p className="text-neutral-400 text-sm">Sign in to continue to the app</p>
                </div>

                {status === 'loading' && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                )}

                {status === 'ready' && (
                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>
                )}

                {status === 'authenticating' && (
                    <div className="py-8">
                        <div className="flex items-center justify-center mb-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                        </div>
                        <p className="text-neutral-400">Signing in...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="py-8">
                        <div className="flex items-center justify-center mb-4">
                            <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-emerald-400 font-medium">Success! Redirecting to app...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="py-4">
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-4">
                            {error || 'An error occurred'}
                        </div>
                        <button
                            onClick={() => setStatus('ready')}
                            className="px-6 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                <div className="mt-6 pt-6 border-t border-neutral-800">
                    <p className="text-neutral-500 text-xs">
                        This page authenticates you with Google and redirects back to the indiiOS desktop app.
                    </p>
                </div>
            </div>
        </div>
    );
}
