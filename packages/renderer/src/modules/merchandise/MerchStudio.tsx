import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MerchDashboard from './MerchDashboard';
import MerchDesigner from './MerchDesigner';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

/**
 * MerchStudio — Top-level router for the Merchandise module.
 *
 * Uses absolute paths (leading `/`) because this `<Routes>` sits inside
 * the global `<BrowserRouter>` without a parent `<Route path="/merch/*">`.
 *
 * Route map:
 *   /merch          → MerchDashboard (3-panel layout: sidebar + workspace + right panel)
 *   /merch/design   → MerchDesigner (Fabric.js canvas + AI generation + Showroom)
 *   /merch/*        → Redirect to /merch
 */
export default function MerchStudio() {
    return (
        <ModuleErrorBoundary moduleName="Merchandise">
            <Routes>
                <Route path="/merch" element={<MerchDashboard />} />
                <Route path="/merch/design" element={<MerchDesigner />} />
                <Route path="/merch/catalog" element={<MerchDashboard />} />
                <Route path="/merch/settings" element={<MerchDashboard />} />
                {/* Catch all for this module - redirect to dashboard root */}
                <Route path="*" element={<Navigate to="/merch" replace />} />
            </Routes>
        </ModuleErrorBoundary>
    );
}
