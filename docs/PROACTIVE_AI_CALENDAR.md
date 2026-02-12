# Proactive AI Calendar: The "Pulse" Engine

The **Proactive AI Calendar** (internal name: **indii Pulse**) is not a passive list of dates. It is a living, breathing orchestration layer that monitors the world and the artist's data to _initiate_ actions.

## 1. Core Concept: "The Pulse"

Instead of waiting for a user to check a calendar, the Pulse Engine runs as a background process (Heartbeat) that evaluates:

- **Project Deadlines:** "We are 3 days from release and haven't cleared the sample."
- **Social Trends:** "TikTok sound #XYZ is trending; we should pivot tomorrow's post to use it."
- **Financial Health:** "Burn rate is high; I've postponed the non-essential studio session on Friday."
- **Artist Energy:** "You've been in 'Execution Mode' for 12 hours. I've cleared your afternoon for 'Creative Rest'."

## 2. Proactive Behaviors

- **Auto-Drafting:** If a release is coming up, the Pulse doesn't just remind you; it shows up in the morning with 3 drafted press releases and 5 social posts ready for approval.
- **Conflict Resolution:** If a tour date conflicts with a high-priority media interview, the Pulse notifies the Road Manager and the Publicist (via the Hub) to resolve the clash before the human even sees it.
- **Trend-Jacking:** When a relevant industry news item breaks, the Pulse initiates a "Specialist Huddle" to draft a response.

## 3. The "Huddle" UI

In the Chat Overlay, the Proactive Calendar manifests as a **"Pulse Feed"**:

- **Alert:** "🚨 Metadata Risk: ISRC missing for 'Midnight Sun'. Fixed? [Yes] [Fix for me]"
- **Opportunity:** "💡 Viral Trend: 80s Synth-pop is peaking. Should we generate an 80s-vibe teaser for the b-side? [Generate]"
- **Rest:** "🧘 Energy Check: You've completed 15 tasks today. I'm muting non-urgent notifications until 6 PM."

## 4. Technical Implementation (The "Ghost" Layer)

- **Cron/Heartbeat:** Regular polling of the workspace, Firestore, and external APIs.
- **Context Synthesis:** Using the **Keeper Agent** to compare the current state vs. the "Brand Bible" and "Technical Roadmap."
- **Autonomous Sub-Agents:** Spawning short-lived sessions to "Draft" work in the background.

---

_indii doesn't just track your time; indii protects your time._ 💠
