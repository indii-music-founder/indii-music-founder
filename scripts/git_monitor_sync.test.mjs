import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCronExpression, getNextInterval } from './git_monitor_sync.js';
import {
    getCronExpression as pollerCron,
    getNextInterval as pollerInterval,
} from './check_git_changes.js';

test('getCronExpression maps supported intervals to cron expressions', () => {
    assert.equal(getCronExpression(5), '*/5 * * * *');
    assert.equal(getCronExpression(10), '*/10 * * * *');
    assert.equal(getCronExpression(15), '*/15 * * * *');
    assert.equal(getCronExpression(30), '*/30 * * * *');
    assert.equal(getCronExpression(60), '0 * * * *');
    assert.equal(getCronExpression(120), '0 */2 * * *');
    assert.equal(getCronExpression(240), '0 */4 * * *');
});

test('getCronExpression falls back to the 8-hour interval for unknown values', () => {
    assert.equal(getCronExpression(7), '0 */8 * * *');
    assert.equal(getCronExpression(999), '0 */8 * * *');
});

test('getNextInterval polls every 5 minutes on the first idle run, then backs off to 10', () => {
    assert.equal(getNextInterval(0), 5);
    assert.equal(getNextInterval(1), 10);
    assert.equal(getNextInterval(5), 10);
});

test('check_git_changes poller backs off 15 -> 30 -> 60 -> 120 -> 240 -> 480 minutes', () => {
    assert.equal(pollerInterval(0), 15);
    assert.equal(pollerInterval(1), 30);
    assert.equal(pollerInterval(2), 60);
    assert.equal(pollerInterval(3), 120);
    assert.equal(pollerInterval(4), 240);
    assert.equal(pollerInterval(9), 480);
});

test('check_git_changes poller maps intervals to cron expressions', () => {
    assert.equal(pollerCron(15), '*/15 * * * *');
    assert.equal(pollerCron(30), '*/30 * * * *');
    assert.equal(pollerCron(60), '0 * * * *');
    assert.equal(pollerCron(120), '0 */2 * * *');
    assert.equal(pollerCron(240), '0 */4 * * *');
    assert.equal(pollerCron(999), '0 */8 * * *');
});
