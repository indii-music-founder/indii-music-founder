/**
 * Item 271: Accessible Modal Wrapper
 *
 * Drop-in replacement for the ad-hoc `fixed inset-0 ... bg-black/70` pattern
 * used across 30+ modal components. Provides:
 *  - role="dialog" aria-modal="true" aria-labelledby (WCAG 2.1 AA)
 *  - useFocusTrap: Tab/Shift+Tab cycles only through focusable children
 *  - Escape key dismissal
 *  - Backdrop click-to-close
 *  - AnimatePresence entry/exit animation
 *
 * Usage:
 * ```tsx
 * <Modal isOpen={isOpen} onClose={onClose} titleId="my-modal-title">
 *   <h2 id="my-modal-title">Title</h2>
 *   ...content...
 * </Modal>
 * ```
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Must match the `id` of the element providing the dialog title (aria-labelledby) */
    titleId: string;
    children: React.ReactNode;
    /** Max-width class for the inner panel. Defaults to 'max-w-2xl' */
    maxWidth?: string;
    /** Additional class names for the inner panel */
    className?: string;
}

export function Modal({ isOpen, onClose, titleId, children, maxWidth = 'max-w-2xl', className = '' }: ModalProps) {
    const trapRef = useFocusTrap(isOpen);

    // Escape key closes modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    <motion.div
                        ref={trapRef}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`w-full ${maxWidth} bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden ${className}`}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
