import { renderStartupFallback } from './startupFallback';

const BOOT_TIMEOUT_MS = 12000;

function isRootMounted(root: HTMLElement): boolean {
  return root.childElementCount > 0 || (root.textContent?.trim().length ?? 0) > 0;
}

function checkWebGLAvailability(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function showStartupFallback(reason: string): void {
    const root = document.getElementById('root');
    if (!root || isRootMounted(root)) return;

    const webglAvailable = checkWebGLAvailability();
    const fullReason = `${reason}${webglAvailable ? '' : ' WebGL appears unavailable in this browser/device.'}`;
    renderStartupFallback(fullReason);
}

window.addEventListener('error', (event) => {
  showStartupFallback(event?.message || 'Script error during startup.');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason instanceof Error ? event.reason.message : 'Unhandled startup promise rejection.';
  showStartupFallback(reason);
});

window.setTimeout(() => {
  const root = document.getElementById('root');
  if (root && !isRootMounted(root)) {
    showStartupFallback(`Startup timeout exceeded (${BOOT_TIMEOUT_MS / 1000}s).`);
  }
}, BOOT_TIMEOUT_MS);
