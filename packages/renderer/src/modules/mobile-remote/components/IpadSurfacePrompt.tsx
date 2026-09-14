/**
 * IpadSurfacePrompt — Interactive choice modal for iPad/tablet visitors on /mobile-remote.
 * Prompts whether they want to open the full Web Studio or use the companion Remote Controller.
 */

import React from 'react';
import { Tablet, Monitor, Smartphone, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerHaptic } from '../haptics';

interface IpadSurfacePromptProps {
  isOpen: boolean;
  onDismiss: () => void;
  onOpenStudio?: () => void;
}

export const IPAD_REMOTE_PROMPT_KEY = 'indii_ipad_remote_prompt_dismissed';

export default function IpadSurfacePrompt({
  isOpen,
  onDismiss,
  onOpenStudio,
}: IpadSurfacePromptProps) {
  if (!isOpen) return null;

  const handleOpenStudio = () => {
    triggerHaptic();
    if (onOpenStudio) {
      onOpenStudio();
    } else {
      window.location.href = '/';
    }
  };

  const handleUseRemote = () => {
    triggerHaptic();
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(IPAD_REMOTE_PROMPT_KEY, 'true');
      } catch {
        // Ignore session storage errors
      }
    }
    onDismiss();
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ipad-prompt-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-md w-full bg-[#16161a] border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden"
        >
          {/* Subtle Ambient Background Gradient */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            onClick={handleUseRemote}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center">
            {/* Device Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-blue-400 shadow-inner">
              <Tablet className="w-7 h-7" />
            </div>

            <h2 id="ipad-prompt-title" className="text-xl font-bold text-white tracking-tight">
              Open Web Studio or Remote?
            </h2>

            <p className="mt-2 text-sm text-zinc-300 leading-relaxed max-w-sm">
              You are viewing indii on an iPad. You can launch the full Web Studio or use this device as a companion Remote Controller.
            </p>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={handleOpenStudio}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer group"
              >
                <Monitor className="w-4 h-4 text-black" />
                <span>Open Web Studio</span>
                <ArrowRight className="w-4 h-4 text-black/70 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={handleUseRemote}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-zinc-400" />
                <span>Launch Remote Controller</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
