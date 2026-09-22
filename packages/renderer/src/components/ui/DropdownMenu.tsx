import type { ComponentProps, ReactNode } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';

/**
 * DropdownMenu — thin house wrapper over @radix-ui/react-dropdown-menu
 * (already a dependency). Exists so control-dense screens (ISSUE-1440) can
 * move large toggle-button clusters into one compact multi-select control
 * without each module assembling Radix primitives and re-inventing the
 * dark-theme styling.
 *
 * Composes Radix parts 1:1 — anything not wrapped here can be imported
 * directly from @radix-ui/react-dropdown-menu alongside it.
 */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export function DropdownMenuTriggerButton({
    children,
    className = '',
    ...props
}: ComponentProps<'button'> & { children: ReactNode }) {
    return (
        <DropdownMenuPrimitive.Trigger asChild {...props}>
            <button
                className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            >
                {children}
                <ChevronDown size={14} className="text-gray-500" />
            </button>
        </DropdownMenuPrimitive.Trigger>
    );
}

export function DropdownMenuContent({
    children,
    className = '',
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                sideOffset={6}
                align="start"
                className={`z-[120] min-w-[220px] max-h-[320px] overflow-y-auto custom-scrollbar rounded-xl border border-gray-700 bg-[#141821] p-1.5 shadow-2xl shadow-black/50 ${className}`}
                {...props}
            >
                {children}
            </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
    );
}

export function DropdownMenuCheckboxItem({
    children,
    className = '',
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
    return (
        <DropdownMenuPrimitive.CheckboxItem
            className={`relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none transition-colors data-highlighted:bg-white/5 data-state-checked:text-white ${className}`}
            {...props}
        >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-600 data-state-checked:border-blue-500 data-state-checked:bg-blue-500/20">
                <DropdownMenuPrimitive.ItemIndicator>
                    <Check size={12} className="text-blue-400" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.CheckboxItem>
    );
}
