import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './core/App';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
);

// Disable Default Drag-and-Drop (HEY Audit Hardening)
// Prevents the app from navigating to dropped files (potential RCE)
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
    event.preventDefault();
});
