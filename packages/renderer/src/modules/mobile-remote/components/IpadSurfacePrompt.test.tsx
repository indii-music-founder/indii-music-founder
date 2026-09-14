import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import IpadSurfacePrompt, { IPAD_REMOTE_PROMPT_KEY } from './IpadSurfacePrompt';

describe('IpadSurfacePrompt', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <IpadSurfacePrompt isOpen={false} onDismiss={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content when isOpen is true', () => {
    render(<IpadSurfacePrompt isOpen={true} onDismiss={vi.fn()} />);

    expect(screen.getByText('Open Web Studio or Remote?')).toBeInTheDocument();
    expect(
      screen.getByText(/You are viewing indii on an iPad/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Open Web Studio/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Launch Remote Controller/i })
    ).toBeInTheDocument();
  });

  it('calls onOpenStudio when Open Web Studio is clicked', () => {
    const onOpenStudio = vi.fn();
    render(
      <IpadSurfacePrompt
        isOpen={true}
        onDismiss={vi.fn()}
        onOpenStudio={onOpenStudio}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Web Studio/i }));
    expect(onOpenStudio).toHaveBeenCalledTimes(1);
  });

  it('sets sessionStorage and calls onDismiss when Launch Remote is clicked', () => {
    const onDismiss = vi.fn();
    render(<IpadSurfacePrompt isOpen={true} onDismiss={onDismiss} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Launch Remote Controller/i })
    );

    expect(sessionStorage.getItem(IPAD_REMOTE_PROMPT_KEY)).toBe('true');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<IpadSurfacePrompt isOpen={true} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /Close dialog/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
