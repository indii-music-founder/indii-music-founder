import { useRef, useCallback, useEffect } from 'react';

/**
 * Item 270: Keyboard Navigation Hook — Roving Tabindex pattern
 *
 * Implements WAI-ARIA Roving Tabindex for lists of interactive items.
 * The active item has tabIndex=0, all others have tabIndex=-1.
 * Arrow keys move focus between items, Home/End jump to first/last.
 *
 * @param itemCount - Total number of items in the list
 * @param options - Configuration for orientation, wrapping, etc.
 * @returns Properties to spread onto each item and container handlers
 *
 * Usage:
 * ```tsx
 * const { getItemProps, containerProps, activeIndex } = useKeyboardNav(items.length);
 *
 * <div {...containerProps} role="listbox">
 *   {items.map((item, i) => (
 *     <button key={i} {...getItemProps(i)}>{item.label}</button>
 *   ))}
 * </div>
 * ```
 */

interface KeyboardNavOptions {
    /** 'vertical' (Up/Down) or 'horizontal' (Left/Right) */
    orientation?: 'vertical' | 'horizontal';
    /** Whether to wrap from last to first and vice versa */
    wrap?: boolean;
    /** Initial active index */
    initialIndex?: number;
    /** Callback when active index changes */
    onActiveChange?: (index: number) => void;
}

interface ItemProps {
    tabIndex: number;
    ref: (el: HTMLElement | null) => void;
    'data-nav-index': number;
}

interface ContainerProps {
    role: string;
    onKeyDown: (e: React.KeyboardEvent) => void;
    'aria-orientation'?: 'vertical' | 'horizontal';
}

interface KeyboardNavReturn {
    /** Get props to spread onto each navigable item */
    getItemProps: (index: number) => ItemProps;
    /** Props to spread onto the container element */
    containerProps: ContainerProps;
    /** Currently active index */
    activeIndex: number;
    /** Programmatically set active index */
    setActiveIndex: (index: number) => void;
}

export function useKeyboardNav(
    itemCount: number,
    options: KeyboardNavOptions = {}
): KeyboardNavReturn {
    const {
        orientation = 'vertical',
        wrap = true,
        initialIndex = 0,
        onActiveChange,
    } = options;

    const activeIndexRef = useRef(initialIndex);
    const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

    // Focus the current active item
    const focusItem = useCallback((index: number) => {
        const el = itemRefs.current.get(index);
        if (el) {
            el.focus();
            el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }
    }, []);

    const setActiveIndex = useCallback((index: number) => {
        const clamped = Math.max(0, Math.min(index, itemCount - 1));
        activeIndexRef.current = clamped;
        focusItem(clamped);
        onActiveChange?.(clamped);
    }, [itemCount, focusItem, onActiveChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
        const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';

        let newIndex = activeIndexRef.current;
        let handled = false;

        switch (e.key) {
            case nextKey:
                handled = true;
                if (newIndex < itemCount - 1) {
                    newIndex += 1;
                } else if (wrap) {
                    newIndex = 0;
                }
                break;

            case prevKey:
                handled = true;
                if (newIndex > 0) {
                    newIndex -= 1;
                } else if (wrap) {
                    newIndex = itemCount - 1;
                }
                break;

            case 'Home':
                handled = true;
                newIndex = 0;
                break;

            case 'End':
                handled = true;
                newIndex = itemCount - 1;
                break;

            default:
                break;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex(newIndex);
        }
    }, [orientation, itemCount, wrap, setActiveIndex]);

    // Sync initial focus on mount
    useEffect(() => {
        activeIndexRef.current = Math.min(initialIndex, itemCount - 1);
    }, [initialIndex, itemCount]);

    const getItemProps = useCallback((index: number): ItemProps => ({
        tabIndex: index === activeIndexRef.current ? 0 : -1,
        ref: (el: HTMLElement | null) => {
            if (el) {
                itemRefs.current.set(index, el);
            } else {
                itemRefs.current.delete(index);
            }
        },
        'data-nav-index': index,
    }), []);

    const containerProps: ContainerProps = {
        role: orientation === 'vertical' ? 'listbox' : 'tablist',
        onKeyDown: handleKeyDown,
        'aria-orientation': orientation,
    };

    return {
        getItemProps,
        containerProps,
        activeIndex: activeIndexRef.current,
        setActiveIndex,
    };
}
