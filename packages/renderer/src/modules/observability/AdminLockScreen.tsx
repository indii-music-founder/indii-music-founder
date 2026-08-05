import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { useGodMode } from '@/hooks/useGodMode';

interface AdminLockScreenProps {
  children: React.ReactNode;
}

/**
 * AdminLockScreen — gates the Observability/Command Center dashboard behind
 * the Firebase Auth `god_mode` custom claim. Only the platform owner can see
 * the dashboard contents. Everyone else gets a locked screen.
 */
export const AdminLockScreen: React.FC<AdminLockScreenProps> = ({ children }) => {
  const { isGodMode, loading } = useGodMode();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-slate-500 text-sm">Verifying access…</div>
      </div>
    );
  }

  if (!isGodMode) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="rounded-2xl border border-red-500/30 bg-slate-900/80 p-8 text-center max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-red-400" />
          </div>
          <h1 className="font-semibold text-white text-lg mb-2">Access Restricted</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This dashboard requires elevated platform access. Contact the platform owner if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 text-sm text-slate-300 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <ShieldAlert size={20} className="text-cyan-300" />
        </div>
        <div>
          <h1 className="font-semibold text-white">Founder telemetry surface</h1>
          <p className="text-slate-400 mt-1">
            God mode verified. Full observability access granted.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
};
