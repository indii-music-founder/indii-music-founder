---
description: How to stress test the Creative Director module in the browser
---

# Live Test: Creative Director

This workflow guides the agent through an iterative process of testing and fixing the Creative Director module.

## 1. Setup

- Ensure the dev server is running (`npx vite --port 4242`).
- Open the browser to [http://localhost:4242](http://localhost:4242).

## 2. Navigation

- Click on the **Creative Director** icon in the left sidebar.
- Verify the page loads without blank screens or console errors.

## 3. Workflow Trigger

- Locate the **Main Prompt Bar** at the bottom of the screen.
- Enter a test prompt (e.g., "A futuristic city in neon lights").
- Click the **Generate** button (or press Enter).

## 4. Observation & Fix Loop

- **Monitor**: Watch for Toast notifications (Info/Success/Error).
- **Console**: Check the browser console for red error traces.
- **Network**: Check the Network tab for failed API calls (500/400 errors).

### If it breaks

1. **Diagnose**: Read the error message.
2. **Locate**: Find the mapped file in `src/modules/creative` or `src/services`.
3. **Fix**: Apply a patch to the code.
4. **Restart**: Refresh the page and retry the prompt from Step 3.

## 5. Success Criteria

- A toast message confirms "Image generated!".
- The generated image appears in the **Generation History** or **Showroom**.
- No unhandled exceptions in the console.
