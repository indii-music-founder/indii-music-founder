import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, Notification, powerMonitor, crashReporter } from 'electron';
import path from 'path';
import log from 'electron-log';
import { registerSystemHandlers } from './handlers/system';
// import { registerAuthHandlers } from './handlers/auth';
import { handleDeepLink } from './handlers/deeplink';
import { setupMenu } from './menu';
import { registerAudioHandlers } from './handlers/audio';
import { registerNetworkHandlers } from './handlers/network';
import { registerCredentialHandlers } from './handlers/credential';
import { registerSFTPHandlers } from './handlers/sftp';
import { sftpService } from './services/SFTPService';
import { setupDistributionHandlers as registerDistributionHandlers } from './handlers/distribution';
import { registerAgentHandlers } from './handlers/agent';
import { registerBrandHandlers } from './handlers/brand';
import { registerPublicistHandlers } from './handlers/publicist';
import { registerMarketingHandlers } from './handlers/marketing';
import { registerSecurityHandlers } from './handlers/security';
import { registerVideoHandlers } from './handlers/video';
import { registerSonicBridgeHandlers } from './handlers/sonic_bridge';
import { registerMobileRemoteHandlers, stopMobileRemoteServer } from './handlers/mobile_remote';
import { configureSecurity, auditSessionCookies } from './security';
import { SidecarService } from './services/SidecarService';
import { setupAutoUpdater } from './updater';
import Store from 'electron-store';

const store = new Store();

// Configure logging
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');


log.info(`App Started. PID: ${process.pid}, Args: ${JSON.stringify(process.argv)}`);

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Item 374: Crash reporter (no PII — only crash metadata is submitted)
if (app.isPackaged) {
    crashReporter.start({
        submitURL: process.env.CRASH_REPORTER_URL ?? 'https://sentry.io/api/indiios/minidump/',
        uploadToServer: !!process.env.CRASH_REPORTER_URL,
    });
}

const createWindow = () => {
    const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:4242';

    const windowState = store.get('window-state', {
        width: 1280,
        height: 800,
        x: undefined,
        y: undefined,
        isMaximized: false
    }) as { width: number, height: number, x?: number, y?: number, isMaximized: boolean };

    // Item 325: Hard assertion — webSecurity must always be true in production
    if (app.isPackaged && isDev) {
        throw new Error('[Security] webSecurity must be enabled in production builds');
    }

    const win = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        webPreferences: {
            devTools: !app.isPackaged,
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            safeDialogs: true,
            safeDialogsMessage: 'Stop seeing alerts from this page',
            webSecurity: !isDev, // Intentionally disabled in dev only — needed for Vite CORS. Always true in production builds.
            webviewTag: false,
        },
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        show: false,
        icon: path.join(app.getAppPath(), 'public/icon-512.png'),
    });

    if (windowState.isMaximized) {
        win.maximize();
    }

    const saveWindowState = () => {
        const bounds = win.getBounds();
        store.set('window-state', {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: win.isMaximized()
        });
    };

    win.on('resize', saveWindowState);
    win.on('move', saveWindowState);
    win.on('maximize', saveWindowState);
    win.on('unmaximize', saveWindowState);

    mainWindow = win;

    // Handle close event to minimize to tray instead
    win.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            win.hide();
            if (process.platform === 'darwin') {
                app.dock.hide();
            }
            return false;
        }
    });

    // Configure Security for the session
    configureSecurity(win.webContents.session);

    // Content Protection (MacOS/Windows only)
    win.setContentProtection(true);

    // Console message logging from renderer
    win.webContents.on('console-message', (_event, level, message) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const tag = levels[level] || 'INFO';
        log.info(`[Renderer][${tag}] ${message}`);
    });

    // Handle Window Open Requests
    win.webContents.setWindowOpenHandler(({ url }) => {
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
    win.webContents.on('will-navigate', (event, navigationUrl) => {
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
        win.loadURL(devServerUrl).catch(err => log.error(`Failed to load URL: ${err}`));
        win.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        log.info(`Loading Production File: ${indexPath}`);
        win.loadFile(indexPath).catch(err => log.error(`Failed to load file: ${err}`));
    }

    win.once('ready-to-show', () => {
        setupMenu(win);
        win.show();
        startHealthMonitoring(win);
    });
};

/**
 * Sidecar Health Monitor
 */
let healthCheckInterval: NodeJS.Timeout | null = null;
let sidecarFailureCount = 0;
const MAX_SIDECAR_FAILURES = 3;
let autoRestartCount = 0;
const MAX_AUTO_RESTARTS = 3;

const checkSidecarHealth = async (window: BrowserWindow) => {
    try {
        // Fetch is available in Node.js 18+ (Project requires Node 22)
        const response = await fetch('http://localhost:50080/health');
        if (response.ok) {
            sidecarFailureCount = 0;
            autoRestartCount = 0; // Reset restart count on success
            window.webContents.send('sidecar:status-update', 'online');
        } else {
            throw new Error('Health check response not OK');
        }
    } catch (err) {
        sidecarFailureCount++;
        log.warn(`[Sidecar] Health check failed (${sidecarFailureCount}/${MAX_SIDECAR_FAILURES})`);
        window.webContents.send('sidecar:status-update', 'offline');

        if (sidecarFailureCount >= MAX_SIDECAR_FAILURES && autoRestartCount < MAX_AUTO_RESTARTS) {
            log.info('[Sidecar] Attempting automatic restart...');
            sidecarFailureCount = 0;
            autoRestartCount++;

            showNotification('System Service Issue', 'The Python back-end seems to have crashed. Attempting auto-restart...');

            SidecarService.restartSystem().catch(restartErr => {
                log.error(`[Sidecar] Auto-restart failed: ${restartErr}`);
            });
        }
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

/**
 * Tray Management
 */
const createTray = () => {
    const iconPath = path.join(app.getAppPath(), 'public/icon-192.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show IndiiOS',
            click: () => {
                mainWindow?.show();
                if (process.platform === 'darwin') {
                    app.dock.show();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('IndiiOS Studio');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow?.show();
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    });
};

/**
 * Desktop Notifications
 */
const showNotification = (title: string, body: string) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title,
            body,
            icon: path.join(app.getAppPath(), 'public/icon-192.png'),
            silent: false,
        });
        notification.show();

        notification.on('click', () => {
            mainWindow?.show();
            if (process.platform === 'darwin') {
                app.dock.show();
            }
        });
    }
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
            handleDeepLink(url, mainWindow);
        }
    });

    // Deep Links (macOS) - Register early
    app.on('open-url', (event, url) => {
        event.preventDefault();
        log.info(`open-url event received: ${url}`);
        handleDeepLink(url, mainWindow);
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
            const result = await SidecarService.restartSystem();

            // Trigger immediate health check after restart if a window exists
            const windows = BrowserWindow.getAllWindows();
            if (windows.length > 0) {
                // Wait 5s for container to fully wrap up its internal init
                setTimeout(() => checkSidecarHealth(windows[0]), 5000);
            }

            return result;
        });


        // Item 373: IPC channel allowlist audit — log any unregistered channels on startup
        const KNOWN_IPC_CHANNELS = new Set([
            'get-platform', 'get-app-version', 'privacy:toggle-protection',
            'system:select-file', 'system:select-directory', 'system:get-directory-contents', 'system:get-gpu-info', 'system:getMobileRemoteInfo',
            'auth:logout', 'credentials:save', 'credentials:get', 'credentials:delete',
            'audio:analyze', 'audio:lookup-metadata', 'audio:transcode', 'audio:master',
            'net:fetch-url',
            'sftp:connect', 'sftp:upload-directory', 'sftp:disconnect', 'sftp:is-connected',
            'distribution:validate-metadata', 'distribution:generate-isrc', 'distribution:generate-upc',
            'distribution:generate-ddex', 'distribution:stage-release', 'distribution:submit-release',
            'distribution:transmit', 'distribution:package-itmsp', 'distribution:package-spotify',
            'distribution:deliver-apple', 'distribution:validate-xsd', 'distribution:register-release',
            'distribution:generate-bwarm', 'distribution:check-merlin-status', 'distribution:run-forensics',
            'distribution:generate-content-id-csv', 'distribution:execute-waterfall',
            'distribution:calculate-tax', 'distribution:certify-tax',
            'agent:get-history', 'agent:save-history', 'agent:delete-history', 'agent:navigate-and-extract', 'agent:perform-action', 'agent:capture-state',
            'brand:analyze-consistency', 'marketing:analyze-trends', 'publicist:generate-pdf',
            'security:rotate-credentials', 'security:scan-vulnerabilities',
            'sonic-bridge:watch-folder', 'sonic-bridge:stop-watching',
            'video:render', 'video:open-folder', 'video:save-asset',
            'sidecar:restart', 'power:get-state', 'mobile-remote:stop',
            'updater:check', 'updater:install',
            'test:browser-agent', 'show-notification',
        ]);
        log.info(`[IPC Allowlist] ${KNOWN_IPC_CHANNELS.size} known channels registered`);

        // Item 375: Audit session cookies for security flags on startup
        auditSessionCookies();

        // Ensure AI Services are running
        SidecarService.ensureStarted().catch(err => {
            log.error(`[Main] Initial Docker startup failed: ${err.message}`);
        });
        registerMobileRemoteHandlers();

        createWindow();
        createTray();

        // Register Notification IPC
        ipcMain.on('show-notification', (_event, { title, body }) => {
            showNotification(title, body);
        });

        // Power Monitor (Item 165: CPU Throttling)
        powerMonitor.on('on-battery', () => {
            log.info('[PowerMonitor] System is on battery. Throttling CPU-heavy UI (Three.js/Animations).');
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('power:on-battery'));
        });

        powerMonitor.on('on-ac', () => {
            log.info('[PowerMonitor] System is on AC power. Restoring full UI performance.');
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('power:on-ac'));
        });

        // Send initial state on load
        ipcMain.handle('power:get-state', () => {
            return powerMonitor.isOnBatteryPower() ? 'battery' : 'ac';
        });

        // Auto-updater (production only)
        if (app.isPackaged) {
            setupAutoUpdater();
        }
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async () => {
    isQuitting = true;
    // Item 377: Close open SFTP/SSH connections before quit
    if (sftpService.isConnected()) {
        await sftpService.disconnect().catch(e => log.warn('[Main] SFTP disconnect on quit error:', e));
    }
    await SidecarService.stopSystem();
    stopMobileRemoteServer();
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
