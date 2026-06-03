import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const STATE_FILE_PATH = path.resolve('.agent/checkpoints/polling_state.json');
const LOG_FILE_PATH = path.resolve('.agent/logs/git_monitor.log');

// Ensure directories exist
const checkpointsDir = path.dirname(STATE_FILE_PATH);
if (!fs.existsSync(checkpointsDir)) {
    fs.mkdirSync(checkpointsDir, { recursive: true });
}
const logsDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(LOG_FILE_PATH, logLine);
}

function runCommand(cmd, ignoreError = false) {
    try {
        return execSync(cmd, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }).trim();
    } catch (error) {
        if (ignoreError) {
            return '';
        }
        throw new Error(`Command failed: ${cmd}\nError: ${error.message}`);
    }
}

function getGitState() {
    try {
        logMessage('Fetching remote tracking branch status...');
        execSync('git fetch origin', { stdio: 'ignore' });
    } catch (e) {
        logMessage('Warning: Could not fetch from origin (offline or remote access blocked).');
    }

    const statusOutput = runCommand('git status -sb');
    const hasLocalChanges = runCommand('git status --short').length > 0;
    
    // Parse branch status line, e.g. "## main...origin/main [ahead 1, behind 2]"
    const firstLine = statusOutput.split('\n')[0];
    const branchName = runCommand('git rev-parse --abbrev-ref HEAD');

    let aheadCount = 0;
    let behindCount = 0;

    const aheadMatch = firstLine.match(/\[ahead (\d+)/);
    const behindMatch = firstLine.match(/behind (\d+)/);

    if (aheadMatch) aheadCount = parseInt(aheadMatch[1], 10);
    if (behindMatch) behindCount = parseInt(behindMatch[1], 10);

    return {
        branchName,
        hasLocalChanges,
        aheadCount,
        behindCount,
        firstLine
    };
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

async function executeSync() {
    logMessage('--- Starting Git Monitor Sync Cycle ---');
    
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
            logMessage('Could not read existing state file, resetting state.');
        }
    }

    const { branchName, hasLocalChanges, aheadCount, behindCount, firstLine } = getGitState();
    logMessage(`Current Branch: ${branchName}`);
    logMessage(`Git status line: ${firstLine}`);
    logMessage(`Local uncommitted changes: ${hasLocalChanges ? 'YES' : 'NO'}`);
    logMessage(`Commits ahead: ${aheadCount}, Commits behind: ${behindCount}`);

    let syncPerformed = false;
    let syncError = null;

    try {
        // 1. Check for behind status -> Pull and rebase
        if (behindCount > 0) {
            logMessage(`Pulling and rebasing from origin/${branchName}...`);
            let stashed = false;
            if (hasLocalChanges) {
                logMessage('Stashing local uncommitted changes before rebase...');
                runCommand('git stash');
                stashed = true;
            }

            try {
                runCommand(`git pull --rebase origin ${branchName}`);
                logMessage('Pull and rebase completed successfully.');
                syncPerformed = true;
            } catch (err) {
                logMessage(`CRITICAL: Rebase failed! Error: ${err.message}`);
                throw err;
            } finally {
                if (stashed) {
                    logMessage('Restoring stashed local changes...');
                    try {
                        runCommand('git stash pop');
                        logMessage('Stashed changes restored successfully.');
                    } catch (popErr) {
                        logMessage('WARNING: Stash pop failed due to conflicts. Manual resolution required.');
                        syncError = 'stash-pop-conflict';
                    }
                }
            }
        }

        // 2. Check for ahead status -> Run validation and push
        if (aheadCount > 0 && !syncError) {
            logMessage(`Verifying local commits (${aheadCount} ahead) before pushing...`);
            
            if (aheadCount > 10) {
                logMessage(`WARNING: Commit count (${aheadCount}) is greater than 10. Recommend consolidation/squashing to prevent bloat.`);
            }

            logMessage('Running typecheck validation...');
            runCommand('npm run typecheck');

            logMessage('Running tests validation...');
            // Running specific workspace or fast sharded validation to prevent long-running timeouts
            runCommand('npm test -- --run');
            
            logMessage('Validation successful. Pushing local commits to origin...');
            runCommand(`git push origin ${branchName}`);
            logMessage('Push completed successfully.');
            syncPerformed = true;
        }
    } catch (err) {
        logMessage(`Sync failed: ${err.message}`);
        syncError = err.message;
    }

    // 3. Dynamic backoff interval calculations
    let nextInterval = state.currentIntervalMinutes;
    let consecutiveNoChanges = state.consecutiveNoChangesRuns;

    if (syncPerformed && !syncError) {
        logMessage('Sync activity detected, resetting poll interval to 15 minutes.');
        nextInterval = 15;
        consecutiveNoChanges = 0;
    } else {
        consecutiveNoChanges += 1;
        nextInterval = getNextInterval(consecutiveNoChanges);
        logMessage(`No sync activity. Idle run count: ${consecutiveNoChanges}. Next poll interval: ${nextInterval} minutes.`);
    }

    const intervalChanged = nextInterval !== state.currentIntervalMinutes;
    const cronExpression = getCronExpression(nextInterval);

    const result = {
        syncPerformed,
        syncError,
        branchName,
        aheadCount,
        behindCount,
        hasLocalChanges,
        currentIntervalMinutes: state.currentIntervalMinutes,
        nextIntervalMinutes: nextInterval,
        consecutiveNoChangesRuns: consecutiveNoChanges,
        intervalChanged,
        cronExpression,
        currentTaskId: state.currentTaskId
    };

    // Update state file (retaining Task ID)
    state.currentIntervalMinutes = nextInterval;
    state.consecutiveNoChangesRuns = consecutiveNoChanges;
    state.lastCheckTime = new Date().toISOString();
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));

    logMessage('--- Git Monitor Sync Cycle Complete ---');
    console.log(JSON.stringify(result, null, 2));
}

executeSync();
