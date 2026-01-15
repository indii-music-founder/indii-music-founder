import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MerchDashboard from './MerchDashboard';
import MerchDesigner from './MerchDesigner';

export default function MerchStudio() {
    return (
        <Routes>
            <Route path="merch" element={<MerchDashboard />} />
            <Route path="merch/design" element={<MerchDesigner />} />
            {/* Catch all for this module - redirect to dashboard root */}
            <Route path="*" element={<Navigate to="/merch" replace />} />
        </Routes>
    );
}
