# Mega Stress Test Plan: Projects & Inbox System (50 Routines)

To ensure absolute resilience of the PROJECTS sidebar navigation and the Project Inbox system, we will execute a gauntlet of 50 distinct stress routines. These tests cover UI thrashing, bulk file ingestion, state corruption, and project isolation limits.

## Section 1: UI & Projects Navigation Core
1. **Projects Accordion Thrash:** Rapidly toggle the Projects accordion group 50 times in 10 seconds to test animation frame drops and React state lag.
2. **Inbox Double-Mount Sabotage:** The sidebar currently displays duplicate "Inbox" items. Rapidly click between them to test if it forces a double-mount or corrupts the active route state.
3. **Keyboard Focus Trap:** Tab through the entire Projects menu rapidly while transitioning between expanded/collapsed sidebar states.
4. **Active State Desync:** Use browser back/forward buttons repeatedly across different projects to verify the sidebar active highlight stays perfectly synced.
5. **Scroll & Click Sabotage:** Scroll the sidebar rapidly while clicking different projects to ensure scroll position isn't hijacking the click target.
6. **Network Throttling:** Switch network to "Slow 3G" and click into a heavy project folder to observe skeleton loaders and ensure no layout shifts occur.
7. **Offline Mode Transition:** Go offline mid-click and verify the app handles the failed chunk/data load gracefully without a white screen.
8. **Double-Click Sabotage:** Double-click and triple-click the Inbox and project items to ensure routing mechanisms don't stack history entries or crash the router.

## Section 2: Inbox & File Ingestion
9. **Bulk Ingestion Avalanche:** Drag and drop 500 files simultaneously into the Inbox dropzone to test the chunking and queueing mechanisms.
10. **Zero-Byte File Sabotage:** Upload multiple 0-byte or corrupted files into the Inbox to ensure error boundaries catch them without halting the ingestion queue.
11. **Deep Directory Structure Import:** Drop a nested folder structure (10 levels deep) into the Inbox to test recursive parsing limits.
12. **MIME Type Chaos:** Upload a mix of valid, invalid, and masquerading file types (e.g. an EXE renamed to .wav) to test strict MIME type validation.
13. **Simultaneous Processing:** Attempt to delete a file from the Inbox while it is still actively being parsed and analyzed by the background agent.
14. **Duplicate File Hash:** Upload the exact same 100MB file 5 times in a row to test deduplication and hash-checking logic.
15. **Storage Quota Boundary:** Fill the Inbox to 99.9% of the storage quota, then attempt to upload a file that exceeds the remaining space.

## Section 3: Project Organization & Structuring
16. **Rapid Folder Creation:** Create 50 nested project folders as fast as possible to test optimistic UI and state synchronization.
17. **Infinite Drag & Drop Loop:** Drag a project folder into itself, or into its own child, to test circular reference protection.
18. **Cross-Project File Transfer:** Drag 100 heavy assets from the Inbox directly into a specific Project folder simultaneously.
19. **Mass Rename Operations:** Rename 20 files simultaneously using a simulated bulk-rename action to check for database write locking.
20. **Metadata Overload:** Attach 10,000 characters of custom metadata tags to a single project file.
21. **Permissions Sabotage:** Attempt to open a project file that belongs to a different user or organization via direct URL parameter manipulation.
22. **Project Deletion Race Condition:** Delete a project folder while actively uploading a file into it.

## Section 4: Cross-Project Data Integrity
23. **Project Context Bleed:** Open Project A, then rapidly switch to Project B and ask the agent a question. Verify it does not reference Project A's files.
24. **Global Search Spam:** Mash the keyboard in the universal project search bar to test API debouncing and response race conditions.
25. **Simultaneous Project Loads:** Open 5 different projects in 5 separate browser tabs and attempt to move files between them.
26. **Archive/Restore Thrash:** Rapidly archive and restore a project 20 times in succession.
27. **Deleted Asset Recovery:** Restore a project from the trash while its contained assets are currently being purged by the cleanup cron job.
28. **Cross-Project References:** Create a symlink or reference from Project A to an asset in Project B, then delete Project B.
29. **Version History Overload:** Trigger 50 rapid auto-saves on a project file to test version history pagination and snapshot logic.

## Section 5: Media Streaming & Rendering in Inbox
30. **Concurrent Audio Streams:** Attempt to play 10 different audio files in the Inbox previewer simultaneously.
31. **Video Preview Scrubbing:** Rapidly scrub the timeline of a 4K video preview back and forth while it is still buffering.
32. **Image Render Limits:** Open a 100 Megapixel TIFF image in the Inbox previewer to test canvas/memory limits.
33. **PDF Zoom Sabotage:** Zoom a PDF document preview to 10,000% to check for integer overflows or rendering crashes.
34. **Audio Waveform Generation Race:** Rapidly click through 20 unanalyzed audio files to see if the waveform generator queue locks up.
35. **Broken Media Streams:** Disconnect the internet exactly as a video buffer request is sent, verifying the UI shows a graceful error instead of an infinite spinner.
36. **Metadata Extraction Thrash:** View the ID3/EXIF data for 50 files in rapid succession.

## Section 6: Multi-Agent Interaction in Projects
37. **Inbox Agent Overload:** Ask the default agent to summarize all 500 files in the Inbox at once.
38. **Project-Specific Knowledge Limit:** Ask a hyper-specific question about a 10,000-page document stored in a project to test RAG limits.
39. **Multi-Agent Collision:** Ask the Legal Agent to review a contract in Project A while the Creative Director is renaming the same file.
40. **Agent Identity Crisis:** In the Inbox, forcefully ask the agent to act as the Finance Manager to test strict prompt boundaries.
41. **State Hydration Failure:** Hard refresh the browser while the agent is actively writing a response about a project file.
42. **File Generation Loop:** Ask the agent to generate a text file based on an audio file, then immediately ask it to summarize the generated text file before it finishes saving.
43. **Websocket Disconnect Loop:** Throttle the network to drop the WebSocket connection every 2 seconds during an active agent chat in the Inbox.

## Section 7: The Chaos Routines
44. **Rapid Toggle Spam:** Click filters/sort dropdowns inside the Inbox 100 times in 5 seconds to test optimistic UI updates.
45. **Local Storage Nuke:** Manually clear `localStorage` via dev tools while inside a deep project folder, then try to navigate back to the Inbox.
46. **The Heavy Workload Bomb:** Start a 10GB file upload, trigger a RAG embedding process on a PDF, and ask the agent a complex query simultaneously.
47. **Form Validation Bypass:** Inspect element to remove `required` or `maxlength` attributes on the "New Project" modal, then submit.
48. **The Duplicate Inbox Thrash:** Given the UI bug showing two "Inbox" links, run an automated script that violently clicks between both of them every 50ms for 5 minutes straight.
49. **The Ultimate Routing Thrash:** Randomly click every single item in the PROJECTS menu, opening and closing folders, every 50ms for 5 minutes straight to ensure absolute memory and routing stability.
50. **Systemic Crash Recovery:** Force a React Error Boundary crash inside the Inbox previewer and verify that the sidebar navigation remains fully functional to allow the user to escape the broken view.
