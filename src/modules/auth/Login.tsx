import React, { useState } from 'react';
import { AuthService } from '@/services/AuthService';
import { AuthLayout } from './components/AuthLayout';
import { Signup } from './Signup';
import { ForgotPassword } from './ForgotPassword';

type AuthView = 'login' | 'signup' | 'forgot';

export const AuthLogin: React.FC = () => {
    const [view, setView] = useState<AuthView>('login');

    if (view === 'signup') {
        return <Signup onNavigate={() => setView('login')} />;
    }

    if (view === 'forgot') {
        return <ForgotPassword onNavigate={() => setView('login')} />;
    }

    // Default Login View
    return <LoginForm onNavigate={setView} />;
};

interface LoginFormProps {
    onNavigate: (view: AuthView) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await AuthService.signIn(email, password);
            // App.tsx handles state update via auth listener
        } catch (err: any) {
            console.error("Login Error:", err);
            if (err.code === 'auth/invalid-credential') {
                setError("Incorrect email or password. If you signed in with Google before, try that.");
            } else {
                setError(err.message || "Failed to sign in. Check your credentials.");
            }
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            // Web: Redirects to Google (page unloads)
            // Electron: Opens popup (awaits result)
            await AuthService.signInWithGoogle();
        } catch (err: any) {
            console.error("Google Login Error:", err);
            setError(err.message || "Google sign in failed.");
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            await AuthService.signInAnonymously();
        } catch (err: any) {
            console.error("Guest Login Error:", err);
            setError(err.message || "Guest login failed.");
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Welcome Back" subtitle="Sign in to your workspace">
            <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-zinc-300">Email</label>
                    <input
                        id="email"
                        type="email"
                        required
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label htmlFor="password" className="text-sm font-medium text-zinc-300">Password</label>
                        <button
                            type="button"
                            onClick={() => onNavigate('forgot')}
                            className="text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                            Forgot password?
                        </button>
                    </div>
                    <input
                        id="password"
                        type="password"
                        required
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                    {loading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-zinc-900/50 text-zinc-500 backdrop-blur-sm">Or continue with</span>
                </div>
            </div>

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-zinc-800 text-white font-medium py-2.5 rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 border border-zinc-700"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Google
                </button>

                <button
                    type="button"
                    onClick={handleGuestLogin}
                    disabled={loading}
                    className="w-full bg-transparent text-zinc-400 font-medium py-2 rounded-lg hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    Continue as Guest
                </button>
            </div>

            <div className="pt-6 text-center text-sm text-zinc-400">
                Don't have an account?{' '}
                <button
                    type="button"
                    onClick={() => onNavigate('signup')}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                >
                    Sign Up
                </button>
            </div>
        </AuthLayout>
    );
};
