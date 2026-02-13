import { ipcMain, BrowserWindow, shell } from 'electron';
import { validateSender } from '../utils/ipc-security';
import { credentialService } from '../services/CredentialService';

export function registerSocialHandlers() {
    ipcMain.handle('social:connect-oauth', async (event, provider: string) => {
        validateSender(event);

        console.log(`[SocialHandler] Starting OAuth Flow for: ${provider}`);

        const win = new BrowserWindow({
            width: 600,
            height: 800,
            show: true,
            title: `Connect to ${provider}`,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        return new Promise((resolve) => {
            // Mock Flow for Alpha:
            // We load a simple local "OAuth" page that simulates the login
            const mockHtml = `
                <html>
                    <head>
                        <style>
                            body { font-family: sans-serif; background: #0b0e14; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; }
                            .card { background: #161b22; padding: 40px; border-radius: 20px; border: 1px solid #30363d; text-align: center; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
                            button { background: #1d9bf0; color: white; border: none; padding: 14px 30px; border-radius: 9999px; font-weight: bold; cursor: pointer; margin-top: 30px; font-size: 16px; transition: all 0.2s; }
                            button:hover { background: #1a8cd8; transform: translateY(-2px); }
                            .logo { font-size: 64px; margin-bottom: 24px; }
                            h2 { margin-bottom: 12px; }
                            p { color: #8b949e; line-height: 1.5; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="logo">${provider === 'twitter' ? '𝕏' : provider[0].toUpperCase()}</div>
                            <h2>Authorize indiiOS</h2>
                            <p>indiiOS Alpha is requesting access to your ${provider} account to post content and view analytics.</p>
                            <button onclick="window.location.href='indii-os://oauth-callback?provider=${provider}&token=MOCK_TOKEN_${Date.now()}&user=alpha_user'">Authorize App</button>
                        </div>
                    </body>
                </html>
            `;

            win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(mockHtml)}`);

            const handleRedirect = (url: string) => {
                if (url.startsWith('indii-os://oauth-callback')) {
                    const parsed = new URL(url);
                    const token = parsed.searchParams.get('token');
                    const userId = parsed.searchParams.get('user');

                    win.close();
                    resolve({
                        success: true,
                        provider,
                        accessToken: token,
                        userId: userId
                    });
                    return true;
                }
                return false;
            };

            win.webContents.on('will-navigate', (e, url) => {
                if (handleRedirect(url)) e.preventDefault();
            });

            win.webContents.on('will-redirect', (e, url) => {
                if (handleRedirect(url)) e.preventDefault();
            });

            win.on('closed', () => {
                resolve({ success: false, provider, error: 'User closed the login window' });
            });
        });
    });

    ipcMain.handle('social:get-token', async (event, platform: string) => {
        validateSender(event);
        const { credentialService } = await import('../services/CredentialService');
        const creds = await credentialService.getCredentials(`social_${platform}` as any);
        return creds?.accessToken || null;
    });
}
