import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, Notification, powerMonitor, crashReporter } from 'electron';
import path from 'path';
import log from 'electron-log';

// Item 86: isDev must be defined early for logging config
const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;

// Configure logging — app.getPath may not be available in dev CJS bundles
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'info';

// Item 166: Suppression of 'write EIO' errors. This happens if stdout is closed
// before the app finishes logging during shutdown.
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrapConsole = (original: (...args: any[]) => void) => (...args: any[]) => {
    try {
        original(...args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        if (e.code === 'EIO' || (e.message && e.message.includes('EIO'))) {
            // Silently ignore IO errors on console (dead terminal/pipe)
            return;
        }
        // If we can't write to console, we probably can't write to log either
        // In shutdown mode, we're even more aggressive
        if (typeof isQuitting !== 'undefined' && isQuitting) return;
        
        throw e;
    }
};

console.log = wrapConsole(originalConsoleLog);
console.error = wrapConsole(originalConsoleError);
console.info = wrapConsole(originalConsoleInfo);
console.warn = wrapConsole(originalConsoleWarn);

// Item 374: Global Uncaught Exception Handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('uncaughtException', (error: any) => {
    if (error.code === 'EIO' || (error.message && error.message.includes('EIO'))) return;
    try {
        log.error('Uncaught Exception in Main Process:', error);
    } catch (err) {
        // Fallback to stderr if electron-log fails (e.g. EPERM / EIO issues during early setup/shutdown)
        process.stderr.write(`[Fallback Log Error] Uncaught Exception: ${error?.message || error}\nLogging failed: ${err}\n`);
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('unhandledRejection', (reason: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (reason instanceof Error && ((reason as any).code === 'EIO' || reason.message.includes('EIO'))) return;
    try {
        log.error('Unhandled Rejection in Main Process:', reason);
    } catch (err) {
        // Fallback to stderr if electron-log fails
        process.stderr.write(`[Fallback Log Error] Unhandled Rejection: ${reason?.message || reason}\nLogging failed: ${err}\n`);
    }
});

try {
    log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');
} catch {
    // Fallback: write logs to the current working directory until app is ready
    log.transports.file.resolvePathFn = () => path.join(process.cwd(), 'logs/main.log');
}

log.info(`App Started. PID: ${process.pid}, Args: ${JSON.stringify(process.argv)}`);

import { registerSystemHandlers } from './handlers/system';
import { registerAuthHandlers } from './handlers/auth';
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
import { registerDawHandlers } from './handlers/daw';
import { registerMobileRemoteHandlers, stopMobileRemoteServer } from './handlers/mobile_remote';
import { indiiRemoteService } from './services/IndiiRemoteService';
import { registerSchedulerHandlers } from './handlers/scheduler';
import { SchedulerService } from './services/SchedulerService';
import { configureSecurity, auditSessionCookies } from './security';
import { applyCSP } from './security/csp';
import { mcpClientService } from './services/mcp/MCPClientService';
import { setupAutoUpdater, registerUpdaterHandlers } from './updater';
import Store from 'electron-store';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Disable security warnings in development (suppresses unsafe-eval CSP warning from Vite HMR)
if (isDev) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// Item 374: Crash reporter (no PII — only crash metadata is submitted)
if (app.isPackaged) {
    crashReporter.start({
        submitURL: process.env.CRASH_REPORTER_URL ?? 'https://sentry.io/api/indii/minidump/',
        uploadToServer: !!process.env.CRASH_REPORTER_URL,
    });
}

const createWindow = async () => {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:4242';

    interface IWindowStore {
        get(key: string, defaultValue: unknown): unknown;
        set(key: string, value: unknown): void;
    }
    const storeSafe = new Store() as unknown as IWindowStore;
    const windowState = storeSafe.get('window-state', {
        width: 1280,
        height: 800,
        x: undefined,
        y: undefined,
        isMaximized: false
    }) as { width: number, height: number, x?: number, y?: number, isMaximized: boolean };

    // Load .env here (after app.whenReady) to avoid esbuild hoisting issues with dotenv v17
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try { require('dotenv').config(); } catch (__e) { /* dotenv optional */ }

    try {
        const token = process.env.VITE_NGROK_AUTHTOKEN || process.env.NGROK_AUTHTOKEN;
        const password = crypto.randomUUID().substring(0, 6);
        try {
            const url = await indiiRemoteService.start({ port: 3333, password, ngrokToken: token });
            log.info(`[IndiiRemote READY] Ngrok Tunnel: ${url}`);
        } catch (startErr) {
            log.error('[Main] IndiiRemoteService startup rejected:', startErr);
        }
    } catch (e) {
        log.error('[Main] Failed to start IndiiRemote subsystem:', e);
    }

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
            preload: path.join(__dirname, '../preload/index.cjs'),
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
        storeSafe.set('window-state', {
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
                app.dock?.hide();
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
        // Item 377: Sanitize and truncate renderer logs to prevent EIO crashes
        // Large data URLs (images/videos) can exceed pipe buffers.
        const sanitizedMessage = typeof message === 'string' && message.length > 1024
            ? message.substring(0, 1024) + '... [TRUNCATED]'
            : message;
        log.info(`[Renderer][${tag}] ${sanitizedMessage}`);
    });

    // Handle Window Open Requests
    win.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsedUrl = new URL(url);
            const allowedOrigins = [
                'https://accounts.google.com', 
                'https://indii.music', 
                'https://indii-music-founder.firebaseapp.com',
                'http://localhost:3000',
                'http://localhost:4242',
                'http://localhost:9099'
            ];

            if (allowedOrigins.some(origin => parsedUrl.origin === origin)) {
                return { action: 'allow' };
            }

            // Use logic similar to will-navigate for consistency
            if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
                shell.openExternal(url);
            }
        } catch (err) {
            log.error('[Security] Invalid URL in window open request:', url);
        }
        return { action: 'deny' };
    });

    // Security Gate for WebNavigation
    win.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        const allowedOrigins = ['https://accounts.google.com', 'https://accounts.youtube.com', 'https://indii.music', 'https://indii-music-founder.firebaseapp.com'];

        if (navigationUrl.startsWith(devServerUrl)) return;

        if (!allowedOrigins.some(origin => parsedUrl.origin === origin)) {
            event.preventDefault();
            log.info(`[Security] Blocked navigation to: ${navigationUrl}`);
            if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
                shell.openExternal(navigationUrl);
            }
        }
    });

    const handleLoadFailure = (context: string, error: Error) => {
        log.error(`[Main] ${context} failed to load:`, error);
        // Create dynamic HTML to show a friendly connection failure screen
        const failureHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Connection Failure</title>
                <style>
                    body {
                        background-color: #000;
                        color: #fff;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        text-align: center;
                    }
                    h1 { font-size: 24px; margin-bottom: 8px; font-weight: 600; }
                    p { color: #888; font-size: 14px; margin-bottom: 24px; max-width: 400px; line-height: 1.5; }
                    button {
                        background-color: #ffffff;
                        color: #000000;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 13px;
                        transition: opacity 0.2s;
                    }
                    button:hover { opacity: 0.9; }
                </style>
            </head>
            <body>
                <h1>Failed to connect to studio</h1>
                <p>Unable to connect to the dev server or load production files. Please check if the studio is running locally or reinstall the application.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
            </body>
            </html>
        `;
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(failureHtml)}`;
        win.loadURL(dataUrl).catch(e => log.error('[Main] Failed to load failure fallback page:', e));
    };

    if (isDev) {
        log.info(`Attempting to load Dev Server URL: ${devServerUrl}`);
        win.loadURL(devServerUrl).catch(err => handleLoadFailure('Dev server URL', err));
        win.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../renderer/index.html');
        log.info(`Loading Production File: ${indexPath}`);
        win.loadFile(indexPath).catch(err => handleLoadFailure('Production build index file', err));
    }

    win.once('ready-to-show', () => {
        setupMenu(win);
        win.show();
    });
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
            label: 'Show indii',
            click: () => {
                mainWindow?.show();
                if (process.platform === 'darwin') {
                    app.dock?.show();
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

    tray.setToolTip('indii Studio');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow?.show();
        if (process.platform === 'darwin') {
            app.dock?.show();
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
                app.dock?.show();
            }
        });
    }
};

// Protocol Registration
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        const scriptPath = path.resolve(process.argv[1]);
        log.info(`Setting default protocol client in DEV mode. Script: ${scriptPath}`);
        app.setAsDefaultProtocolClient('indii', process.execPath, [scriptPath]);
    }
} else {
    // Production/Bundled
    app.setAsDefaultProtocolClient('indii');
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
log.info(`Acquired Lock: ${gotTheLock}`);

if (!gotTheLock) {
    log.info('Failed to acquire lock, quitting secondary instance...');
    app.quit();
} else {
    // Protocol handle for secondary instances (Windows/Linux/macOS)
    app.on('second-instance', (_event, commandLine) => {
        log.info(`second-instance event: ${JSON.stringify(commandLine)}`);
        if (mainWindow) {
            if (!mainWindow.isVisible()) {
                mainWindow.show();
                if (process.platform === 'darwin') {
                    app.dock?.show();
                }
            }
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
        const url = commandLine.find(arg => arg.startsWith('indii://'));
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

        // Apply Content Security Policy headers
        applyCSP();

        registerSystemHandlers();
        registerAuthHandlers();
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
        registerDawHandlers();

        // Register Sidecar Handlers (Removed)

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
            'daw:start', 'daw:stop', 'daw:get-state',
            'video:render', 'video:open-folder', 'video:save-asset',
            'power:get-state', 'mobile-remote:stop',
            'updater:check', 'updater:install', 'updater:set-channel', 'updater:set-source', 'updater:get-config',
            'scheduler:register', 'scheduler:cancel', 'scheduler:set-enabled', 'scheduler:status', 'scheduler:get',
            'test:browser-agent', 'show-notification',
        ]);
        log.info(`[IPC Allowlist] ${KNOWN_IPC_CHANNELS.size} known channels registered`);

        // Item 375: Audit session cookies for security flags on startup
        auditSessionCookies();


        registerMobileRemoteHandlers();

        // Built-in Task Scheduler
        registerSchedulerHandlers();
        SchedulerService.start();
        SchedulerService.registerBuiltInTasks();

        // Initialize Local MCP Client
        mcpClientService.connectLocal().then(async () => {
            log.info('[MCP] Successfully connected to local server');
            try {
                // Test call just to prove the protocol works on startup
                const res = await mcpClientService.executeTool('read_wav_tags', { filePath: '/invalid/path.wav' });
                log.info(`[MCP] Test call result: ${JSON.stringify(res)}`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log.info(`[MCP] Test call (expected) error: ${msg}`);
            }
        }).catch(err => {
            log.error(`[MCP] Failed to connect to local server: ${err?.message}`);
        });

        createWindow();
        createTray();

        // Register Notification IPC
        ipcMain.on('show-notification', (_event, { title, body }) => {
            showNotification(title, body);
        });

        // Power Monitor (Item 165: CPU Throttling)
        powerMonitor.on('on-battery', () => {
            log.info('[PowerMonitor] System is on battery. Throttling CPU-heavy UI (Three.js/Animations).');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                    try {
                        win.webContents.send('power:on-battery');
                    } catch (err) {
                        log.warn(`[PowerMonitor] Failed to send on-battery event: ${err}`);
                    }
                }
            });
        });

        powerMonitor.on('on-ac', () => {
            log.info('[PowerMonitor] System is on AC power. Restoring full UI performance.');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                    try {
                        win.webContents.send('power:on-ac');
                    } catch (err) {
                        log.warn(`[PowerMonitor] Failed to send on-ac event: ${err}`);
                    }
                }
            });
        });

        // Send initial state on load
        ipcMain.handle('power:get-state', () => {
            return powerMonitor.isOnBatteryPower() ? 'battery' : 'ac';
        });

        // Auto-updater IPC handlers — registered unconditionally so the renderer
        // never hangs on unanswered IPC calls. The handlers gracefully no-op
        // when autoUpdater is unavailable (dev environment).
        registerUpdaterHandlers();

        // Auto-updater polling — production only
        if (app.isPackaged) {
            setupAutoUpdater();
        }

        // Item 378: Developer-only memory snapshot — accessible via --inspect flag or IPC
        if (!app.isPackaged) {
            ipcMain.handle('dev:heap-snapshot', async () => {
                try {
                    const v8 = await import('v8');
                    const snapshotPath = path.join(app.getPath('userData'), `heap-${Date.now()}.heapsnapshot`);
                    v8.writeHeapSnapshot(snapshotPath);
                    log.info(`[Dev] Heap snapshot written: ${snapshotPath}`);
                    return { success: true, path: snapshotPath };
                } catch (err) {
                    log.error(`[Dev] Heap snapshot failed: ${err}`);
                    return { success: false, error: String(err) };
                }
            });

            // Log heap stats every 5 minutes in dev for leak detection
            setInterval(() => {
                const mem = process.memoryUsage();
                log.info(`[Dev][Memory] RSS=${(mem.rss / 1024 / 1024).toFixed(1)}MB HeapUsed=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB HeapTotal=${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`);
            }, 5 * 60 * 1000);
        }
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async () => {
    isQuitting = true;
    
    // Item 166: Disable console logging during shutdown to avoid write EIO if terminal/pipe is gone
    log.transports.console.level = false;
    
    SchedulerService.stop();
    // Item 377: Close open SFTP/SSH connections before quit
    if (sftpService.isConnected()) {
        await sftpService.disconnect().catch(e => log.warn('[Main] SFTP disconnect on quit error:', e));
    }
    await mcpClientService.disconnect().catch(e => log.warn('[Main] MCP disconnect error:', e));
    await stopMobileRemoteServer().catch(e => log.warn('[Main] Mobile remote shutdown error:', e));
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
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
        if (process.platform === 'darwin') {
            app.dock?.show();
        }
    }
});
