---
name: direct_upload
description: Bypass the browser's native file picker by directly uploading local files or JSON mock data into Firebase Storage and Firestore using the Admin SDK.
---

# Direct Upload & Mock Data Injection Protocol

When testing the application, browser subagents cannot interact with the native macOS file picker dialog (`<input type="file">`). To upload assets, images, audio, or bulk mock data during testing, you **MUST MUST MUST** bypass the UI and use the direct upload execution script.

## The Tool: `execution/testing/direct_upload.mjs`

This Node.js script uses the Firebase Admin SDK and Application Default Credentials (or `serviceAccount.json`) to securely push local files to the active Firebase environment.

### Prerequisites

- Node.js installed
- `firebase-admin` installed in the project root (`npm install --no-save firebase-admin uuid`)
- The active Firebase project in `.env` (`VITE_FIREBASE_PROJECT_ID`)

### Use Cases & Commands

#### 1. Uploading a Single File to Storage (and getting the URL)

Use this when you just need the public download URL of a local asset to use elsewhere.

```bash
node execution/testing/direct_upload.mjs \
  --file "/absolute/path/to/local/image.png" \
  --storage-path "public/test_assets/image.png"
```

*Output will contain the public download URL.*

#### 2. Uploading a File and Appending URL to a User's Array (e.g., Brand Assets)

Use this when a user upload flow is blocked by the file picker.

```bash
node execution/testing/direct_upload.mjs \
  --file "/absolute/path/to/local/logo.png" \
  --storage-path "users/<UID>/brand_assets/logo.png" \
  --collection "users" \
  --doc "<UID>" \
  --field "brandKit.brandAssets" \
  --array-union \
  --metadata '{"category":"logo","description":"Test Logo"}'
```

#### 3. Uploading Bulk Fake Data (JSON) directly to Firestore

If you need to seed the database with mock records (like tours, campaigns, finances), pass a `.json` file. If `--collection` is provided but no `--doc`, it will auto-generate document IDs.

```bash
node execution/testing/direct_upload.mjs \
  --json-data "/absolute/path/to/mock_tours.json" \
  --collection "tour_itineraries"
```

*(The JSON file should contain an array of objects).*

### Golden Rules for AI Agents

1. **Never stall on file pickers:** If a task requires uploading a file via the browser and the `<input>` element is hidden or opens a native dialog, immediately pivot to `direct_upload.mjs`.
2. **Paths must be absolute:** Always use absolute `/Volumes/X SSD 2025/...` paths for local files.
3. **Verify via DB:** After running the script, verify the injection succeeded by querying Firestore or refreshing the browser to check the UI.
