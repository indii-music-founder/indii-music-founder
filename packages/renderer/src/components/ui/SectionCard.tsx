import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SectionCardProps {
    title: ReactNode;
    icon?: ReactNode;
    children: ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}

/**
 * SectionCard — the shared single-open disclosure primitive.
 *
 * Promoted from StudioControlsPanel (ISSUE-1440): control-dense panels
 * (OmniWorkflow controller, QCPanel metadata, ReleaseWizard metadata) were
 * dumping every control into one scroll column. This is the house pattern for
 * collapsing secondaries while keeping a visible spine: a header button with a
 * rotating chevron and an animated height reveal.
 *
 * The open state lives with the caller, so a parent can implement
 * single-open behavior or auto-open a section on validation failure
 * (see QCPanel's CID rights attestation).
 */
export function SectionCard({ title, icon, children, isOpen, onToggle }: SectionCardProps) {
    return (
        <div className="mb-4">
            <button
                onClick={onToggle}
                aria-expanded={isOpen}
                className="w-full py-2 px-1 flex items-center justify-between group"
            >
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-300 tracking-wider uppercase transition-colors group-hover:text-white">
                    {icon}
                    {title}
                </div>
                <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="pt-2 pb-1 space-y-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default SectionCard;
