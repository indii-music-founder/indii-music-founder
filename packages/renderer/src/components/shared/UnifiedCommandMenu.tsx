import React from 'react';
import { Command } from 'cmdk';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    AudioWaveform, Settings, StickyNote, PanelRight, Activity, AlertCircle, Lightbulb, HelpCircle, Sparkles,
} from 'lucide-react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { useBugReport } from '@/modules/debug';
import { useGodMode } from '@/hooks/useGodMode';
import { getCommandMenuModules, HIDDEN_MODULE_REASONS, type ModuleRegistryEntry } from '@/core/moduleRegistry';
import { type ModuleId } from '@/core/constants';
import { useGatedModules } from '@/config/featureFlags';
import { useOrganizationAccess } from '@/core/context/OrganizationAccessContext';
import { judgeCommandIntent, type CommandIntentJudgment } from '@/config/typesafeJudgments';

/**
 * UnifiedCommandMenu — the global ⌘K palette.
 *
 * ISSUE-1438: the module destination groups ("Navigation", "Business Strategy",
 * and the module items inside "Tools & Discovery") used to be a hardcoded ~22-item
 * list while the app ships ~45 registered modules — most reachable nowhere else.
 * Destination groups are now generated from `core/moduleRegistry.ts` (filtered by
 * feature-flag gating and organization access), so every module the current user
 * can access is listed. A Recent section resumes the user's last modules.
 * Handwritten entries remain only for true *actions* (tab deep-links, drawers,
 * toggles, feedback, settings) that are not module destinations.
 */
export function UnifiedCommandMenu() {
    const { isCommandMenuOpen, setCommandMenuOpen, setModule, currentModule } = useStore(
        useShallow(state => ({
            isCommandMenuOpen: state.isCommandMenuOpen,
            setCommandMenuOpen: state.setCommandMenuOpen,
            setModule: state.setModule,
            currentModule: state.currentModule,
        }))
    );
    // ISSUE-1438: recents come from the navigation history the app already tracks
    // (appSlice `_navigationHistory`). Read defensively: some tests install a flat
    // store mock, so never assume this selector returns an array.
    const navigationHistory = useStore(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (state: any) => state._navigationHistory
    );

    const gatedModules = useGatedModules();
    const { canAccessModule } = useOrganizationAccess();

    const { reportBug, requestFeature } = useBugReport();
    const { isGodMode } = useGodMode();

    // Most recent unique, still-visible modules (oldest→newest history → newest first).
    const recentModules: ModuleRegistryEntry[] = [];
    if (Array.isArray(navigationHistory)) {
        const seen = new Set<string>();
        const all = getCommandMenuModules().flatMap(section => section.items);
        for (let i = navigationHistory.length - 1; i >= 0 && recentModules.length < 3; i--) {
            const id = navigationHistory[i] as ModuleId;
            if (id === currentModule || seen.has(id) || HIDDEN_MODULE_REASONS[id]) continue;
            const entry = all.find(item => item.id === id);
            if (entry && !gatedModules.has(id) && canAccessModule(id)) {
                seen.add(id);
                recentModules.push(entry);
            }
        }
    }

    const generatedSections = getCommandMenuModules()
        .map(section => ({
            ...section,
            items: section.items.filter(item => !gatedModules.has(item.id) && canAccessModule(item.id)),
        }))
        .filter(section => section.items.length > 0);

    const [searchQuery, setSearchQuery] = React.useState('');
    const [suggestedIntent, setSuggestedIntent] = React.useState<CommandIntentJudgment | null>(null);

    React.useEffect(() => {
        if (!isCommandMenuOpen) {
            setSearchQuery('');
            setSuggestedIntent(null);
            return;
        }

        const trimmed = searchQuery.trim();
        if (trimmed.length < 3) {
            setSuggestedIntent(null);
            return;
        }

        const timer = setTimeout(async () => {
            const verdict = await judgeCommandIntent(trimmed);
            if (verdict && verdict.targetModule && verdict.targetModule !== 'none') {
                setSuggestedIntent(verdict);
            } else {
                setSuggestedIntent(null);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [searchQuery, isCommandMenuOpen]);

    // Toggle the menu when ⌘K is pressed
    useGlobalShortcut({
        id: 'cmd-k-menu',
        key: 'k',
        meta: true,
        ignoreInput: true, // Allow opening cmd+k even when typing in input
        priority: 'high',
        handler: (e) => {
            e.preventDefault();
            setCommandMenuOpen(!isCommandMenuOpen);
        }
    }, [isCommandMenuOpen, setCommandMenuOpen]);

    // Also support Ctrl+K for Windows/Linux
    useGlobalShortcut({
        id: 'ctrl-k-menu',
        key: 'k',
        ctrl: true,
        ignoreInput: true,
        priority: 'high',
        handler: (e) => {
            e.preventDefault();
            setCommandMenuOpen(!isCommandMenuOpen);
        }
    }, [isCommandMenuOpen, setCommandMenuOpen]);

    // BUG-005 FIX: Dedicated Escape handler that always force-closes.
    // Under rapid interaction, the cmdk `onOpenChange` can miss Escape events.
    useGlobalShortcut({
        id: 'close-cmd-k-menu',
        key: 'Escape',
        ignoreInput: true,
        priority: 'modal',
        handler: (e) => {
            if (isCommandMenuOpen) {
                e.preventDefault();
                e.stopPropagation();
                setCommandMenuOpen(false);
            }
        }
    }, [isCommandMenuOpen, setCommandMenuOpen]);

    // Run a command and close the menu
    const runCommand = (command: () => void) => {
        setCommandMenuOpen(false);
        command();
    };

    const itemClass = "flex items-center gap-3 cursor-pointer";

    return (
        <Command.Dialog
            open={isCommandMenuOpen}
            onOpenChange={setCommandMenuOpen}
            label="Global Command Menu"
            className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh] pb-[20vh] px-4 backdrop-blur-sm bg-black/50"
            onClick={() => setCommandMenuOpen(false)}
        >
            <div
                className="w-full max-w-2xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all flex flex-col"
                style={{
                    backgroundColor: 'var(--color-surface-elevated, #3a3226)',
                    opacity: 0.95
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center border-b border-white/5 px-4 h-14">
                    <Command.Input
                        autoFocus
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        className="flex-1 w-full bg-transparent border-0 outline-none text-white placeholder-slate-400 text-lg h-full"
                        placeholder="Search commands, navigate modules, open settings..."
                    />
                </div>

                <Command.List className="max-h-[50vh] overflow-y-auto px-2 py-4 custom-scrollbar text-sm font-medium">
                    <Command.Empty className="py-6 text-center text-slate-400">
                        {suggestedIntent && suggestedIntent.targetModule && suggestedIntent.targetModule !== 'none' ? (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-slate-400">No exact command matches for &quot;{searchQuery}&quot;.</span>
                                <button
                                    type="button"
                                    onClick={() => runCommand(() => {
                                        if (suggestedIntent.targetModule && suggestedIntent.targetModule !== 'none') {
                                            setModule(suggestedIntent.targetModule as ModuleId);
                                        }
                                    })}
                                    className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-sm font-medium transition-colors border border-amber-500/30"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <span>Open {suggestedIntent.suggestedLabel}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 uppercase font-mono tracking-wider ml-1">AI Match</span>
                                </button>
                            </div>
                        ) : (
                            'No results found.'
                        )}
                    </Command.Empty>

                    {suggestedIntent && suggestedIntent.targetModule && suggestedIntent.targetModule !== 'none' && (
                        <Command.Group heading="Suggested by indii AI" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-amber-500/10 [&_[cmdk-item][data-selected]]:text-white">
                            <Command.Item
                                value={`${searchQuery} ${suggestedIntent.suggestedLabel} ${suggestedIntent.targetModule}`}
                                onSelect={() => runCommand(() => {
                                    if (suggestedIntent.targetModule && suggestedIntent.targetModule !== 'none') {
                                        setModule(suggestedIntent.targetModule as ModuleId);
                                    }
                                })}
                                className={itemClass}
                            >
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span className="text-amber-200 font-semibold">{suggestedIntent.suggestedLabel}</span>
                                <span className="text-xs text-slate-400 ml-2">Matched intent: &quot;{searchQuery}&quot;</span>
                                <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">AI match</span>
                            </Command.Item>
                        </Command.Group>
                    )}

                    {recentModules.length > 0 && (
                        <Command.Group heading="Recent" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                            {recentModules.map(item => (
                                <Command.Item
                                    key={`recent-${item.id}`}
                                    onSelect={() => runCommand(() => setModule(item.id))}
                                    className={itemClass}
                                >
                                    <item.icon className="w-4 h-4 text-slate-400" />
                                    <span>{item.label}</span>
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {/*
                        ISSUE-1438: destination groups are generated from the module
                        registry so nothing reachable is missing from the palette.
                    */}
                    {generatedSections.map(section => (
                        <Command.Group
                            key={section.group}
                            heading={section.group}
                            className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white"
                        >
                            {section.items.map(item => (
                                <Command.Item
                                    key={item.id}
                                    onSelect={() => runCommand(() => setModule(item.id))}
                                    className={itemClass}
                                >
                                    <item.icon className="w-4 h-4 text-slate-400" />
                                    <span>{item.label}</span>
                                </Command.Item>
                            ))}
                        </Command.Group>
                    ))}

                    <Command.Group heading="Actions" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                        <Command.Item onSelect={() => runCommand(() => setModule('distribution', { tab: 'qc' }))} className={itemClass}>
                            <AudioWaveform className="w-4 h-4 text-cyan-400" />
                            <span>Audio Pre-Flight QC (Acoustics &amp; Loudness)</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => useStore.getState().setQuickNotesOpen(true))} className={itemClass}>
                            <StickyNote className="w-4 h-4 text-amber-400" />
                            <span>Quick Notes Drawer (⌘J)</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => useStore.getState().toggleCanvas())} className={itemClass}>
                            <PanelRight className="w-4 h-4 text-blue-400" />
                            <span>Toggle Agent Canvas (Pushed Specs &amp; Documents)</span>
                        </Command.Item>
                    </Command.Group>

                    <Command.Group heading="Feedback & Help" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                        <Command.Item onSelect={() => runCommand(() => reportBug())} className={itemClass}>
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span>Report a Bug</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => requestFeature())} className={itemClass}>
                            <Lightbulb className="w-4 h-4 text-yellow-400" />
                            <span>Request a Feature</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('settings'))} className={itemClass}>
                            <HelpCircle className="w-4 h-4 text-blue-400" />
                            <span>Help & Keyboard Shortcuts</span>
                        </Command.Item>
                    </Command.Group>

                    <Command.Group heading="System" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                        <Command.Item onSelect={() => runCommand(() => useStore.getState().setSettingsOpen(true))} className={itemClass}>
                            <Settings className="w-4 h-4 text-cyan-400" />
                            <span>Settings & Preferences (⌘,)</span>
                        </Command.Item>
                        {isGodMode && (
                            // ISSUE-1269: the sidebar's "Command Center" pill was removed for routing to this
                            // ops dashboard under a name shared with the artist-facing Command Center tab.
                            // Same destination, god-mode gated, distinct name — restores the entry point
                            // without restoring the naming collision or the loud sidebar pill.
                            <Command.Item onSelect={() => runCommand(() => setModule('observability'))} className={itemClass}>
                                <Activity className="w-4 h-4 text-slate-400" />
                                <span>Ops Dashboard (Internal)</span>
                            </Command.Item>
                        )}
                    </Command.Group>
                </Command.List>

                <div className="bg-white/5 border-t border-white/5 h-10 flex items-center px-4 justify-between text-xs text-slate-500">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">↑</kbd>
                            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">↓</kbd>
                            to navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">Enter</kbd>
                            to select
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <kbd className="bg-white/10 px-1.5 py-0.5 rounded">Esc</kbd>
                        to close
                    </div>
                </div>

            </div>
        </Command.Dialog>
    );
}
