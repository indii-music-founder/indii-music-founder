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
    signInWithRedirect,
    getRedirectResult,
    EmailAuthProvider,
    linkWithCredential,
    signInAnonymously
} from 'firebase/auth';
import { auth } from './firebase';
import { UserService } from './UserService';

export const AuthService = {
    // Email/Password
    async signUp(email: string, password: string): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await UserService.syncUserProfile(userCredential.user);
        return userCredential.user;
    },

    async signIn(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await UserService.syncUserProfile(userCredential.user);
        return userCredential.user;
    },

    // Google Sign-In - REDIRECT ONLY (works on all platforms)
    async signInWithGoogle(): Promise<void> {
        console.log('[Auth] Starting Google sign-in via redirect...');
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        // This redirects away from the app to Google
        // When user returns, handleRedirectResult() picks up the result
        await signInWithRedirect(auth, provider);
        // Code after this line never runs - page redirects
    },

    // Called on app load to check if we're returning from Google
    async handleRedirectResult(): Promise<User | null> {
        console.log('[Auth] Checking for redirect result...');
        try {
            const result = await getRedirectResult(auth);
            if (result && result.user) {
                console.log('[Auth] Redirect success! User:', result.user.email);
                await UserService.syncUserProfile(result.user);
                return result.user;
            }
            console.log('[Auth] No redirect result (normal page load)');
            return null;
        } catch (error: any) {
            console.error('[Auth] Redirect error:', error.code, error.message);
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
