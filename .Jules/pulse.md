## 2024-05-24 - VideoWorkflow Loading State
**Learning:** The current tests for `VideoWorkflow` verify that `setJobStatus` is called, but they don't explicitly assert that the Loading UI (spinner, progress bar) is actually rendered in the DOM during the 'processing' state.
**Action:** Create a test that forces the component into the 'processing' state and asserts the presence of the specific loading indicators (spinner, text).
