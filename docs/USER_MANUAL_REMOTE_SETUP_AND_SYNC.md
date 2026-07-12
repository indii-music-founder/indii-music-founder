# indii Remote Setup & Cross-Device Sync User Manual

**Version:** 1.55.3  
**Last Updated:** 2026-07-12  
**Scope:** Phone/tablet pairing, workspace sync, and data persistence across devices

---

> ⚠️ **CURRENT LIMITATIONS (2026-07-12)**
> 
> This manual describes the **target** cross-device sync behavior. The current implementation has known gaps:
> - **Conversations may disappear** when switching modules or offices (ISSUE-755 — scope fix in progress)
> - **Notes are device-local only** — not synced to cloud (ISSUE-761 — planned)
> - **Boardroom persistence** is improved but still has edge cases (ISSUE-760 — partially fixed)
> 
> **Best practice:** Manually archive important conversations and export notes as a backup until ISSUE-755/761 complete.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup: Pairing Your Mobile Device](#setup-pairing-your-mobile-device)
3. [What Data Syncs Across Devices](#what-data-syncs-across-devices)
4. [Cross-Device Workflows](#cross-device-workflows)
5. [Persistence Guarantees](#persistence-guarantees)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

**Goal:** Work on your phone/iPad, seamlessly continue on your desktop (or vice versa).

**5-Minute Setup:**

1. **Open indii Studio on your desktop** (Mac, Windows, or Linux)
2. **Go to Settings > Remote Access** and select **"Generate Pairing QR Code"**
3. **On your phone/iPad**, open Safari and navigate to the URL from the QR code (or manually enter it)
4. **Confirm the pairing request** on both devices
5. **Your mobile device is now connected** — you can immediately start sending commands to the Studio

**Result:** Your phone becomes a wireless remote for the desktop. Any workspace state you create is automatically saved to the cloud and available on all your devices.

---

## Setup: Pairing Your Mobile Device

### Prerequisites

- ✅ **Desktop Studio installed** (Electron app on Mac/Windows/Linux)
- ✅ **Internet connection** (WiFi or cellular)
- ✅ **Phone or tablet** (iOS, Android, or any device with a browser)
- ✅ **Same indii account** on both devices (use your email login)

### Step 1: Open Remote Access Settings (Desktop)

1. Launch **indii Studio** on your desktop
2. Click the **Settings gear icon** (top-right)
3. Select **"Remote Access"** or **"Mobile Remote"**
4. You'll see the **Pairing Code Generator** section

### Step 2: Generate the Pairing QR Code (Desktop)

1. In the Remote Access panel, click **"Generate Pairing QR Code"**
2. A QR code appears on screen with a 10-minute expiry timer
3. The code also displays as a text URL in case you need to type it manually

### Step 3: Scan or Enter the Pairing Code (Mobile)

**Option A: Scan the QR Code**
1. Open the **Camera app** on your phone
2. Point at the QR code on your desktop screen
3. Tap the notification that appears ("Open in Safari")
4. You'll be redirected to the pairing page

**Option B: Enter the URL Manually**
1. Copy the text URL from the desktop pairing panel
2. Open **Safari** (or your default browser) on your phone
3. Paste the URL into the address bar and press Enter

### Step 4: Confirm Pairing (Mobile)

1. The browser shows: **"Confirm Pairing to [Your Studio Name]"**
2. Verify that your **studio name** and **email** are correct
3. Tap **"Confirm Pairing"**
4. The page shows: **"✅ Paired Successfully"** and redirects to the **Mobile Remote Control Interface**

### Step 5: Confirm Acceptance (Desktop)

1. On your desktop, you'll see a notification: **"New device paired: [Device Name]"**
2. Click **"Accept"** (or the pairing is pending)
3. The desktop now shows: **"Studio Connected"** on the phone's interface

### Step 6: Test the Connection

1. **On your phone**, type a simple command in the chat box (e.g., `Hi` or `Show me the dashboard`)
2. **On your desktop**, you should see the message appear in the Boardroom
3. **Wait 2–5 seconds** for the desktop Studio to process and respond
4. **On your phone**, the response appears in the chat

**✅ Success!** Your mobile device is now paired and synced.

---

## What Data Syncs Across Devices

### Automatically Synced (Cloud Persistence)

Every time you make a change on one device, it's saved to the cloud and appears on all your other devices within **2–5 seconds**:

| Category | What Syncs | Example |
|----------|-----------|---------|
| **Workspace** | Seated agents, active conversation, notes, module selection | You open the Creative Director on your phone; your desktop automatically switches to Creative Director next time you open it |
| **Conversations** | Chat history, agent responses, message timestamps | A reply from the Finance agent on mobile is visible on desktop without refreshing |
| **Notes & Assets** | Created notes, referenced images, audio files | A voice memo you recorded on your phone is immediately available in the desktop editor |
| **Agent Selection** | Active agents, conversation mode (Boardroom/Direct/Department) | Switching to the Legal agent on your phone carries over to desktop |
| **Plans** | Living plans, selected step, agent delegations | A plan you created on mobile is fully editable on desktop |
| **Current Module** | Which screen you're viewing (Dashboard, Creative, Distribution, etc.) | If you're viewing the Dashboard on your phone, your desktop remembers this preference |

### NOT Synced (Local or Device-Specific)

These items stay on each device and are intentionally **not** synced:

| Item | Why | What to Do |
|------|-----|-----------|
| **Electron Window State** | Window size, position, theme (light/dark) | Each device remembers its own window layout |
| **Local Cache** | Downloaded media, temporary files | Media is re-fetched on each device from cloud storage |
| **Device-Specific Settings** | Microphone/camera permissions, browser history | Each device manages its own hardware access |
| **Offline Queue** | Commands queued while offline | Synced to cloud once internet reconnects |

---

## Cross-Device Workflows

### Workflow 1: Start on Mobile, Continue on Desktop

**Scenario:** You're at the studio recording, using your phone to browse and create assets. Later, you sit at your desk and want to continue.

**Steps:**

1. **On your phone:**
   - Use the Mobile Remote to chat with agents
   - Create notes, capture voice memos, take photos
   - Navigate to the Creative Director and set up a prompt
   - All changes auto-save to the cloud

2. **On your desktop:**
   - Launch indii Studio (no pairing needed — you're already logged in)
   - The app automatically **loads your last workspace state from the cloud**
   - You see the same **agents seated**, **notes**, **prompt**, and **conversation** from your phone
   - A dialog may ask: _"Load workspace from your phone (5 mins ago)?"_ — click **"Yes"** to accept
   - Continue editing the prompt, generate images, or send Boardroom commands

3. **Result:** **Zero friction** — your phone's work is instantly available on your desktop.

---

### Workflow 2: Start on Desktop, Control from Phone

**Scenario:** You're at your desk working in the Creative Director. A client calls — you need to review the work on your phone while walking.

**Steps:**

1. **On your desktop:**
   - Work in the Creative Director (generate images, refine prompts, etc.)
   - All changes sync to the cloud in real-time (every 4 seconds)

2. **On your phone:**
   - Open the Mobile Remote (already paired)
   - The phone's dashboard shows **"Studio Connected"** (green)
   - Chat with agents using text or voice: _"Show me the latest creative"_
   - The desktop Studio receives the command and responds
   - Responses appear on your phone in 2–5 seconds

3. **Back on your desktop:**
   - If you made changes on the phone (e.g., added notes), the desktop auto-updates
   - Workspace state stays in sync with no manual refresh needed

4. **Result:** Your phone is a **full remote control** for the desktop Studio.

---

### Workflow 3: Offline Handoff (Works Offline)

**Scenario:** You're on a plane, subway, or in an area with no internet. You still want to create content.

**Steps:**

1. **Before going offline:**
   - Make sure both devices are fully synced (no warning indicators)
   - All data is cached locally on each device

2. **While offline:**
   - You can still chat with agents on your desktop (using cached models)
   - You can create notes, draft prompts, and organize agents
   - Changes are **queued locally** and marked with a ⏳ icon

3. **When internet reconnects:**
   - Both devices automatically **push their queued changes** to the cloud
   - If there's a conflict (e.g., you edited on both devices), a dialog asks which version to keep
   - Sync completes silently in the background

4. **Result:** **Offline mode doesn't block your workflow** — just queue changes that sync later.

---

## Persistence Guarantees

### What You're Guaranteed

✅ **Real-Time Sync:** Changes sync from one device to others in **2–5 seconds**  
✅ **Last-Write-Wins:** If you edit on both devices at the same time, **the most recent change** takes priority  
✅ **Conflict Resolution:** If a conflict is detected, **you're asked to choose** which version to keep  
✅ **Cloud Backup:** All workspace data is persisted in **Firestore** and survives app crashes  
✅ **Cross-Browser:** Works on any device — desktop app, web browser, iPad, phone  
✅ **Offline Queue:** Commands queue locally and push when internet returns  

### What Can Go Wrong (and How to Fix It)

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Sync Stalled** | Changes on phone don't appear on desktop after 10s | Check internet connection; try toggling airplane mode off/on |
| **Conflict Dialog** | "Load workspace from Device X?" appears repeatedly | Click "Yes" to accept the latest version; click "No" to keep local |
| **Old Data Loads** | Desktop loads a 1-hour-old workspace instead of fresh | Make a small change on desktop (e.g., add a note) to trigger a fresh push |
| **Mobile Says "Offline"** | Phone shows "Studio Offline" but desktop is running | Desktop may be sleeping; click the indii icon to wake it; check desktop internet |
| **Cache Corrupted** | Some notes/assets vanish after restart | Clear browser cache on the affected device and restart |

---

## Troubleshooting

### Mobile Remote Not Connecting

**Problem:** You generate a QR code, scan it, but the phone says "Failed to connect."

**Checklist:**

1. ✅ Is your desktop **running and signed in**? (Not just minimized — actually logged in)
2. ✅ Are both devices on the **same WiFi network**? (Or at least connected to the internet)
3. ✅ Did you use the **same email** to log in on both devices?
4. ✅ Is the QR code still **valid** (green, not expired)? If expired, generate a new one.
5. ✅ **Try again:** Close the mobile browser tab, clear cache, and rescan the QR code.

**If still failing:**

- Desktop: Go to **Settings > Remote Access > Restart Relay Service**
- Wait 10 seconds
- On mobile: Generate a new QR code and rescan

---

### Desktop Not Showing Changes from Mobile

**Problem:** I made changes on my phone, but my desktop still shows the old state.

**Checklist:**

1. ✅ Did you **send the command** on mobile, or just type it? Press Enter to send.
2. ✅ Is the desktop showing **"Studio Connected"** in green? If red/gray, it's offline.
3. ✅ **Wait 5 seconds** — sync is not instant; allow time for the push.
4. ✅ **Try a manual refresh:** On desktop, press `Cmd+R` (Mac) or `Ctrl+R` (Windows).

**If still not syncing:**

- On desktop: Check **Settings > Workspace Sync > Status**
- Look for error messages (e.g., "Firebase auth failed")
- Sign out and sign back in

---

### Pairing Code Expired

**Problem:** The QR code disappeared or won't scan.

**Solution:**

1. On desktop, go back to **Settings > Remote Access**
2. Click **"Generate Pairing QR Code"** again
3. A new code appears (valid for 10 minutes)
4. Scan or enter the new URL on your mobile device

---

### Duplicate or Conflicting Data

**Problem:** The same note appears twice, or two versions of a plan exist.

**Root Cause:** Two devices pushed changes at the same time, creating a conflict.

**How to Fix:**

1. **Desktop:** Look for a notification bar at the top: _"Workspace conflict detected"_
2. Click the notification to see options: "Keep This" vs. "Load From Cloud"
3. **Choose the version you want to keep**
4. The app syncs and removes the duplicate

**Prevention:**

- Avoid editing the same item on two devices at the same time
- Always wait for one device to finish before switching to another
- If you need to edit on multiple devices, make one a "read-only" session (no edits)

---

### "Your Session Was Updated"

**Problem:** You're working on desktop, but a notification says "Your workspace was updated from iPhone."

**What This Means:**

- Another device (your iPhone) pushed a newer workspace snapshot to the cloud
- The desktop detected that the cloud version is fresher than the local version

**What Happens:**

1. A dialog appears: **"Load the updated workspace from your iPhone?"**
2. **Click "Yes"** to adopt the iPhone's state (recommended)
3. **Click "No"** to keep your desktop changes and overwrite the iPhone's version

**Recommendation:** Usually click **"Yes"** to stay in sync. Only click "No" if you're certain your desktop changes are more important.

---

## Advanced: Device ID & Workspace Identity

### What Is a Device ID?

Each device gets a unique **Device ID** (e.g., `device-abc123def-1720000000`). This ID is:

- ✅ Stored locally in your browser's cache (localStorage)
- ✅ Used to identify **which device pushed a workspace snapshot**
- ✅ Helps the sync system avoid re-applying your own writes
- ✅ Visible in **Settings > About > Device ID**

### Why Does It Matter?

When you have multiple devices (phone, iPad, desktop), the sync system needs to know:
- _"Is this change from **my phone** or **my desktop**?"_
- _"Should I ask the user about a conflict, or silently apply it?"_

The Device ID answers these questions.

### Can I Share a Device ID?

**No.** Each device should have its own Device ID. If you manually copy a Device ID to another device:
- The sync system will think both devices are the same device
- Your phone and desktop may interfere with each other
- Changes may not sync correctly

If you accidentally shared a Device ID, **clear browser cache and refresh** — a new Device ID will be generated.

---

## Architecture: How Sync Works (Technical)

### Phase 1: Resume & Handoff (Current)

When you open indii Studio on a new device:

1. **Pull:** The app fetches the latest workspace snapshot from Firestore (cloud)
2. **Compare:** It checks if the cloud version is newer than your local state
3. **Conflict Detection:** If both are recent, it asks you to choose
4. **Rehydrate:** The chosen version is loaded into your app

When you make changes:

1. **Debounce:** Changes are queued for 4 seconds
2. **Push:** After 4 seconds, the workspace snapshot is written to Firestore
3. **Metadata:** The push includes your Device ID and timestamp

### Phase 2: Live Mirror (Planned)

In a future release, the sync system will:

1. **Subscribe:** Instead of one-shot pulls, each device listens for real-time updates
2. **Merge:** Field-level changes merge intelligently (not whole-document overwrites)
3. **Presence Heartbeat:** Devices announce their active status
4. **Zero Conflict:** Changes from multiple devices sync smoothly without conflicts

---

## FAQ

**Q: Do I need to manually save my work?**  
A: No. indii automatically saves to the cloud every 4 seconds. You never need to click "Save."

**Q: What if I'm offline — will my changes disappear?**  
A: No. Changes are queued locally and synced to the cloud when internet returns.

**Q: Can I use indii on more than 2 devices at once?**  
A: Yes. You can pair as many devices as you want. All devices sync to the same cloud account.

**Q: If I delete something on my phone, will it disappear on my desktop?**  
A: Yes (by design). Deletions sync across devices. If you delete by accident, restore from the cloud backup or use Undo (if available).

**Q: Can my partner use the same indii account?**  
A: Technically yes, but **not recommended**. You'll both sync to the same workspace, which can create conflicts. Use separate accounts for separate users.

**Q: What if my phone and desktop go out of sync?**  
A: Sign out and sign back in on the device that's out of sync. This forces a full resync from the cloud.

---

## Getting Help

If you encounter issues not covered here:

1. **Check the Settings > Workspace Sync panel** for error messages
2. **Use Ctrl+Shift+B** (or Cmd+Shift+B on Mac) to open the Bug Reporter
3. **Include:** Device type, browser/app version, and steps to reproduce
4. **Submit** — the report goes directly to our team

---

**Last Updated:** 2026-07-12  
**Next Review:** 2026-08-01 (Phase 2 Live Mirror planned)
