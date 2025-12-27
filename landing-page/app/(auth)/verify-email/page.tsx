'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { applyActionCode } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';
import Link from 'next/link';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
        if (!mode && !oobCode) return 'error';
        return 'loading';
    });
    const [error, setError] = useState<string | null>(() => {
        if (!mode && !oobCode) return 'Missing verification info.';
        return null;
    });

    useEffect(() => {
        async function verify() {
            if (!oobCode) return; // Should be handled by initial state, but safe guard
            if (!auth) {
                setStatus('error');
                setError('Authentication service not available');
                return;
            }

            try {
                await applyActionCode(auth, oobCode);
                setStatus('success');
            } catch (err: unknown) {
                console.error(err);
                setStatus('error');
                const errorMessage = err instanceof Error ? err.message : 'Failed to verify email.';
                setError(errorMessage);
            }
        }

        if (mode === 'verifyEmail' && oobCode) {
            verify();
        }
    }, [mode, oobCode]);

    if (status === 'loading') {
        return (
            <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto" />
                <h2 className="mt-4 text-xl font-bold text-white">Verifying email...</h2>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="text-center space-y-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <div>
                    <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
                    <p className="mt-2 text-gray-400">Your account has been successfully verified.</p>
                </div>
                <div>
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
                    >
                        Continue to Sign in
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="text-center space-y-6">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <div>
                <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
                <p className="mt-2 text-red-300">{error}</p>
            </div>
            <div>
                <Link
                    href="/login"
                    className="text-gray-400 hover:text-white underline transition-colors"
                >
                    Back to Login
                </Link>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <div className="flex flex-col items-center">
            <Link href="/" className="mb-8 text-2xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
                indiiOS
            </Link>
            <div className="w-full max-w-md bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl">
                <Suspense fallback={<div className="text-center text-white">Loading...</div>}>
                    <VerifyEmailContent />
                </Suspense>
            </div>
        </div>
    );
}
