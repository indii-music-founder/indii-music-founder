import { useState, useEffect, useCallback } from 'react';
import { licensingService } from '@/services/licensing/LicensingService';
import { useStore } from '@/core/store';
import { License, LicenseRequest } from '@/services/licensing/types';
import { useToast } from '@/core/context/ToastContext';

/**
 * useLicensing Hook
 * 
 * Provides reactive data for the Licensing module.
 * Subscribes to active licenses and pending requests in real-time.
 * 
 * @status BETA_READY
 */
export function useLicensing() {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [requests, setRequests] = useState<LicenseRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    // Subscribe to data
    useEffect(() => {
        let isMounted = true;
        let unsubscribeLicenses: (() => void) | undefined;
        let unsubscribeRequests: (() => void) | undefined;

        try {
            // Trigger seeding if needed by fetching once
            const userId = useStore.getState().userProfile?.id;
            if (userId) {
                licensingService.getActiveLicenses(userId).catch(err =>
                    console.error('[useLicensing] Seeding Error:', err)
                );
            }

            unsubscribeLicenses = licensingService.subscribeToActiveLicenses((data) => {
                if (isMounted) {
                    setLicenses(data);
                    setIsLoading(false);
                }
            });

            unsubscribeRequests = licensingService.subscribeToPendingRequests((data) => {
                if (isMounted) {
                    setRequests(data);
                    setIsLoading(false); // Ensure loading is cleared
                }
            });
        } catch (err) {
            console.error('[useLicensing] Subscription Error:', err);
            if (isMounted) {
                const message = (err as Error).message;
                setTimeout(() => {
                    if (isMounted) {
                        setError(message);
                        setIsLoading(false);
                        toast.error(`Licensing Data Error: ${message}`);
                    }
                }, 0);
            }
        }

        return () => {
            isMounted = false;
            if (unsubscribeLicenses) unsubscribeLicenses();
            if (unsubscribeRequests) unsubscribeRequests();
        };
    }, [toast]);

    // Action: Update Request Status
    const updateRequestStatus = useCallback(async (id: string, status: LicenseRequest['status']) => {
        try {
            await toast.promise(
                licensingService.updateRequestStatus(id, status),
                {
                    loading: 'Updating request status...',
                    success: `Request status updated to ${status}`,
                    error: 'Failed to update request status'
                }
            );
        } catch (err) {
            console.error('[useLicensing] Update Error:', err);
        }
    }, [toast]);

    // Action: Simulate Drafting (Alpha/Beta stub for agent trigger)
    const draftAgreement = useCallback(async (request: LicenseRequest) => {
        if (!request.id) {
            const err = new Error('Cannot draft agreement: Request ID missing');
            console.error(err);
            toast.error(err.message);
            return;
        }

        // Validate state before proceeding (Beta Reliability)
        if (!['checking', 'pending_approval', 'negotiating'].includes(request.status)) {
            toast.error(`Cannot draft agreement for request in '${request.status}' status.`);
            return;
        }

        try {
            // Trigger transition to negotiating status
            await toast.promise(
                licensingService.updateRequestStatus(request.id, 'negotiating'),
                {
                    loading: 'Initiating draft sequence...',
                    success: 'Agreement draft generated. Status: Negotiating.',
                    error: 'Failed to initiate drafting.'
                }
            );
        } catch (error) {
            console.error("Failed to initiate drafting:", error);
        }
    }, [toast]);

    return {
        licenses,
        requests,
        isLoading,
        error,
        actions: {
            updateRequestStatus,
            draftAgreement
        }
    };
}
