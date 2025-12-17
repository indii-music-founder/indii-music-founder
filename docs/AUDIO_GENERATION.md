# Audio Generation & TTS Models

**Last Updated:** December 10, 2025
**Source:** Google DeepMind Product Update

## 1. Model Overview & Availability

* **New Models:**
  * **Gemini 2.5 Flash TTS preview** (Optimized for low latency).
  * **Gemini 2.5 Pro TTS preview** (Optimized for quality).
* **Status:** Preview models available as of December 10, 2025.
* **Legacy Note:** These new models replace the previous TTS models released in May.
* **Access:** Available via the Gemini API in Google AI Studio and the Playground.

## 2. Key Technical Improvements

### A. Enhanced Expressivity & Tone Control

* **Richer Tone Versatility:** Adheres strictly to style prompts.
* **Role Adherence:** Users can request specific tones (e.g., "cheerful and optimistic" or "somber and serious") for authentic performance.

### B. Precision Pacing (Context-Aware)

* **Context-Aware Speed Adjustments:** Automatically adjusts speed based on content—slowing down for emphasis/complexity or speeding up for excitement/action sequences.
* **Instruction Fidelity:** Follows explicit pace-related instructions with higher fidelity than previous versions.

### C. Seamless Multi-Speaker & Multilingual Dialogue

* **Speaker Handoffs:** Handles "handoffs" between speakers in back-and-forth exchanges naturally.
* **Identity Consistency:** Character voices remain consistent in multi-speaker scenarios.
* **Language Support:** Preserves unique tone, pitch, and style across **24 supported languages**.

## 3. Use Cases & Integration

* **Target Applications:** Long-form audiobooks, localized e-learning modules, product tutorials, and marketing videos.
* **Complex Scenarios:** Role-playing game characters, virtual assistants, podcasts, and simulated interviews.
* **Customer Examples:**
  * *Wondercraft:* Uses models for "Convo Mode" (life-like multi-speaker conversations) and "Director Mode" (precise control over non-verbal cues).
  * *Toonsutra:* Uses models for cinematic voiceovers and promotional video ads.

> **Analogy:**
> Think of the previous models as a generic news anchor reading a script clearly. The Gemini 2.5 update turns the model into a **voice actor**—one who knows when to whisper for suspense, speed up during a chase scene, and switch accents seamlessly without breaking character.
