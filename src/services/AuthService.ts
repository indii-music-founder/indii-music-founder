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
    signInWithPopup,
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

    // Google Sign-In - Unified Popup Flow (Works on Web & Electron & Mobile)
    async signInWithGoogle(): Promise<void> {
        console.log('[Auth] Starting Google sign-in (Popup Flow)...');
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        try {
            // We now use Popup for EVERYTHING. 
            // It prevents the "redirect hang" on mobile and works in Electron.
            const result = await signInWithPopup(auth, provider);
            console.log('[Auth] Popup success! User:', result.user.email);
            await UserService.syncUserProfile(result.user);
        } catch (error: any) {
            console.error('[Auth] Sign-in error:', error.code, error.message);
            if (error.code === 'auth/popup-blocked') {
                throw new Error('Pop-up was blocked. Please allow pop-ups for this site.');
            }
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in cancelled by user.');
            }
            throw error;
        }
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
