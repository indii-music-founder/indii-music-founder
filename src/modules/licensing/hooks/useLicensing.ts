import { useState, useEffect, useCallback } from 'react';
import { licensingService } from '@/services/licensing/LicensingService';
import { useStore } from '@/core/store';
import { License, LicenseRequest } from '@/services/licensing/types';
import { useToast } from '@/core/context/ToastContext';

export const useLicensing = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { userProfile } = useStore();
  const toast = useToast();

  // Subscribe to data
  useEffect(() => {
    if (!userProfile?.id) return;

    let isMounted = true;
    let unsubscribeLicenses: (() => void) | undefined;
    let unsubscribeRequests: (() => void) | undefined;

    const setupSubscriptions = async () => {
      try {
        // Trigger seeding if needed by fetching once
        if (userProfile?.id) {
          await licensingService.getActiveLicenses(userProfile.id).catch(err =>
            console.error('[useLicensing] Seeding Error:', err)
          );
        }

        unsubscribeLicenses = licensingService.subscribeToActiveLicenses((data) => {
          if (isMounted) {
            setLicenses(data);
            setLoading(false);
          }
        }, userProfile.id, (err) => {
          console.error('[useLicensing] License Subscription Error:', err);
          if (isMounted) setError(err.message);
        });

        unsubscribeRequests = licensingService.subscribeToPendingRequests((data) => {
          if (isMounted) {
            setRequests(data);
            setLoading(false);
          }
        }, userProfile.id, (err) => {
          console.error('[useLicensing] Request Subscription Error:', err);
          if (isMounted) setError(err.message);
        });

      } catch (err) {
        console.error('[useLicensing] Setup Error:', err);
        if (isMounted) {
          const message = (err as Error).message;
          setError(message);
          setLoading(false);
          toast.error(`Licensing Data Error: ${message}`);
        }
      }
    };

    setLoading(true);
    setupSubscriptions();

    return () => {
      isMounted = false;
      if (unsubscribeLicenses) unsubscribeLicenses();
      if (unsubscribeRequests) unsubscribeRequests();
    };
  }, [userProfile?.id]);

  const initiateDrafting = useCallback(async (request: LicenseRequest) => {
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
  }, []);

  const createLicense = async (licenseData: Omit<License, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      const id = await licensingService.createLicense(licenseData);
      return id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    licenses,
    requests,
    loading,
    error,
    initiateDrafting,
    createLicense
  };
};
