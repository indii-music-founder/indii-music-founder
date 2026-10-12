import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Terms from './Terms';

describe('Terms of Service Component', () => {
  it('renders Terms of Service with core legal structure and contact info', () => {
    render(<Terms />);

    expect(screen.getByRole('heading', { level: 1, name: /Terms of Service/i })).toBeDefined();
    expect(screen.getAllByText(/New Detroit Music LLC/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/legal@indii.music/i)).toBeDefined();
  });

  it('renders Section 15 Founding Artist Beta & Operations with all canonical operational terms', () => {
    render(<Terms />);

    expect(screen.getByRole('heading', { level: 2, name: /15\. Founding Artist Beta & Operations/i })).toBeDefined();
    expect(screen.getByText(/working software that is actively being refined/i)).toBeDefined();
    expect(screen.getByText(/Invitation-Based Entry:/i)).toBeDefined();
    expect(screen.getByText(/Bug Reporting & Feedback:/i)).toBeDefined();
    expect(screen.getByText(/Milestone Communications:/i)).toBeDefined();
    expect(screen.getByText(/Founding Owner License:/i)).toBeDefined();
    expect(screen.getByText(/No Unscheduled Deadlines:/i)).toBeDefined();
    expect(screen.getByText(/software purchase only—not equity, an investment, a security/i)).toBeDefined();
  });
});
