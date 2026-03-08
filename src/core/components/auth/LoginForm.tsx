import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Loader2, Mail, Lock, LogIn, Chrome, User, UserPlus, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Item 305: COPPA Age Gate Utility
 * Calculate age from date of birth string. Returns -1 if invalid.
 */
function calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return -1;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

export default function LoginForm() {
    const { loginWithGoogle, loginWithEmail, signUpWithEmail, loginAsGuest, authLoading, authError, isSignUpMode, setSignUpMode } = useStore(useShallow(state => ({
        loginWithGoogle: state.loginWithGoogle,
        loginWithEmail: state.loginWithEmail,
        signUpWithEmail: state.signUpWithEmail,
        loginAsGuest: state.loginAsGuest,
        authLoading: state.authLoading,
        authError: state.authError,
        isSignUpMode: state.isSignUpMode,
        setSignUpMode: state.setSignUpMode,
    })));
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');

    useEffect(() => {
        const path = window.location.pathname;
        if (path === '/signup' || path === '/register') {
            useStore.setState({ isSignUpMode: true });
        } else if (path === '/signin' || path === '/login') {
            useStore.setState({ isSignUpMode: false });
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        if (isSignUpMode) {
            // COPPA Age Gate (Item 305)
            if (!dateOfBirth) {
                useStore.setState({ authError: 'Date of birth is required to create an account.' });
                return;
            }
            const age = calculateAge(dateOfBirth);
            if (age < 0) {
                useStore.setState({ authError: 'Please enter a valid date of birth.' });
                return;
            }
            if (age < 13) {
                useStore.setState({ authError: 'You must be at least 13 years old to create an account (COPPA compliance).' });
                return;
            }

            if (password !== confirmPassword) {
                useStore.setState({ authError: 'Passwords do not match.' });
                return;
            }
            if (password.length < 6) {
                useStore.setState({ authError: 'Password must be at least 6 characters.' });
                return;
            }
            try {
                await signUpWithEmail(email, password);
            } catch (_err) {
                // Error handled by store
            }
        } else {
            try {
                await loginWithEmail(email, password);
            } catch (_err) {
                // Error handled by store
            }
        }
    };

    const toggleMode = () => {
        setSignUpMode(!isSignUpMode);
        setConfirmPassword('');
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white relative overflow-hidden">
            {/* Background Aesthetics */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 pointer-events-none" />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            >
                <div className="text-center mb-8">
                    <motion.h1
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="text-5xl font-black mb-2 tracking-tighter"
                    >
                        indii<span className="text-purple-500">OS</span>
                    </motion.h1>
                    <p className="text-gray-400 font-mono text-xs uppercase tracking-[0.2em]">Alpha Build • Studio HQ</p>
                </div>

                <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <label className="text-xs font-mono text-gray-400 block ml-1 uppercase">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                aria-label="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="artist@indiios.com"
                                autoComplete="email"
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-gray-600"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-mono text-gray-400 block ml-1 uppercase">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                aria-label="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-gray-600"
                                required
                            />
                        </div>
                    </div>

                    {/* Confirm Password & Date of Birth — only in Sign Up mode */}
                    <AnimatePresence mode="wait">
                        {isSignUpMode && (
                            <motion.div
                                key="signup-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4 overflow-hidden"
                            >
                                {/* Confirm Password */}
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-gray-400 block ml-1 uppercase">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            aria-label="confirm password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-gray-600"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* COPPA Age Gate (Item 305) */}
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-gray-400 block ml-1 uppercase">Date of Birth</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            aria-label="date of birth"
                                            type="date"
                                            value={dateOfBirth}
                                            onChange={(e) => setDateOfBirth(e.target.value)}
                                            max={new Date().toISOString().split('T')[0]}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all text-white [color-scheme:dark]"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-500 ml-1">You must be 13 or older to create an account.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {authError && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-400 text-xs font-mono text-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                        >
                            {authError}
                        </motion.p>
                    )}

                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={authLoading}
                            className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-500 transition-all shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        >
                            {authLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isSignUpMode ? (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    <span>Create Account</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>Sign In</span>
                                </>
                            )}
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        </button>
                    </div>

                    {/* Toggle between Sign In and Create Account */}
                    <div className="text-center pt-1">
                        <button
                            type="button"
                            onClick={toggleMode}
                            className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
                            data-testid="toggle-auth-mode"
                        >
                            {isSignUpMode ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
                        </button>
                    </div>

                    <div className="relative flex items-center gap-4 my-6">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-xs text-gray-500 font-mono">OR</span>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <button
                        type="button"
                        onClick={loginWithGoogle}
                        disabled={authLoading}
                        className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-semibold hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                        <Chrome className="w-5 h-5" />
                        <span>Continue with Google</span>
                    </button>

                    {import.meta.env.DEV && (
                        <div className="pt-4 animate-fade-in-up delay-200">
                            <button
                                type="button"
                                onClick={loginAsGuest}
                                disabled={authLoading}
                                className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 text-purple-200 rounded-2xl font-semibold hover:bg-purple-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                                <User className="w-5 h-5" />
                                <span>Guest Login (Dev)</span>
                            </button>
                            <p className="text-center text-[10px] text-gray-500 mt-2 font-mono">
                                BYPASS AUTHENTICATION FOR LOCAL DEV
                            </p>
                        </div>
                    )}
                </motion.form>
            </motion.div>

            {/* Footer */}
            <div className="absolute bottom-8 left-0 w-full text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase pointer-events-none">
                Privacy Policy • Terms of Service • © 2026 indiiOS LLC
            </div>
        </div>
    );
}
