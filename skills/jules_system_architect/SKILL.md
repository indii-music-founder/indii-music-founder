---
name: Jules (System Architect)
description: Enforces architectural standards, strict TypeScript/Zod validation, and the 3-Layer Agent Architecture.
version: 2.0.0
last_updated: 2026-02-06
---

# Jules: System Architect (Platinum Level)

**The guardian of architectural integrity and strict typing.**

---

## 1. Core Philosophy

> **"Architecture is not about code; it's about constraints."**

Jules enforces the **3-Layer Architecture**:

1. **Layer 1 (Directive):** Natural language SOPs (`.docs/directives/`).
2. **Layer 2 (Orchestration):** Agentic reasoning and tool selection.
3. **Layer 3 (Execution):** Deterministic, typed code (`execution/`).

---

## 2. The 18 Laws of indiiOS

### 1. Architectural Laws

### Law 1: No Circular Dependencies

Use `import type` for interfaces. Use dynamic imports for circular runtime dependencies.

```typescript
// ✅ CORRECT
import type { AgentConfig } from "./types";
// Runtime import inside function
const { useStore } = await import("@/core/store");

// ❌ WRONG
import { useStore } from "@/core/store"; // Top-level cycle
```

### Law 2: Strong Typing (Zod)

All external inputs (API, user, IPC) must be validated with Zod.

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
});

function createUser(input: unknown) {
  const user = UserSchema.parse(input); // Throws if invalid
  // ...
}
```

### Law 3: Confirmation Dialogs

Destructive actions must require user confirmation.

- Deleting data
- Changing authentication settings
- Revoking access permissions
- Publishing public content

```typescript
// ✅ CORRECT
const confirmed = await confirmDialog("Delete this project permanently?");
if (!confirmed) return;
await deleteProject(projectId);

// ❌ WRONG
await deleteProject(projectId); // No confirmation
```

### Law 4: Backend Before Frontend

When building new features:

1. Define API contract/schema first
2. Implement backend logic
3. Write backend tests
4. Build frontend consuming the API
5. Write frontend tests

### Law 5: Kebab-Case Directories

All directories use `kebab-case`. No exceptions.

```text
✅ src/services/ai-providers/
✅ src/components/chat-overlay/
❌ src/services/AIProviders/
❌ src/components/ChatOverlay/
```

---

## 2. UI/UX Laws

### Law 6: Token-Based Colors Only

Never hardcode color values. Always use design tokens.

```css
/* ✅ CORRECT */
.button {
  background: var(--color-dept-creative);
}

/* ❌ WRONG */
.button {
  background: #8b5cf6;
}
```

### Law 7: Mobile-First Design

Design for mobile constraints first, then enhance for larger screens.

```css
/* ✅ CORRECT - Mobile first */
.container {
  padding: 16px;
}
@media (min-width: 768px) {
  .container {
    padding: 32px;
  }
}

/* ❌ WRONG - Desktop first */
.container {
  padding: 32px;
}
@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
}
```

### Law 8: Accessibility Non-Negotiable

WCAG 2.1 AA compliance is mandatory.

| Requirement    | Implementation                           |
| -------------- | ---------------------------------------- |
| Focus visible  | `outline: 2px solid` on `:focus-visible` |
| Color contrast | 4.5:1 minimum for body text              |
| Keyboard nav   | All interactive elements tabbable        |
| Screen reader  | Semantic HTML + ARIA where needed        |
| Touch targets  | Minimum 44×44px                          |

---

## 3. Security Laws

### Law 9: Zod Validation for IPC

All Electron IPC messages must be validated with Zod on both sides.

```typescript
// Shared schema
const FileOperationSchema = z.object({
  action: z.enum(["read", "write", "delete"]),
  path: z.string().refine(isValidPath),
  content: z.string().optional(),
});

// Preload validation
ipcRenderer.send("file-operation", FileOperationSchema.parse(data));

// Main process validation
ipcMain.handle("file-operation", async (event, data) => {
  const validated = FileOperationSchema.parse(data);
  // ... safe to proceed
});
```

### Law 10: Secure File Handling

All file paths must be validated and sandboxed.

```typescript
import path from "path";

function isValidPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const sandboxDir = path.resolve(app.getPath("userData"));
  return resolved.startsWith(sandboxDir);
}
```

### Law 11: Cryptographic Security

Use `crypto.getRandomValues()` for all security-sensitive randomness.

```typescript
// ✅ CORRECT
const buffer = new Uint8Array(32);
crypto.getRandomValues(buffer);

// ❌ WRONG
const random = Math.random(); // Predictable, not secure
```

### Law 12: API Key Classification

| Type           | Example          | Treatment              |
| -------------- | ---------------- | ---------------------- |
| **Identifier** | Firebase `AIza*` | Safe in client code    |
| **Secret**     | Stripe `sk_*`    | Server-only, .env      |
| **Token**      | GitHub `ghp_*`   | Server-only, rotatable |

---

## 4. Data & Evolution Laws

### Law 13: Explicit Schema Migrations

Database schema changes must have explicit migration scripts.

```typescript
// migrations/2026_02_06_add_user_preferences.ts
export async function up(db: Firestore): Promise<void> {
  // Add field with default value to existing documents
  const users = await db.collection("users").get();
  const batch = db.batch();

  users.docs.forEach((doc) => {
    batch.update(doc.ref, {
      preferences: { theme: "dark", notifications: true },
    });
  });

  await batch.commit();
}

export async function down(db: Firestore): Promise<void> {
  // Remove field (destructive - use with caution)
}
```

### Law 14: Immutable Event Logs

Critical user actions must be logged immutably for audit trails.

```typescript
interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  timestamp: FirebaseFirestore.Timestamp;
  ip?: string;
}

async function logAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  await db.collection("audit_logs").add({
    ...event,
    timestamp: FieldValue.serverTimestamp(),
  });
}
```

---

## 5. Media & Asset Laws

### Law 15: Metadata Preservation

When processing media, preserve or extract metadata.

```typescript
interface MediaMetadata {
  originalFilename: string;
  mimeType: string;
  dimensions?: { width: number; height: number };
  duration?: number; // For audio/video
  fileSize: number;
  createdAt: Date;
  exifData?: Record<string, unknown>;
}
```

### Law 16: Progressive Enhancement for Media

Load media progressively: placeholder → low-res → full-res.

```tsx
<img
  src={thumbnailUrl}
  data-src={fullResUrl}
  loading="lazy"
  onLoad={handleProgressiveLoad}
  alt={description}
/>
```

---

## 6. Naming Conventions

| Element              | Convention           | Example                 |
| -------------------- | -------------------- | ----------------------- |
| **Directories**      | kebab-case           | `agent-zero/`           |
| **Components**       | PascalCase           | `ChatOverlay.tsx`       |
| **Hooks**            | camelCase + use      | `useImageGeneration.ts` |
| **Services**         | PascalCase + Service | `AIService.ts`          |
| **Utils**            | camelCase            | `formatDate.ts`         |
| **Constants**        | SCREAMING_SNAKE      | `MAX_FILE_SIZE`         |
| **Env vars**         | SCREAMING_SNAKE      | `VITE_API_KEY`          |
| **CSS classes**      | kebab-case           | `.glass-card`           |
| **Types/Interfaces** | PascalCase           | `UserProfile`           |

---

## 7. Import Organization

```typescript
// 1. React/Framework
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

// 2. Third-party libraries
import { z } from "zod";
import { format } from "date-fns";

// 3. Internal aliases (@/)
import { useAuth } from "@/hooks/useAuth";
import { AIService } from "@/services/AIService";

// 4. Relative imports (same feature/module)
import { ChatMessage } from "./ChatMessage";
import type { ChatProps } from "./types";
```

---

## 8. Error Handling Pattern

```typescript
// Define domain-specific errors
class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

// Use at service layer
async function generateContent(prompt: string): Promise<string> {
  try {
    const response = await api.generate(prompt);
    return response.text;
  } catch (error) {
    if (error.code === 429) {
      throw new AIServiceError("Rate limited", "RATE_LIMITED", true);
    }
    throw new AIServiceError("Generation failed", "GENERATION_FAILED", false);
  }
}

// Handle at UI layer
try {
  const result = await generateContent(prompt);
} catch (error) {
  if (error instanceof AIServiceError && error.retryable) {
    showRetryDialog();
  } else {
    showErrorToast(error.message);
  }
}
```

---

## 9. Performance Laws

### Law 17: Lazy Loading by Default

Code-split routes and heavy components.

```typescript
const ImageEditor = lazy(() => import('./ImageEditor'));

<Suspense fallback={<EditorSkeleton />}>
  <ImageEditor />
</Suspense>
```

### Law 18: Memoization for Expensive Operations

```typescript
// Memoize expensive computations
const processedData = useMemo(() =>
  heavyProcessing(rawData),
  [rawData]
);

// Memoize callbacks
const handleSubmit = useCallback((data) => {
  submitForm(data);
}, [submitForm]);

// Memoize components
const MemoizedList = memo(({ items }) => (
  <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>
));
```

---

## 10. Checklist for New Features

- [ ] Schema/API contract defined first
- [ ] Backend implemented with tests
- [ ] Frontend consumes validated API
- [ ] Directory follows kebab-case
- [ ] Colors use design tokens
- [ ] Mobile-first responsive design
- [ ] Accessibility requirements met
- [ ] IPC validated with Zod (if Electron)
- [ ] Audit logging for sensitive actions
- [ ] Error handling follows pattern
- [ ] Code-split for non-critical paths
