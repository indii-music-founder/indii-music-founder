import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import type {
    PersonaMeasurementReceipt,
    PersonaMeasurementRequest,
} from '@indii/shared';

export async function recordPersonaResponseMeasurement(
    request: PersonaMeasurementRequest,
): Promise<PersonaMeasurementReceipt> {
    if (!functions) {
        throw new Error('Firebase Functions us-central1 client is unavailable.');
    }

    const recordMeasurement = httpsCallable<
        PersonaMeasurementRequest,
        PersonaMeasurementReceipt
    >(functions, 'recordPersonaResponseMeasurement');
    const result = await recordMeasurement(request);
    return result.data;
}
