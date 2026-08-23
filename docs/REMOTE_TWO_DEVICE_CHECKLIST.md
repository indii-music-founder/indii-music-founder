# Remote Control — Real Two-Device Validation Checklist

This is the only validation an agent cannot perform for you: a real iPhone (or
iPad) and the signed-in Mac running the installed indii Studio desktop app.
Run top to bottom; any failure is a real defect to report, not a config hint.

## Setup
1. Install the latest desktop build (`dist-electron/*.dmg`; first launch → right-click → Open).
2. Open indii Studio, sign in. Go to **Settings → Mobile Remote** and confirm
   **Cloud Relay Heartbeat** shows **Live** within ~10s. If it says **Failing**,
   read the error — that is the ground truth now.
3. On the phone, open `app.indii.music` → Mobile Remote, tap **Link**, scan the QR
   from the desktop. The phone header should flip to **Active** (green).

## Connection honesty
4. On the phone, put the desktop app **asleep to tray** (its Sleep setting). Header
   should show **Sleeping**, not Offline, and controls should still respond.
5. **Quit** the desktop app entirely (Cmd+Q). The phone should move to
   **Offline/Standby** — *not* linger as "Active" for minutes. (This is the flapping
   fix being verified.)
6. Reopen the desktop app. Phone should return to **Active** on its own within a
   heartbeat or two, no manual retry.

## Bottom-line capabilities (desktop execution model)
7. **Boardroom** — seat 2+ agents on the desktop. From the phone, send a message in
   Boardroom mode. Expect **one reply per seated agent**, each attributed and
   rateable — not just the last speaker.
8. **Notes** — phone: "save a note: <something>". Then ask "what are my notes?"
   Both should work; the note appears in the desktop Notes module too.
9. **Files** — approve a folder in desktop Settings → Mobile Remote → Desktop Asset
   Folders. Phone: "find <a file you know is in that folder>". The agent should
   search only approved folders and return the name/path, never contents.

## Wake & dispatch
10. With the desktop asleep, send a chat from the phone. The desktop should wake
    (window appears) and answer.
11. From the phone Quick Capture, save a photo/note while the desktop agent is
    **actively running another task**. Expect an honest "Queued" or failure —
    **never** a silent "Done." with nothing saved.

## Interruptions
12. Lock the phone for 30s, unlock. No false "disconnected" flash.
13. Airplane-mode the phone for ~2 min, then reconnect. The phone should recover
    without needing a re-pair.
14. Switch tabs/apps on the phone and return — pairing must hold.

## Capabilities card
15. Settings tab on the phone shows the **Studio capabilities** chips matching your
    Mac (Agents, Computer control, Local audio, DAW, Screen). Greyed-out = honest.

## Sign-off
- All green → the remote system is real-world confirmed.
- Any red → capture the desktop **Cloud Relay Heartbeat** text and the phone's
  header state, and report both.
