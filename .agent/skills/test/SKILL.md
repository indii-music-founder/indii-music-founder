---
name: Test Expert
description: Platinum-level expert on finding, creating, and maintaining tests for the indiiOS codebase using Vitest and Playwright.
version: 2.0.0
last_updated: 2026-02-06
---

# Test Expert (Platinum Level)

**Comprehensive testing protocol for indiiOS using Vitest and Playwright.**

---

## 1. Testing Architecture Overview

| Layer | Tool | Location | Pattern | Purpose |
|-------|------|----------|---------|---------|
| **Unit** | Vitest | `**/*.test.ts` | `describe/it` | Pure function testing |
| **Integration** | Vitest | `**/*.test.ts` | Mock boundaries | Service interactions |
| **Component** | Vitest + Testing Library | `**/*.test.tsx` | RTL queries | React component tests |
| **E2E** | Playwright | `e2e/*.spec.ts` | Page objects | Full user flows |
| **Visual** | Playwright | `e2e/*.spec.ts` | Screenshots | UI regression |

---

## 2. Context-Aware Test Discovery

### 2.1 Automatic Detection (The "Identify" Phase)

```
Active File: src/services/ai/FirebaseAIService.ts
  → Look for: src/services/ai/FirebaseAIService.test.ts
  → Or: src/services/ai/__tests__/FirebaseAIService.test.ts

Active File: src/components/chat/ChatOverlay.tsx
  → Look for: src/components/chat/__tests__/ChatOverlay.test.tsx
  → Or: src/components/chat/ChatOverlay.test.tsx

Active File: functions/src/lib/image_generation.ts
  → Look for: functions/src/__tests__/image_generation.test.ts
```

### 2.2 File Location Patterns

| Source Type | Test Location |
|-------------|---------------|
| `src/services/*.ts` | `src/services/*.test.ts` or `__tests__/` |
| `src/components/*.tsx` | `__tests__/*.test.tsx` |
| `src/hooks/*.ts` | `__tests__/*.test.ts` |
| `functions/src/**/*.ts` | `functions/src/__tests__/` |
| Full flows | `e2e/*.spec.ts` |

---

## 3. Vitest Configuration (2025)

### 3.1 Modern Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/*.test.*', '**/*.d.ts', 'src/test/**'],
    },
    typecheck: {
      enabled: true,
      include: ['**/*.test.{ts,tsx}'],
    },
  },
});
```

### 3.2 Test Setup File

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
```

---

## 4. Unit Test Templates

### 4.1 Service Test (Vitest)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from './AIService';

describe('AIService', () => {
  let service: AIService;
  
  beforeEach(() => {
    service = new AIService();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateContent', () => {
    it('should return generated text on success', async () => {
      // Arrange
      const mockResponse = { text: 'Generated content' };
      vi.spyOn(service, 'callAPI').mockResolvedValue(mockResponse);
      
      // Act
      const result = await service.generateContent('Test prompt');
      
      // Assert
      expect(result).toBe('Generated content');
      expect(service.callAPI).toHaveBeenCalledWith('Test prompt');
    });

    it('should throw AIError on API failure', async () => {
      // Arrange
      vi.spyOn(service, 'callAPI').mockRejectedValue(new Error('API Error'));
      
      // Act & Assert
      await expect(service.generateContent('Test')).rejects.toThrow('API Error');
    });

    it('should respect timeout parameter', async () => {
      // Arrange
      vi.useFakeTimers();
      
      // Act
      const promise = service.generateContent('Test', { timeout: 5000 });
      vi.advanceTimersByTime(5000);
      
      // Assert
      await expect(promise).rejects.toThrow('Timeout');
      
      vi.useRealTimers();
    });
  });
});
```

### 4.2 React Component Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatOverlay } from './ChatOverlay';

// Mock hooks
vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isLoading: false,
  }),
}));

describe('ChatOverlay', () => {
  it('should render chat input', () => {
    render(<ChatOverlay />);
    
    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('should submit message on form submission', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();
    
    vi.mock('@/hooks/useChat', () => ({
      useChat: () => ({
        messages: [],
        sendMessage: mockSendMessage,
        isLoading: false,
      }),
    }));
    
    render(<ChatOverlay />);
    
    const input = screen.getByRole('textbox', { name: /message/i });
    await user.type(input, 'Hello AI');
    await user.click(screen.getByRole('button', { name: /send/i }));
    
    expect(mockSendMessage).toHaveBeenCalledWith('Hello AI');
  });

  it('should disable input while loading', () => {
    vi.mock('@/hooks/useChat', () => ({
      useChat: () => ({
        messages: [],
        sendMessage: vi.fn(),
        isLoading: true,
      }),
    }));
    
    render(<ChatOverlay />);
    
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
```

### 4.3 Hook Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImageGeneration } from './useImageGeneration';

describe('useImageGeneration', () => {
  it('should generate image successfully', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ url: 'https://example.com/image.png' });
    
    const { result } = renderHook(() => useImageGeneration({ onGenerate: mockGenerate }));
    
    expect(result.current.isGenerating).toBe(false);
    
    await act(async () => {
      await result.current.generate('A sunset over mountains');
    });
    
    await waitFor(() => {
      expect(result.current.imageUrl).toBe('https://example.com/image.png');
    });
  });
});
```

---

## 5. Playwright E2E Tests (2025)

### 5.1 Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  
  use: {
    baseURL: 'http://localhost:4242',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],

  webServer: {
    command: 'npm run dev',
    port: 4242,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 5.2 E2E Test Template

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow user to sign in', async ({ page }) => {
    // Navigate to login
    await page.click('[data-testid="login-button"]');
    
    // Fill form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Submit
    await page.click('[data-testid="submit-login"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="submit-login"]');
    
    await expect(page.locator('[role="alert"]')).toContainText('Invalid credentials');
  });
});
```

### 5.3 Visual Regression Test

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('dashboard should match snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for animations to complete
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('dark mode should match snapshot', async ({ page }) => {
    await page.goto('/settings');
    await page.click('[data-testid="dark-mode-toggle"]');
    
    await expect(page).toHaveScreenshot('settings-dark.png');
  });
});
```

---

## 6. Mocking Strategies

### 6.1 Firebase Mocking

```typescript
import { vi } from 'vitest';

// Mock Firestore
export const mockFirestore = {
  collection: vi.fn(() => mockFirestore),
  doc: vi.fn(() => mockFirestore),
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  onSnapshot: vi.fn(),
  where: vi.fn(() => mockFirestore),
  orderBy: vi.fn(() => mockFirestore),
  limit: vi.fn(() => mockFirestore),
};

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => mockFirestore),
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  ...mockFirestore,
}));
```

### 6.2 API Mocking with MSW

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/generate', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      text: `Generated response for: ${body.prompt}`,
    });
  }),
  
  http.get('/api/user', () => {
    return HttpResponse.json({
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
    });
  }),
];

// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## 7. Test Execution Commands

```bash
# Unit tests
npm run test                    # Run all tests
npm run test -- AIService       # Run tests matching "AIService"
npm run test -- --watch         # Watch mode
npm run test -- --coverage      # With coverage report

# Type checking
npm run typecheck               # TypeScript type verification

# E2E tests
npm run test:e2e                # All E2E tests
npm run test:e2e -- auth.spec   # Specific spec file
npm run test:e2e -- --ui        # Interactive UI mode
npm run test:e2e -- --debug     # Debug mode with inspector

# Update snapshots
npm run test -- -u              # Update Vitest snapshots
npm run test:e2e -- --update-snapshots  # Update Playwright screenshots
```

---

## 8. Test Creation Protocol (MANDATORY)

> **RULE:** If a test does not exist for modified code, **YOU MUST CREATE ONE.**

### 8.1 Decision Tree

```
1. Did I modify a function/method?
   → Create unit test for that function

2. Did I modify a React component?
   → Create component test with Testing Library

3. Did I add a new user flow?
   → Create E2E test with Playwright

4. Did I fix a bug?
   → Create regression test that would have caught it

5. Did I add a new API endpoint?
   → Create integration test with mocked dependencies
```

### 8.2 Minimum Test Coverage

| Code Type | Min Coverage | Critical Coverage |
|-----------|--------------|-------------------|
| Services | 80% | 95% for payment/auth |
| Components | 70% | 90% for forms |
| Hooks | 85% | 100% for state management |
| Utils | 90% | 100% for security utilities |

---

## 9. Auto-Triage Protocol

When tests fail:

```
1. READ OUTPUT
   └── Analyze the stack trace
   └── Identify failing assertion
   └── Check if test or code is wrong

2. DIAGNOSE
   └── Is this a flaky test? (timing, async issues)
   └── Is this a regression? (new code broke old behavior)
   └── Is this an outdated test? (requirements changed)

3. FIX
   └── If CODE is buggy → Fix the code
   └── If TEST is outdated → Update the test
   └── If TEST is flaky → Add proper waits/mocks

4. VERIFY
   └── Run the specific test until green
   └── Run related tests
   └── Run full suite before commit
```

---

## 10. Best Practices Checklist

- [ ] Test file exists for every service/component
- [ ] Mocks are properly reset between tests
- [ ] Async operations use `await` properly
- [ ] No `sleep()` calls—use proper waits
- [ ] Tests are isolated and can run in any order
- [ ] Error paths are tested, not just happy paths
- [ ] Accessibility tested (axe-core in component tests)
- [ ] Visual regressions checked for UI changes
