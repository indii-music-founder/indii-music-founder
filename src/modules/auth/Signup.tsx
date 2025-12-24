import React, { useState } from 'react';
import { AuthService } from '@/services/AuthService';
import { AuthLayout } from './components/AuthLayout';

interface SignupProps {
    onNavigate: (screen: 'login') => void;
}

export const Signup: React.FC<SignupProps> = ({ onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await AuthService.signUp(email, password, displayName);
            // Auth listener in App.tsx will handle redirect/state update
        } catch (err: any) {
            console.error("Signup Error:", err);
            setError(err.message || "Failed to sign up.");
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Create Account" subtitle="Join the future of music management">
            <form onSubmit={handleSignup} className="space-y-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Name</label>
                    <input
                        type="text"
                        required
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="Your Artist or Manager Name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Email</label>
                    <input
                        type="email"
                        required
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Password</label>
                    <input
                        type="password"
                        required
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="••••••••"
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>

                <div className="pt-4 text-center text-sm text-zinc-400">
                    Already have an account?{' '}
                    <button
                        type="button"
                        onClick={() => onNavigate('login')}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                        Sign In
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
};
