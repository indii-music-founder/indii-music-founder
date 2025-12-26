import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DistributorConnection } from '@/services/distribution/types/distributor';

interface DistributorCardProps {
    connection: DistributorConnection;
    onConnect: (id: string) => void;
    isConnecting?: boolean;
}

const getDistributorColor = (id: string) => {
    // Mock brand colors
    const colors: Record<string, string> = {
        distrokid: 'bg-green-500',
        cdbaby: 'bg-blue-600',
        tunecore: 'bg-orange-500',
        // default
    };
    return colors[id] || 'bg-gray-500';
};

export const DistributorCard: React.FC<DistributorCardProps> = ({ connection, onConnect, isConnecting }) => {
    return (
        <Card className="overflow-hidden">
            <div className={`h-2 w-full ${getDistributorColor(connection.distributorId)}`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold capitalize">
                    {connection.distributorId}
                </CardTitle>
                <div className={`h-3 w-3 rounded-full ${connection.isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                        {connection.isConnected ? (
                            <>
                                <p>Connected as: {connection.accountEmail}</p>
                                <p>Synced: {new Date(connection.lastSyncedAt!).toLocaleDateString()}</p>
                            </>
                        ) : (
                            <p>Not connected</p>
                        )}
                    </div>

                    <button
                        onClick={() => !connection.isConnected && onConnect(connection.distributorId)}
                        disabled={connection.isConnected || isConnecting}
                        className={`w-full py-2 px-4 rounded text-white font-medium transition-colors ${connection.isConnected
                                ? 'bg-gray-100 text-gray-400 cursor-default'
                                : 'bg-black hover:bg-gray-800'
                            }`}
                    >
                        {connection.isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect'}
                    </button>

                    {connection.isConnected && (
                        <div className="text-xs text-center text-blue-500 cursor-pointer hover:underline">
                            Manage Settings
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
