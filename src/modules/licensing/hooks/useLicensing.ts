
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
  const [licensesLoaded, setLicensesLoaded] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { userProfile } = useStore();
  const toast = useToast();

  const isLoading = (!licensesLoaded || !requestsLoaded) || isActionLoading;

  // Subscribe to data
  useEffect(() => {
    if (!userProfile?.id) return;

    let isMounted = true;
    let unsubscribeLicenses: (() => void) | undefined;
    let unsubscribeRequests: (() => void) | undefined;

    const setupSubscriptions = async () => {
      try {
        // Trigger seeding if needed by fetching once
        await licensingService.getActiveLicenses(userProfile.id).catch(err =>
          console.error('[useLicensing] Seeding Error:', err)
        );

        if (!isMounted) return;

        unsubscribeLicenses = licensingService.subscribeToActiveLicenses((data) => {
          if (isMounted) {
            setLicenses(data);
            setLicensesLoaded(true);
          }
        }, userProfile.id, (err) => {
          console.error('[useLicensing] License Subscription Error:', err);
          if (isMounted) {
            setError(err.message);
            // Ensure we don't hang if one stream fails
            setLicensesLoaded(true);
          }
        });

        unsubscribeRequests = licensingService.subscribeToPendingRequests((data) => {
          if (isMounted) {
            setRequests(data);
            setRequestsLoaded(true);
          }
        }, userProfile.id, (err) => {
          console.error('[useLicensing] Request Subscription Error:', err);
          if (isMounted) {
            setError(err.message);
            // Ensure we don't hang if one stream fails
            setRequestsLoaded(true);
          }
        });

      } catch (err) {
        console.error('[useLicensing] Setup Error:', err);
        if (isMounted) {
          const message = (err as Error).message;
          setError(message);
          // Force load completion on error to prevent infinite spinner
          setLicensesLoaded(true);
          setRequestsLoaded(true);
          toast.error(`Licensing Data Error: ${message}`);
        }
      }
    };

    setupSubscriptions();

    return () => {
      isMounted = false;
      if (unsubscribeLicenses) unsubscribeLicenses();
      if (unsubscribeRequests) unsubscribeRequests();
    };
  }, [userProfile?.id, toast]);

  const initiateDrafting = useCallback(async (request: LicenseRequest) => {
    // Validate state before proceeding (Beta Reliability)
    if (request.id && !['checking', 'pending_approval', 'negotiating'].includes(request.status)) {
      toast.error(`Cannot draft agreement for request in '${request.status}' status.`);
      return;
    }

    try {
      // Trigger transition to negotiating status
      await toast.promise(
        licensingService.updateRequestStatus(request.id!, 'negotiating'),
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

  const createLicense = async (licenseData: Omit<License, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setIsActionLoading(true);
      const id = await licensingService.createLicense(licenseData);
      return id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  return {
    licenses,
    requests,
    loading: isLoading,
    error,
    initiateDrafting,
    createLicense
  };
}
