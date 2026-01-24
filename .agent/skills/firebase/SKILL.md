---
name: firebase-expert
description: Google Firebase Architect rules for Auth, Firestore, Hosting, and AI Logic.
---

# Firebase Architect

## 1. Project & SDKs

* **Web/Node:** Use Modular SDK (v9+).
* **Mobile (AI):** **Use Firebase AI Logic** (`firebase_ai` / `Firebase AI Logic`). Legacy GenAI SDKs for Swift/Android are deprecated.
* **Android:** Use BoM (`com.google.firebase:firebase-bom`).

## 2. Auth

* **Plan:** Spark (50k MAU). Phone Auth expensive.
* **Claims:** Use Custom Claims (`admin: true`) for RBAC.

## 3. Firestore (NoSQL)

* **Security (CRITICAL):**
  * User-Owned: `allow write: if request.auth.uid == userId;`
  * Role-Based: `allow write: if request.auth.token.admin == true;`
* **Queries:** Shallow reads. Compound indexes linked in error.

## 4. Hosting & Functions

* **App Hosting:** Next.js/Angular (SSR).
* **Functions (Blaze):** Gen 2 (Cloud Run). Avoid infinite triggers.
* **Costs:** Set Budget Alerts. Check for Hotspotting (1 write/sec/doc).
