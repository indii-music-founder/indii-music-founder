/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */

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

        const isPlainObject = value !== null && typeof value === 'object'
            && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
        if (Array.isArray(value) || isPlainObject) {
            result[key] = cleanFirestoreData(value);
        } else {
            result[key] = value;
        }
    });

    return result as T;
}
