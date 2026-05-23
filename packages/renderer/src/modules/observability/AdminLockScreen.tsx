import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, ShieldAlert, KeyRound } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface AdminLockScreenProps {
  children: React.ReactNode;
}

export const AdminLockScreen: React.FC<AdminLockScreenProps> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    // Check session storage on mount safely
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('indii_admin_unlocked') === 'true';
    }
    return false;
  });
  const [pin, setPin] = useState('');
  const { showToast } = useToast();

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default fallback to '1234' for local dev if missing
    const correctPin = import.meta.env.VITE_ADMIN_PIN || '1234';
    
    if (pin === correctPin) {
      sessionStorage.setItem('indii_admin_unlocked', 'true');
      setIsUnlocked(true);
      showToast('Command Center unlocked', 'success');
    } else {
      showToast('Access Denied. Invalid PIN.', 'error');
      setPin('');
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center h-full min-h-[500px] w-full bg-slate-900/20 p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-red-500 via-orange-500 to-red-500"></div>
        
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert size={32} className="text-red-400" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Restricted Access</h1>
            <p className="text-sm text-slate-400">
              The Command Center requires an administrative PIN.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="w-full space-y-4">
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all text-center tracking-[0.5em] font-mono text-lg"
                autoFocus
                maxLength={8}
              />
            </div>
            
            <button
              type="submit"
              disabled={pin.length < 4}
              className="w-full py-3 px-4 bg-red-500 hover:bg-red-400 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <Lock size={16} /> Unlock
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
