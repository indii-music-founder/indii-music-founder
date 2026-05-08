# Mega Stress Test Plan: Manager's Office (50 Routines)

To ensure absolute resilience of the MANAGER'S OFFICE sidebar navigation and the individual manager modules, we will execute a gauntlet of 50 distinct stress routines. These tests cover UI thrashing, cross-manager context delegation, state corruption, and role-specific operational limits.

## Section 1: UI & Manager's Office Core
1. **Manager Accordion Thrash:** Rapidly toggle the Manager's Office accordion group 50 times in 10 seconds to test animation frame drops and React state lag.
2. **Keyboard Focus Trap:** Tab through the entire Manager's Office menu rapidly while transitioning between expanded/collapsed sidebar states.
3. **Hover State Persistence:** Hover over a manager item, then use keyboard navigation to jump to another section, ensuring the hover CSS clears properly.
4. **Active State Desync:** Use browser back/forward buttons repeatedly across different managers to verify the sidebar active highlight stays perfectly synced.
5. **Scroll & Click Sabotage:** Scroll the sidebar rapidly while clicking different managers to ensure scroll position isn't hijacking the click target.
6. **Network Throttling:** Switch network to "Slow 3G" and click each manager item to observe the skeleton loaders and ensure no layout shifts occur.
7. **Offline Mode Transition:** Go offline mid-click and verify the app handles the failed chunk/data load gracefully without a white screen.
8. **Double-Click Sabotage:** Double-click and triple-click every manager item to ensure routing mechanisms don't stack history entries or double-mount components.

## Section 2: Brand Manager & Road Manager
9. **Brand Kit Avalanche:** Upload 100 high-resolution brand assets (logos, fonts, palettes) simultaneously to the Brand Manager to test bulk processing.
10. **Color Palette Hex Sabotage:** Enter invalid hex codes, RGB strings, and malicious payload strings into the Brand Kit color inputs.
11. **Tour Routing Algorithm Overload:** Request the Road Manager to route a 500-city global tour to stress the mapping and distance calculation logic.
12. **Simultaneous Itinerary Edits:** Attempt to drag-and-drop tour dates in the Road Manager timeline while the agent is actively rescheduling them.
13. **Timezone Matrix Chaos:** Set 20 different tour stops in 20 different timezones, checking for off-by-one errors in flight/travel logistics.
14. **Cross-Manager Delegation:** Instruct the Brand Manager to delegate a brand deal to the Road Manager for the tour, then rapidly navigate between tabs.
15. **Mid-Generation Navigation:** Click away from the Brand Manager while it is actively generating a 50-page Brand Identity guideline document.

## Section 3: Campaign Manager & Booking Agent
16. **Campaign Flood:** Generate 50 simultaneous marketing campaigns in the Campaign Manager to check for pagination, context limit, or memory issues.
17. **Budget Allocation Sabotage:** Input negative numbers and extremely large integers ($1,000,000,000,000) into the Campaign Manager budget allocation tools.
18. **Venue Database Spam:** Search the Booking Agent venue database with 100 rapid, random keystrokes to test API debouncing and response race conditions.
19. **Concurrent Offer Generations:** Ask the Booking Agent to draft 20 performance offers at the exact same time.
20. **Offer Letter Markdown Injection:** Inject malformed markdown and HTML into the Booking Agent offer terms.
21. **Contract Negotiation Loop:** Rapidly accept, reject, and counter an offer 50 times to test state history.
22. **Cross-Manager Analytics:** Try to view the Campaign Manager ROI dashboard while the Booking Agent is updating the total tour revenue.

## Section 4: Publicist & Creative Director
23. **Press Release Token Bomb:** Feed a 100,000-word biography into the Publicist context window to test parsing and tokenizer limits.
24. **Media Contact Bulk Import:** Upload a CSV with 10,000 media contacts to the Publicist CRM to test parser chunking and UI unblocking.
25. **Concept Art Generation Spam:** Rapidly click "Generate Variant" 20 times in the Creative Director studio before the first image returns.
26. **Canvas Z-Index Limits:** Add 500 overlapping text and shape layers to the Creative Director canvas to test WebGL/FabricJS memory boundaries.
27. **Moodboard State Hydration:** Hard refresh the browser while the Creative Director moodboard is saving to Firebase.
28. **Pitch Angle Regeneration:** Force the Publicist to regenerate a PR pitch 50 times in a row, ensuring the context doesn't degrade into hallucinations.
29. **Asset Format Chaos:** Drop HEIC, WebP, SVG, and corrupted JPEGs into the Creative Director upload zone.
30. **Simultaneous PR Crises:** Simulate 10 concurrent PR crisis alerts to test the Publicist notification and queue system.

## Section 5: Video Producer & Maestro
31. **Video Timeline Scrubbing Thrash:** Rapidly scrub the Video Producer timeline back and forth while playing an active render.
32. **Render Queue Exhaustion:** Queue 100 video renders simultaneously to test the worker background queue stability.
33. **Audio-Reactive Sabotage:** Upload a silent, 0-byte audio file to the Video Producer's audio-reactive visualizer engine.
34. **Maestro Workflow Recursion:** Create an automated Maestro workflow that calls itself in an infinite loop, testing the circuit breaker.
35. **Maestro Multi-Agent Orchestration:** Trigger a Maestro macro that fires off requests to ALL 7 other managers simultaneously.
36. **Workflow Builder Node Spam:** Drag and drop 200 nodes onto the Maestro canvas to test React Flow rendering performance.
37. **Video Export Disconnect:** Disconnect the internet at 99% completion of a Video Producer render to test error recovery.

## Section 6: Cross-Manager & Context Memory
38. **Context Window Exhaustion:** Switch through every single manager in 10 seconds and verify that no agent inherits the wrong context.
39. **The Memory Leak Test:** Leave the Maestro dashboard open for 24 hours with active background polling, then measure heap usage.
40. **Agent Identity Crisis:** In the Publicist module, forcefully ask the agent to act as the Booking Agent to test strict prompt boundaries.
41. **Multi-Agent Collision:** Ask the Video Producer to fetch an asset at the exact same moment the Creative Director is deleting it.
42. **State Hydration Failure:** Hard refresh the browser while transitioning between the Campaign Manager and Publicist.
43. **Permissions Override:** Attempt to navigate to Maestro using a direct URL when the user's role does not have orchestration access.
44. **Websocket Disconnect Loop:** Throttle the network to drop the WebSocket connection every 2 seconds during a manager switch.

## Section 7: The Chaos Routines
45. **Rapid Toggle Spam:** Click settings/filters inside any manager module 100 times in 5 seconds to test optimistic UI updates.
46. **Local Storage Nuke:** Manually clear `localStorage` via dev tools while building a Maestro workflow, then try to save it.
47. **The Heavy Workload Bomb:** Start a PR pitch, a video render, and a tour routing calculation simultaneously across 3 background tabs.
48. **Form Validation Bypass:** Inspect element to remove `required` or `maxlength` attributes in the Brand Manager, then submit.
49. **The Ultimate Routing Thrash:** Run an automated script that randomly clicks every single item in the MANAGER'S OFFICE menu every 50ms for 5 minutes straight to ensure absolute memory, routing, and component unmount stability.
50. **Systemic Crash Recovery:** Force a React Error Boundary crash inside a manager module and verify that the sidebar navigation remains fully functional to allow the user to escape the broken view.
