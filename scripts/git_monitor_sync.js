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
    let fetchSucceeded = true;
    try {
        logMessage('Fetching origin/main...');
        execSync('git fetch origin', { stdio: 'ignore' });
    } catch (e) {
        fetchSucceeded = false;
        logMessage('CRITICAL: Could not fetch origin/main. Mainline delivery is blocked.');
    }

    const statusOutput = runCommand('git status -sb');
    const hasLocalChanges = runCommand('git status --short').length > 0;
    const firstLine = statusOutput.split('\n')[0];
    const branchName = runCommand('git rev-parse --abbrev-ref HEAD');
    const divergence = runCommand('git rev-list --left-right --count origin/main...HEAD').split(/\s+/);
    const behindCount = parseInt(divergence[0], 10);
    const aheadCount = parseInt(divergence[1], 10);

    return {
        branchName,
        hasLocalChanges,
        aheadCount,
        behindCount,
        firstLine,
        fetchSucceeded
    };
}

function getCronExpression(minutes) {
    if (minutes === 5) return '*/5 * * * *';
    if (minutes === 10) return '*/10 * * * *';
    if (minutes === 15) return '*/15 * * * *';
    if (minutes === 30) return '*/30 * * * *';
    if (minutes === 60) return '0 * * * *';
    if (minutes === 120) return '0 */2 * * *';
    if (minutes === 240) return '0 */4 * * *';
    return '0 */8 * * *'; // 480 minutes (8 hours)
}

function getNextInterval(consecutiveNoChanges) {
    if (consecutiveNoChanges === 0) return 5;
    return 10;
}

async function executeSync() {
    logMessage('--- Starting Git Monitor Sync Cycle ---');
    
    let state = {
        currentIntervalMinutes: 5,
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

    let { branchName, hasLocalChanges, aheadCount, behindCount, firstLine, fetchSucceeded } = getGitState();
    logMessage(`Current Branch: ${branchName}`);
    logMessage(`Git status line: ${firstLine}`);
    logMessage(`Local uncommitted changes: ${hasLocalChanges ? 'YES' : 'NO'}`);
    logMessage(`Commits ahead: ${aheadCount}, Commits behind: ${behindCount}`);

    let syncPerformed = false;
    let syncError = null;

    try {
        if (!fetchSucceeded) {
            throw new Error('origin-main-fetch-failed');
        }
        if (branchName !== 'main') {
            throw new Error(`non-main-branch-blocked:${branchName}`);
        }
        if (behindCount > 0 && aheadCount > 0) {
            throw new Error(`main-diverged:behind-${behindCount}:ahead-${aheadCount}`);
        }
        if (behindCount > 0 && hasLocalChanges) {
            throw new Error(`main-behind-with-dirty-worktree:${behindCount}`);
        }
        if (behindCount > 0) {
            logMessage(`Fast-forwarding main by ${behindCount} commit(s)...`);
            runCommand('git merge --ff-only origin/main');
            behindCount = 0;
            syncPerformed = true;
        }
        if (aheadCount > 1) {
            throw new Error(`multiple-unpushed-commits-blocked:${aheadCount}`);
        }
        if (aheadCount === 1 && hasLocalChanges) {
            throw new Error('unpushed-commit-with-dirty-worktree');
        }

        // Validate and push exactly one coherent mainline commit.
        if (aheadCount === 1) {
            logMessage('Verifying the single mainline commit before pushing...');

            logMessage('Running typecheck validation...');
            runCommand('npm run typecheck');

            logMessage('Running tests validation...');
            runCommand('NODE_OPTIONS="--max-old-space-size=4096" npm test -- --run --pool=threads');
            
            logMessage('Validation successful. Pushing explicit HEAD:main refspec...');
            runCommand('git push origin HEAD:main');
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

    function checkGitHubActions() {
        const currentSha = runCommand('git rev-parse HEAD', true);
        logMessage(`Checking GitHub Actions for main SHA ${currentSha}...`);
        try {
            // Check authentication cleanly before proceeding
            let authSuccess = false;
            try {
                execSync('gh auth status', { stdio: 'ignore' });
                authSuccess = true;
            } catch (authError) {
                if (process.env.GITHUB_TOKEN) {
                    logMessage('gh auth status failed with GITHUB_TOKEN set. Retrying with cleared GITHUB_TOKEN...');
                    const originalToken = process.env.GITHUB_TOKEN;
                    delete process.env.GITHUB_TOKEN;
                    try {
                        execSync('gh auth status', { stdio: 'ignore' });
                        authSuccess = true;
                    } catch (retryError) {
                        process.env.GITHUB_TOKEN = originalToken; // restore if it still fails
                    }
                }
            }

            if (!authSuccess) {
                logMessage('Warning: GitHub CLI (gh) is not authenticated or not installed. Run `gh auth login` to enable CI pipeline monitoring. Skipping.');
                return;
            }

            const ghOutput = runCommand(`gh run list --branch main --commit ${currentSha} --limit 20 --json status,conclusion,name,url,createdAt,headBranch,headSha,databaseId`);
            const runs = JSON.parse(ghOutput);
            const matchingRuns = runs.filter(r => r.headBranch === 'main' && r.headSha === currentSha);
            const failedRuns = matchingRuns.filter(r => r.conclusion === 'failure');

            result.ci = matchingRuns.map(r => ({
                name: r.name,
                status: r.status,
                conclusion: r.conclusion,
                url: r.url,
                headSha: r.headSha
            }));

            if (failedRuns.length > 0) {
                for (const run of failedRuns) {
                    logMessage(`CI FAILED for current main SHA: ${run.name} (${run.url}). Inspect this run's logs before changing code.`);
                }
            } else if (matchingRuns.some(r => r.status !== 'completed')) {
                logMessage('CI is still in progress for the current main SHA. Do not push another commit yet.');
            } else if (matchingRuns.length > 0 && matchingRuns.every(r => r.conclusion === 'success')) {
                logMessage('CI is green for the current main SHA. Delivery cycle complete.');
            } else {
                logMessage('No CI run is visible yet for the current main SHA. Do not infer success.');
            }
        } catch (e) {
            logMessage(`Warning: Could not check GitHub Actions. Error: ${e.message}`);
        }
    }

    // Run the GitHub actions check
    checkGitHubActions();

    logMessage('--- Git Monitor Sync Cycle Complete ---');
    console.log(JSON.stringify(result, null, 2));
}

executeSync();
