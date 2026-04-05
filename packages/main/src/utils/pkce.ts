import crypto from 'crypto';

const base64URLEncode = (str: Buffer): string => {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export const generatePKCECodeVerifier = (): string => {
    return base64URLEncode(crypto.randomBytes(32));
}

export const generatePKCECodeChallenge = (verifier: string): string => {
    return base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
}
