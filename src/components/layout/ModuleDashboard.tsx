import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ModuleDashboardProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    tabs?: { label: string; value: string }[];
    activeTab?: string;
    onTabChange?: (value: string) => void;
    className?: string; // For additional custom styles if absolutely needed
}

export function ModuleDashboard({
    title,
    description,
    icon,
    actions,
    children,
    tabs,
    activeTab,
    onTabChange,
    className = ""
}: ModuleDashboardProps) {
    return (
        <div className={`h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-hidden ${className}`}>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 tracking-tight">
                        {icon && <span className="">{icon}</span>}
                        {title}
                    </h1>
                    {description && (
                        <p className="text-gray-400 max-w-2xl">{description}</p>
                    )}
                </div>

                {/* Actions & Tabs Area */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    {/* Tabs */}
                    {tabs && tabs.length > 0 && (
                        <div className="flex bg-[#161b22] p-1 rounded-lg border border-gray-800">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    onClick={() => onTabChange?.(tab.value)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.value
                                            ? 'bg-gray-800 text-white shadow-sm'
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
    );
}
