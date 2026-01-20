# Live Test Plan: "Black Kitty" Release

## Objective

Simulate a complete user journey for releasing a Deep Detroit Tech track on indiiOS Studio.

## Persona

- **Artist Name:** Marcus Deep
- **Email:** <marcus.deep@test.indiios.com> (Mock)
- **Password:** Test1234! (Mock)
- **Genre:** Deep Detroit Tech
- **Track:** "Black Kitty"

## Steps

1. **Authentication**
   - Navigate to `https://indiios-studio.web.app` or `http://localhost:4242` (if local). *We will use the live URL.*
   - Attempt to Sign In with credentials.
   - If User not found, attempt Sign Up.

2. **Project Setup**
   - Click **"New Project"**.
   - Select **"Music Release"** (or "Single").
   - Enter Title: **"Black Kitty"**.
   - Click **"Create"**.

3. **Workspace & Creative**
   - Verify Project Workspace loads.
   - Navigate to **"Creative"** tab.
   - (Optional) Use AI to generate cover art: Prompt "Geometric black cat, detroit techno style, dark background".

4. **Detailed Metadata**
   - Navigate to **"Metadata"**.
   - Genre: **"Deep House"** (Subgenre: Detroit Tech).
   - Mood: **"Dark", "Energetic"**.
   - BPM: **124**.

5. **Distribution**
   - Navigate to **"Distribution"**.
   - Check status (should be "Draft").
   - (Simulation) Click **"Review Release"**.

6. **Success Criteria**
   - Project created successfully.
   - Critical pages (Creative, Metadata, Distribution) load without error (no White Screen of Death).
   - No `structuredClone` errors in console.

## Notes

- Watch for 429 errors on API calls.
- If file upload is blocked, document it and proceed with metadata only.
