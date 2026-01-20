---
name: firebase-expert
description: Use this skill when the user asks to set up Firebase, write Security Rules, architect Firestore databases, implement Authentication, deploy via App Hosting, or debug Firebase errors (permission denied, quota exceeded).
---

# Firebase Full-Stack Expert

This skill transforms the agent into a **Google Firebase Architect**, capable of implementing backend-as-a-service solutions, configuring security, and optimizing costs across the Firebase ecosystem.

## 1. Project Configuration & SDKs

### Web (Modular SDK v9+)

* **Standard**: Always use the **Modular SDK** (tree-shakeable) over the legacy namespaced API.
* **Initialization**: Requires a configuration object containing `apiKey`, `authDomain`, and `projectId`.
* **Security**: API Keys in `firebaseConfig` are for **identification**, not authorization. They are safe to expose in client code, but MUST be restricted by HTTP Referrer in the Google Cloud Console.

### Android (Gradle & BoM)

* **Bill of Materials (BoM)**: Always use the Firebase Android BoM to manage dependency versions and ensure compatibility.

    ```kotlin
    implementation(platform("com.google.firebase:firebase-bom:34.8.0"))
    implementation("com.google.firebase:firebase-analytics")
    ```

* **Plugin**: The `com.google.gms.google-services` plugin is required to process the `google-services.json` file.

### Apple Platforms (iOS+)

* **Setup**: Use Swift Package Manager (SPM). The `GoogleService-Info.plist` file must be added to the project root and included in all targets.
* **Initialization**: Call `FirebaseApp.configure()` in the `UIApplicationDelegate` or `App` struct.

## 2. Authentication & Identity

### Service Selection

* **Free Tier**: Supports up to **50,000 Monthly Active Users (MAUs)** on the Spark plan.
* **Enterprise**: For SAML/OIDC or multi-tenancy, use **Identity Platform** (requires Blaze plan).
* **Phone Auth**: Includes 10k free verifications/month; subsequent verifications are billed per SMS. **Avoid** for high-volume free apps; prefer Email/Social.

### Implementation Rules

* **Custom Claims**: Use Admin SDK to set roles (e.g., `admin: true`) for RBAC (Role-Based Access Control).
* **Anonymous Auth**: Use for "lazy registration" to let users try the app before signing up.

## 3. Cloud Firestore (NoSQL Database)

### Data Modeling

* **Structure**: Data is stored in **Documents** arranged in **Collections**.
* **Querying**: Queries are shallow; fetching a document does not fetch its subcollections.
* **Indexes**: Compound queries require composite indexes. If a query fails, the error message provides a direct link to create the index in the console.

### Security Rules (CRITICAL)

**Never** leave rules as `allow read, write: if true;` in production. Use the following patterns:

**Pattern: User-Owned Data**

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Only the user can read/write their own document
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Pattern: Role-Based Access**

```javascript
match /posts/{postId} {
  allow read: if true; // Public read
  // Only admins can write
  allow write: if request.auth.token.admin == true;
}
```

## 4. Hosting & Deployment

### App Hosting (Next.js / Angular)

* **Use Case**: For server-rendered, full-stack frameworks (Next.js 13+, Angular 18+).
* **Mechanism**: Builds automatically from a GitHub repository. Handles SSR (Server-Side Rendering) and API routes automatically.
* **Configuration**: Configure backend settings (memory, secrets) via `apphosting.yaml`.

### Firebase Hosting (Static)

* **Use Case**: Single Page Apps (React, Vue) or static sites.
* **Dynamic Content**: Can be paired with Cloud Functions or Cloud Run for microservices using `rewrites` in `firebase.json`.

## 5. Cloud Functions (Serverless)

### Versioning

* **Gen 2**: Built on Cloud Run. Offers longer timeouts, higher concurrency (up to 1000 requests/instance), and larger instance sizes.
* **Triggers**: Supports HTTP, Firestore (on create/update/delete), Pub/Sub, and Scheduler.

### Pricing Warning

* **Requirement**: Projects MUST be on the **Blaze (Pay-as-you-go)** plan to deploy functions.
* **Infinite Loops**: Avoid triggers that write to the same path they listen to, which causes infinite billing loops.

## 6. Troubleshooting & Error Handling

| Error | Likely Cause | Solution |
| :--- | :--- | :--- |
| **403 Permission Denied** | Security Rules rejected the operation. | Check `request.auth` in rules. Ensure client is signed in. |
| **402 Payment Required** | Quota exceeded or Plan mismatch. | Upgrade to Blaze Plan. Cloud Functions *require* Blaze. |
| **429 Resource Exhausted** | Rate limits hit (e.g., Firestore writes). | Implement exponential backoff. Check "App Check" quotas. |
| **auth/api-key-not-valid** | API Key missing or restricted. | Check Google Cloud Console > Credentials. Ensure "Identity Toolkit API" is allowed. |
| **Missing google-services.json** | Config file not in app module root. | Download from console. Place in `app/` (Android) or `Runner/` (iOS). |

## 7. Cost Optimization (Spark vs. Blaze)

* **Spark (Free)**: Best for Dev/Test. Includes 1GB Firestore storage, 10GB/month Hosting transfer, 50k Auth MAUs.
* **Blaze (Paid)**: Required for Cloud Functions and scaling. Set up **Budget Alerts** in Google Cloud Console immediately upon upgrading.
* **Optimization**:
  * Cache heavy read operations on client.
  * Avoid high-frequency updates on single documents (1 write/sec limit).
  * Use **App Check** to prevent billing fraud from unauthorized clients.

```
