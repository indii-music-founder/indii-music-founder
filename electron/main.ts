import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerSystemHandlers } from './handlers/system';
import { registerAuthHandlers, handleDeepLink } from './handlers/auth';
import { registerAudioHandlers } from './handlers/audio';
import { registerNetworkHandlers } from './handlers/network';
import { registerCredentialHandlers } from './handlers/credential';
import { configureSecurity } from './security';

const LOG_FILE = path.join(app.getPath('desktop'), 'indii-os-debug.log');

function logToFile(msg: string) {
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {
        console.error('Failed to write to log file', e);
    }
}

logToFile(`App Started. PID: ${process.pid}, Args: ${JSON.stringify(process.argv)}`);


// Protocol Registration
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        const scriptPath = path.resolve(process.argv[1]);
        logToFile(`Setting default protocol client in DEV mode. Script: ${scriptPath}`);
        app.setAsDefaultProtocolClient('indii-os', process.execPath, [scriptPath]);
    }
} else {
    // Production/Bundled
    app.setAsDefaultProtocolClient('indii-os');
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
logToFile(`Acquired Lock: ${gotTheLock}`);

if (!gotTheLock) {
    logToFile('Failed to acquire lock, quitting secondary instance...');
    app.quit();
} else {
    // Protocol handle for secondary instances (Windows/Linux)
    app.on('second-instance', (_event, commandLine) => {
        logToFile(`second-instance event: ${JSON.stringify(commandLine)}`);
        if (BrowserWindow.getAllWindows().length > 0) {
            const win = BrowserWindow.getAllWindows()[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
        const url = commandLine.find(arg => arg.startsWith('indii-os://'));
        if (url) {
            logToFile(`Handling deep link from second-instance: ${url}`);
            handleDeepLink(url);
        }
    });

    // Deep Links (macOS) - Register early
    app.on('open-url', (event, url) => {
        event.preventDefault();
        logToFile(`open-url event received: ${url}`);
        handleDeepLink(url);
    });

    app.on('ready', () => {
        logToFile('App Ready (Primary Instance)');
        registerSystemHandlers();
        registerAuthHandlers();
        registerAudioHandlers();
        registerNetworkHandlers();
        registerCredentialHandlers();

        setupIpcHandlers();

        createWindow();
    });
}

function setupIpcHandlers() {
    // Test Browser Agent (Remove in prod)
    const { ipcMain } = require('electron');
    ipcMain.handle('test:browser-agent', async (_event: any, query?: string) => {
        const { browserAgentService } = require('./services/BrowserAgentService');
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

    ipcMain.handle('agent:navigate-and-extract', async (_event: any, url: string) => {
        const { browserAgentService } = require('./services/BrowserAgentService');
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

    ipcMain.handle('agent:perform-action', async (_event: any, action: 'click' | 'type', selector: string, text?: string) => {
        const { browserAgentService } = require('./services/BrowserAgentService');
        return await browserAgentService.performAction(action, selector, text);
    });

    ipcMain.handle('agent:capture-state', async () => {
        const { browserAgentService } = require('./services/BrowserAgentService');
        try {
            const snapshot = await browserAgentService.captureSnapshot();
            return { success: true, ...snapshot };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
}

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
            sandbox: true,
            safeDialogs: true,
            safeDialogsMessage: 'Stop seeing alerts from this page',
            webSecurity: !isDev,
            webviewTag: false,
        },
    });

    mainWindow.setContentProtection(true);
    configureSecurity(mainWindow.webContents.session);

    mainWindow.webContents.on('console-message', (_event, level, message) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        console.log(`[Renderer][${levels[level] || 'INFO'}] ${message}`);
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://accounts.google.com')) return { action: 'allow' };
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        const allowedOrigins = ['https://accounts.google.com', 'https://accounts.youtube.com'];

        if (navigationUrl.startsWith(devServerUrl)) return;

        if (!allowedOrigins.some(origin => parsedUrl.origin === origin)) {
            event.preventDefault();
            logToFile(`[Security] Blocked navigation to: ${navigationUrl}`);
            if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
                shell.openExternal(navigationUrl);
            }
        }
    });

    if (isDev) {
        logToFile(`Attempting to load Dev Server URL: ${devServerUrl}`);
        mainWindow.loadURL(devServerUrl).catch(err => logToFile(`Failed to load URL: ${err}`));
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        logToFile(`Loading Production File: ${indexPath}`);
        mainWindow.loadFile(indexPath);
    }
};

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (app.isReady()) createWindow();
    }
});
