import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeft, PanelRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceLayout } from '@/hooks/useWorkspaceLayout';
import { AdaptiveWorkspaceContext } from './AdaptiveWorkspaceContext';

interface AdaptiveWorkspaceProps {
    children: React.ReactNode;
    leftRail?: React.ReactNode;
    rightRail?: React.ReactNode;
    leftRailLabel?: string;
    rightRailLabel?: string;
    className?: string;
    contentClassName?: string;
}

type DrawerSide = 'left' | 'right' | null;

/**
 * A department/manager-office frame that reacts to its own width rather than
 * the browser width. Secondary rails yield space before the main workspace is
 * allowed to become a narrow desktop sliver.
 */
export function AdaptiveWorkspace({
    children,
    leftRail,
    rightRail,
    leftRailLabel = 'Workspace navigation',
    rightRailLabel = 'Workspace details',
    className,
    contentClassName,
}: AdaptiveWorkspaceProps) {
    const { ref, width, mode } = useWorkspaceLayout();
    const [openDrawer, setOpenDrawer] = useState<DrawerSide>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const drawerRef = useRef<HTMLElement | null>(null);

    const hasPersistentLeftRail = Boolean(leftRail) && mode !== 'focused';
    const hasPersistentRightRail = Boolean(rightRail) && mode === 'wide';

    const activeDrawer =
        (openDrawer === 'left' && hasPersistentLeftRail) || (openDrawer === 'right' && hasPersistentRightRail)
            ? null
            : openDrawer;

    const closeDrawer = useCallback(() => {
        setOpenDrawer(null);
        triggerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!activeDrawer) return;
        const focusableSelector = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',');
        const focusableElements = () => Array.from(
            drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
        );
        (focusableElements()[0] ?? drawerRef.current)?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeDrawer();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = focusableElements();
            if (focusable.length === 0) {
                event.preventDefault();
                drawerRef.current?.focus();
                return;
            }
            const first = focusable[0]!;
            const last = focusable[focusable.length - 1]!;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeDrawer, closeDrawer]);

    const openRail = (side: Exclude<DrawerSide, null>, event: React.MouseEvent<HTMLButtonElement>) => {
        triggerRef.current = event.currentTarget;
        setOpenDrawer(side);
    };

    const renderDrawer = (side: Exclude<DrawerSide, null>, content: React.ReactNode, label: string) => {
        if (activeDrawer !== side) return null;
        return (
            <>
                <button
                    aria-label={`Close ${label}`}
                    className="absolute inset-0 z-30 bg-black/50 backdrop-blur-[1px]"
                    onClick={closeDrawer}
                />
                <aside
                    ref={drawerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={label}
                    tabIndex={-1}
                    className={cn(
                        'absolute inset-y-0 z-40 flex w-[min(20rem,calc(100%-2rem))] flex-col overflow-y-auto border-white/10 bg-[#0b0d11]/98 p-3 shadow-2xl',
                        side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
                    )}
                >
                    <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">{label}</span>
                        <button
                            aria-label={`Close ${label}`}
                            onClick={closeDrawer}
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    {content}
                </aside>
            </>
        );
    };

    return (
        <AdaptiveWorkspaceContext.Provider value={{ mode, width }}>
            <div
                ref={ref}
                data-testid="adaptive-workspace"
                data-workspace-mode={mode}
                className={cn('absolute inset-0 flex min-w-0 overflow-hidden @container', className)}
            >
                {hasPersistentLeftRail && (
                    <aside data-testid="adaptive-left-rail" aria-label={leftRailLabel} className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-white/5 p-3 @xl:w-72 @2xl:w-80">
                        {leftRail}
                    </aside>
                )}

                <main className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', contentClassName)}>
                    {children}
                </main>

                {hasPersistentRightRail && (
                    <aside data-testid="adaptive-right-rail" aria-label={rightRailLabel} className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-white/5 p-3 @2xl:w-80">
                        {rightRail}
                    </aside>
                )}

                {leftRail && !hasPersistentLeftRail && (
                    <button
                        data-testid="adaptive-left-rail-trigger"
                        aria-label={`Open ${leftRailLabel}`}
                        onClick={(event) => openRail('left', event)}
                        className="absolute left-3 top-3 z-20 rounded-lg border border-white/10 bg-black/70 p-2 text-gray-300 shadow-lg backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <PanelLeft size={16} />
                    </button>
                )}
                {rightRail && !hasPersistentRightRail && (
                    <button
                        data-testid="adaptive-right-rail-trigger"
                        aria-label={`Open ${rightRailLabel}`}
                        onClick={(event) => openRail('right', event)}
                        className="absolute right-3 top-3 z-20 rounded-lg border border-white/10 bg-black/70 p-2 text-gray-300 shadow-lg backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <PanelRight size={16} />
                    </button>
                )}

                {leftRail && !hasPersistentLeftRail && renderDrawer('left', leftRail, leftRailLabel)}
                {rightRail && !hasPersistentRightRail && renderDrawer('right', rightRail, rightRailLabel)}
            </div>
        </AdaptiveWorkspaceContext.Provider>
    );
}
