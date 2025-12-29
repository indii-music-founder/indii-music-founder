'use client';

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, getStudioUrl } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function LoginForm() {
    // const router = useRouter(); // Unused
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await signInWithEmail(email, password);
            // Redirect to studio app
            window.location.href = getStudioUrl();
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="w-full max-w-md space-y-8 bg-black/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white">Welcome back</h2>
                <p className="mt-2 text-sm text-gray-400">
                    Sign in to your account
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
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
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500 sm:text-sm transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <Link
                            to="/reset-password"
                            className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            Forgot your password?
                        </Link>
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
                            'Sign in'
                        )}
                    </button>


                </div>

                <div className="text-center text-sm">
                    <span className="text-gray-500">Don&apos;t have an account?</span>{' '}
                    <Link
                        to="/signup"
                        className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        Sign up for free
                    </Link>
                </div>
            </form>
        </div>
    );
}
