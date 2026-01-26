import React, { memo } from 'react';

// --- Keyframe Button ---

interface KeyframeButtonProps {
    onClick: () => void;
    active: boolean;
}

export const KeyframeButton = memo(({ onClick, active }: KeyframeButtonProps) => (
    <button
        onClick={onClick}
        className={`p-1 rounded hover:bg-gray-700 ${active ? 'text-purple-400' : 'text-gray-500'}`}
        title="Add/Update Keyframe"
    >
        <div className="w-2 h-2 transform rotate-45 border border-current bg-current" />
    </button>
));
KeyframeButton.displayName = 'KeyframeButton';

// --- Generic Inputs ---
// These components are simple wrappers around input/select that apply standard styling
// and are memoized to prevent re-renders when parent re-renders but props are unchanged.

interface StyledInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const StyledInput = memo(({ className = "", ...props }: StyledInputProps) => (
    <input
        className={`w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none ${className}`}
        {...props}
    />
));
StyledInput.displayName = 'StyledInput';

interface StyledRangeProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const StyledRange = memo(({ className = "", ...props }: StyledRangeProps) => (
    <input
        type="range"
        className={`w-full ${className}`}
        {...props}
    />
));
StyledRange.displayName = 'StyledRange';

interface StyledSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const StyledSelect = memo(({ className = "", children, ...props }: StyledSelectProps) => (
    <select
        className={`bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none ${className}`}
        {...props}
    >
        {children}
    </select>
));
StyledSelect.displayName = 'StyledSelect';

interface StyledTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const StyledTextArea = memo(({ className = "", ...props }: StyledTextAreaProps) => (
    <textarea
        className={`bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none ${className}`}
        {...props}
    />
));
StyledTextArea.displayName = 'StyledTextArea';
