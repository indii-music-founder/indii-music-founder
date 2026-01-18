## Lens's Journal

## 2024-05-22 - [Veo Flash to Pro Upgrade]
**Learning:** `waitForJob` resolves on the *first* completion event, making it unsuitable for "Flash then Pro" upgrade flows where the UI needs to display a preview immediately and then update to the final quality.
**Action:** Use `subscribeToJob` directly in components/tests when handling multi-stage generation results (Flash -> Pro).
