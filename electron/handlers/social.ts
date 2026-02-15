import { ipcMain, BrowserWindow } from 'electron';
import { validateSender } from '../utils/ipc-security';
import { credentialService } from '../services/CredentialService';

export function registerSocialHandlers() {
    ipcMain.handle('social:connect-oauth', async (event, provider: string) => {
        validateSender(event);

        // Whitelist allowed providers
        const ALLOWED_PROVIDERS = new Set(['twitter', 'instagram', 'linkedin', 'tiktok']);
        const safeProvider = ALLOWED_PROVIDERS.has(provider.toLowerCase()) ? provider.toLowerCase() : 'unknown';

        // Helper to escape HTML to prevent XSS (Internal usage only for mock)
        const escape = (str: string) => str.replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m] as string));

        const displayProvider = safeProvider.charAt(0).toUpperCase() + safeProvider.slice(1);
        const safeDisplayProvider = escape(displayProvider);
        const logo = safeProvider === 'twitter' ? '𝕏' : safeDisplayProvider.charAt(0);

        console.log(`[SocialHandler] Starting OAuth Flow for: ${safeProvider}`);

        const win = new BrowserWindow({
            width: 600,
            height: 800,
            show: true,
            title: `Connect to ${displayProvider}`,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        return new Promise((resolve) => {
            let resolved = false;

            // Mock Flow for Alpha:
            // We load a simple local "OAuth" page that simulates the login
            // Using data attributes and a script block for safety
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
                            <div class="logo">${logo}</div>
                            <h2>Authorize indiiOS</h2>
                            <p>indiiOS Alpha is requesting access to your ${safeDisplayProvider} account to post content and view analytics.</p>
                            <button id="auth-btn" data-provider="${escape(safeProvider)}">Authorize App</button>
                        </div>
                        <script>
                            document.getElementById('auth-btn').addEventListener('click', (e) => {
                                const provider = e.currentTarget.dataset.provider;
                                const timestamp = Date.now();
                                const token = 'MOCK_TOKEN_' + timestamp;
                                const user = 'alpha_user';
                                const params = new URLSearchParams({
                                    provider: provider,
                                    token: token,
                                    user: user
                                });
                                window.location.href = 'indii-os://oauth-callback?' + params.toString();
                            });
                        </script>
                    </body>
                </html>
            `;

            win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(mockHtml)}`);

            const handleRedirect = (url: string) => {
                if (url.startsWith('indii-os://oauth-callback')) {
                    const parsed = new URL(url);
                    const token = parsed.searchParams.get('token');
                    const userId = parsed.searchParams.get('user');

                    resolved = true;
                    win.close();
                    resolve({
                        success: true,
                        provider: safeProvider,
                        accessToken: token,
                        userId: userId
                    });
                    return true;
                }
                return false;
            };

            win.webContents.on('will-navigate', (event, url) => {
                if (handleRedirect(url)) event.preventDefault();
            });

            win.webContents.on('will-redirect', (event, url) => {
                if (handleRedirect(url)) event.preventDefault();
            });

            win.on('closed', () => {
                if (!resolved) {
                    resolve({ success: false, provider: safeProvider, error: 'User closed the login window' });
                }
            });
        });
    });

    ipcMain.handle('social:get-token', async (event, platform: string) => {
        validateSender(event);
        // Use top-level imported credentialService
        const creds = await credentialService.getCredentials(`social_${platform}` as any);
        return creds;
    });
}
