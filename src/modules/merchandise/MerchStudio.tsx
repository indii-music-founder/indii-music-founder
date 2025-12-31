import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MerchDashboard from './MerchDashboard';
import MerchDesigner from './MerchDesigner';

export default function MerchStudio() {
    return (
        <Routes>
            <Route index element={<MerchDashboard />} />
            <Route path="design" element={<MerchDesigner />} />
            <Route path="*" element={<Navigate to="." />} />
        </Routes>
    );
}
