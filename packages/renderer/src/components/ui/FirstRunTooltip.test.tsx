import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFirstRunTip } from './FirstRunTooltip';

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
