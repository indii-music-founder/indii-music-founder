
import { useState, useEffect, useCallback } from 'react';
import { licensingService } from '@/services/licensing/LicensingService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { License, LicenseRequest } from '@/services/licensing/types';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

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

  const { userProfile } = useStore(useShallow(state => ({
    userProfile: state.userProfile
  })));
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
          logger.error('[useLicensing] Seeding Error:', err)
        );

        if (!isMounted) return;

        unsubscribeLicenses = licensingService.subscribeToActiveLicenses((data) => {
          if (isMounted) {
            setLicenses(data);
            setLicensesLoaded(true);
          }
        }, userProfile.id, (err) => {
          logger.error('[useLicensing] License Subscription Error:', err);
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
          logger.error('[useLicensing] Request Subscription Error:', err);
          if (isMounted) {
            setError(err.message);
            // Ensure we don't hang if one stream fails
            setRequestsLoaded(true);
          }
        });

      } catch (err: unknown) {
        logger.error('[useLicensing] Setup Error:', err);
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
      // Trigger transition to negotiating status (does not generate draft)
      await toast.promise(
        licensingService.updateRequestStatus(request.id!, 'negotiating'),
        {
          loading: 'Moving to negotiation...',
          success: 'Request status updated to Negotiating. Draft generation requires separate licensing contract step.',
          error: 'Failed to update request status.'
        }
      );
    } catch (error: unknown) {
      logger.error("Failed to initiate drafting:", error);
    }
  }, [toast]);

  // ISSUE-1276: this was `licenses.length * 12500` — a flat invented constant per
  // license, displayed as a real dollar figure. `License` carries no fee at all
  // unless the deal terms have been recorded, so the honest answer when none do is
  // "unknown" (null), not a synthesized number. Sums only licenses with real fees.
  const licensesWithFee = licenses.filter(l => typeof l.feeUsd === 'number' && Number.isFinite(l.feeUsd));
  const projectedValue = licensesWithFee.length > 0
    ? licensesWithFee.reduce((sum, l) => sum + (l.feeUsd as number), 0)
    : null;

  return {
    licenses,
    requests,
    projectedValue,
    loading: isLoading,
    error,
    initiateDrafting,
  };
}
