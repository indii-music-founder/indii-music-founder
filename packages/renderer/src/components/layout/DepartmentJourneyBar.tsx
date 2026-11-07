import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Compass, Sparkles, X } from 'lucide-react';
import { useStore } from '@/core/store';
import {
    DEPARTMENT_JOURNEYS,
    deterministicDepartmentJourneyFallback,
    judgeDepartmentJourneyIntent,
    type DepartmentJourneyContext,
    type DepartmentJourneyOption,
    type DepartmentJourneyVerdict,
    type DepartmentWorkspaceId,
} from '@/config/typesafeJudgments';

const HINT_TIMEOUT_MS = 7000;

export interface DepartmentJourneyBarProps {
    department: DepartmentWorkspaceId;
    activeTab: string;
    onSelectTab?: (tab: string) => void;
    itemCount?: number;
    pendingCount?: number;
    hasAlert?: boolean;
    accentColorClass?: string;
}

/**
 * Inline Jev System One Journey & Pathways control for Department and Manager headers.
 * Consolidates guided pathways into a compact "Journeys ▾" popover and an inline
 * 1-click Jev recommendation chip right inside the single 48px department header row.
 */
export function DepartmentJourneyBar({
    department,
    activeTab,
    onSelectTab,
    itemCount = 0,
    pendingCount = 0,
    hasAlert = false,
    accentColorClass = 'text-indigo-300 border-indigo-400/25 bg-indigo-400/10 hover:bg-indigo-400/20',
}: DepartmentJourneyBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [hint, setHint] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    const rawCommandBarInput = useStore(state => state?.commandBarInput);
    const commandBarInput = typeof rawCommandBarInput === 'string' ? rawCommandBarInput : '';
    const options: readonly DepartmentJourneyOption[] = DEPARTMENT_JOURNEYS[department] ?? [];

    const context = useMemo<DepartmentJourneyContext>(() => ({
        department,
        activeTab,
        prompt: commandBarInput || '',
        itemCount,
        pendingCount,
        hasAlert,
    }), [department, activeTab, commandBarInput, itemCount, pendingCount, hasAlert]);

    const contextKey = JSON.stringify(context);
    const [judged, setJudged] = useState<{ key: string; verdict: DepartmentJourneyVerdict } | null>(null);

    const verdict = judged?.key === contextKey
        ? judged.verdict
        : deterministicDepartmentJourneyFallback(context);

    useEffect(() => {
        let current = true;
        const timer = window.setTimeout(() => {
            void judgeDepartmentJourneyIntent(context).then(res => {
                if (current) {
                    setJudged({ key: contextKey, verdict: res });
                }
            });
        }, 350);
        return () => {
            current = false;
            window.clearTimeout(timer);
        };
    }, [context, contextKey]);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!hint) return;
        const timer = window.setTimeout(() => setHint(''), HINT_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [hint]);

    const handleTriggerOption = (opt: DepartmentJourneyOption) => {
        setIsOpen(false);
        toggleRef.current?.focus();
        onSelectTab?.(opt.targetTab);
        setHint(opt.description);
    };

    const handleTriggerVerdict = () => {
        const matched = options.find(o => o.id === verdict.journeyId);
        onSelectTab?.(verdict.targetTab);
        setHint(matched?.description || verdict.headline);
    };

    return (
        <div
            ref={containerRef}
            role="group"
            aria-label={`${department} studio journeys`}
            data-testid={`dept-journey-${department}`}
            className="relative flex items-center gap-1.5 shrink-0"
        >
            {/* Jev System One Inline Recommendation Chip */}
            {verdict.confidence >= 0.5 && (
                <button
                    type="button"
                    onClick={handleTriggerVerdict}
                    title={verdict.headline}
                    data-testid={`dept-journey-recommendation-${department}`}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${accentColorClass}`}
                >
                    <Sparkles size={11} aria-hidden="true" className="shrink-0" />
                    <span className="max-w-36 truncate">{verdict.actionLabel}</span>
                </button>
            )}

            {/* Compact Journeys Popover Trigger */}
            <button
                type="button"
                ref={toggleRef}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setIsOpen(v => !v)}
                onKeyDown={event => {
                    if (event.key === 'Escape' && isOpen) {
                        setIsOpen(false);
                        toggleRef.current?.focus();
                    }
                }}
                data-testid={`dept-journeys-toggle-${department}`}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
                <Compass size={11} aria-hidden="true" className="text-gray-400" />
                <span>Journeys</span>
                <ChevronDown
                    size={11}
                    aria-hidden="true"
                    className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Journeys Popover Menu */}
            {isOpen && (
                <div
                    role="menu"
                    aria-label={`${department} pathways`}
                    data-testid={`dept-journeys-menu-${department}`}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            setIsOpen(false);
                            toggleRef.current?.focus();
                        }
                    }}
                    className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#0d0d12]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
                >
                    <div className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 mb-1 flex items-center justify-between">
                        <span>Guided Pathways</span>
                        <span className="text-indigo-400">Jev System One</span>
                    </div>
                    {options.map(option => {
                        const isRecommended = option.id === verdict.journeyId;
                        const isCurrentTab = option.targetTab === activeTab;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="menuitem"
                                onClick={() => handleTriggerOption(option)}
                                data-testid={`dept-journey-option-${option.id}`}
                                className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                                    isCurrentTab ? 'bg-white/[0.04]' : ''
                                }`}
                            >
                                <div className="flex w-full items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-gray-100">{option.label}</span>
                                    {isRecommended && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                                            <Sparkles size={8} /> Jev Pick
                                        </span>
                                    )}
                                </div>
                                <span className="mt-0.5 text-[10px] text-gray-400 leading-snug">{option.description}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Self-dismissing Contextual Hint Toast */}
            {hint && (
                <div
                    role="status"
                    aria-live="polite"
                    data-testid={`dept-journey-hint-toast-${department}`}
                    className="absolute right-0 top-full z-40 mt-2 flex w-72 items-start justify-between gap-2 rounded-xl border border-white/10 bg-[#101014]/95 px-3 py-2 text-xs text-gray-200 shadow-2xl backdrop-blur-xl"
                >
                    <span>{hint}</span>
                    <button
                        type="button"
                        aria-label="Dismiss journey hint"
                        onClick={() => setHint('')}
                        className="rounded p-0.5 text-gray-500 hover:bg-white/5 hover:text-gray-200"
                    >
                        <X size={12} aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
}
