import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IPC Handlers
// IPC Handlers
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => import('electron').then(({ shell }) => shell.openExternal(url)));

// Protocol Registration
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('indii-os', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('indii-os');
}

// Handle Deep Links (macOS)
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

// Handle Deep Links (Windows/Linux - Second Instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        // Someone tried to run a second instance, we should focus our window.
        if (BrowserWindow.getAllWindows().length > 0) {
            const win = BrowserWindow.getAllWindows()[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
        // Find the protocol url in commandLine
        const url = commandLine.find(arg => arg.startsWith('indii-os://'));
        if (url) handleDeepLink(url);
    });
}

function handleDeepLink(url: string) {
    console.log("Deep link received:", url);
    // Expected format: indii-os://auth/callback?idToken=XYZ&accessToken=ABC
    try {
        const urlObj = new URL(url);
        const idToken = urlObj.searchParams.get('idToken');
        const accessToken = urlObj.searchParams.get('accessToken');

        if (idToken) {
            const wins = BrowserWindow.getAllWindows();
            // Send structured token data to renderer
            wins.forEach(w => w.webContents.send('auth-token', { idToken, accessToken }));
        }
    } catch (e) {
        console.error("Failed to parse deep link:", e);
    }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
    // @ts-ignore - no types for electron-squirrel-startup
    import('electron-squirrel-startup').then((mod: { default?: boolean }) => {
        if (mod.default) app.quit();
    }).catch(() => {
        // electron-squirrel-startup not available, ignore
    });
}

// Disable site isolation to allow cross-origin auth flows
app.commandLine.appendSwitch('disable-site-isolation-trials');

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false, // TEMPORARY: Disable web security for local dev auth
        },
    });

    // Handle Auth Popups
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                frame: true,
                fullscreenable: false,
                backgroundColor: 'black',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: false,
                    webSecurity: false
                }
            }
        };
    });

    console.log('Main process: Preload path configured as:', path.join(__dirname, 'preload.cjs'));

    // In production, load the index.html.
    // In development, load the Vite dev server URL.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
