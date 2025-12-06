'use client';

import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '../../lib/firebase'; // Adjust import based on your structure
import { useRouter } from 'next/navigation';

export default function LoginBridge() {
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState('');
    const router = useRouter();
    const auth = getAuth(app);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                handleUser(user);
            } else {
                setStatus('Signing in with Google...');
                startSignIn();
            }
        });

        return () => unsubscribe();
    }, []);

    const startSignIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            // Force account selection to ensure fresh token if needed
            provider.setCustomParameters({ prompt: 'select_account' });
            const result = await signInWithPopup(auth, provider);
            handleUser(result.user);
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Unknown error');
            setStatus('Sign In Failed');
        }
    };

    const handleUser = async (user: User) => {
        setStatus('Authenticated. Redirecting to Indii OS...');
        try {
            const token = await user.getIdToken();
            // Redirect to custom protocol
            window.location.href = `indii-os://auth/callback?token=${token}`;
            setStatus('Sign in complete. You can close this tab.');
            // Optional: Close window after delay
            setTimeout(() => window.close(), 2000);
        } catch (e: any) {
            setError('Failed to get token: ' + e.message);
        }
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
            </div>
        </div>
    );
}
