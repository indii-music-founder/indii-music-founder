import React, { useState } from "react";
import { createCallable } from 'react-call';
import { motion } from 'motion/react';
import { Loader2 } from "lucide-react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from '@/utils/logger';

export type NewProjectType = "creative" | "music" | "marketing" | "legal";

interface NewProjectModalProps {
  onCreate: (name: string, type: NewProjectType) => Promise<string>;
  initialName?: string;
  initialType?: NewProjectType;
}

// ISSUE-1207: converted from an isOpen/onClose-gated component to react-call
// (per CLAUDE.md's "Standardized on react-call... never fake a modal").
// Also fixes a real bug found in the process: the old isOpen/onClose version
// took an `error` prop that the only caller hardcoded to `null` and never
// wired up, so a failed onCreate() was silently swallowed with zero user
// feedback. Error state now lives here, next to the thing that can fail.
// Returns the created project's id, or null if the user cancelled/closed it.
const NewProjectModal = createCallable<NewProjectModalProps, string | null>(({
  call,
  onCreate,
  initialName = "",
  initialType = "creative",
}) => {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<NewProjectType>(initialType);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClose = () => call.end(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const id = await onCreate(name, type);
      call.end(id);
    } catch (e: unknown) {
      logger.error("Operation failed:", e);
      setError(e instanceof Error ? e.message : "Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-2xl font-bold text-white">
            Create New Project
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close modal"
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <X size={20} />
          </Button>
        </div>
        {error && (
          <div
            className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs font-bold text-white/50 uppercase mb-1"
            >
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name..."
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-base text-white focus:border-neon-purple outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 uppercase mb-1">
              Project Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["creative", "music", "marketing", "legal"].map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    setType(t as "creative" | "music" | "marketing" | "legal")
                  }
                  className={`p-3 min-h-11 rounded-lg border text-sm font-medium capitalize transition-all ${
                    type === t
                      ? "bg-neon-purple/20 border-neon-purple text-neon-purple"
                      : "bg-black/50 border-white/10 text-white/50 hover:border-white/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="flex-1 py-3 min-h-11 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="flex-1 py-3 min-h-11 bg-white hover:bg-neon-blue hover:text-black text-black rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export default NewProjectModal;
