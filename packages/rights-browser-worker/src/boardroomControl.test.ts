import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BoardroomControl } from './boardroomControl.js';

const assignment = { requestId: 'mission', stepId: 'research', agentId: 'marketing' };

test('only the assigned mission step can act on the current page', () => {
  const control = new BoardroomControl();
  const artist = control.state;
  assert.equal(control.giveControl(assignment, artist), true);
  const firstPage = control.state;
  assert.equal(control.allowsSpecialist(assignment, firstPage), true);
  assert.equal(control.allowsSpecialist({ ...assignment, stepId: 'another-step' }, firstPage), false);
  assert.equal(control.allowsArtist(artist), false);

  control.didNavigate();
  assert.equal(control.allowsSpecialist(assignment, firstPage), false);
  assert.equal(control.allowsSpecialist(assignment, control.state), true);
});

test('takeover invalidates queued input even if the artist hands back to the same specialist', () => {
  const control = new BoardroomControl();
  control.giveControl(assignment, control.state);
  const delayed = control.state;
  control.takeOver();
  assert.equal(control.allowsSpecialist(assignment, delayed), false);
  assert.equal(control.allowsArtist(control.state), true);
  assert.equal(control.giveControl(assignment, delayed), false);
  assert.equal(control.giveControl(assignment, control.state), true);
  assert.equal(control.allowsSpecialist(assignment, delayed), false);
});

test('reconnect returns to artist control and stop is terminal', () => {
  const control = new BoardroomControl();
  control.giveControl(assignment, control.state);
  const delayed = control.state;
  control.disconnect();
  assert.equal(control.allowsArtist(control.state), false);
  assert.equal(control.allowsSpecialist(assignment, delayed), false);
  control.reconnect();
  assert.equal(control.allowsArtist(control.state), true);
  control.stop();
  control.disconnect();
  control.reconnect();
  control.takeOver();
  assert.equal(control.state.controller, 'stopped');
  assert.equal(control.giveControl(assignment, control.state), false);
});
