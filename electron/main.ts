import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { registerSystemHandlers } from './handlers/system';
import { registerAuthHandlers, handleDeepLink } from './handlers/auth';
import { registerAudioHandlers } from './handlers/audio';
import { registerNetworkHandlers } from './handlers/network';
import { configureSecurity } from './security';

// Protocol Registration
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('indii-os', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('indii-os');
}

// Deep Links (macOS)
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

// Deep Links (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, commandLine) => {
        if (BrowserWindow.getAllWindows().length > 0) {
            const win = BrowserWindow.getAllWindows()[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
        const url = commandLine.find(arg => arg.startsWith('indii-os://'));
        if (url) handleDeepLink(url);
    });
}

const createWindow = () => {
    const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;

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
            webSecurity: !isDev, // Disable webSecurity in Dev
            webviewTag: false,
        },
    });

    mainWindow.setContentProtection(true);

    // Configure Security (CSP, Permissions, Headers)
    configureSecurity(mainWindow.webContents.session);

    // Pipe Renderer Logs to Terminal
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        console.log(`[Renderer][${levels[level] || 'INFO'}] ${message}`);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`[DEBUG] Page failed to load: ${errorCode} - ${errorDescription}`);
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error(`[DEBUG] Renderer Process Gone: ${details.reason}`);
    });

    mainWindow.webContents.on('dom-ready', () => {
        console.log('[DEBUG] DOM Ready');
    });

    // Secure Navigation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://accounts.google.com') || url.includes('accounts.google.com')) {
            return { action: 'allow' };
        }
        if (url.startsWith('https://')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        const allowedOrigins = [
            'https://accounts.google.com',
            'https://accounts.youtube.com'
        ];

        if (process.env.VITE_DEV_SERVER_URL && navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL)) {
            return;
        }

        if (!allowedOrigins.some(origin => parsedUrl.origin === origin)) {
            event.preventDefault();
            console.warn(`[Security] Blocked navigation to: ${navigationUrl}`);
            if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
                shell.openExternal(navigationUrl);
            }
        }
    });

    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:4242';
    // const isDev = !app.isPackaged || process.env.VITE_DEV_SERVER_URL; // Already defined above

    if (isDev) {
        console.log('[DEBUG] Attempting to load Dev Server URL:', devServerUrl);
        mainWindow.loadURL(devServerUrl).catch(err => console.error('[DEBUG] Failed to load URL:', err));
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        console.log('[DEBUG] Loading Production File:', indexPath);
        mainWindow.loadFile(indexPath);
    }
};

app.on('ready', () => {
    registerSystemHandlers();
    registerAuthHandlers();
    registerAudioHandlers();
    registerNetworkHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (app.isReady()) {
            createWindow();
        }
    }
});
