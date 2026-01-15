## 2024-05-23 - Video Workflow Error Handling
**Learning:** VideoWorkflow uses 'failed' status to stop the spinner but doesn't have a specific 'error' view component. It falls back to 'Director's Chair' (empty state) or resets the active video if one existed. This is good for recovery but might be confusing if the toast is missed.
**Action:** Ensure toast duration is sufficient or consider adding an inline error message in the empty state for better persistence.
