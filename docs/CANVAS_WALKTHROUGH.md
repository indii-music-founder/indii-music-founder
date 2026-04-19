# Creative Canvas: How It Works & Test Routine

The Creative Canvas is a powerful workspace for editing and refining generated images using Fabric.js and AI integrations (Gemini Vision and Inpainting). Here is a breakdown of what the feature does, how it is supposed to work, and the routine we are running to test it.

## 1. Core Tools & Functions

### **Magic Fill (Inpainting)**
- **What it does:** Allows you to draw a freehand mask over a specific part of an image and replace it with something else using an AI text prompt.
- **How to use it:**
  1. Click the **Wand** icon (Magic Fill Mode) in the left toolbar to enter drawing mode.
  2. Draw over the area you want to change (e.g., a character's hat).
  3. In the top bar, type what you want to generate in that area (e.g., "A futuristic helmet").
  4. Click the **"Refine"** button in the top bar.
  5. The AI processes the image and mask. When finished, it shows a "Candidate" image overlay. Click the candidate to apply the change.

### **AI Object Detection**
- **What it does:** Automatically detects prominent objects in your image and allows you to mask them with a single click.
- **How to use it:**
  1. Click the **Scan** icon in the left toolbar.
  2. The system uses Gemini Vision to detect objects and places bounding boxes around them.
  3. Click a label (bounding box) to automatically generate a precise mask for that object.
  4. Type a prompt in the top bar and click **Refine** to replace or edit that specific object.

### **High Fidelity (Pro) vs High Speed (Flash)**
- Next to the Refine button, there is a **Star** icon. 
- **Toggled On (High Fidelity):** Uses `gemini-3-pro-image-preview` for complex, high-quality edits.
- **Toggled Off (High Speed):** Uses a faster model (`gemini-3-flash-preview`) for quick adjustments.

### **Animate & Create Last Frame**
- **Create Last Frame:** Generates a dramatic "climax" version of your image. It analyzes the scene and remixes it with a cinematic prompt to use as the end frame of a video.
- **Animate:** Sends the current canvas state directly to the Video Producer (Veo 3.1) to generate a video.

### **Multi-Format Export**
- The **Multi-Format** button automatically generates and downloads variations of your canvas cropped for TikTok (9:16), Instagram (1:1), and YouTube (16:9).

---

## 2. Testing Routine (Currently Running)

To truly understand what is "wonky" about the feature, I have dispatched the browser subagent to execute the following stress test:

1. **Initialization:** Open an existing image in the Creative Canvas.
2. **Interaction Feel:** Test the left toolbar tools (Rectangle, Circle, Text). Are they responsive? Is dragging/resizing smooth or laggy?
3. **Magic Fill Masking:** Toggle Magic Fill and draw a mask. We are checking if the brush strokes align properly with the cursor.
4. **Refine Execution:** Enter a prompt and hit **Refine**. We are testing if the AI response is fast, if it times out, and if the "Candidate" applies correctly to the canvas.
5. **AI Detection:** Trigger "Detect Objects". Does the system accurately identify items, and does clicking a label generate a valid mask?
6. **State Persistence:** Do undo/redo functions work? Can we save the canvas and reload it without losing annotations?

The subagent is currently navigating `http://localhost:4242/creative` and capturing its screen. Once it completes, we will have a definitive report on where the friction lies.
