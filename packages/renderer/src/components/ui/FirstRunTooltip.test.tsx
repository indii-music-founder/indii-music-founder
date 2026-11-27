import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FirstRunTooltip, resetAllTips, useFirstRunTip } from '@/components/ui/FirstRunTooltip';

afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
});

it.each(['null', '[]', '42'])('handles invalid stored tip state %s', raw => {
    vi.useFakeTimers();
    localStorage.setItem('indii_first_run_tips', raw);
    const { result } = renderHook(() => useFirstRunTip('chat'));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.shouldShow).toBe(true);
});

it('does not reveal a tip after dismissal cancels its pending timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useFirstRunTip('chat'));
    act(() => result.current.dismiss());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.shouldShow).toBe(false);
    expect(JSON.parse(localStorage.getItem('indii_first_run_tips')!)).toEqual({ chat: true });
});

it('hides the previous tip when the ID changes to a dismissed tip', () => {
    vi.useFakeTimers();
    localStorage.setItem('indii_first_run_tips', JSON.stringify({ dismissed: true }));
    const { result, rerender } = renderHook(({ id }) => useFirstRunTip(id), {
        initialProps: { id: 'chat' },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.shouldShow).toBe(true);
    rerender({ id: 'dismissed' });
    expect(result.current.shouldShow).toBe(false);
});

it('dismisses FirstRunTooltip when Escape is pressed and handles resetAllTips storage errors safely', () => {
    const onDismiss = vi.fn();
    render(<FirstRunTooltip message="Tip" onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();

    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage disabled');
    });
    expect(() => resetAllTips()).not.toThrow();
    removeSpy.mockRestore();
});
