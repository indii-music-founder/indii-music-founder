'use client';

import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import app from '../lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginBridge() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-sans">
            <div className="p-8 border border-neutral-800 rounded-xl bg-neutral-900/50 text-center max-w-md w-full">
                <h1 className="text-2xl font-bold mb-4">Login Bridge</h1>
                <p className="text-neutral-400 mb-6">
                    Google Sign-In is currently disabled. Please use Email/Password login in the main application.
                </p>
                <a
                    href="/login"
                    className="inline-block px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Go to Login
                </a>
            </div>
        </div>
    );
}
