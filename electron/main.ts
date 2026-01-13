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
import { configureSecurity } from './security';
import { AgentActionSchema, AgentNavigateSchema } from './utils/validation';
import { validateSender } from './utils/ipc-security';
import { z } from 'zod';

// Configure logging
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');


log.info(`App Started. PID: ${process.pid}, Args: ${JSON.stringify(process.argv)}`);

/**
 * IPC Handler Registration
 */
function setupIpcHandlers() {
    // Test Browser Agent (Development ONLY)
    if (!app.isPackaged) {
        ipcMain.handle('test:browser-agent', async (event: any, query?: string) => {
            const { browserAgentService } = await import('./services/BrowserAgentService');
            try {
                validateSender(event);
                // Input validation (query is optional but if present should be safe)
                if (query && typeof query !== 'string') {
                    throw new Error('Invalid query format');
                }

                await browserAgentService.startSession();
                if (query) {
                    await browserAgentService.navigateTo('https://www.google.com');
                    await browserAgentService.typeInto('[name="q"]', query);
                    await browserAgentService.pressKey('Enter');
                    await browserAgentService.waitForSelector('#search');
                } else {
                    await browserAgentService.navigateTo('https://www.google.com');
                }
                const snapshot = await browserAgentService.captureSnapshot();
                await browserAgentService.closeSession();
                return { success: true, ...snapshot };
            } catch (error) {
                console.error('Agent Test Failed:', error);
                return { success: false, error: String(error) };
            }
        });

        // Secure Agent IPC - Development Only
        ipcMain.handle('agent:navigate-and-extract', async (event: any, url: string) => {
            try {
                validateSender(event);
                const validated = AgentNavigateSchema.parse({ url });
                const { browserAgentService } = await import('./services/BrowserAgentService');

                await browserAgentService.startSession();
                await browserAgentService.navigateTo(validated.url);
                const snapshot = await browserAgentService.captureSnapshot();
                await browserAgentService.closeSession();
                return { success: true, ...snapshot };
            } catch (error) {
                console.error('Agent Navigate Failed:', error);
                const { browserAgentService } = await import('./services/BrowserAgentService');
                await browserAgentService.closeSession();

                if (error instanceof z.ZodError) {
                    return { success: false, error: `Validation Error: ${error.errors[0].message}` };
                }
                return { success: false, error: String(error) };
            }
        });

        ipcMain.handle('agent:perform-action', async (event: any, action: string, selector: string, text?: string) => {
            try {
                validateSender(event);
                // Validate inputs against schema (allows text to be optional)
                const validated = AgentActionSchema.parse({ action, selector, text });

                const { browserAgentService } = await import('./services/BrowserAgentService');
                return await browserAgentService.performAction(validated.action as any, validated.selector, validated.text);
            } catch (error) {
                console.error('Agent Action Failed:', error);
                if (error instanceof z.ZodError) {
                    return { success: false, error: `Validation Error: ${error.errors[0].message}` };
                }
                return { success: false, error: String(error) };
            }
        });

        ipcMain.handle('agent:capture-state', async (event: any) => {
            const { browserAgentService } = await import('./services/BrowserAgentService');
            try {
                validateSender(event);
                const snapshot = await browserAgentService.captureSnapshot();
                return { success: true, ...snapshot };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        });
    }
}

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
        console.log(`[Renderer][${levels[level] || 'INFO'}] ${message}`);
    });

    // Handle Window Open Requests
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://accounts.google.com')) return { action: 'allow' };

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
        const allowedOrigins = ['https://accounts.google.com', 'https://accounts.youtube.com'];

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
    });
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


        setupIpcHandlers();
        createWindow();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;

app.on('will-quit', () => {
    isQuitting = true;
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
