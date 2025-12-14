import { useState } from 'react';

// ============================================================================
// AuthLogin Component - Handles user authentication
// ============================================================================

export function AuthLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            const { auth } = await import('@/services/firebase');
            await signInWithEmailAndPassword(auth, email, password);
            // Auth listener in App will handle the rest
        } catch (err: unknown) {
            console.error('[AuthLogin] Login failed:', err);
            const message = err instanceof Error ? err.message : 'Failed to sign in';
            setError(message);
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        try {
            const { signInAnonymously } = await import('firebase/auth');
            const { auth } = await import('@/services/firebase');
            await signInAnonymously(auth);
        } catch (err: unknown) {
            console.error('[AuthLogin] Guest Login Error:', err);
            const message = err instanceof Error ? err.message : 'Failed to sign in as guest';
            setError(message);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-white p-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-xl border border-border shadow-xl">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
                    <p className="text-gray-400">Sign in to Indii OS Studio</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white transition-all"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-all transform active:scale-95 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <button
                        type="button"
                        onClick={handleGuestLogin}
                        disabled={loading}
                        className="text-indigo-600 hover:text-indigo-500 font-semibold disabled:opacity-50"
                    >
                        Guest Mode (Anonymous)
                    </button>
                    <p className="mt-2">Don&apos;t have an account? Please contact your administrator.</p>
                </div>
            </div>
        </div>
    );
}
