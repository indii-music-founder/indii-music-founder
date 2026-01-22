
/**
 * Remove undefined fields from an object recursively.
 * Firestore does not allow undefined values in documents.
 */
export function cleanFirestoreData<T extends Record<string, any>>(data: T): T {
    const result: any = Array.isArray(data) ? [] : {};

    Object.keys(data).forEach(key => {
        const value = data[key];

        if (value === undefined) {
            return; // Skip undefined
        }

        if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value.constructor?.name === 'Timestamp')) {
            result[key] = cleanFirestoreData(value);
        } else {
            result[key] = value;
        }
    });

    return result as T;
}
