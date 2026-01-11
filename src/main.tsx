import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './core/App';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import { initViewportFixes, initKeyboardDetection } from '@/lib/mobile';
import './index.css';

// Initialize mobile utilities (must run after DOM is ready)
initViewportFixes();
initKeyboardDetection();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </BrowserRouter>
    </React.StrictMode>,
);

// Disable Default Drag-and-Drop (HEY Audit Hardening)
// Prevents the app from navigating to dropped files (potential RCE)
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
    event.preventDefault();
});
