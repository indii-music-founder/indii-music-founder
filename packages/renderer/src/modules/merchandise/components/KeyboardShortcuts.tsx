import React, { useState, useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ShortcutGroup {
    title: string;
    shortcuts: {
        keys: string[];
        description: string;
    }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
    {
        title: 'Canvas Actions',
        shortcuts: [
            { keys: ['⌘', 'Z'], description: 'Undo' },
            { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
            { keys: ['⌘', 'C'], description: 'Copy selected' },
            { keys: ['⌘', 'V'], description: 'Paste' },
            { keys: ['⌘', 'A'], description: 'Select all' },
            { keys: ['Delete'], description: 'Delete selected' },
        ]
    },
    {
        title: 'View Controls',
        shortcuts: [
            { keys: ['⌘', ';'], description: 'Toggle snap-to-grid' },
            { keys: ['⌘', '0'], description: 'Reset zoom' },
            { keys: ['⌘', '+'], description: 'Zoom in' },
            { keys: ['⌘', '-'], description: 'Zoom out' },
        ]
    },
    {
        title: 'Quick Actions',
        shortcuts: [
            { keys: ['T'], description: 'Add text' },
            { keys: ['⌘', 'S'], description: 'Save draft' },
            { keys: ['⌘', 'E'], description: 'Export' },
        ]
    }
];

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-400/20 rounded-lg text-yellow-400">
                            <Keyboard size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Keyboard Shortcuts</h2>
                            <p className="text-xs text-neutral-400">Speed up your workflow</p>
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
                    {SHORTCUT_GROUPS.map((group, i) => (
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
};

// Hook to show shortcuts on "?" key press
export const useKeyboardShortcutsHint = () => {
    const [showShortcuts, setShowShortcuts] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Show shortcuts on "?" key (Shift + /)
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                // Don't trigger if user is typing in an input
                if (
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement
                ) {
                    return;
                }
                e.preventDefault();
                setShowShortcuts(prev => !prev);
            }

            // Close on Escape
            if (e.key === 'Escape' && showShortcuts) {
                setShowShortcuts(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showShortcuts]);

    return { showShortcuts, setShowShortcuts };
};

export default KeyboardShortcuts;
