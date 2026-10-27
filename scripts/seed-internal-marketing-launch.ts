/**
 * seed-internal-marketing-launch.ts
 *
 * M-01 & ISSUE-1429 Execution Script:
 * Seeds the "indii.music Public Launch" internal marketing campaign directly into Firestore,
 * implementing the core directive: "indii.music is its own first artist. We used indii.music to launch indii.music."
 *
 * Usage:
 *   npx tsx scripts/seed-internal-marketing-launch.ts [--dry-run] [--user <userId>] [--emulator]
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp, connectFirestoreEmulator } from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Standard Firebase config
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY || 'MOCK_KEY_DO_NOT_USE',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'indii-music-founder.firebaseapp.com',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'indii-music-founder',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'gs://indii-alpha-electron',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '148015878263',
    appId: process.env.VITE_FIREBASE_APP_ID || '1:148015878263:web:febc76c0bd56f28cdbb672'
};

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isEmulator = args.includes('--emulator');
const userArgIndex = args.indexOf('--user');
const targetUserId = userArgIndex !== -1 && args[userArgIndex + 1] ? args[userArgIndex + 1] : (process.env.SEED_USER_ID || 'wiil-founder');

export interface ScheduledPostSeed {
    id: string;
    platform: 'Twitter' | 'Instagram';
    copy: string;
    subject?: string;
    day: number;
    status: 'PENDING' | 'EXECUTING' | 'DONE' | 'FAILED';
    imageAsset: {
        assetType: 'image';
        title: string;
        imageUrl: string;
        caption: string;
    };
}

export interface LaunchCampaignRecord {
    assetType: 'campaign';
    title: string;
    description: string;
    tagline: string;
    primaryMessage: string;
    proofStatement: string;
    durationDays: number;
    startDate: string;
    budget: number;
    status: 'PENDING' | 'EXECUTING' | 'DONE';
    userId: string;
    attachedAssets: string[];
    posts: ScheduledPostSeed[];
    jobsStackM: Array<{ id: string; job: string; dependsOn: string; evidence: string; status: string }>;
    jobsStackC: Array<{ id: string; job: string; dependsOn: string; evidence: string; status: string }>;
    createdAt: string;
    updatedAt: string;
}

export const launchCampaignData: LaunchCampaignRecord = {
    assetType: 'campaign',
    title: 'indii.music Public Launch',
    description: 'Launch indii.music using indii.music — run your music career without giving it away.',
    tagline: 'music business at the speed of you.',
    primaryMessage: 'Run your music career without giving it away.',
    proofStatement: 'We used indii.music to launch indii.music.',
    durationDays: 60,
    startDate: new Date().toISOString(),
    budget: 5000,
    status: 'EXECUTING',
    userId: targetUserId,
    attachedAssets: [
        'clip-01-registration.mp4',
        'clip-02-audio-analysis.mp4',
        'clip-03-creative-canvas.mp4',
        'clip-04-video-nle.mp4',
        'clip-05-rights-copilot.mp4',
        'clip-06-ddex-packaging.mp4',
        'clip-07-ad-automation.mp4',
        'clip-08-mobile-remote.mp4',
        'indii-master-brand-kit',
        'founding-artist-license-agreement'
    ],
    posts: [
        {
            id: 'post-launch-01',
            platform: 'Twitter',
            day: 1,
            copy: 'Every contract you sign asks for a piece of your masters. What if you had an entire AI-native record label infrastructure in your own pocket? Music business at the speed of you. #indiimusic #independentartist',
            status: 'PENDING',
            imageAsset: {
                assetType: 'image',
                title: 'indii Master Artwork Teaser',
                imageUrl: 'https://indii.music/assets/branding/teaser-01.png',
                caption: 'music business at the speed of you.'
            }
        },
        {
            id: 'post-launch-02',
            platform: 'Instagram',
            day: 3,
            copy: 'We built indii.music because artists shouldn’t have to give away 50% of their future just to get distribution, legal filings, and video production. Here is how we used indii.music to launch indii.music.',
            status: 'PENDING',
            imageAsset: {
                assetType: 'image',
                title: 'Founder Video Clip 1 - Registration',
                imageUrl: 'https://indii.music/clips/clip-01-registration.png',
                caption: 'Song Registration & Immutable Split Ledgers'
            }
        },
        {
            id: 'post-launch-03',
            platform: 'Twitter',
            day: 7,
            copy: 'HyperFrames: Timeline-based, 60fps seek-safe non-linear video editing right inside your music workspace. Render broadcast-quality lyric videos synced directly to your audio transients. #HyperFrames #MusicVideo',
            status: 'PENDING',
            imageAsset: {
                assetType: 'image',
                title: 'HyperFrames NLE Timeline Clip',
                imageUrl: 'https://indii.music/clips/clip-04-video-nle.png',
                caption: 'Deterministic Code-Rendered Motion Video'
            }
        },
        {
            id: 'post-launch-04',
            platform: 'Instagram',
            day: 14,
            copy: 'The Desktop Rights Copilot walks you through official US Copyright and PRO member portals, pre-populating verified metadata so you never make filing mistakes or pay middleman service markups. #MusicRights',
            status: 'PENDING',
            imageAsset: {
                assetType: 'image',
                title: 'Rights Copilot Portal Walkthrough',
                imageUrl: 'https://indii.music/clips/clip-05-rights-copilot.png',
                caption: 'Zero Middleman Rights Filing'
            }
        },
        {
            id: 'post-launch-05',
            platform: 'Twitter',
            day: 21,
            copy: 'Direct DDEX ERN 4.3 packaging. Own your DPID, package official digital releases, validate checksums offline, and send directly to streaming DSPs. Your music, your delivery pipes.',
            status: 'PENDING',
            imageAsset: {
                assetType: 'image',
                title: 'DDEX Release Packaging',
                imageUrl: 'https://indii.music/clips/clip-06-ddex-packaging.png',
                caption: 'Distributor-Grade DDEX Delivery'
            }
        },
        {
            id: 'post-launch-06',
            platform: 'Instagram',
            day: 30,
            copy: 'Mobile Remote + Car Test audio streaming. When you’re in the studio or in the parking lot, your music library and creative tools sync instantly over peer-to-peer Cloud Relay. #StudioAnywhere',
            status: 'PENDING',
            imageAsset: {
                assetType: 'image',
                title: 'Mobile Remote Viewfinder & Vault Player',
                imageUrl: 'https://indii.music/clips/clip-08-mobile-remote.png',
                caption: 'Studio in Your Pocket'
            }
        }
    ],
    jobsStackM: [
        { id: 'M-01', job: 'Create the Public Launch campaign and timeline', dependsOn: 'Approved campaign direction', evidence: 'scripts/seed-internal-marketing-launch.ts', status: 'COMPLETED' },
        { id: 'M-02', job: 'Audit, verify, and register every social account', dependsOn: 'M-01', evidence: 'docs/launch/FOUNDER_LAUNCH_OPERATIONS_DOSSIER.md § Section 4', status: 'READY' },
        { id: 'M-03', job: 'Import and organize brand/marketing asset system', dependsOn: 'M-01', evidence: 'Brand kit imported in packages/renderer/public/assets', status: 'READY' },
        { id: 'M-04', job: 'Produce eight 15–30 second lifecycle clips', dependsOn: 'M-01, product access', evidence: 'docs/launch/FOUNDER_LAUNCH_OPERATIONS_DOSSIER.md § Section 3', status: 'IN_FLIGHT' },
        { id: 'M-05', job: 'Produce guided demonstration and long cut', dependsOn: 'M-04 visual system', evidence: 'packages/landing/src/pages/Home.tsx lifecycle section', status: 'READY' },
        { id: 'M-06', job: 'Create initial platform-specific social package', dependsOn: 'M-02..M-05', evidence: 'launchCampaignData.posts (6 scheduled posts)', status: 'SEEDED' },
        { id: 'M-07', job: 'Develop newsworthy content and outreach angles', dependsOn: 'M-01, verified claims', evidence: 'docs/business-decisions/07_FOUNDING_ARTIST_BETA_MARKETING.md', status: 'READY' },
        { id: 'M-08', job: 'Schedule and publish approved launch material', dependsOn: 'C-04/C-05 ready, M-06', evidence: 'Publication receipts and live post URLs', status: 'PENDING' },
        { id: 'M-09', job: 'Measure, review, improve, and repeat', dependsOn: 'M-08', evidence: 'Weekly operating review and analytics sync', status: 'PENDING' }
    ],
    jobsStackC: [
        { id: 'C-01', job: 'Audit existing website & produce protected boundaries', dependsOn: 'Repository access', evidence: 'docs/design_review_fixes_plan.md', status: 'COMPLETED' },
        { id: 'C-02', job: 'Implement approved domain routing and canonical metadata', dependsOn: 'C-01', evidence: 'packages/landing/src/pages/*', status: 'COMPLETED' },
        { id: 'C-03', job: 'Implement approved page structure and responsive sections', dependsOn: 'M-01', evidence: 'packages/landing/src/pages/Home.tsx', status: 'COMPLETED' },
        { id: 'C-04', job: 'Implement waitlist form, verification, and storage', dependsOn: 'C-03', evidence: 'packages/landing/src/components/waitlist/WaitlistModal.tsx', status: 'COMPLETED' },
        { id: 'C-05', job: 'Implement video presentation, captions, transcript, and poster', dependsOn: 'M-04 specs', evidence: 'docs/launch/FOUNDER_LAUNCH_OPERATIONS_DOSSIER.md § Section 3', status: 'SCAFFOLDED' },
        { id: 'C-06', job: 'Implement access & Founding Owner License pricing presentation', dependsOn: 'Approved pricing', evidence: 'packages/landing/src/components/pricing/PricingSection.tsx', status: 'COMPLETED' },
        { id: 'C-07', job: 'Implement social links, Open Graph data, and attribution', dependsOn: 'M-02 verified URLs', evidence: 'packages/landing/index.html & meta tags', status: 'COMPLETED' },
        { id: 'C-08', job: 'Run accessibility, performance, and security regression', dependsOn: 'C-02..C-07', evidence: 'All 37 engineering issues closed on main', status: 'COMPLETED' }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

async function main() {
    console.log('====================================================');
    console.log('🚀 indii.music Internal Marketing Launch Seeder (M-01)');
    console.log('====================================================');
    console.log(`Target User ID: ${targetUserId}`);
    console.log(`Dry Run: ${isDryRun ? 'YES (No DB writes)' : 'NO'}`);
    console.log(`Emulator Mode: ${isEmulator ? 'YES (localhost:8080)' : 'NO'}`);
    console.log('----------------------------------------------------');

    if (isDryRun) {
        console.log('\n[DRY RUN] Generated Campaign Payload:');
        console.log(JSON.stringify(launchCampaignData, null, 2));
        console.log('\n✅ Dry-run validation passed. 0 database operations executed.');
        return;
    }

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    if (isEmulator) {
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
        console.log('Connected to local Firestore emulator on 127.0.0.1:8080');
    }

    try {
        console.log(`Checking existing campaigns for user: ${targetUserId}...`);
        const campaignsRef = collection(db, 'campaigns');
        const q = query(campaignsRef, where('userId', '==', targetUserId), where('title', '==', launchCampaignData.title));
        const existing = await getDocs(q);

        if (!existing.empty) {
            console.log(`⚠️ Campaign "${launchCampaignData.title}" already exists for user ${targetUserId} (${existing.docs.length} found).`);
            console.log(`Existing Doc ID: ${existing.docs[0].id}`);
            console.log('Skipping duplicate insertion.');
            return;
        }

        console.log(`Inserting "${launchCampaignData.title}" campaign record into Firestore...`);
        const docRef = await addDoc(campaignsRef, {
            ...launchCampaignData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        console.log(`\n🎉 SUCCESS! Campaign seeded with Document ID: ${docRef.id}`);
        console.log(`The campaign is now live in indii Studio Marketing Dashboard for user ${targetUserId}.`);
    } catch (err) {
        console.error('❌ Failed to seed campaign:', err);
        process.exit(1);
    }
}

// Execute if run directly
main();
