import fs from 'fs';

const openIssuesContent = `
---

### ISSUE-017: Boardroom Overlay Z-Index Bleed
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** UI/UX Polish
- **Module:** Creative Director & Boardroom
- **Found:** 2026-05-02 by Detroit Producer
- **Steps to Reproduce:**
  1. Open the Creative Director module with the Prompt Engineering toolbar visible.
  2. Navigate into the Boardroom HQ.
  3. Observe that elements of the Creative Director (like the Prompt Engineering toolbar) remain visible or bleed through the Boardroom overlay.
  4. Expected: The Boardroom should completely occlude or hide underlying module toolbars.
- **User Impact:** Makes the UI look broken and unpolished. Causes confusion about which context is currently active.
- **Screenshot:** Attached in artifacts/DetroitProducer_2026-05-02_test_results.md
- **Notes:** Check the z-index hierarchy between \`BoardroomModule.tsx\` and \`CanvasToolbar.tsx\`.

---

### ISSUE-018: Direct Generation State Volatility (Prompt Loss)
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** State Persistence
- **Module:** Creative Director (Direct Generation)
- **Found:** 2026-05-02 by Detroit Producer
- **Steps to Reproduce:**
  1. Navigate to Creative Director -> Direct Generation.
  2. Type a detailed prompt into the textarea.
  3. Toggle the mode between "Image" and "Video".
  4. Observe that the prompt is completely cleared.
  5. Navigating to another module and returning also clears the state.
- **User Impact:** Destructive action without warning. Users lose their carefully crafted prompts simply by switching generation modes or checking another module.
- **Screenshot:** Attached in artifacts.
- **Notes:** Needs to sync with the \`creativeControlsSlice\` properly and ensure toggling the \`generationMode\` does not wipe the \`creativePrompt\`.

---

### ISSUE-019: Silent Validation on Empty Prompt
- **Status:** OPEN
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Direct Generation)
- **Found:** 2026-05-02 by Detroit Producer
- **Steps to Reproduce:**
  1. Leave the prompt textarea empty.
  2. Click the 'GENERATE' button.
  3. Nothing happens. No toast, no visual feedback.
  4. Expected: A toast warning or visual input highlighting.
- **User Impact:** The user might think the button is broken.
- **Screenshot:** N/A
- **Notes:** Add validation and a \`toast.error('Please enter a prompt')\` inside \`handleGenerate\`.

---

### ISSUE-020: "Back to Studio" Button Unreliable
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** Navigation Clarity
- **Module:** Boardroom
- **Found:** 2026-05-02 by Detroit Producer
- **Steps to Reproduce:**
  1. Enter the Boardroom HQ.
  2. Attempt to click the "Back to Studio" button.
  3. The click doesn't register, trapping the user until page reload.
  4. Expected: Immediate navigation back to the previous module.
- **User Impact:** Catastrophic navigation failure. User is trapped.
- **Screenshot:** N/A
- **Notes:** Check for hit-box occlusion from other elements or z-index issues on the back button container.
`;

const historyContent = `
## 2026-05-02 - Detroit Producer - Creative Director Edge Case Testing
- **Modules Tested:** Creative Director, Boardroom
- **Duration:** 4 minutes
- **Findings:** 3 HIGH, 1 MEDIUM
- **Key Issues:** Prompt state loss on mode toggle, Boardroom trap, Z-index bleeding.
- **Coverage Delta:** State persistence and character references tested thoroughly.
- **UX Score:** 18/30
`;

fs.appendFileSync('.agent/test_ledger/OPEN_ISSUES.md', openIssuesContent);
fs.appendFileSync('.agent/test_ledger/REAL_TEST_HISTORY.md', historyContent);

console.log('Appended to files');
