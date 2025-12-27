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
    signInAnonymously
} from 'firebase/auth';
import { auth } from './firebase';
import { UserService } from './UserService';
import { UserProfile } from '@/types/User';


export const AuthService = {
    // Email/Password
    async signUp(email: string, password: string, displayName?: string): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Initialize User Profile
        await UserService.syncUserProfile(user);

        return user;
    },

    async signIn(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Sync Profile on Login
        await UserService.syncUserProfile(user);

        return user;
    },

    async signInWithGoogle(): Promise<User> {
        // Robust Electron detection that works even if 'process' is sandboxed/hidden
        const isElectron = /Electron/i.test(navigator.userAgent);
        const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;

        console.log('[AuthService] Environment Check:', { isElectron, hasAPI: !!electronAPI });

        if (isElectron) {
            if (!electronAPI?.auth) {
                // FAIL FAST: Do not fallback to popup - it won't work in production
                const error = new Error('ELECTRON_BRIDGE_MISSING');
                console.error('[AuthService] Critical Error: Electron Bridge missing. Preload failed?');
                throw error;
            }

            console.log('[AuthService] Using Electron IPC login flow');
            await electronAPI.auth.login();

            // Wait for the auth:user-update event handler to process the token
            // This promise never resolves here - the app state update handles navigation
            return new Promise(() => { });
        }

        console.warn('[AuthService] electronAPI not found, falling back to signInWithPopup');
        // Browser fallback: use Firebase popup
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;

        await UserService.syncUserProfile(user);

        return user;
    },

    async signInAnonymously(): Promise<User> {
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        await UserService.syncUserProfile(user);
        return user;
    },

    async signOut(): Promise<void> {
        await signOut(auth);
    },

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
        const user = userCredential.user;

        // Ensure profile is synced/updated (account merge logic could go here if needed)
        await UserService.syncUserProfile(user);

        return user;
    }
};
