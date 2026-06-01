import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { auth } from '../firebase';

/**
 * Admin sign-in. Authenticates against Firebase, then the dashboard verifies the
 * account is an @indii.music admin (App.tsx + the backend both enforce this).
 * No bypass, no mock auth — a real Firebase session or nothing.
 */
export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Auth state is observed in App.tsx; no manual navigation needed.
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Incorrect email or password.'
          : 'Sign-in failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0A0A0B] text-white font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm bg-[#121214] border border-white/5 rounded-3xl p-8 space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">indii Admin</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Restricted Access</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            placeholder="you@indii.music"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
        </button>

        <p className="text-[11px] text-white/30 text-center">Requires an @indii.music admin account.</p>
      </form>
    </div>
  );
};
