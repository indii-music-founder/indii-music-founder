import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import log from 'electron-log';
import { registerSystemHandlers } from './handlers/system';
// import { registerAuthHandlers, handleDeepLink } from './handlers/auth';
import { registerAudioHandlers } from './handlers/audio';
import { registerNetworkHandlers } from './handlers/network';
import { registerCredentialHandlers } from './handlers/credential';
import { registerSFTPHandlers } from './handlers/sftp';
import { setupDistributionHandlers as registerDistributionHandlers } from './handlers/distribution';
import { registerAgentHandlers } from './handlers/agent';
import { registerBrandHandlers } from './handlers/brand';
import { registerPublicistHandlers } from './handlers/publicist';
import { registerMarketingHandlers } from './handlers/marketing';
import { registerSecurityHandlers } from './handlers/security';
import { registerVideoHandlers } from './handlers/video';
import { registerSonicBridgeHandlers } from './handlers/sonic_bridge';
import { configureSecurity } from './security';
import { DockerService } from './services/DockerService';
import { setupAutoUpdater } from './updater';

// Configure logging
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');


log.info(`App Started. PID: ${process.pid}, Args: ${JSON.stringify(process.argv)}`);

/**
 * Window Management
 */
const createWindow = () => {
    const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:4242';

    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            devTools: !app.isPackaged,
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true, // Enabled for security
            safeDialogs: true,
            safeDialogsMessage: 'Stop seeing alerts from this page',
            webSecurity: !isDev,
            webviewTag: false,
        },
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        show: false,
    });

    // Configure Security for the session
    configureSecurity(mainWindow.webContents.session);

    // Content Protection (MacOS/Windows only)
    mainWindow.setContentProtection(true);

    // Console message logging from renderer
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const tag = levels[level] || 'INFO';
        log.info(`[Renderer][${tag}] ${message}`);
    });

    // Handle Window Open Requests
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://accounts.google.com')) return { action: 'allow' };
        if (url.startsWith('https://indiios-v-1-1.firebaseapp.com')) return { action: 'allow' };

        // Use logic similar to will-navigate for consistency
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // Security Gate for WebNavigation
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        const allowedOrigins = ['https://accounts.google.com', 'https://accounts.youtube.com', 'https://indiios-v-1-1.firebaseapp.com'];

        if (navigationUrl.startsWith(devServerUrl)) return;

        if (!allowedOrigins.some(origin => parsedUrl.origin === origin)) {
            event.preventDefault();
            log.info(`[Security] Blocked navigation to: ${navigationUrl}`);
            if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
                shell.openExternal(navigationUrl);
            }
        }
    });

    if (isDev) {
        log.info(`Attempting to load Dev Server URL: ${devServerUrl}`);
        mainWindow.loadURL(devServerUrl).catch(err => log.error(`Failed to load URL: ${err}`));
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        log.info(`Loading Production File: ${indexPath}`);
        mainWindow.loadFile(indexPath).catch(err => log.error(`Failed to load file: ${err}`));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        startHealthMonitoring(mainWindow);
    });
};

/**
 * Sidecar Health Monitor
 */
let healthCheckInterval: NodeJS.Timeout | null = null;

const checkSidecarHealth = async (window: BrowserWindow) => {
    try {
        // Fetch is available in Node.js 18+ (Project requires Node 22)
        const response = await fetch('http://localhost:50080/health');
        const status = response.ok ? 'online' : 'offline';
        window.webContents.send('sidecar:status-update', status);
    } catch (err) {
        // Only log error in debug, as 'offline' is an expected state
        log.debug('[Sidecar] Health check failed - sidecar is likely offline');
        window.webContents.send('sidecar:status-update', 'offline');
    }
};

const startHealthMonitoring = (window: BrowserWindow) => {
    if (healthCheckInterval) clearInterval(healthCheckInterval);

    // Initial check
    checkSidecarHealth(window);

    // 30s interval
    healthCheckInterval = setInterval(() => {
        checkSidecarHealth(window);
    }, 30000);
};


// Protocol Registration
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        const scriptPath = path.resolve(process.argv[1]);
        log.info(`Setting default protocol client in DEV mode. Script: ${scriptPath}`);
        app.setAsDefaultProtocolClient('indii-os', process.execPath, [scriptPath]);
    }
} else {
    // Production/Bundled
    app.setAsDefaultProtocolClient('indii-os');
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
log.info(`Acquired Lock: ${gotTheLock}`);

if (!gotTheLock) {
    log.info('Failed to acquire lock, quitting secondary instance...');
    app.quit();
} else {
    // Protocol handle for secondary instances (Windows/Linux)
    app.on('second-instance', (_event, commandLine) => {
        log.info(`second-instance event: ${JSON.stringify(commandLine)}`);
        if (BrowserWindow.getAllWindows().length > 0) {
            const win = BrowserWindow.getAllWindows()[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
        const url = commandLine.find(arg => arg.startsWith('indii-os://'));
        if (url) {
            log.info(`Handling deep link from second-instance: ${url}`);
            // handleDeepLink(url);
        }
    });

    // Deep Links (macOS) - Register early
    app.on('open-url', (event, url) => {
        event.preventDefault();
        log.info(`open-url event received: ${url}`);
        // handleDeepLink(url);
    });

    app.on('ready', () => {
        log.info('App Ready (Primary Instance)');
        registerSystemHandlers();
        // registerAuthHandlers(); // Removed
        registerAudioHandlers();
        registerNetworkHandlers();
        registerCredentialHandlers();
        registerSFTPHandlers();
        registerDistributionHandlers();
        registerAgentHandlers();
        registerBrandHandlers();
        registerPublicistHandlers();
        registerMarketingHandlers();
        registerSecurityHandlers();
        registerVideoHandlers();
        registerSonicBridgeHandlers();

        // Register Sidecar Handlers
        ipcMain.handle('sidecar:restart', async () => {
            log.info('[Main] Manual sidecar restart requested via IPC');
            const result = await DockerService.restartSystem();

            // Trigger immediate health check after restart if a window exists
            const windows = BrowserWindow.getAllWindows();
            if (windows.length > 0) {
                // Wait 5s for container to fully wrap up its internal init
                setTimeout(() => checkSidecarHealth(windows[0]), 5000);
            }

            return result;
        });


        // Ensure AI Services are running
        DockerService.ensureStarted().catch(err => {
            log.error(`[Main] Initial Docker startup failed: ${err.message}`);
        });

        createWindow();

        // Auto-updater (production only)
        if (app.isPackaged) {
            setupAutoUpdater();
        }
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;

app.on('will-quit', async () => {
    isQuitting = true;
    await DockerService.stopSystem();
});

// Crash Handling & Observability
app.on('render-process-gone', (_event, _webContents, details) => {
    if (isQuitting) return;
    log.warn(`[Main] Renderer process gone: ${details.reason} (${details.exitCode})`);
});

app.on('child-process-gone', (_event, details) => {
    if (isQuitting) return;
    log.warn(`[Main] Child process gone: ${details.type} - ${details.reason} (${details.exitCode})`);
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (app.isReady()) createWindow();
    }
});
