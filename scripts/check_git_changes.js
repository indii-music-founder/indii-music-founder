import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const STATE_FILE_PATH = path.resolve('.agent/checkpoints/polling_state.json');

// Check git status
function getGitState() {
    try {
        // Fetch to update remote tracking branch status
        execSync('git fetch origin', { stdio: 'ignore' });
    } catch (e) {
        console.warn('Warning: Could not fetch from origin (offline or remote access blocked).');
    }

    try {
        const statusOutput = execSync('git status -sb', { encoding: 'utf-8' }).trim();
        const hasLocalChanges = execSync('git status --short', { encoding: 'utf-8' }).trim().length > 0;
        const isAhead = statusOutput.includes('[ahead ');
        
        return {
            hasChanges: hasLocalChanges || isAhead,
            statusSummary: statusOutput.split('\n')[0]
        };
    } catch (error) {
        console.error('Error checking git status:', error);
        return { hasChanges: false, statusSummary: 'unknown' };
    }
}

function getCronExpression(minutes) {
    if (minutes === 15) return '*/15 * * * *';
    if (minutes === 30) return '*/30 * * * *';
    if (minutes === 60) return '0 * * * *';
    if (minutes === 120) return '0 */2 * * *';
    if (minutes === 240) return '0 */4 * * *';
    return '0 */8 * * *'; // 480 minutes (8 hours)
}

function getNextInterval(consecutiveNoChanges) {
    if (consecutiveNoChanges === 0) return 15;
    if (consecutiveNoChanges === 1) return 30;
    if (consecutiveNoChanges === 2) return 60;
    if (consecutiveNoChanges === 3) return 120;
    if (consecutiveNoChanges === 4) return 240;
    return 480; // 8 hours maximum
}

function run() {
    let state = {
        currentIntervalMinutes: 15,
        currentTaskId: "",
        consecutiveNoChangesRuns: 0,
        lastCheckTime: new Date().toISOString()
    };

    if (fs.existsSync(STATE_FILE_PATH)) {
        try {
            state = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf-8'));
        } catch (e) {
            console.warn('Could not read existing state file, resetting state.');
        }
    }

    const { hasChanges, statusSummary } = getGitState();
    
    let nextInterval = state.currentIntervalMinutes;
    let consecutiveNoChanges = state.consecutiveNoChangesRuns;

    if (hasChanges) {
        // Reset to minimum interval immediately if we have changes
        nextInterval = 15;
        consecutiveNoChanges = 0;
    } else {
        // Increment consecutive run count and determine next backoff interval
        consecutiveNoChanges += 1;
        nextInterval = getNextInterval(consecutiveNoChanges);
    }

    const intervalChanged = nextInterval !== state.currentIntervalMinutes;
    const cronExpression = getCronExpression(nextInterval);

    const result = {
        hasChanges,
        statusSummary,
        currentIntervalMinutes: state.currentIntervalMinutes,
        nextIntervalMinutes: nextInterval,
        consecutiveNoChangesRuns: consecutiveNoChanges,
        intervalChanged,
        cronExpression,
        currentTaskId: state.currentTaskId
    };

    // Update state file (excluding Task ID which will be updated by the agent when it registers the new task)
    state.currentIntervalMinutes = nextInterval;
    state.consecutiveNoChangesRuns = consecutiveNoChanges;
    state.lastCheckTime = new Date().toISOString();
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));

    console.log(JSON.stringify(result, null, 2));
}

run();
