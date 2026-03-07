import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { RegistrationStatus, getStatusBadge } from '../types';

interface RegistrationSectionProps {
    id: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    status: RegistrationStatus;
    isRequired?: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

export const RegistrationSection: React.FC<RegistrationSectionProps> = ({
    id,
    icon,
    title,
    subtitle,
    status,
    isRequired = false,
    isExpanded,
    onToggle,
    children,
}) => {
    const badge = getStatusBadge(status, isRequired);

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
            {/* Header (Always Visible) */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50/80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-expanded={isExpanded}
                aria-controls={`section-content-${id}`}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0 w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        {icon}
                    </div>
                    <div className="flex-1 pr-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                            <span
                                className={`text-xs font-medium px-2.5 py-1 flex items-center rounded-full w-max ${badge.className}`}
                            >
                                {badge.text}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500">{subtitle}</p>
                    </div>
                </div>
                <div className="text-gray-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </button>

            {/* Expanded Content Area */}
            {isExpanded && (
                <div
                    id={`section-content-${id}`}
                    className="p-5 border-t border-gray-100 bg-gray-50/30 transition-all duration-500"
                >
                    {children}
                </div>
            )}
        </div>
    );
};
