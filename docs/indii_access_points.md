# indii Access Points: The 3 Doors to the Studio

indii is built on a hybrid architecture, meaning there are three distinct ways to access your creative tools. Depending on what you are trying to accomplish, you will want to choose the right access point.

---

## 1. The Desktop Studio (Primary Founder Runtime)
**Who it's for:** Core creative work, heavy rendering, audio mastering, local file management.
**How to access:** Download the `.dmg` (macOS) or `.exe` (Windows) from your Founder Dashboard.

The Desktop Studio is the canonical indii experience. Because it runs natively on your machine via Electron, it bypasses browser limitations. This allows the application to directly interface with your local filesystem, execute heavy Python/FFmpeg processes, and communicate securely over SSH/SFTP for distribution. **If you are mastering a track, rendering a video, or uploading to distributors, you MUST use the Desktop Studio.**

## 2. The Web App (Lightweight Access)
**Who it's for:** Checking stats, managing your subscription, chatting with the basic intelligence tier on the go, or configuring your account.
**How to access:** Navigate to `app.indii.music` (or your local web host).

The web app is a lightweight version of the studio. It provides a standard web-browser experience. However, because browsers run in a secure sandbox, the web app **cannot** access your local files directly, cannot render heavy videos natively, and cannot run the full suite of autonomous distribution tools. It is best used for administrative tasks and quick ideation.

## 3. indiiREMOTE (Companion Control Surface)
**Who it's for:** Controlling your Desktop Studio from your phone while recording in the vocal booth, tracking instruments, or stepping away from your desk.
**How to access:** Scan the QR code presented inside your Desktop Studio app using your smartphone.

indiiREMOTE turns your smartphone into a dedicated hardware controller for your Desktop Studio. It is **not** a standalone app; it only functions when connected to an active Desktop Studio session. Through indiiREMOTE, you can trigger recordings, control playback, and dictate commands via voice to your AI agents from across the room.

---

*For detailed technical information on how the remote architecture works, see [indiiREMOTE Architecture](./indiiREMOTE_ARCHITECTURE.md).*
