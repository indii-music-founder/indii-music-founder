# Remote contact capture repair

## Reproduced failure

On 22 October 2026, the normal `https://app.indii.music/mobile-remote` Contact → Manual form failed twice after Save Contact with: “This encounter has no completed contact analysis to review.” Both attempts used a clearly labeled internal QA entry with no telephone number, email address or external outreach. The form retained the entered name and note. Evidence: `outputs/remote-manual-contact-save-failure.png` in the task workspace, outside Git.

This was the existing genuinely signed-in indii.music Chrome account. Account creation was not observed; actual subscription plan unknown. No injected authentication, seeded state or fabricated service response was used.

The form created a pending AI encounter and immediately called a review API that requires completed analysis. The full manual fields were not included in that encounter's analysis context, so eventual AI processing could not recover the supplied fields either.

## Resulting behavior

- Manual entry writes a confirmed manual contact and completed encounter in one account-owned Firestore batch. It preserves the entered fields and refuses overlong input instead of silently truncating it. The existing server trigger skips completed encounters, so this path does not request AI extraction.
- Duplicate manual submissions are blocked while saving, and fields remain in place after failure. Mode changes are disabled during saving.
- Optional photos and generated avatars are actually uploaded to the storage object named in their asset descriptor. The voice path previously invented a generated-avatar object path that the extraction pipeline could not read.
- Preview URL changes no longer run contact-media cleanup. Cleanup follows closing/unmounting; recording sessions reject late permission/data callbacks, stop the microphone when switching to manual entry, and reject empty recordings. Changing or removing a photo invalidates older avatar results.
- Avatar generation uses the selected portrait's bytes. Missing or empty media now fails before generation instead of substituting the previous one-pixel placeholder. The selected file remains available when its preview URL is created.

## Acceptance remaining after deployment

1. Save a name-only manual contact. Close/reopen the remote and inspect the same record on the computer.
2. Save all manual fields, including multiline notes, then verify exact values on both devices. Confirm no pending extraction replaces them.
3. Attach a real photo, save, reload and open the stored image. Repeat with an explicitly requested generated avatar and voice intake, confirming actual analysis completion and required review.
4. Record audio, stop and replay it. Confirm the captured blob and image preview remain until save or explicit cancellation. Cancel while microphone permission is pending, switch to manual while recording, and ensure no late recording or avatar repopulates a closed/new form.
5. Exercise genuine save failure and account change. Keep entered data and show an actionable error; never report a cloud save before acknowledgment.

Pure field-contract tests and existing mock-backed UI/review tests are structural regression checks, not live proof of this repair. The old UI save test required the broken create-then-review calls and fabricated their success; it now checks retention of entered fields across mode changes without pretending to persist a contact. Remaining legacy auth/image-generation doubles are explicitly classified as structural only. The reproduced baseline failure is confirmed; repaired manual, camera, microphone and avatar paths remain unverified until the deployed walkthrough.
