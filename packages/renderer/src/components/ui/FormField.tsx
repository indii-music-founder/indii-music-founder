import React, { useId } from 'react';

/**
 * Item 275: Accessible FormField wrapper.
 *
 * Ensures every input has a properly associated <label> via htmlFor/id.
 * Uses React's useId() to generate stable, unique IDs automatically.
 *
 * Usage:
 *   <FormField label="Email">
 *     <input type="email" className="..." />
 *   </FormField>
 *
 * The child input will receive an `id` prop automatically if it doesn't
 * already have one, and the label's `htmlFor` will point to it.
 */

interface FormFieldProps {
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    className?: string;
    children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-required'?: boolean | 'true' | 'false'; 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' }>;
}

export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
    const generatedId = useId();
    const inputId = children.props.id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    const describedBy = Array.from(new Set([
        ...(children.props['aria-describedby']?.split(/\s+/).filter(Boolean) ?? []),
        hintId,
        errorId,
    ].filter((id): id is string => Boolean(id)))).join(' ') || undefined;
    const invalid = error ? true : children.props['aria-invalid'];

    const enhancedChild = React.cloneElement(children, {
        id: inputId,
        'aria-describedby': describedBy,
        'aria-invalid': invalid,
        'aria-required': required || children.props['aria-required'],
    });

    return (
        <div className={className}>
            <label
                htmlFor={inputId}
                className="block text-xs font-bold text-gray-500 tracking-wider uppercase mb-1.5"
            >
                {label}
                {required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
            </label>
            {enhancedChild}
            {hint && (
                <p id={hintId} className="mt-1 text-xs text-gray-500">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} className="mt-1 text-xs text-red-400" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
