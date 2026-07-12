# Mobile Remote Relay Test Plan

**Date:** 2026-07-12  
**Objective:** Verify phone-to-desktop remote control workflows end-to-end  
**Status:** In Progress

---

## Test Scenarios

### ✅ Completed Tests

#### 1. Basic Chat & Agent Response
- **Test:** Send text message "Hi" from phone → agent responds
- **Expected:** Full agent response with context (Conductor mentions project, strategy)
- **Result:** ✅ PASS — Agent responded with project context, 5-star rating shown
- **Evidence:** Phone screenshot shows full Conductor response about synthetic/organic project
- **Latency:** ~2-5 seconds (acceptable)

#### 2. Multi-Turn Conversation
- **Test:** User asks agent to search for file → agent responds → user clarifies location → agent re-thinks
- **Expected:** Agent maintains context across turns, refines search based on clarification
- **Result:** ✅ PASS — Conversation flows, agent understands clarification
- **Evidence:** User said "in the photos folder" → agent now processing new search
- **Latency:** ~2-5 seconds per turn

---

### 🟡 In-Progress Tests

#### 3. File Discovery & Asset Reference (BLOCKED)
- **Test:** Ask phone agent to find specific file (e.g., "font logo") in local assets
- **Expected:** Agent searches desktop files, returns matching results
- **Current Status:** ❌ BLOCKED — File browser tool not implemented (ISSUE-1044)
- **Agent's Honest Response:** "I don't have access to your local files. Files need to be in the Creative Studio or uploaded."
- **Workaround:** Upload assets to Firestore first, then ask agent to reference them
- **Fix Required:** Implement Desktop File Browser Tool

---

### 📋 Planned Tests (Not Yet Run)

#### 4. Creative Generation from Phone
- **Test:** Ask phone agent to generate an image with specific parameters
- **Commands to Try:**
  - "Generate an image with my headshots, underground breakbeat style"
  - "Create a 16:9 thumbnail for a music video"
  - "Generate 3 variations of the brand color palette"
- **Expected:** 
  - Agent accepts the request
  - Desktop Studio generates image
  - Phone displays progress ("Generating...")
  - Phone shows completed image
- **Success Criteria:**
  - Image generation completes in <2 minutes
  - Phone can rate the image
  - Image persists in Creative History

#### 5. Boardroom Group Chat
- **Test:** Use phone to send a message to the Boardroom (all seated agents)
- **Commands to Try:**
  - "Boardroom: What's the best way to distribute this track?"
  - "Broadcast: Here's the new reference image [image attachment]"
  - "@Finance: What's my current spending?"
- **Expected:**
  - Message reaches all seated agents
  - Agents respond with department-specific perspective
  - Phone shows multi-agent responses
- **Success Criteria:**
  - At least 3 agents respond
  - Responses visible on phone within 10 seconds
  - No dropped messages

#### 6. Navigation & Module Switching
- **Test:** Use phone to navigate between modules
- **Commands to Try:**
  - "Show me the dashboard"
  - "Switch to creative director"
  - "Open my projects"
  - "Go to distribution"
- **Expected:**
  - Desktop app switches to requested module
  - Phone shows confirmation
  - Phone displays module-specific data
- **Success Criteria:**
  - Desktop switches module within 2 seconds
  - Phone shows correct module view
  - No UI conflicts between phone and desktop

#### 7. Project/Session Management
- **Test:** Create or switch projects from phone
- **Commands to Try:**
  - "Create a new project called 'Underground Breakbeat EP'"
  - "Switch to project 'Synthwave Dreams'"
  - "Archive the old demo session"
- **Expected:**
  - Project operations complete on desktop
  - Phone shows updated project list
  - Desktop and phone stay in sync
- **Success Criteria:**
  - Project state syncs within 5 seconds
  - Phone shows the new project name
  - Archive action reflected on both devices

#### 8. Cross-Device Sync
- **Test:** Make a change on phone, verify it appears on desktop
- **Scenario:**
  - Phone: Add a note "Remember to upload to DistroKid"
  - Desktop: Note appears in the Notes panel
  - Desktop: Add a note "Finished mastering"
  - Phone: Note appears in phone notes
- **Expected:** Bidirectional sync with <5 second latency
- **Success Criteria:**
  - Both devices show the same notes
  - No duplicate notes
  - Timestamps are accurate

#### 9. Voice/Audio Commands
- **Test:** Use voice input on phone to control desktop
- **Commands to Try:**
  - (Press 🎤 microphone) "Generate an image with the brand colors"
  - (Press 🎤) "Create a 30-second video clip"
- **Expected:**
  - Voice transcribed on phone
  - Sent as text command
  - Desktop processes normally
- **Success Criteria:**
  - Voice transcription is accurate
  - Commands execute as if typed
  - No loss of data in transcription

#### 10. Offline Behavior
- **Test:** Use phone remote while desktop is offline
- **Scenario:**
  - Close desktop app
  - Send commands from phone
  - Desktop comes back online
  - Commands should queue and execute
- **Expected:**
  - Phone shows "Studio Offline" (not "Processing...")
  - Commands route to Cloud Function (text-only)
  - When desktop returns, queued commands complete
- **Success Criteria:**
  - Timeout after 2 minutes (not infinite thinking)
  - Cloud function processes cloud-eligible commands
  - Honest status ("studio offline" not false "connected")

#### 11. Image Attachment in Chat
- **Test:** Phone sends a photo/image in a message to the agent
- **Scenario:**
  - User takes a photo or selects from gallery
  - Attaches to chat message
  - Sends with text like "What do you think of this reference?"
- **Expected:**
  - Image uploads to Firestore
  - Agent receives image URL
  - Agent analyzes and responds with feedback
- **Success Criteria:**
  - Image uploads within 5 seconds
  - Agent can see and analyze the image
  - Response includes specific feedback about the image

#### 12. Living Plans from Phone
- **Test:** Create a living plan (multi-step workflow) from phone
- **Scenario:**
  - User: "Create a plan to finalize the mastering and upload to 3 platforms"
  - Agent creates plan with steps: Mastering → Quality Check → Upload to DistroKid → Upload to Spotify → Upload to Apple Music
  - Phone shows the plan
  - User approves plan
  - Steps execute
- **Expected:**
  - Plan renders on phone with all steps visible
  - User can approve/edit/execute
  - Desktop shows the same plan
- **Success Criteria:**
  - Plan visible on phone within 3 seconds
  - Plan persists across devices
  - Steps execute in sequence

#### 13. Rating & Feedback
- **Test:** Rate agent responses and provide feedback from phone
- **Scenario:**
  - Agent responds to a query
  - User taps 1-5 stars to rate the response
  - User optionally adds a comment
- **Expected:**
  - Rating is submitted
  - Feedback goes to memory/analytics
  - No errors
- **Success Criteria:**
  - Rating submitted without delay
  - Rating visible immediately
  - Feedback appears in next agent context (agent recalls this was useful)

---

## Test Environment Setup

### Desktop (Studio)
- [ ] Desktop app running and signed in
- [ ] Internet connection stable
- [ ] Settings > Remote Access shows "QR Code Generator" button
- [ ] No browser tabs with `/mobile-remote` URL open

### Phone (Remote)
- [ ] Same indii account as desktop
- [ ] QR code scanned and paired successfully
- [ ] Shows "Studio Connected" (green indicator)
- [ ] Stable WiFi or cellular connection

### Monitoring
- [ ] Browser console open on desktop (check for errors)
- [ ] Firestore rules check passing (no permission errors)
- [ ] Relay state document exists: `users/{uid}/remote-relay/state`

---

## Known Limitations (Workarounds)

| Limitation | Workaround | Fix |
|------------|-----------|-----|
| **No file browser** (ISSUE-1044) | Upload assets to Firestore first | Implement Desktop File Browser Tool |
| **No voice input** | Type or copy-paste commands | Add mobile voice-to-text (OS-level) |
| **No image attachment tool** | Describe the image in text | Build image upload + storage integration |
| **Studio offline → 2min timeout** | Close phone remote when studio is down | Implement faster offline detection |
| **Notes don't sync** (ISSUE-761) | Keep notes in Firestore instead of localStorage | Implement cloud persistence for notes |
| **Conversations disappear** (ISSUE-755) | Manually archive important chats | Fix session persistence |

---

## Test Execution Order

**Priority 1 (Core Relay):** Tests 1-3 (already done), 4-7  
**Priority 2 (Advanced):** Tests 8-10  
**Priority 3 (Polish):** Tests 11-13  

**Estimated Time:**
- Quick run (tests 1-6): 15 minutes
- Full run (tests 1-13): 45 minutes
- With issues: 90 minutes

---

## Issue Tracking

As you run each test, log results here:

| Test # | Command | Result | Issue Raised | Notes |
|--------|---------|--------|--------------|-------|
| 1 | "Hi" | ✅ PASS | — | Conductor response with context |
| 2 | "Find font logo..." | ✅ PASS | — | Multi-turn conversation working |
| 3 | "Find font logo in photos" | ❌ BLOCKED | ISSUE-1044 | No file browser tool |
| 4 | "Generate image..." | 🟡 TBD | — | Will test next |
| 5 | "Boardroom: ..." | 🟡 TBD | — | Will test next |
| 6 | "Show dashboard" | 🟡 TBD | — | Will test next |
| 7 | "New project..." | 🟡 TBD | — | Will test next |
| 8 | Phone add note | 🟡 TBD | — | Will test next |
| 9 | Voice command | 🟡 TBD | — | Will test next |
| 10 | Desktop offline | 🟡 TBD | — | Will test next |
| 11 | Image attachment | 🟡 TBD | — | Will test next |
| 12 | Create living plan | 🟡 TBD | — | Will test next |
| 13 | Rate response | 🟡 TBD | — | Will test next |

---

## Summary (Update After Each Session)

**Date:** 2026-07-12  
**Tester:** William  
**Tests Passed:** 2/3  
**Tests Blocked:** 1/3 (ISSUE-1044)  
**Critical Issues Found:** None (file browser is planned limitation)  
**Recommendations:**
1. Implement Desktop File Browser Tool (ISSUE-1044)
2. Continue with tests 4-13 in next session
3. Monitor latency (currently 2-5s, acceptable for beta)

