/** Decode Firestore VectorValue via its public API; retain legacy array compatibility. */
export function readKnowledgeEmbedding(value: unknown): number[] {
  const decoded: unknown = value && typeof value === 'object'
    && 'toArray' in value && typeof value.toArray === 'function'
    ? value.toArray()
    : value;
  if (Array.isArray(decoded) && decoded.every(item => typeof item === 'number')) return decoded;
  return [];
}
