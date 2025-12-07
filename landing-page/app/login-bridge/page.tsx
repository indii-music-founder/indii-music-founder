'use client';

import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import app from '../lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginBridge() {
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState('');
    const router = useRouter();
    const auth = getAuth(app);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Determine if we are just landing here or if we just finished a popup flow
                // Check if this window was opened by window.open (popup)
                if (window.opener) {
                    // We are likely inside the popup itself? No, firebase handles popup closure.
                    // Wait, signInWithPopup opens its OWN window. We are the MAIN window.
                    setStatus('Session active. Click button to re-sync if needed.');
                } else {
                    setStatus('Ready to sign in.');
                }
            } else {
                setStatus('Ready to sign in.');
            }
        });

        return () => unsubscribe();
    }, []);

    const startSignIn = async () => {
        try {
            setStatus('Signing in with Google...');
            const provider = new GoogleAuthProvider();
            // Force account selection to ensure fresh token if needed
            provider.setCustomParameters({ prompt: 'select_account' });
            const result = await signInWithPopup(auth, provider);

            // Get the GOOGLE OAuth credential (not Firebase ID token)
            // This is required for Electron bridge - GoogleAuthProvider.credential() expects Google OAuth tokens
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const googleIdToken = credential?.idToken;
            const googleAccessToken = credential?.accessToken;

            if (googleIdToken) {
                setStatus('Authenticated. Redirecting to Indii OS...');
                // Pass Google OAuth tokens (not Firebase ID token)
                const params = new URLSearchParams();
                params.set('idToken', googleIdToken);
                if (googleAccessToken) {
                    params.set('accessToken', googleAccessToken);
                }
                window.location.href = `indii-os://auth/callback?${params.toString()}`;
                setStatus('Sign in complete. You can close this tab.');
                setTimeout(() => window.close(), 2000);
            } else {
                setError('Failed to get Google credential');
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Unknown error');
            setStatus('Sign In Failed');
        }
    };

    const handleUser = async (_user: User) => {
        // User is already authenticated - trigger fresh sign-in to get OAuth credentials
        // (onAuthStateChanged fires for cached sessions, but we need fresh Google OAuth tokens)
        setStatus('Session found. Re-authenticating...');
        startSignIn();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-sans">
            <div className="p-8 border border-neutral-800 rounded-xl bg-neutral-900/50 text-center max-w-md w-full">
                <h1 className="text-2xl font-bold mb-4">Indii OS Login</h1>

                {error ? (
                    <div className="text-red-500 mb-4 p-4 bg-red-900/20 rounded-lg">
                        {error}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 block w-full py-2 bg-red-600 rounded hover:bg-red-500"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-neutral-400">{status}</p>
                    </div>
                )}

                <div className="mt-8">
                    <button
                        onClick={startSignIn}
                        className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                        Sign in with Google
                    </button>
                    <p className="mt-4 text-xs text-neutral-500 max-w-xs mx-auto">
                        This will open a browser window to authenticate securely with Google.
                    </p>
                </div>
            </div>
        </div>
    );
}
