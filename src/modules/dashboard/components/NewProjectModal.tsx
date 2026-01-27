import React, { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    type: "creative" | "music" | "marketing" | "legal",
  ) => Promise<void>;
  error: string | null;
  initialName?: string;
  initialType?: "creative" | "music" | "marketing" | "legal";
}

export default function NewProjectModal({
  isOpen,
  onClose,
  onCreate,
  error,
  initialName = "",
  initialType = "creative",
}: NewProjectModalProps) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<
    "creative" | "music" | "marketing" | "legal"
  >(initialType);
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setType(initialType);
      setIsCreating(false);
    }
  }, [isOpen, initialName, initialType]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreate(name, type);
    } catch (e) {
      // Parent component handles error display via 'error' prop
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

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
}
