import { useState, useEffect, useCallback } from 'react';
import { licensingService } from '@/services/licensing/LicensingService';
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
        let unsubscribeLicenses: (() => void) | null = null;
        let unsubscribeRequests: (() => void) | null = null;

        const handleError = (err: Error) => {
            console.error('[useLicensing] Subscription Error:', err);
            if (isMounted) {
                // Ensure we stop loading on error so the spinner doesn't hang
                setError(err.message);
                setIsLoading(false);
                toast.error(`Licensing Data Error: ${err.message}`);
            }
        };

        try {
            unsubscribeLicenses = licensingService.subscribeToActiveLicenses((data) => {
                if (isMounted) {
                    setLicenses(data);
                    // Only clear loading if both might have fired, or aggressively clear it to show at least partial data
                    setIsLoading(false);
                }
            }, handleError);

            unsubscribeRequests = licensingService.subscribeToPendingRequests((data) => {
                if (isMounted) {
                    setRequests(data);
                    setIsLoading(false);
                }
            }, handleError);
        } catch (err) {
            // Catch synchronous errors during subscription setup
            handleError(err as Error);
        }

        return () => {
            isMounted = false;
            if (unsubscribeLicenses) unsubscribeLicenses();
            if (unsubscribeRequests) unsubscribeRequests();
        };
    }, [toast, userProfile?.id]);

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
            // toast.promise already handles error notifications
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
