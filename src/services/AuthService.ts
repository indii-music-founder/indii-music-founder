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
    signInWithRedirect,
    getRedirectResult,
    EmailAuthProvider,
    linkWithCredential,
    signInAnonymously
} from 'firebase/auth';
import { auth } from './firebase';
import { UserService } from './UserService';

// Detect mobile devices (iOS Safari doesn't support popups well)
const isMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};
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

    async signInWithGoogle(): Promise<User | null> {
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        // Mobile devices (iOS/Android) don't handle popups well
        // Use redirect flow instead
        if (isMobile()) {
            console.log('[AuthService] Mobile detected - using signInWithRedirect');
            await signInWithRedirect(auth, provider);
            // User will be redirected to Google, then back to app
            // getRedirectResult is called on page load in authSlice
            return null; // Won't reach here - redirect happens
        }

        // Desktop/Electron: Use popup (faster, no page reload)
        console.log('[AuthService] Desktop detected - using signInWithPopup');
        const userCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;

        await UserService.syncUserProfile(user);

        return user;
    },

    // Handle redirect result (called on page load for mobile flow)
    async handleRedirectResult(): Promise<User | null> {
        try {
            const result = await getRedirectResult(auth);
            if (result?.user) {
                console.log('[AuthService] Redirect result received:', result.user.uid);
                await UserService.syncUserProfile(result.user);
                return result.user;
            }
            return null;
        } catch (error) {
            console.error('[AuthService] Redirect result error:', error);
            throw error;
        }
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
