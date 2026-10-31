/** Resolve a Firebase ID token through the existing server-owned profile API.
 * The installed desktop app does not carry Firebase Admin service credentials.
 */
export async function verifiedAgentKnowledgeUid(idToken: string): Promise<string> {
    const response = await fetch('https://us-central1-indii-music-founder.cloudfunctions.net/getProfile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Signed-in account verification failed');
    const envelope: unknown = await response.json();
    const data = envelope && typeof envelope === 'object' && 'success' in envelope && envelope.success === true &&
        'data' in envelope ? envelope.data : undefined;
    const uid = data && typeof data === 'object' && 'id' in data ? data.id : undefined;
    if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/')) {
        throw new Error('Account verification returned an invalid identity');
    }
    return uid;
}
