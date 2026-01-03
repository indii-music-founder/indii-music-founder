"use strict";
/**
 * GCE Service - Google Compute Engine Instance Management
 *
 * This module provides real GCE instance management through the Google Compute API.
 * Requires service account with roles/compute.viewer or roles/compute.admin.
 *
 * Setup:
 * 1. Enable Compute API: gcloud services enable compute.googleapis.com
 * 2. Grant role: gcloud projects add-iam-policy-binding PROJECT_ID \
 *      --member="serviceAccount:FIREBASE_SERVICE_ACCOUNT" \
 *      --role="roles/compute.viewer"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInstances = listInstances;
exports.getInstanceStatus = getInstanceStatus;
exports.startInstance = startInstance;
exports.stopInstance = stopInstance;
exports.resetInstance = resetInstance;
const googleapis_1 = require("googleapis");
const firebase_functions_1 = require("firebase-functions");
// Initialize Compute client with ADC
const getComputeClient = async () => {
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/compute.readonly'],
    });
    return googleapis_1.google.compute({ version: 'v1', auth });
};
// For write operations
const getComputeClientReadWrite = async () => {
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/compute'],
    });
    return googleapis_1.google.compute({ version: 'v1', auth });
};
/**
 * List all GCE instances in the project (all zones)
 */
async function listInstances(projectId) {
    var _a, _b, _c, _d;
    try {
        const compute = await getComputeClient();
        const response = await compute.instances.aggregatedList({
            project: projectId,
        });
        const instances = [];
        const items = response.data.items || {};
        for (const [zone, zoneData] of Object.entries(items)) {
            const zoneInstances = zoneData.instances || [];
            for (const instance of zoneInstances) {
                // Extract zone name from full path
                const zoneName = zone.replace('zones/', '');
                // Get internal IP
                const networkInterface = (_a = instance.networkInterfaces) === null || _a === void 0 ? void 0 : _a[0];
                const internalIp = networkInterface === null || networkInterface === void 0 ? void 0 : networkInterface.networkIP;
                const externalIp = (_c = (_b = networkInterface === null || networkInterface === void 0 ? void 0 : networkInterface.accessConfigs) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.natIP;
                // Get machine type (extract just the type name)
                const machineTypeParts = ((_d = instance.machineType) === null || _d === void 0 ? void 0 : _d.split('/')) || [];
                const machineType = machineTypeParts[machineTypeParts.length - 1] || 'unknown';
                instances.push({
                    name: instance.name || 'unknown',
                    zone: zoneName,
                    status: instance.status || 'UNKNOWN',
                    internalIp,
                    externalIp,
                    machineType,
                });
            }
        }
        return instances;
    }
    catch (error) {
        firebase_functions_1.logger.error('[GCE] listInstances failed:', error);
        throw new Error(`Failed to list GCE instances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get status of a specific instance
 */
async function getInstanceStatus(projectId, zone, instanceName) {
    try {
        const compute = await getComputeClient();
        const response = await compute.instances.get({
            project: projectId,
            zone,
            instance: instanceName,
        });
        const instance = response.data;
        // Calculate approximate uptime if running
        let uptime;
        if (instance.status === 'RUNNING' && instance.lastStartTimestamp) {
            const startTime = new Date(instance.lastStartTimestamp);
            const now = new Date();
            const diffMs = now.getTime() - startTime.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            uptime = `${diffDays}d ${diffHours}h`;
        }
        return {
            status: instance.status || 'UNKNOWN',
            uptime,
            health: instance.status === 'RUNNING' ? 'HEALTHY' : 'UNKNOWN',
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[GCE] getInstanceStatus failed:', error);
        throw new Error(`Failed to get instance status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Start a stopped instance
 */
async function startInstance(projectId, zone, instanceName) {
    try {
        const compute = await getComputeClientReadWrite();
        await compute.instances.start({
            project: projectId,
            zone,
            instance: instanceName,
        });
        return {
            success: true,
            message: `Instance '${instanceName}' is starting.`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[GCE] startInstance failed:', error);
        throw new Error(`Failed to start instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Stop a running instance
 */
async function stopInstance(projectId, zone, instanceName) {
    try {
        const compute = await getComputeClientReadWrite();
        await compute.instances.stop({
            project: projectId,
            zone,
            instance: instanceName,
        });
        return {
            success: true,
            message: `Instance '${instanceName}' is stopping.`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[GCE] stopInstance failed:', error);
        throw new Error(`Failed to stop instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Reset (restart) an instance
 */
async function resetInstance(projectId, zone, instanceName) {
    try {
        const compute = await getComputeClientReadWrite();
        await compute.instances.reset({
            project: projectId,
            zone,
            instance: instanceName,
        });
        return {
            success: true,
            message: `Instance '${instanceName}' is restarting.`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[GCE] resetInstance failed:', error);
        throw new Error(`Failed to reset instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
//# sourceMappingURL=gceService.js.map