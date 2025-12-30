import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import log from 'electron-log';
import { registerSystemHandlers } from './handlers/system';
// import { registerAuthHandlers, handleDeepLink } from './handlers/auth';
import { registerAudioHandlers } from './handlers/audio';
import { registerNetworkHandlers } from './handlers/network';
import { registerCredentialHandlers } from './handlers/credential';
import { registerSFTPHandlers } from './handlers/sftp';
import { configureSecurity } from './security';

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
        ipcMain.handle('test:browser-agent', async (_event: any, query?: string) => {
            const { browserAgentService } = await import('./services/BrowserAgentService');
            try {
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
    }

    ipcMain.handle('agent:navigate-and-extract', async (_event: any, url: string) => {
        const { browserAgentService } = await import('./services/BrowserAgentService');
        try {
            await browserAgentService.startSession();
            await browserAgentService.navigateTo(url);
            const snapshot = await browserAgentService.captureSnapshot();
            await browserAgentService.closeSession();
            return { success: true, ...snapshot };
        } catch (error) {
            console.error('Agent Navigate Failed:', error);
            await browserAgentService.closeSession();
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:perform-action', async (_event: any, action: string, selector: string, text?: string) => {
        const { browserAgentService } = await import('./services/BrowserAgentService');
        return await browserAgentService.performAction(action, selector, text);
    });

    ipcMain.handle('agent:capture-state', async () => {
        const { browserAgentService } = await import('./services/BrowserAgentService');
        try {
            const snapshot = await browserAgentService.captureSnapshot();
            return { success: true, ...snapshot };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
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
            sandbox: false, // Disabled to ensure preload script loads correctly in production
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
        shell.openExternal(url);
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


        setupIpcHandlers();
        createWindow();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Crash Handling & Observability
app.on('render-process-gone', (_event, _webContents, details) => {
    log.warn(`[Main] Renderer process gone: ${details.reason} (${details.exitCode})`);
});

app.on('child-process-gone', (_event, details) => {
    log.warn(`[Main] Child process gone: ${details.type} - ${details.reason} (${details.exitCode})`);
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (app.isReady()) createWindow();
    }
});
