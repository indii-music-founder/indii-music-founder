# Firebase Architect Skill

This skill transforms the agent into a Firebase Backend-as-a-Service (BaaS) expert. It provides decision trees for infrastructure selection, security rule generation patterns, and CLI command execution strategies for the Firebase ecosystem.

## 1. Capabilities & Triggers

**Equip this skill when the user asks to:**

* "Set up a backend for my app."
* "Write security rules for Firestore/Storage."
* "Deploy a Cloud Function."
* "Fix a Firebase permission denied error."
* "Choose between Realtime Database and Firestore."
* "Configure Gemini or AI features in Firebase."

## 2. Architectural Decision Matrix

The agent must use the following logic to guide infrastructure decisions:

### Database Selection

* **Choose Cloud Firestore** if:
  * The app requires complex querying, sorting, and filtering [1, 2].
  * Data is structured as documents and collections [3, 4].
  * Scalability beyond 200k concurrent connections is required (Firestore scales automatically) [5].
  * **Best Practice:** Adhere to the "500/50/5" rule when ramping traffic to new collections to avoid hotspotting [6, 7].
  * **Pricing:** Charges primarily based on document reads/writes/deletes [8].
* **Choose Realtime Database (RTDB)** if:
  * The app requires extremely low latency (<10ms) state synchronization (e.g., gaming, live cursors) [9, 10].
  * The data model is a simple JSON tree [11].
  * **Constraint:** Scaling beyond 200k connections requires manual sharding [5].
  * **Best Practice:** Keep data flat; avoid nesting to prevent fetching unnecessary data [12].

### Hosting Selection

* **Choose Firebase App Hosting** if:
  * The app uses a modern full-stack web framework (Next.js, Angular) [13, 14].
  * Server-Side Rendering (SSR) is required [15].
  * **Note:** Built on Cloud Run; requires Blaze (Pay-as-you-go) plan [16].
* **Choose Firebase Hosting (Classic)** if:
  * The site is purely static (HTML/CSS/JS) or a basic SPA [14, 17].
  * Cost optimization on the Spark (Free) plan is a priority [16].

### Compute Selection

* **Choose Cloud Functions (2nd Gen)** for:
  * Longer processing times (up to 60 min for HTTP) [18, 19].
  * High concurrency (up to 1000 requests per instance) [18].
  * Larger instance sizes (up to 16GiB RAM, 4 vCPU) [18].
* **Avoid Gen 1** unless legacy triggers (Analytics/Auth) specifically require it [20].

## 3. Workflow Instructions

### A. Project Initialization

When initializing a project, the agent must ensure:

1. **Environment Isolation:** Recommend separate projects for `dev`, `staging`, and `prod` to prevent data pollution [21, 22].
2. **API Key Safety:** Inform the user that Firebase API keys (found in `google-services.json` or `firebaseConfig`) are identifiers, *not* secrets. They can be public, but must have "API Restrictions" applied in the Google Cloud Console to prevent quota theft [23, 24].
3. **Local Development:** Suggest using the **Local Emulator Suite** (`firebase emulators:start`) for safe prototyping without incurring cloud costs [25, 26].

### B. Security Rule Generation

The agent must generate rules based on the Principle of Least Privilege.

**Firestore Template (Production):**

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // Content-owner only access pattern
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Default lock
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Storage Template:**

```javascript
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### C. AI Integration (Firebase AI Logic)

When the user wants to add Generative AI:

1. **Migration:** If the user mentions "Vertex AI in Firebase," note that it has been rebranded to Firebase AI Logic.
2. **Provider Selection:**
    * **Gemini Developer API:** Use for free-tier access (Spark plan compatible, lower rate limits).
    * **Vertex AI Gemini API:** Use for enterprise reliability and higher quotas (Blaze plan required).
3. **Initialization:** Do not embed Gemini API keys in the code; use the SDK which handles Auth automatically.

## 4. MCP Tool Operations Manual

The agent has access to `firebase-mcp-server` tools. Use this mapping for executing tasks:

| High-Level Goal | Preferred MCP Tool | Notes |
| :--- | :--- | :--- |
| **Inspect Data** | `mcp_firebase-mcp-server_firestore_get_documents` | Use if path is known. |
| **Query Data** | `mcp_firebase-mcp-server_firestore_query_collection` | Use for searching/filtering. |
| **Inspect Auth** | `mcp_firebase-mcp-server_auth_get_users` | Look up by email or UID. |
| **Check Backends** | `mcp_firebase-mcp-server_apphosting_list_backends` | See App Hosting status. |
| **Read Config** | `mcp_firebase-mcp-server_firebase_get_environment` | Get current project/user context. |
| **Validate Rules** | `mcp_firebase-mcp-server_firebase_validate_security_rules`| Run before deploying. |

**Important:** Always prefer MCP tools over CLI commands for read operations (inspecting data, config, status). Use CLI commands for write operations (deploying, initializing) or complex scaffolding.

## 5. Project Configuration Context

*Mapped from `firebase.json`*

* **Firestore Rules:** `./firestore.rules`
* **Storage Rules:** `./storage.rules`
* **Functions:** `./functions` (Pre-deploy: `npm run lint && npm run build`)
* **Hosting Targets:**
  * `landing`: `landing-page/dist`
  * `app`: `dist`
* **Emulators:** Firestore (8080)

## 6. CLI Command Cheat Sheet (Executable)

The agent can execute these commands via the terminal interface.

```bash
# Install Firebase Tools
npm install -g firebase-tools

# Login (CI/CD environments should use service accounts)
firebase login

# Initialize Project (Interactive)
firebase init

# Deploy specific services only
firebase deploy --only functions,firestore

# Start Local Emulators (Auth, Firestore, Functions)
firebase emulators:start --only auth,firestore,functions

# Export Production Data for Local Testing
firebase emulators:export ./test-data
```
