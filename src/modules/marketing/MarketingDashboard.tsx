import React from 'react';
import CampaignDashboard from './components/CampaignDashboard';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

/**
 * Main Marketing Module Entry Point
 * 
 * Replaces the legacy dashboard with the new "Campaign Manager" 
 * following Platinum Polish standards.
 */
export default function MarketingDashboard() {
    return <ModuleErrorBoundary moduleName="Marketing"><CampaignDashboard /></ModuleErrorBoundary>;
}
