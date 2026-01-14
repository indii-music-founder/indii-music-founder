import React from 'react';
import { useStore } from '@/core/store';
import { getColorForModule } from '@/core/theme/moduleColors';
import type { ModuleId } from '@/core/constants';

interface ModuleDashboardProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    tabs?: { label: string; value: string }[];
    activeTab?: string;
    onTabChange?: (value: string) => void;
    className?: string;
    /** Optional moduleId override - defaults to current module from store */
    moduleId?: ModuleId;
}

/**
 * ModuleDashboard - Department-themed layout wrapper
 *
 * Automatically applies department color theming based on the current module.
 * Features:
 * - Department-colored header accent bar
 * - Icon tinting in department color
 * - Consistent layout structure
 */
export function ModuleDashboard({
    title,
    description,
    icon,
    actions,
    children,
    tabs,
    activeTab,
    onTabChange,
    className = "",
    moduleId: propModuleId
}: ModuleDashboardProps) {
    // Get current module from store if not provided
    const currentModule = useStore((state) => state.currentModule);
    const moduleId = propModuleId || currentModule;
    const colors = getColorForModule(moduleId);

    return (
        <div
            className={`h-full flex flex-col bg-bg-dark text-white overflow-hidden ${className}`}
            style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
        >
            {/* Department-tinted header bar */}
            <div className="h-1 w-full bg-[--dept-color] opacity-80" />

            <div className="p-6 flex-1 flex flex-col overflow-hidden">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 flex-shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 tracking-tight font-main">
                            {icon && (
                                <span className={`${colors.text} drop-shadow-[0_0_8px_var(--dept-color)]`}>
                                    {icon}
                                </span>
                            )}
                            {title}
                        </h1>
                        {description && (
                            <p className="text-gray-400 max-w-2xl">{description}</p>
                        )}
                    </div>

                    {/* Actions & Tabs Area */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        {/* Tabs - department-themed active state */}
                        {tabs && tabs.length > 0 && (
                            <div className="flex bg-[#161b22] p-1 rounded-lg border border-gray-800">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => onTabChange?.(tab.value)}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors bolt-interactive ${
                                            activeTab === tab.value
                                                ? `${colors.bg} ${colors.text} shadow-sm`
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Custom Actions */}
                        {actions && (
                            <div className="flex items-center gap-3">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 relative">
                    {children}
                </div>
            </div>
        </div>
    );
}
