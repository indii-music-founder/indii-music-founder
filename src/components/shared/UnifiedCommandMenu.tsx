import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    AudioWaveform, FolderOpen, Video, Map, User, Briefcase,
    Settings, PenTool, LayoutDashboard, Radio, CreditCard,
    Building, Music, ShieldAlert, Cpu
} from 'lucide-react';

export function UnifiedCommandMenu() {
    const { isCommandMenuOpen, setCommandMenuOpen, setModule } = useStore(
        useShallow(state => ({
            isCommandMenuOpen: state.isCommandMenuOpen,
            setCommandMenuOpen: state.setCommandMenuOpen,
            setModule: state.setModule
        }))
    );

    // Toggle the menu when ⌘K is pressed
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCommandMenuOpen(!isCommandMenuOpen);
            }

            // BUG-005 FIX: Dedicated Escape handler that always force-closes.
            // Under rapid interaction, the cmdk `onOpenChange` can miss Escape events.
            if (e.key === 'Escape' && isCommandMenuOpen) {
                e.preventDefault();
                e.stopPropagation();
                setCommandMenuOpen(false);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [isCommandMenuOpen, setCommandMenuOpen]);

    // Run a command and close the menu
    const runCommand = (command: () => void) => {
        setCommandMenuOpen(false);
        command();
    };

    return (
        <Command.Dialog
            open={isCommandMenuOpen}
            onOpenChange={setCommandMenuOpen}
            label="Global Command Menu"
            className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh] pb-[20vh] px-4 backdrop-blur-sm bg-black/50"
        >
            <div
                className="w-full max-w-2xl bg-[#0f1115]/95 border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center border-b border-white/5 px-4 h-14">
                    <Command.Input
                        autoFocus
                        className="flex-1 w-full bg-transparent border-0 outline-none text-white placeholder-slate-400 text-lg h-full"
                        placeholder="Search commands, navigate modules, open settings..."
                    />
                </div>

                <Command.List className="max-h-[50vh] overflow-y-auto px-2 py-4 custom-scrollbar text-sm font-medium">
                    <Command.Empty className="py-6 text-center text-slate-400">
                        No results found.
                    </Command.Empty>

                    <Command.Group heading="Navigation" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                        <Command.Item onSelect={() => runCommand(() => setModule('dashboard'))} className="flex items-center gap-3 cursor-pointer">
                            <LayoutDashboard className="w-4 h-4 text-purple-400" />
                            <span>Dashboard</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('creative'))} className="flex items-center gap-3 cursor-pointer">
                            <PenTool className="w-4 h-4 text-pink-400" />
                            <span>Creative Studio</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('video'))} className="flex items-center gap-3 cursor-pointer">
                            <Video className="w-4 h-4 text-sky-400" />
                            <span>Video Studio</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('files'))} className="flex items-center gap-3 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-emerald-400" />
                            <span>File Explorer</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('agent'))} className="flex items-center gap-3 cursor-pointer">
                            <Cpu className="w-4 h-4 text-indigo-400" />
                            <span>Agents Control Center</span>
                        </Command.Item>
                    </Command.Group>

                    <Command.Group heading="Business Strategy" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                        <Command.Item onSelect={() => runCommand(() => setModule('finance'))} className="flex items-center gap-3 cursor-pointer">
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            <span>Finance & Royalties</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('distribution'))} className="flex items-center gap-3 cursor-pointer">
                            <Radio className="w-4 h-4 text-blue-500" />
                            <span>Audio Distribution Hub</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('brand'))} className="flex items-center gap-3 cursor-pointer">
                            <Briefcase className="w-4 h-4 text-rose-400" />
                            <span>Brand Identity</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('licensing'))} className="flex items-center gap-3 cursor-pointer">
                            <Briefcase className="w-4 h-4 text-amber-500" />
                            <span>Licensing</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('legal'))} className="flex items-center gap-3 cursor-pointer">
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                            <span>Legal Center</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('marketing'))} className="flex items-center gap-3 cursor-pointer">
                            <Map className="w-4 h-4 text-orange-500" />
                            <span>Marketing Strategy</span>
                        </Command.Item>
                    </Command.Group>

                    <Command.Group heading="Tools & Discovery" className="mb-2 text-slate-500 px-2 [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:text-slate-300 [&_[cmdk-item][data-selected]]:bg-white/10 [&_[cmdk-item][data-selected]]:text-white">
                        <Command.Item onSelect={() => runCommand(() => setModule('audio-analyzer'))} className="flex items-center gap-3 cursor-pointer">
                            <AudioWaveform className="w-4 h-4 text-cyan-400" />
                            <span>Audio Fidelity Analyzer</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('history'))} className="flex items-center gap-3 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-purple-300" />
                            <span>History & Vault</span>
                        </Command.Item>
                        <Command.Item onSelect={() => runCommand(() => setModule('workflow'))} className="flex items-center gap-3 cursor-pointer">
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span>Workflow Blueprints</span>
                        </Command.Item>
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
