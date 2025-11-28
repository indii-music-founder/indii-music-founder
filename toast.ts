
import * as dom from './dom';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

const ICONS = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
};

const COLORS = {
    success: 'bg-green-900/90 border-green-500/50 text-white',
    error: 'bg-red-900/90 border-red-500/50 text-white',
    info: 'bg-blue-900/90 border-blue-500/50 text-white',
    warning: 'bg-yellow-900/90 border-yellow-500/50 text-white'
};

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl backdrop-blur-md transform transition-all duration-300 translate-x-10 opacity-0 ${COLORS[type]} min-w-[300px] pointer-events-auto`;
    toast.innerHTML = `
        <div class="flex-shrink-0">${ICONS[type]}</div>
        <div class="text-sm font-medium flex-1">${message}</div>
    `;

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-10', 'opacity-0');
    });

    // Animate Out
    setTimeout(() => {
        toast.classList.add('translate-x-10', 'opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// Global helper for easy access
(window as any).showToast = showToast;
