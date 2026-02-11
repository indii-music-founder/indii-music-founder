---
name: test
description: Comprehensive testing guidelines for indiiOS, covering unit, integration, and E2E testing with Vitest and Playwright.
version: 2.0.0
last_updated: 2026-02-06
---

# Testing Skill (Platinum Level)

**Comprehensive guide to testing strategies, tools, and best practices for indiiOS.**

---

## 1. Testing Philosophy

> **"If it's not tested, it's broken."**

We employ a modification of the Testing Pyramid:

1. **Unit Tests (Vitest):** 60% - Fast, isolated, logic-heavy.
2. **Integration Tests (Vitest):** 20% - Component interactions, hooks, API mocks.
3. **E2E Tests (Playwright):** 20% - Critical user flows, visual regression, smoke tests.

---

## 2. Toolchain Overview

| Type | Tool | Config File | Usage |
| --- | --- | --- | --- |
| **Unit/Integration** | Vitest | `vitest.config.ts` | `npm test` |
| **E2E** | Playwright | `playwright.config.ts` | `npm run test:e2e` |
| **Component** | Testing Library | N/A | Within Vitest |
| **Mocking** | MSW / Vi | `src/test/mocks/` | API & Service mocks |

---

## 3. Unit Testing (Vitest)

### 3.1 Service Test

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from './AIService';

describe('AIService', () => {
    let service: AIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AIService();
    });

    it('should generate content successfully', async () => {
        const mockResponse = { text: 'Hello AI' };
        vi.spyOn(service, 'generate').mockResolvedValue(mockResponse);

        const result = await service.generate('prompt');
        expect(result).toEqual(mockResponse);
    });

    it('should handle errors gracefully', async () => {
        vi.spyOn(service, 'generate').mockRejectedValue(new Error('API Error'));
        await expect(service.generate('prompt')).rejects.toThrow('API Error');
    });
});
```

### 3.2 Component Test

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatOverlay } from './ChatOverlay';
import { vi } from 'vitest';

describe('ChatOverlay', () => {
  it('should send message on submit', async () => {
    const mockSendMessage = vi.fn();
    vi.mock('@/hooks/useChat', () => ({
      useChat: () => ({
        messages: [],
        sendMessage: mockSendMessage,
        isLoading: false,
      }),
    }));

    render(<ChatOverlay />);
    
    const input = screen.getByPlaceholderText(/type a message/i);
    await fireEvent.change(input, { target: { value: 'Hello AI' } });
    await fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    expect(mockSendMessage).toHaveBeenCalledWith('Hello AI');
  });
});
```

---

## 4. E2E Testing (Playwright)

### 4.1 Basic spec

```typescript
import { test, expect } from '@playwright/test';

test('dashboard loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/indiiOS/);
  await expect(page.getByTestId('dashboard-layout')).toBeVisible();
});
```

### 4.2 Visual Comparison

```typescript
test('visual regression check', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard-main.png');
});
```

---

## 5. Mocking Strategies

### 5.1 Global Mocks

Defined in `src/test/setup.ts`:

- `matchMedia`
- `ResizeObserver`
- `IntersectionObserver`
- Firebase Auth/Firestore/Storage

### 5.2 Service Mocks

Use `vi.mock` for module-level mocking:

```typescript
vi.mock('@/services/firebase/auth', () => ({
  authService: {
    currentUser: { uid: '123' },
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
}));
```

---

## 6. Coverage Requirements

- **Services:** 90%
- **Utils:** 100%
- **Components:** 80% (Focus on interaction, not style)

---

## 7. Best Practices

1. **Arrange-Act-Assert:** Clean test structure.
2. **One Assert Per Test:** (Guideline) Focus on one behavior.
3. **Meaningful Descriptions:** `it('should return 400 if ID is missing')` vs `it('error')`.
4. **Clean Up:** Reset mocks in `beforeEach`.
5. **No Flaky Tests:** If it fails 1/10 times, fix the race condition. Do not ignore.
