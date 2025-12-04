# Video Studio Advanced Features Test Plan

## 1. Audio Visualization

- [ ] **Add Audio Clip**: Drag an audio asset to the timeline.
- [ ] **Verify Waveform**: Check that the waveform visualization appears on the clip.

## 2. Keyframe Animation

- [ ] **Select Clip**: Click on a video or image clip.
- [ ] **Open Properties**: Ensure the Properties Panel is open.
- [ ] **Add Keyframe (Scale)**:
  - [ ] Move playhead to start.
  - [ ] Click the keyframe button for "Scale".
  - [ ] Set Scale to 1.0.
- [ ] **Add Second Keyframe**:
  - [ ] Move playhead to 2 seconds (60 frames).
  - [ ] Click keyframe button for "Scale".
  - [ ] Set Scale to 1.5.
- [ ] **Verify Animation**: Scrub through the timeline and observe the clip scaling up.

## 3. Duration Limits

- [ ] **Check Default**: Verify project duration is 8 minutes (default).
- [ ] **Attempt Override**: Try to set duration > 8 minutes.
- [ ] **Verify Cap**: Confirm duration snaps back to 8 minutes.
