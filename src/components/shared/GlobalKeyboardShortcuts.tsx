import React, { useState, useEffect, useCallback } from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutGroup {
    title: string;
    shortcuts: {
        keys: string[];
        description: string;
    }[];
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

const GLOBAL_SHORTCUT_GROUPS: ShortcutGroup[] = [
    {
        title: 'General',
        shortcuts: [
            { keys: ['?'], description: 'Show keyboard shortcuts' },
            { keys: ['Esc'], description: 'Close dialog / menu' },
            { keys: ['Enter'], description: 'Submit prompt / command' },
            { keys: ['Shift', 'Enter'], description: 'New line in prompt' },
        ]
    },
    {
        title: 'Video Studio',
        shortcuts: [
            { keys: [MOD, 'E'], description: 'Toggle Director / Editor mode' },
            { keys: ['Enter'], description: 'Generate video scene (in prompt bar)' },
        ]
    },
    {
        title: 'Merchandise Designer',
        shortcuts: [
            { keys: [MOD, 'Z'], description: 'Undo' },
            { keys: [MOD, '⇧', 'Z'], description: 'Redo' },
            { keys: [MOD, 'C'], description: 'Copy selected object' },
            { keys: [MOD, 'V'], description: 'Paste object' },
            { keys: [MOD, 'A'], description: 'Select all objects' },
            { keys: ['Delete'], description: 'Delete selected object' },
            { keys: [MOD, ';'], description: 'Toggle snap-to-grid' },
            { keys: [MOD, '0'], description: 'Reset zoom' },
            { keys: [MOD, '+'], description: 'Zoom in' },
            { keys: [MOD, '-'], description: 'Zoom out' },
            { keys: ['T'], description: 'Add text' },
            { keys: [MOD, 'S'], description: 'Save draft' },
            { keys: [MOD, 'E'], description: 'Export design' },
        ]
    },
];

export function GlobalKeyboardShortcuts({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-400/20 rounded-lg text-yellow-400">
                            <Keyboard size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Keyboard Shortcuts</h2>
                            <p className="text-xs text-neutral-400">All available shortcuts across indiiOS</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Shortcuts */}
                <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {GLOBAL_SHORTCUT_GROUPS.map((group, i) => (
                        <div key={group.title} className={cn("space-y-2", i > 0 && "mt-6")}>
                            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                                {group.title}
                            </h3>
                            {group.shortcuts.map(shortcut => (
                                <div
                                    key={shortcut.description}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <span className="text-sm text-neutral-300">{shortcut.description}</span>
                                    <div className="flex items-center gap-1">
                                        {shortcut.keys.map((key, j) => (
                                            <React.Fragment key={j}>
                                                <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs font-mono text-neutral-300">
                                                    {key}
                                                </kbd>
                                                {j < shortcut.keys.length - 1 && (
                                                    <span className="text-neutral-600 text-xs">+</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-neutral-950/50">
                    <p className="text-xs text-neutral-500 text-center flex items-center justify-center gap-2">
                        <Command size={12} />
                        Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-[10px] font-mono">?</kbd> anytime to show shortcuts
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Hook to globally toggle the shortcuts modal with the "?" key.
 * Install once in the app shell (e.g., App.tsx or Sidebar).
 */
export function useGlobalShortcutsModal() {
    const [isOpen, setIsOpen] = useState(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            e.preventDefault();
            setIsOpen(prev => !prev);
        }
        if (e.key === 'Escape' && isOpen) {
            setIsOpen(false);
        }
    }, [isOpen]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return { isOpen, close: () => setIsOpen(false) };
}
