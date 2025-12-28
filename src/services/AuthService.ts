/**
 * AuthService - NUCLEAR REBUILD
 *
 * Simple, reliable auth. No fancy detection, no fallbacks.
 * signInWithRedirect for Google (works everywhere)
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updatePassword,
    sendEmailVerification,
    User,
    GoogleAuthProvider,
    signInWithPopup, // Add this
    EmailAuthProvider,
    linkWithCredential,
    signInAnonymously,
    updateProfile
} from 'firebase/auth';
import { auth } from './firebase';
import { UserService } from './UserService';

export const AuthService = {
    // Email/Password
    async signUp(email: string, password: string, displayName?: string): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        if (displayName) {
            await updateProfile(userCredential.user, { displayName });
        }

        await UserService.syncUserProfile(userCredential.user);
        return userCredential.user;
    },

    async signIn(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await UserService.syncUserProfile(userCredential.user);
        return userCredential.user;
    },

    // Google Sign-In - POPUP (Native support in Electron/Chrome)
    async signInWithGoogle(): Promise<void> {
        console.log('[Auth] Starting Google sign-in via popup...');
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        try {
            const result = await signInWithPopup(auth, provider);
            console.log('[Auth] Popup success! User:', result.user.email);
            await UserService.syncUserProfile(result.user);
        } catch (error: any) {
            console.error('[Auth] Popup error:', error.code, error.message);
            throw error;
        }
    },

    // Legacy/Fallback - kept for compatibility if needed, but unused in main flow
    async handleRedirectResult(): Promise<User | null> {
        return null;
    },

    // Guest/Anonymous
    async signInAnonymously(): Promise<User> {
        const userCredential = await signInAnonymously(auth);
        await UserService.syncUserProfile(userCredential.user);
        return userCredential.user;
    },

    // Sign Out
    async signOut(): Promise<void> {
        await signOut(auth);
    },

    // Password Reset
    async sendPasswordReset(email: string): Promise<void> {
        await sendPasswordResetEmail(auth, email);
    },

    async updatePassword(newPassword: string): Promise<void> {
        if (!auth.currentUser) throw new Error('No user logged in');
        await updatePassword(auth.currentUser, newPassword);
    },

    // Email Verification
    async sendVerificationEmail(): Promise<void> {
        if (!auth.currentUser) throw new Error('No user logged in');
        await sendEmailVerification(auth.currentUser);
    },

    async checkEmailVerified(): Promise<boolean> {
        if (!auth.currentUser) return false;
        await auth.currentUser.reload();
        return auth.currentUser.emailVerified;
    },

    // Upgrade Anonymous Account
    async linkAnonymousAccount(email: string, password: string): Promise<User> {
        if (!auth.currentUser) throw new Error('No user logged in');
        const credential = EmailAuthProvider.credential(email, password);
        const userCredential = await linkWithCredential(auth.currentUser, credential);
        await UserService.syncUserProfile(userCredential.user);
        return userCredential.user;
    }
};
