import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextEffect } from './text-effect';

const reducedMotion = vi.hoisted(() => vi.fn(() => false));
vi.mock('motion/react', async importOriginal => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: reducedMotion,
}));

describe('TextEffect', () => {
  beforeEach(() => reducedMotion.mockReturnValue(false));

  it('announces multiline text once and hides visual line segments', () => {
    const value = 'First line\nSecond line';
    const { container } = render(<TextEffect per='line'>{value}</TextEffect>);
    expect(container.querySelector('.sr-only')?.textContent).toBe(value);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('First lineSecond line');
  });

  it('keeps emoji and combining marks as whole animated characters', () => {
    const { container } = render(<TextEffect per='char'>A👩🏽‍🎤é</TextEffect>);
    const segments = Array.from(container.querySelectorAll('[aria-hidden="true"] > span'));
    expect(segments.map(segment => segment.textContent)).toEqual(['A', '👩🏽‍🎤', 'é']);
  });

  it('shows plain text with no hidden animation under reduced motion', () => {
    reducedMotion.mockReturnValue(true);
    const { container } = render(<TextEffect as='h2' per='char'>Artist updates</TextEffect>);
    expect(screen.getByRole('heading', { name: 'Artist updates' })).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('.sr-only')).not.toBeInTheDocument();
  });
});
