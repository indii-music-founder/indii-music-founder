import { doc, getDoc } from 'firebase/firestore';
import {
    PERSONA_FADER_DEFAULT,
    isValidPersonaFaderValues,
    type PersonaFaderValues,
    type PersonaId,
} from '@indii/shared';
import { auth, db } from '@/services/firebase';
import { logger } from '@/utils/logger';

export class PersonaFaderRepositoryError extends Error {}

/** Resolve the signed-in user's saved faders, or population defaults when unset. */
export async function loadPersonaFaderValues(personaId: PersonaId): Promise<PersonaFaderValues> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw new PersonaFaderRepositoryError('Persona faders require an authenticated user.');
    }

    const snapshot = await getDoc(doc(db, 'users', uid, 'personaFaders', personaId));
    if (!snapshot.exists()) {
        return { ...PERSONA_FADER_DEFAULT };
    }

    const data = snapshot.data();
    if (data.personaId !== personaId || !isValidPersonaFaderValues(data.values)) {
        logger.warn('[PersonaFaderRepository] Saved faders were invalid; using validated population defaults.', {
            personaId,
        });
        return { ...PERSONA_FADER_DEFAULT };
    }

    return { ...data.values };
}
