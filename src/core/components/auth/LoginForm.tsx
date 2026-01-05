import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Loader2, Mail, Lock, LogIn, Chrome } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginForm() {
    const { loginWithGoogle, loginWithEmail, authLoading, authError } = useStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        try {
            await loginWithEmail(email, password);
        } catch (err) {
            // Error handled by store
        }
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
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-gray-600"
                                required
                            />
                        </div>
                    </div>

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
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>Sign In</span>
                                </>
                            )}
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
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
                </motion.form>
            </motion.div>

            {/* Footer */}
            <div className="absolute bottom-8 left-0 w-full text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase pointer-events-none">
                Privacy Policy • Terms of Service • © 2026 indiiOS LLC
            </div>
        </div>
    );
}
