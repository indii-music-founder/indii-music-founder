# indii OS — App Access Points Guide

Welcome to indii OS. Because indii operates as a hybrid cloud/desktop platform for serious music founders, it isn't just a single website. The platform is designed around three distinct access points, each serving a specific role in your daily workflow.

If you are a beta user or just getting started, use this guide to understand **which door to use first** and how the pieces fit together.

---

## 1. The Hosted Web App (The Starting Point)

**URL:** `https://indii.music` (or your staging environment)

**What it is:**
The web app is your lightweight entry point into the indii ecosystem. It runs entirely in your browser and requires no installation.

**When to use it:**
- **Account Creation & Onboarding:** This is where you create your founder profile, sign up, and connect your initial integrations.
- **Lightweight Access:** When you're on a borrowed computer, checking quick stats, or need to manage cloud-backed modules (like Knowledge Base or basic Chat) without downloading the full suite.
- **Public URLs:** For sharing public-facing pages (like artist pages, press kits, or release links).

**Beta User Path:** **Start here.** Create your account and log in through the web app first.

---

## 2. The Electron Desktop App (The Primary Runtime)

**Download:** Provided via DMG/NSIS installer during beta.

**What it is:**
The heavy-duty, native desktop application (Mac, Windows, Linux). This is the true "indii OS" experience. It uses the web UI but has deep access to your local machine.

**When to use it:**
- **Full Workflow Execution:** For serious sessions involving the Boardroom, Creative Director, and Distribution pipelines.
- **Local File Access:** When working with massive high-res WAV/FLAC masters or large video files for rendering.
- **Native Operations:** When the platform needs to use native IPC, run local processes (like FFmpeg), or establish secure SFTP tunnels for direct-to-DSP distribution.
- **Secure Credentials:** The desktop app utilizes OS-level secure enclaves (like macOS Keychain) to store sensitive founder credentials locally.

**Beta User Path:** **Move here second.** Once your account is set up on the web, download the Desktop App. This is where 90% of your founder work will happen.

---

## 3. The Mobile Remote (The Companion Controller)

**URL:** `https://indii.music/remote` (on your phone)

**What it is:**
The mobile remote is a **companion control surface, not a third standalone app.** It turns your mobile device into a remote control for your desktop session.

**How it works:**
It connects to your desktop runtime using either the indii Cloud Relay (via Firestore) or directly via the indiiREMOTE secure tunnel, depending on your connection. When you issue a voice command or tap an action on your phone, the heavy lifting actually executes on your desktop machine at home or in the studio.

**When to use it:**
- **On The Go:** When you're out of the studio but need to tell your desktop agents to start a long-running task (e.g., "Tell the Creative Director to start rendering my video").
- **Second Screen:** As a companion remote on your desk while you work in the main desktop app.

**Beta User Path:** **Use this last.** Once you have the Desktop App running and logged in at home, open the remote on your phone to pair them.

---

## Summary: The Recommended Beta Path

1. **Create Account:** Go to the **Web App** (`https://indii.music`) to sign up and configure your basic profile.
2. **Install Desktop:** Download and log into the **Electron Desktop App**. Treat this as your main headquarters.
3. **Pair Mobile:** Open the **Mobile Remote** on your phone to control your desktop agents from the couch.
