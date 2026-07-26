import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminLockScreen } from './AdminLockScreen';

// Mock the useGodMode hook
const mockUseGodMode = vi.fn();
vi.mock('@/hooks/useGodMode', () => ({
  useGodMode: () => mockUseGodMode(),
}));

describe('AdminLockScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while verifying god_mode claim', () => {
    mockUseGodMode.mockReturnValue({ isGodMode: false, loading: true });

    render(
      <AdminLockScreen>
        <div>Dashboard Content</div>
      </AdminLockScreen>
    );

    expect(screen.getByText('Verifying access…')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('renders dashboard content when god_mode is true', () => {
    mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });

    render(
      <AdminLockScreen>
        <div>Dashboard Content</div>
      </AdminLockScreen>
    );

    expect(screen.getByText('Founder telemetry surface')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    expect(screen.getByText('God mode verified. Full observability access granted.')).toBeInTheDocument();
  });

  it('shows access denied screen when god_mode is false', () => {
    mockUseGodMode.mockReturnValue({ isGodMode: false, loading: false });

    render(
      <AdminLockScreen>
        <div>Dashboard Content</div>
      </AdminLockScreen>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Founder telemetry surface')).not.toBeInTheDocument();
  });

  it('does not render a fake PIN gate', () => {
    mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });

    render(
      <AdminLockScreen>
        <div>Dashboard Content</div>
      </AdminLockScreen>
    );

    expect(screen.queryByPlaceholderText('Enter PIN')).not.toBeInTheDocument();
  });
});
