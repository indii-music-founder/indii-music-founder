import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
    PERSONA_FADER_DEFAULT,
    isValidPersonaFaderValues,
    type PersonaFaderValues,
    type PersonaId,
} from '@indii/shared';
import { auth, db } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { PersonaFaderResolution } from './PersonaFaderResolution';

export class PersonaFaderRepositoryError extends Error {}

/** Resolve values plus their genuine persisted/default source for runtime verification. */
export async function resolvePersonaFaderValues(personaId: PersonaId): Promise<PersonaFaderResolution> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw new PersonaFaderRepositoryError('Persona faders require an authenticated user.');
    }

    const snapshot = await getDoc(doc(db, 'users', uid, 'personaFaders', personaId));
    if (!snapshot.exists()) {
        return { values: { ...PERSONA_FADER_DEFAULT }, source: 'absent-default' };
    }

    const data = snapshot.data();
    if (data.personaId !== personaId || !isValidPersonaFaderValues(data.values)) {
        logger.warn('[PersonaFaderRepository] Saved faders were invalid; using validated population defaults.', {
            personaId,
        });
        return { values: { ...PERSONA_FADER_DEFAULT }, source: 'invalid-default' };
    }

    return { values: { ...data.values }, source: 'saved' };
}

/** Resolve the signed-in user's saved faders, or population defaults when unset. */
export async function loadPersonaFaderValues(personaId: PersonaId): Promise<PersonaFaderValues> {
    return (await resolvePersonaFaderValues(personaId)).values;
}

/** Persist calibrated persona faders for the signed-in user. */
export async function savePersonaFaderValues(
    personaId: PersonaId,
    values: PersonaFaderValues,
): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw new PersonaFaderRepositoryError('Persona faders require an authenticated user.');
    }
    if (!isValidPersonaFaderValues(values)) {
        throw new PersonaFaderRepositoryError('Invalid persona fader values provided.');
    }

    await setDoc(doc(db, 'users', uid, 'personaFaders', personaId), {
        personaId,
        values,
        updatedAt: Date.now(),
    });
}

/** Reset persona faders back to population defaults by deleting the saved override. */
export async function resetPersonaFaderValues(personaId: PersonaId): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw new PersonaFaderRepositoryError('Persona faders require an authenticated user.');
    }

    await deleteDoc(doc(db, 'users', uid, 'personaFaders', personaId));
}
