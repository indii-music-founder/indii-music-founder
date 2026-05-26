import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from './App';

// Mock subcomponents to isolate routing logic
vi.mock('./page', () => ({
  default: () => <div data-testid="founder-home">Founder Program Lander</div>,
}));

vi.mock('./components/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('./components/layouts/AuthLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./components/auth/LoginForm', () => ({ default: () => null }));
vi.mock('./components/auth/SignupForm', () => ({ default: () => null }));
vi.mock('./components/auth/PasswordResetForm', () => ({ default: () => null }));
vi.mock('./components/auth/VerifyEmail', () => ({ default: () => null }));
vi.mock('./pages/Privacy', () => ({ default: () => null }));
vi.mock('./pages/Terms', () => ({ default: () => null }));
vi.mock('./pages/FieldRecorder', () => ({ default: () => null }));

describe('Landing App Dynamic Routing', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const originalLocation = window.location;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubEnv('VITE_FOUNDER_MODE', 'false');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true
    });
  });

  it('renders General public placeholder when VITE_FOUNDER_MODE=false and hostname is not founder.indii.music', async () => {
    Object.defineProperty(window, 'location', {
      value: { 
        hostname: 'indii.music', 
        href: 'http://indii.music/',
        origin: 'http://indii.music',
      },
      writable: true,
    });

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('indii.music');
    expect(container.textContent).toContain('The general public platform is coming soon.');
    expect(container.querySelector('[data-testid="founder-home"]')).toBeNull();
  });

  it('renders Founder Program Lander when VITE_FOUNDER_MODE=true even on general domain', async () => {
    vi.stubEnv('VITE_FOUNDER_MODE', 'true');
    Object.defineProperty(window, 'location', {
      value: { 
        hostname: 'indii.music', 
        href: 'http://indii.music/',
        origin: 'http://indii.music',
      },
      writable: true,
    });

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('[data-testid="founder-home"]')).not.toBeNull();
    expect(container.textContent).toContain('Founder Program Lander');
  });

  it('renders Founder Program Lander when hostname is founder.indii.music even when env var is false', async () => {
    vi.stubEnv('VITE_FOUNDER_MODE', 'false');
    Object.defineProperty(window, 'location', {
      value: { 
        hostname: 'founder.indii.music', 
        href: 'http://founder.indii.music/',
        origin: 'http://founder.indii.music',
      },
      writable: true,
    });

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('[data-testid="founder-home"]')).not.toBeNull();
    expect(container.textContent).toContain('Founder Program Lander');
  });
});
