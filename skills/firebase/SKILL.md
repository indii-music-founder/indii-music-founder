---
name: Firebase Expert (2025 Edition)
description: Master of Firebase Gen 2 (Functions, App Hosting, Data Connect, Firestore Enterprise).
version: 2.1.0
last_updated: 2026-02-06
---

# Firebase Expert (Platinum Level)

**The definitive guide to Firebase in 2025. Gen 2 Functions, App Hosting, Data Connect.**

---

## 1. Core Philosophy

> **"Serverless does not mean structureless."**

We use Firebase as a **backend-as-a-service**, not just a database.

- **Strict schemas** (Zod)
- **Security Rules** (The real firewall) - Never trust the client.
- **Security Rules** (The rreal firewall)
- **Edge caching** (App Hosting)

---

## 2. Project Structure (Gen 2)

```text
/
├── firebase.json              # Hosting, Firestore, Storage config
├── firestore.rules            # Security rules (Role-Based Access Control)
├── storage.rules             # File access policies
├── dataconnect/              # Data Connect (PostgreSQL) schemas
│   ├── schema/
│   └── connector/
├── functions/                # Cloud Functions Gen 2
│   ├── src/
│   │   ├── triggers/         # Firestore/Auth triggers
│   │   ├── api/              # Callable functions (tRPC/REST)
│   │   └── shared/           # Shared types with frontend
│   └── main.ts
└── hosting/                  # App Hosting configuration
```

---

## 3. Streaming with Gen 2 Functions

**CRITICAL:** Gen 2 functions run on Cloud Run. Enable streaming for AI responses.

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const apiKey = defineSecret("OPENAI_API_KEY");

export const chatStream = onCall({ secrets: [apiKey] }, async (request) => {
  const { message } = request.data;

  // 1. Return a stream immediately
  const stream = await ai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: message }],
    stream: true,
  });

  // 2. Pipe to client
  for await (const chunk of stream) {
    response.sendChunk(chunk.choices[0].delta.content);
  }
  response.end();
});
```

### Client-Side Consumption

```typescript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const chatStream = httpsCallable(functions, "chatStream");

const result = await chatStream({ message: "Hello" });
const stream = result.data as ReadableStream;

for await (const chunk of stream.stream) {
  console.log(chunk.text);
}
```

---

## 4. App Hosting (GA 2025)

### 4.1 Supported Frameworks

- **Next.js** (SSR, ISR, App Router)
- **Angular** (SSR)
- **Vite** (SPA, SSR via plugins)

### 4.2 Deployment Options

| Method              | Command             | Use Case                        |
| ------------------- | ------------------- | ------------------------------- |
| **GitHub**          | Auto-deploy on push | Standard workflow               |
| **CLI Source**      | `firebase deploy`   | Local + other Firebase services |
| **Terraform**       | Container images    | CI/CD pipelines                 |
| **Firebase Studio** | Export              | AI-generated apps               |

### 4.3 CLI Setup

```bash
# Initialize App Hosting
firebase init apphosting

# Deploy with other Firebase services
firebase deploy  # Deploys hosting + functions + rules
```

### 4.4 Automatic Emulator Configuration

```typescript
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// No arguments = auto-connects to emulator locally, production when deployed
const app = initializeApp();
const db = getFirestore();
```

---

## 5. Cloud Firestore (Best Practices)

### 5.1 Security Rules (CRITICAL)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User-owned documents
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Role-based access
    match /admin/{document=**} {
      allow read, write: if request.auth.token.admin == true;
    }

    // Organization documents
    match /orgs/{orgId}/{document=**} {
      allow read: if request.auth.uid in resource.data.members;
      allow write: if request.auth.uid == resource.data.ownerId;
    }

    // Public read, authenticated write
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Size validation
    match /uploads/{uploadId} {
      allow write: if request.resource.size < 5 * 1024 * 1024; // 5MB max
    }
  }
}
```

### 5.2 Query Optimization

```typescript
// ALWAYS use .limit() to prevent unbounded costs
const recentPosts = query(
  collection(db, "posts"),
  where("userId", "==", userId),
  orderBy("createdAt", "desc"),
  limit(50), // CRITICAL: Always limit
);

// Use composite indexes (link provided in console error)
// Denormalize for frequent access patterns
const campaignDoc = {
  id: "campaign-123",
  userId: "user-456",
  orgId: "org-789",
  members: ["user-456", "user-789"], // Denormalized for security rules
  // ... other fields
};
```

### 5.3 Firestore Enterprise (NEW)

- **MongoDB Compatibility Mode**: Use MongoDB drivers with Firestore
- **Database Cloning**: Clone databases for testing
- **Query Insights**: Performance monitoring in console

---

## 6. Firebase Authentication (2025)

### 6.1 New Features

| Feature                 | Description                       |
| ----------------------- | --------------------------------- |
| **Passkeys**            | Passwordless FIDO2 authentication |
| **EU Consent Policy**   | GDPR-compliant consent mode       |
| **Link Domain**         | Custom domains for email links    |
| **Tester Restrictions** | App Distribution access control   |

### 6.2 Custom Claims for RBAC

```typescript
// Admin SDK (server-side)
import { getAuth } from "firebase-admin/auth";

await getAuth().setCustomUserClaims(uid, {
  admin: true,
  role: "editor",
  orgId: "org-123",
});

// Client-side check
const idTokenResult = await user.getIdTokenResult();
if (idTokenResult.claims.admin) {
  // Show admin UI
}
```

### 6.3 Spark Plan Limits

- **50,000 MAUs** free tier
- Phone Auth is expensive beyond free tier
- Consider passwordless email links for cost optimization

---

## 7. Cloud Functions Gen 2

### 7.1 Best Practices

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// Secrets management
const apiKey = defineSecret("EXTERNAL_API_KEY");

export const secureFunction = onCall({ secrets: [apiKey] }, async (request) => {
  // App Check validation
  if (!request.app) {
    throw new HttpsError("failed-precondition", "App Check failed");
  }

  // Auth validation
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  // Use secret
  const key = apiKey.value();
  // ... function logic
});
```

### 7.2 CORS for Hybrid Apps

```typescript
// Handle Electron file://, web production, and localhost
export function getAllowedOrigins(): string[] {
  return [
    "https://your-app.web.app",
    "https://your-app.firebaseapp.com",
    "http://localhost:4242",
    "http://localhost:3000",
    "file://", // Electron
  ];
}
```

---

## 8. Data Connect (GA 2025)

PostgreSQL backend-as-a-service with Firebase DX.

### 8.1 Key Features

- **SQL + TypeScript** bindings
- **TanStack Query** integration
- **Gemini-powered** schema generation
- **Cloud SQL** for PostgreSQL backend

### 8.2 CLI Initialization

```bash
firebase init dataconnect
# Gemini in Firebase can generate your schema from a description
```

---

## 9. Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // User uploads (500MB limit)
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
                   && request.resource.size < 500 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*|video/.*|application/pdf');
    }

    // Project assets (1GB limit, shared access)
    match /projects/{projectId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 1024 * 1024 * 1024;
    }

    // Public CDN assets (read-only)
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.token.admin == true;
    }
  }
}
```

---

## 10. API Key Security Model

### 10.1 The Truth About Firebase API Keys

> **Firebase API Keys (`AIza*`) are IDENTIFIERS, not secrets.**

| Fact                        | Explanation                                      |
| --------------------------- | ------------------------------------------------ |
| **Publicly visible**        | Safe to include in client code/config            |
| **Not authorization**       | Don't grant access to data                       |
| **Authorization via Rules** | Security enforced by Firestore/Storage rules     |
| **API Restrictions**        | Limit to specific Firebase APIs in Cloud Console |

### 10.2 What ARE Secrets

- Service Account JSON files
- Server API keys for external services
- OAuth client secrets
- Any key starting with `sk_`, `ghp_`, etc.

### 10.3 Implementation Pattern

```typescript
// ✅ CORRECT - Firebase config from environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

// ❌ TERMINAL VIOLATION - Never store actual secrets
const stripeSecret = "sk_live_..."; // NEVER DO THIS
```

---

## 11. Critical Indexes (indiiOS Context)

```text
# Required composite indexes for this project
agent_traces: userId + timestamp (Observability)
user_usage_stats: userId + date (Billing)
campaigns: userId + createdAt (Marketing)
projects: orgId + status + updatedAt (Dashboard)
```

---

## 12. MCP Server Integration

Firebase now provides an official MCP server for AI agent integration:

- **Crashlytics MCP Server**: Query crash reports programmatically
- **AI Tools CLI**: `firebase init aitools` for Gemini integration

```bash
# Initialize AI tools
firebase init aitools

# The MCP server enables AI agents to:
# - Query Firestore collections
# - Read Crashlytics data
# - Manage Auth users
# - Execute Cloud Functions
```

---

## 13. Cost Optimization Checklist

- [ ] Always use `.limit()` on queries
- [ ] Denormalize frequently accessed data
- [ ] Use Security Rules to avoid `get()` calls
- [ ] Enable offline persistence for reads
- [ ] Use composite indexes, not multiple single-field indexes
- [ ] Monitor with Query Insights
- [ ] Use App Check to prevent abuse
- [ ] Set billing alerts in Cloud Console
