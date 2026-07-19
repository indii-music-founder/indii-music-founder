# TikTok App Review — Demo Video Shot List (indii.music)

One continuous screen recording, mp4 or mov, under 50MB, no audio needed.
Record against the **Sandbox** (Developer Portal → indii.music app → Sandbox tab →
create sandbox, add the target TikTok test account under Sandbox settings).
TikTok requires sandbox for first-time approval — do NOT record against production.

**Products/scopes that MUST be visibly demonstrated:** Login Kit (`user.info.basic`),
Content Posting API (`video.upload` draft + `video.publish` direct post).
Everything selected in the app must appear in the video or review is delayed.

## Pre-flight
- Dev build of indii.music wired to the sandbox client key/secret
- Web build served at a URL whose domain matches the registered site (app.indii.music
  or clearly the same product; TikTok checks the domain in the video vs the URL on file)
- Sandbox TikTok account logged out (so the login flow is captured from zero)
- A short test video file ready in the app's media library

## Shots, in order
1. **Open the app cold** — show the browser navigating to app.indii.music (or the
   desktop app launching, starting from the app icon/opening window).
2. **Show the indii.music UI** clearly (dashboard) so reviewers see where the
   integration lives.
3. **Initiate TikTok connect** — click the "Connect TikTok" control in the marketing
   module. Show the redirect to TikTok's authorization page.
4. **Login Kit flow** — log in with the sandbox account, show the consent screen
   listing the scopes, click Authorize, show the redirect back into indii.music with
   the account now connected (display name/avatar visible = user.info.basic in use).
5. **Create a post** — pick the test video, add a caption, show the settings the
   artist controls (privacy level, etc.).
6. **Direct Post (`video.publish`)** — click Post, show the confirmation step
   (user-initiated posting), then the success state in the app.
7. **Verify on TikTok** — open the sandbox account's profile and show the posted
   video present.
8. **Draft upload (`video.upload`)** — repeat 5 once with "Save as draft" and show
   the draft appearing in the TikTok inbox/drafts of the sandbox account.

## Rules of thumb
- Keep the cursor visible and move deliberately; reviewers must follow every click.
- No cuts between step 3 and step 7 if possible — continuity sells authenticity.
- Under ~3 minutes total.
- If the recording is over 50MB: 1080p → 720p or trim dead time; don't drop steps.
