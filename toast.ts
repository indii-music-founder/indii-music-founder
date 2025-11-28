
import * as dom from './dom';

export type ToastType = 'success' | 'error' | 'info';

export function show(message: string, type: ToastType = 'info', duration: number = 3000) {
    if (!dom.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border
        transform transition-all duration-300 translate-x-full opacity-0
        ${getTypeStyles(type)}
    `;

    toast.innerHTML = `
        ${getIcon(type)}
        <span class="text-sm font-bold">${message}</span>
    `;

    dom.toastContainer.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // Auto Dismiss
    setTimeout(() => {
        dismiss(toast);
    }, duration);

    // Click to dismiss
    toast.onclick = () => dismiss(toast);
}

function dismiss(toast: HTMLElement) {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
}

function getTypeStyles(type: ToastType): string {
    switch (type) {
        case 'success': return 'bg-green-900/90 border-green-700 text-green-100';
        case 'error': return 'bg-red-900/90 border-red-700 text-red-100';
        default: return 'bg-gray-800/90 border-gray-600 text-gray-100';
    }
}

function getIcon(type: ToastType): string {
    switch (type) {
        case 'success': return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
        case 'error': return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        default: return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }
}
