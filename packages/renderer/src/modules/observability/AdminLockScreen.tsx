import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AdminLockScreenProps {
  children: React.ReactNode;
}

export const AdminLockScreen: React.FC<AdminLockScreenProps> = ({ children }) => {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 text-sm text-slate-300 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <ShieldAlert size={20} className="text-cyan-300" />
        </div>
        <div>
          <h1 className="font-semibold text-white">Founder telemetry surface</h1>
          <p className="text-slate-400 mt-1">
            This dashboard is intentionally visible. There is no client-side PIN or sessionStorage bypass.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
};
