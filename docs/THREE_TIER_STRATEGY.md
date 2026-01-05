# Three-Tier Strategy Implementation Blueprint

**Project:** indiiOS - The Operating System for Independent Artists
**Version:** 1.0.0
**Last Updated:** 2026-01-05
**Strategy:** Multi-Tier Product Deployment

---

## Executive Summary

This blueprint implements a three-tier product strategy to serve the entire music industry spectrum:
- **Tier 1:** indiiOS Free (Web) - Entry-level cloud offering
- **Tier 2:** indiiOS Pro (Web) - Professional cloud subscription
- **Tier 3:** indiiOS Studio (Desktop) - Local-first hybrid offering with two variants

---

## Tier Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    indiiOS Ecosystem                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Tier 1: indiiOS Free (Web)                                   │
│  ┌─────────────────────┐                                     │
│  │ • Basic Features    │                                     │
│  │ • Cloud-Only        │                                     │
│  │ • Free Forever      │                                     │
│  └─────────────────────┘                                     │
│           ↓ Upsell Path                                        │
│  Tier 2: indiiOS Pro (Web)                                    │
│  ┌─────────────────────┐                                     │
│  │ • Enhanced Features │                                     │
│  │ • Subscription      │                                     │
│  │ • Cloud Power       │                                     │
│  └─────────────────────┘                                     │
│           ↓ Upgrade Option                                    │
│  Tier 3: indiiOS Studio (Desktop)                             │
│  ┌─────────────────────┐    ┌─────────────────────┐          │
│  │  Variant 3A         │    │  Variant 3B         │          │
│  │  TypeScript Native  │    │  Docker Agent Zero  │          │
│  │  • Hybrid AI        │    │  • Python Ecosystem │          │
│  │  • Local+Cloud      │    │  • A0T Token Econ  │          │
│  └─────────────────────┘    └─────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Enhance Current Web Offering (Immediate)

### Objectives
- Solidify Tier 1 (Free) and Tier 2 (Pro) web products
- Implement subscription system
- Improve cloud performance
- Prepare infrastructure for desktop variants

### 1.1 Subscription Management

#### 1.1.1 Tier Definitions

```typescript
// src/services/subscription/SubscriptionTier.ts

export enum SubscriptionTier {
  FREE = 'free',
  PRO_MONTHLY = 'pro_monthly',
  PRO_YEARLY = 'pro_yearly',
  STUDIO_MONTHLY = 'studio_monthly',
  STUDIO_YEARLY = 'studio_yearly'
}

export interface TierLimits {
  name: string;
  price: number;
  billingPeriod: 'month' | 'year' | 'once';
  imageGenerations: {
    monthly: number;
    maxResolution: string;
    generationsPerMonth: number;
  };
  videoGenerations: {
    totalDurationMinutes: number;
    maxResolution: string;
    maxDurationSeconds: number;
  };
  aiChat: {
    tokensPerMonth: number;
    modelTier: 'basic' | 'advanced' | 'unlimited';
  };
  storage: {
    totalGB: number;
    fileTypeAccess: string[];
  };
  features: {
    collaboration: boolean;
    exportFormats: string[];
    agentCapabilities: string[];
    advancedTools: string[];
  };
}

// Tier Configuration
export const TIER_CONFIGS: Record<SubscriptionTier, TierLimits> = {
  [SubscriptionTier.FREE]: {
    name: 'indiiOS Free',
    price: 0,
    billingPeriod: 'once',
    imageGenerations: {
      monthly: 50,
      maxResolution: '1024x1024',
      generationsPerMonth: 50
    },
    videoGenerations: {
      totalDurationMinutes: 5,
      maxResolution: '720p',
      maxDurationSeconds: 15
    },
    aiChat: {
      tokensPerMonth: 10000,
      modelTier: 'basic'
    },
    storage: {
      totalGB: 2,
      fileTypeAccess: ['jpg', 'png', 'mp4', 'mp3']
    },
    features: {
      collaboration: false,
      exportFormats: ['png', 'jpg', 'mp4'],
      agentCapabilities: ['basic_chat', 'suggestions'],
      advancedTools: []
    }
  },
  [SubscriptionTier.PRO_MONTHLY]: {
    name: 'indiiOS Pro',
    price: 19,
    billingPeriod: 'month',
    imageGenerations: {
      monthly: 500,
      maxResolution: '2048x2048',
      generationsPerMonth: 500
    },
    videoGenerations: {
      totalDurationMinutes: 30,
      maxResolution: '1080p',
      maxDurationSeconds: 60
    },
    aiChat: {
      tokensPerMonth: 100000,
      modelTier: 'advanced'
    },
    storage: {
      totalGB: 50,
      fileTypeAccess: ['jpg', 'png', 'mp4', 'mp3', 'wav', 'flac', 'svg', 'pdf']
    },
    features: {
      collaboration: true,
      exportFormats: ['png', 'jpg', 'webp', 'mp4', 'mov', 'gif', 'wav', 'mp3'],
      agentCapabilities: ['basic_chat', 'suggestions', 'delegation', 'long_term_memory'],
      advancedTools: ['batch_processing', 'style_transfer', 'video_editing']
    }
  },
  [SubscriptionTier.PRO_YEARLY]: {
    name: 'indiiOS Pro (Yearly)',
    price: 190,
    billingPeriod: 'year',
    imageGenerations: {
      monthly: 500,
      maxResolution: '2048x2048',
      generationsPerMonth: 500
    },
    videoGenerations: {
      totalDurationMinutes: 30,
      maxResolution: '1080p',
      maxDurationSeconds: 60
    },
    aiChat: {
      tokensPerMonth: 100000,
      modelTier: 'advanced'
    },
    storage: {
      totalGB: 50,
      fileTypeAccess: ['jpg', 'png', 'mp4', 'mp3', 'wav', 'flac', 'svg', 'pdf']
    },
    features: {
      collaboration: true,
      exportFormats: ['png', 'jpg', 'webp', 'mp4', 'mov', 'gif', 'wav', 'mp3'],
      agentCapabilities: ['basic_chat', 'suggestions', 'delegation', 'long_term_memory'],
      advancedTools: ['batch_processing', 'style_transfer', 'video_editing']
    }
  },
  [SubscriptionTier.STUDIO_MONTHLY]: {
    name: 'indiiOS Studio',
    price: 49,
    billingPeriod: 'month',
    imageGenerations: {
      monthly: 2000,
      maxResolution: '4096x4096',
      generationsPerMonth: 2000
    },
    videoGenerations: {
      totalDurationMinutes: 120,
      maxResolution: '4K',
      maxDurationSeconds: 300
    },
    aiChat: {
      tokensPerMonth: 500000,
      modelTier: 'unlimited'
    },
    storage: {
      totalGB: 500,
      fileTypeAccess: ['all']
    },
    features: {
      collaboration: true,
      exportFormats: ['all'],
      agentCapabilities: ['all'],
      advancedTools: ['all']
    }
  },
  [SubscriptionTier.STUDIO_YEARLY]: {
    name: 'indiiOS Studio (Yearly)',
    price: 490,
    billingPeriod: 'year',
    imageGenerations: {
      monthly: 2000,
      maxResolution: '4096x4096',
      generationsPerMonth: 2000
    },
    videoGenerations: {
      totalDurationMinutes: 120,
      maxResolution: '4K',
      maxDurationSeconds: 300
    },
    aiChat: {
      tokensPerMonth: 500000,
      modelTier: 'unlimited'
    },
    storage: {
      totalGB: 500,
      fileTypeAccess: ['all']
    },
    features: {
      collaboration: true,
      exportFormats: ['all'],
      agentCapabilities: ['all'],
      advancedTools: ['all']
    }
  }
};
```

#### 1.1.2 Subscription Service

```typescript
// src/services/subscription/SubscriptionService.ts

import { initializeApp, getApps } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { SubscriptionTier, TIER_CONFIGS } from './SubscriptionTier';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface UsageStats {
  tier: SubscriptionTier;
  imagesGenerated: number;
  imagesRemaining: number;
  videoDurationMinutes: number;
  videoRemainingMinutes: number;
  aiChatTokens: number;
  tokensRemaining: number;
  storageUsedGB: number;
  storageRemainingGB: number;
  resetDate: number;
}

class SubscriptionService {
  private subscriptionCache: Map<string, Subscription> = new Map();

  /**
   * Check if user can perform an action based on subscription tier
   */
  async canPerformAction(
    userId: string,
    action: 'generateImage' | 'generateVideo' | 'chat' | 'storage',
    amount: number = 1
  ): Promise<{ allowed: boolean; reason?: string; upgradeUrl?: string }> {
    const stats = await this.getUsageStats(userId);
    const tierConfig = TIER_CONFIGS[stats.tier];

    switch (action) {
      case 'generateImage':
        if (stats.imagesRemaining < amount) {
          return {
            allowed: false,
            reason: `Image quota exceeded. ${stats.imagesGenerated}/${tierConfig.imageGenerations.monthly} generated.`,
            upgradeUrl: '/pricing'
          };
        }
        return { allowed: true };

      case 'generateVideo':
        if (stats.videoRemainingMinutes < amount / 60) {
          return {
            allowed: false,
            reason: `Video quota exceeded. ${stats.videoDurationMinutes}/${tierConfig.videoGenerations.totalDurationMinutes} minutes used.`,
            upgradeUrl: '/pricing'
          };
        }
        return { allowed: true };

      case 'chat':
        if (stats.tokensRemaining < amount) {
          return {
            allowed: false,
            reason: `Token quota exceeded. Upgrade to continue using AI chat.`,
            upgradeUrl: '/pricing'
          };
        }
        return { allowed: true };

      case 'storage':
        if (stats.storageRemainingGB < amount) {
          return {
            allowed: false,
            reason: `Storage quota exceeded. Upgrade for more space.`,
            upgradeUrl: '/pricing'
          };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }

  /**
   * Get current usage statistics for user
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const subscription = await this.getSubscription(userId);
    const tierConfig = TIER_CONFIGS[subscription.tier];

    // In production, this would fetch real usage data from Firestore
    const stats: UsageStats = {
      tier: subscription.tier,
      imagesGenerated: 23,
      imagesRemaining: tierConfig.imageGenerations.monthly - 23,
      videoDurationMinutes: 2,
      videoRemainingMinutes: tierConfig.videoGenerations.totalDurationMinutes - 2,
      aiChatTokens: 1500,
      tokensRemaining: tierConfig.aiChat.tokensPerMonth - 1500,
      storageUsedGB: 0.5,
      storageRemainingGB: tierConfig.storage.totalGB - 0.5,
      resetDate: subscription.currentPeriodEnd
    };

    return stats;
  }

  /**
   * Get user's current subscription
   */
  async getSubscription(userId: string): Promise<Subscription> {
    if (this.subscriptionCache.has(userId)) {
      return this.subscriptionCache.get(userId)!;
    }

    // Fetch from Firestore in production
    const functions = getFunctions();
    const getSubscriptionFn = httpsCallable(functions, 'getSubscription');
    const result = await getSubscriptionFn({ userId });

    const subscription: Subscription = result.data as Subscription;
    this.subscriptionCache.set(userId, subscription);
    return subscription;
  }

  /**
   * Create Stripe checkout session for upgrade/downgrade
   */
  async createCheckoutSession(
    userId: string,
    tier: SubscriptionTier,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string }> {
    const functions = getFunctions();
    const createSessionFn = httpsCallable(functions, 'createCheckoutSession');

    const result = await createSessionFn({
      userId,
      tier,
      successUrl,
      cancelUrl
    });

    return result.data as { checkoutUrl: string };
  }

  /**
   * Cancel subscription at end of current billing period
   */
  async cancelSubscription(userId: string): Promise<void> {
    const functions = getFunctions();
    const cancelFn = httpsCallable(functions, 'cancelSubscription');
    await cancelFn({ userId });
  }

  /**
   * Resume cancelled subscription
   */
  async resumeSubscription(userId: string): Promise<void> {
    const functions = getFunctions();
    const resumeFn = httpsCallable(functions, 'resumeSubscription');
    await resumeFn({ userId });
  }

  /**
   * Clear cache (useful for admin/testing)
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.subscriptionCache.delete(userId);
    } else {
      this.subscriptionCache.clear();
    }
  }
}

export const subscriptionService = new SubscriptionService();
```

#### 1.1.3 Firebase Functions for Subscription

```typescript
// functions/src/subscription/getSubscription.ts

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { Subscription, SubscriptionTier } from '../../../src/services/subscription/SubscriptionTier';

export const getSubscription = onCall(async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  const db = getFirestore();
  const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();

  if (!subscriptionDoc.exists) {
    // Create free tier subscription
    const freeSubscription: Subscription = {
      id: crypto.randomUUID(),
      userId,
      tier: SubscriptionTier.FREE,
      status: 'active',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      cancelAtPeriodEnd: false
    };

    await db.collection('subscriptions').doc(userId).set(freeSubscription);
    return freeSubscription;
  }

  return subscriptionDoc.data() as Subscription;
});
```

```typescript
// functions/src/subscription/createCheckoutSession.ts

import { onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { SubscriptionTier } from '../../../src/services/subscription/SubscriptionTier';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia'
});

const TIER_PRICES: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: '', // Free tier, no checkout needed
  [SubscriptionTier.PRO_MONTHLY]: 'price_pro_monthly_id',
  [SubscriptionTier.PRO_YEARLY]: 'price_pro_yearly_id',
  [SubscriptionTier.STUDIO_MONTHLY]: 'price_studio_monthly_id',
  [SubscriptionTier.STUDIO_YEARLY]: 'price_studio_yearly_id'
};

export const createCheckoutSession = onCall(async (request) => {
  const { userId, tier, successUrl, cancelUrl } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  if (tier === SubscriptionTier.FREE) {
    throw new Error('Cannot create checkout session for free tier');
  }

  const priceId = TIER_PRICES[tier];
  if (!priceId) {
    throw new Error('Invalid tier');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, tier }
  });

  return { checkoutUrl: session.url };
});
```

### 1.2 Usage Tracking

```typescript
// src/services/subscription/UsageTracker.ts

interface UsageRecord {
  userId: string;
  project?: string;
  type: 'image' | 'video' | 'chat_tokens' | 'storage';
  amount: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class UsageTracker {
  // Track image generation
  async trackImageGeneration(userId: string, project?: string): Promise<void> {
    await this.trackUsage(userId, {
      type: 'image',
      amount: 1,
      project
    });
  }

  // Track video generation (in seconds)
  async trackVideoGeneration(userId: string, durationSeconds: number, project?: string): Promise<void> {
    await this.trackUsage(userId, {
      type: 'video',
      amount: durationSeconds,
      project,
      metadata: { durationSeconds }
    });
  }

  // Track AI chat token usage
  async trackChatTokens(userId: string, tokenCount: number): Promise<void> {
    await this.trackUsage(userId, {
      type: 'chat_tokens',
      amount: tokenCount
    });
  }

  // Track storage usage (in GB)
  async trackStorage(userId: string, gbAmount: number, path: string): Promise<void> {
    await this.trackUsage(userId, {
      type: 'storage',
      amount: gbAmount,
      metadata: { path }
    });
  }

  private async trackUsage(userId: string, record: Omit<UsageRecord, 'userId' | 'timestamp'>): Promise<void> {
    const functions = require('@/services/firebase').functions;
    const { httpsCallable } = require('firebase/functions');

    const trackUsageFn = httpsCallable(functions, 'trackUsage');
    await trackUsageFn({
      userId,
      ...record,
      timestamp: Date.now()
    });
  }
}

export const usageTracker = new UsageTracker();
```

### 1.3 UI Components

#### 1.3.1 Pricing Page

```typescript
// src/pages/pricing/PricingPage.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown } from 'lucide-react';
import { TIER_CONFIGS, SubscriptionTier } from '@/services/subscription/SubscriptionTier';
import { subscriptionService } from '@/services/subscription/SubscriptionService';

export const PricingPage: React.FC = () => {
  const handleSubscribe = async (tier: SubscriptionTier) => {
    const result = await subscriptionService.createCheckoutSession(
      'current-user-id', // Get from auth
      tier,
      window.location.origin + '/success',
      window.location.origin + '/pricing'
    );
    window.location.href = result.checkoutUrl;
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-black mb-4 tracking-tighter">
            CHOOSE YOUR STUDIO
          </h1>
          <p className="text-gray-400 text-lg">
            Start free. Upgrade when you need professional power.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Tier */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-[#161b22] rounded-2xl p-8 border border-gray-800"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{TIER_CONFIGS[SubscriptionTier.FREE].name}</h2>
              <div className="text-4xl font-black">FREE</div>
              <p className="text-gray-400 text-sm">Forever</p>
            </div>

            <FeatureList tier={SubscriptionTier.FREE} />

            <button className="w-full mt-8 py-3 rounded-lg bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition">
              CURRENT TIER
            </button>
          </motion.div>

          {/* Pro Tier */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-b from-yellow-500/10 to-[#161b22] rounded-2xl p-8 border-2 border-yellow-500 relative"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                {TIER_CONFIGS[SubscriptionTier.PRO_MONTHLY].name}
                <Zap className="text-yellow-500" size={20} />
              </h2>
              <div className="text-4xl font-black">
                ${TIER_CONFIGS[SubscriptionTier.PRO_MONTHLY].price}
                <span className="text-lg text-gray-400">/mo</span>
              </div>
              <p className="text-gray-400 text-sm">${TIER_CONFIGS[SubscriptionTier.PRO_YEARLY].price}/year (Save 17%)</p>
            </div>

            <FeatureList tier={SubscriptionTier.PRO_MONTHLY} />

            <button
              onClick={() => handleSubscribe(SubscriptionTier.PRO_MONTHLY)}
              className="w-full mt-8 py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition"
            >
              START PRO TRIAL
            </button>
          </motion.div>

          {/* Studio Tier */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-b from-purple-500/10 to-[#161b22] rounded-2xl p-8 border border-purple-500"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                {TIER_CONFIGS[SubscriptionTier.STUDIO_MONTHLY].name}
                <Crown className="text-purple-500" size={20} />
              </h2>
              <div className="text-4xl font-black">
                ${TIER_CONFIGS[SubscriptionTier.STUDIO_MONTHLY].price}
                <span className="text-lg text-gray-400">/mo</span>
              </div>
              <p className="text-gray-400 text-sm">${TIER_CONFIGS[SubscriptionTier.STUDIO_YEARLY].price}/year (Save 17%)</p>
            </div>

            <FeatureList tier={SubscriptionTier.STUDIO_MONTHLY} />

            <button
              onClick={() => handleSubscribe(SubscriptionTier.STUDIO_MONTHLY)}
              className="w-full mt-8 py-3 rounded-lg bg-purple-500 text-white font-bold hover:bg-purple-400 transition"
            >
              GO STUDIO
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const FeatureList: React.FC<{ tier: SubscriptionTier }> = ({ tier }) => {
  const config = TIER_CONFIGS[tier];
  const features = [
    `${config.imageGenerations.monthly} images/month`,
    `${config.videoGenerations.totalDurationMinutes} min video/month`,
    `${config.storage.totalGB}GB storage`,
    `${config.features.collaboration ? 'Collaboration' : 'No collaboration'}`,
    `${config.aiChat.modelTier} AI chat`,
    ...config.features.advancedTools.map(t => t.replace('_', ' ')).slice(0, 5)
  ];

  return (
    <ul className="space-y-3">
      {features.map((feature, index) => (
        <li key={index} className="flex items-start gap-2 text-sm">
          <Check className="text-green-500 size-4 flex-shrink-0 mt-0.5" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
};

export default PricingPage;
```

#### 1.3.2 Usage Dashboard

```typescript
// src/modules/dashboard/components/UsageDashboard.tsx

import React, { useEffect, useState } from 'react';
import { subscriptionService, UsageStats } from '@/services/subscription/SubscriptionService';
import { SubscriptionTier } from '@/services/subscription/SubscriptionTier';

export const UsageDashboard: React.FC = () => {
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    subscriptionService.getUsageStats('current-user-id').then(setUsage);
  }, []);

  if (!usage) return <div>Loading...</div>;

  const resetDate = new Date(usage.resetDate).toLocaleDateString();

  return (
    <div className="bg-[#161b22] rounded-xl p-6 border border-gray-800">
      <h3 className="text-lg font-bold mb-4">Usage This Billing Period</h3>
      <p className="text-gray-400 text-sm mb-4">Resets: {resetDate}</p>

      <div className="space-y-4">
        {/* Images */}
        <UsageBar
          label="Images Generated"
          used={usage.imagesGenerated}
          total={usage.imagesGenerated + usage.imagesRemaining}
          color="blue"
        />

        {/* Video */}
        <UsageBar
          label="Video Duration (minutes)"
          used={usage.videoDurationMinutes}
          total={usage.videoDurationMinutes + usage.videoRemainingMinutes}
          color="purple"
        />

        {/* Chat Tokens */}
        <UsageBar
          label="AI Chat Tokens"
          used={usage.aiChatTokens}
          total={usage.aiChatTokens + usage.tokensRemaining}
          color="yellow"
        />

        {/* Storage */}
        <UsageBar
          label="Storage (GB)"
          used={usage.storageUsedGB}
          total={usage.storageUsedGB + usage.storageRemainingGB}
          color="green"
        />
      </div>
    </div>
  );
};

interface UsageBarProps {
  label: string;
  used: number;
  total: number;
  color: 'blue' | 'purple' | 'yellow' | 'green';
}

const UsageBar: React.FC<UsageBarProps> = ({ label, used, total, color }) => {
  const percentage = (used / total) * 100;
  const colors = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500'
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{used}/{total}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
```

### 1.4 Performance Improvements

#### 1.4.1 Optimistic Updates

```typescript
// src/services/optimistic/OptimisticManager.ts

interface OptimisticAction<T> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  rollback: () => Promise<void>;
}

class OptimisticManager {
  private pendingActions: Map<string, OptimisticAction<any>> = new Map();

  async execute<T>(
    actionId: string,
    actionType: string,
    payload: T,
    executeFn: () => Promise<any>,
    rollbackFn: () => Promise<void>
  ): Promise<any> {
    const action: OptimisticAction<T> = {
      id: actionId,
      type: actionType,
      payload,
      timestamp: Date.now(),
      rollback: rollbackFn
    };

    this.pendingActions.set(actionId, action);

    try {
      return await executeFn();
    } catch (error) {
      await rollbackFn();
      throw error;
    } finally {
      this.pendingActions.delete(actionId);
    }
  }

  getPendingAction(actionId: string): OptimisticAction<any> | undefined {
    return this.pendingActions.get(actionId);
  }

  hasPendingActions(): boolean {
    return this.pendingActions.size > 0;
  }
}

export const optimisticManager = new OptimisticManager();
```

#### 1.4.2 Caching Layer

```typescript
// src/services/cache/CacheService.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
```

---

## Phase 2: Build TypeScript Native Desktop

### Objectives
- Create TypeScript-native agent architecture for Electron
- Implement Instrument layer
- Build local compute foundation (optional)
- Design flexible economic layer

### 2.1 Instrument Layer Architecture

```typescript
// src/services/agent/instruments/InstrumentTypes.ts

export interface InstrumentMetadata {
  id: string;
  name: string;
  description: string;
  category: 'generation' | 'utility' | 'analysis' | 'communication';
  version: string;

  // Execution
  isAsync: boolean;
  timeoutMs?: number;

  // Economic Model
  cost: {
    type: 'free' | 'quota' | 'token' | 'subscription';
    amount: number;
    currency?: string;
  };
  requiresApproval: boolean;

  // Constraints
  requiredTier?: 'free' | 'pro' | 'studio';
  constraints: {
    maxResolution?: string;
    maxDuration?: number;
    maxFileSize?: number;
    allowedFormats?: string[];
  };

  // Model Requirements
  computeType: 'local' | 'cloud' | 'hybrid';
  preferredModel?: string;
  fallbackModels?: string[];
}

export interface InstrumentInput {
  type: string;
  description: string;
  required: boolean;
  schema: any; // JSON Schema
}

export interface InstrumentOutput {
  type: string;
  description: string;
  schema: any; // JSON Schema
}

export interface Instrument {
  metadata: InstrumentMetadata;
  inputs: InstrumentInput[];
  outputs: InstrumentOutput[];

  // Execute function
  execute(params: Record<string, any>): Promise<InstrumentResult>;

  // Validation
  validateInputs(params: Record<string, any>): { valid: boolean; errors: string[] };

  // Cost estimation
  estimateCost(params: Record<string, any>): Promise<number>;

  // Approval check
  requiresApproval?(params: Record<string, any>): Promise<boolean>;
}

export interface InstrumentResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    executionTimeMs: number;
    cost?: number;
    modelUsed?: string;
    quotaImpact?: {
      type: string;
      amount: number;
    };
  };
}
```

### 2.2 Core Instruments

```typescript
// src/services/agent/instruments/ImageGenerationInstrument.ts

import { Instrument, InstrumentMetadata, InstrumentResult } from './InstrumentTypes';
import { ImageGenerationService } from '@/services/image/ImageGenerationService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';

export class ImageGenerationInstrument implements Instrument {
  metadata: InstrumentMetadata = {
    id: 'generate_image',
    name: 'Generate Image',
    description: 'Generate AI images using Gemini 3.x',
    category: 'generation',
    version: '1.0.0',

    isAsync: true,
    timeoutMs: 120000,

    cost: {
      type: 'quota',
      amount: 1
    },
    requiresApproval: false,

    requiredTier: 'free',
    constraints: {
      maxResolution: '2048x2048',
      allowedFormats: ['png', 'jpg']
    },

    computeType: 'cloud',
    preferredModel: 'gemini-3-pro-image-preview'
  };

  inputs = [
    {
      type: 'string',
      description: 'Text prompt describing the desired image',
      required: true,
      schema: { type: 'string' }
    },
    {
      type: 'string',
      description: 'Aspect ratio (e.g., "1:1", "16:9", "9:16")',
      required: false,
      schema: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3', '3:4'] }
    },
    {
      type: 'number',
      description: 'Number of images to generate (1-4)',
      required: false,
      schema: { type: 'number', minimum: 1, maximum: 4 }
    }
  ];

  outputs = [
    {
      type: 'array',
      description: 'Array of generated image objects',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            prompt: { type: 'string' }
          }
        }
      }
    }
  ];

  async execute(params: Record<string, any>): Promise<InstrumentResult> {
    const startTime = Date.now();

    try {
      // Check quota
      const userId = 'current-user-id'; // Get from auth context
      const quotaCheck = await subscriptionService.canPerformAction(
        userId,
        'generateImage',
        params.count || 1
      );

      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: quotaCheck.reason,
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Validate input
      const validation = this.validateInputs(params);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Execute
      const imageService = new ImageGenerationService();
      const results = await imageService.generateImages({
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '1:1',
        count: params.count || 1
      });

      // Track usage
      await subscriptionService?.trackImageGeneration(userId);

      return {
        success: true,
        data: results,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cost: await this.estimateCost(params),
          modelUsed: this.metadata.preferredModel,
          quotaImpact: {
            type: 'image_generation',
            amount: results.length
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTimeMs: Date.now() - startTime
        }
      };
    }
  }

  validateInputs(params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.prompt || typeof params.prompt !== 'string') {
      errors.push('Prompt is required and must be a string');
    }

    if (params.count !== undefined) {
      if (typeof params.count !== 'number' || params.count < 1 || params.count > 4) {
        errors.push('Count must be a number between 1 and 4');
      }
    }

    if (params.aspectRatio !== undefined) {
      const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
      if (!validRatios.includes(params.aspectRatio)) {
        errors.push(`Aspect ratio must be one of: ${validRatios.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async estimateCost(params: Record<string, any>): Promise<number> {
    return (params.count || 1) * this.metadata.cost.amount;
  }

  async requiresApproval(params: Record<string, any>): Promise<boolean> {
    return this.metadata.requiresApproval;
  }
}
```

```typescript
// src/services/agent/instruments/VideoGenerationInstrument.ts

import { Instrument, InstrumentResult } from './InstrumentTypes';
import { VideoGenerationService } from '@/services/video/VideoGenerationService';

export class VideoGenerationInstrument implements Instrument {
  metadata = {
    id: 'generate_video',
    name: 'Generate Video',
    description: 'Generate AI videos using Veo 3.1',
    category: 'generation',
    version: '1.0.0',

    isAsync: true,
    timeoutMs: 300000, // 5 minutes

    cost: {
      type: 'quota',
      amount: 10
    },
    requiresApproval: true,

    requiredTier: 'pro',
    constraints: {
      maxDuration: 60,
      allowedFormats: ['mp4', 'mov']
    },

    computeType: 'cloud',
    preferredModel: 'veo-3.1-generate-preview'
  };

  inputs = [
    {
      type: 'string',
      description: 'Text prompt describing the video',
      required: true,
      schema: { type: 'string' }
    },
    {
      type: 'string',
      description: 'Aspect ratio (e.g., "16:9", "9:16")',
      required: false,
      schema: { type: 'string', enum: ['16:9', '9:16'] }
    },
    {
      type: 'number',
      description: 'Duration in seconds (1-60)',
      required: false,
      schema: { type: 'number', minimum: 1, maximum: 60 }
    }
  ];

  outputs = [
    {
      type: 'string',
      description: 'Job ID for async video generation',
      schema: { type: 'string' }
    }
  ];

  async execute(params: Record<string, any>): Promise<InstrumentResult> {
    const startTime = Date.now();

    try {
      const videoService = new VideoGenerationService();
      const results = await videoService.generateVideo({
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '16:9',
        duration: params.duration || 15
      });

      return {
        success: true,
        data: results[0].id, // Job ID
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cost: await this.estimateCost(params),
          modelUsed: this.metadata.preferredModel
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTimeMs: Date.now() - startTime
        }
      };
    }
  }

  validateInputs(params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.prompt || typeof params.prompt !== 'string') {
      errors.push('Prompt is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  async estimateCost(params: Record<string, any>): Promise<number> {
    const durationCost = (params.duration || 15) * 0.5; // $0.50 per second
    const baseCost = this.metadata.cost.amount;
    return baseCost + durationCost;
  }
}
```

### 2.3 Instrument Registry

```typescript
// src/services/agent/instruments/InstrumentRegistry.ts

import { Instrument } from './InstrumentTypes';
import { ImageGenerationInstrument } from './ImageGenerationInstrument';
import { VideoGenerationInstrument } from './VideoGenerationInstrument';

class InstrumentRegistry {
  private instruments: Map<string, Instrument> = new Map();

  constructor() {
    // Register core instruments
    this.register(new ImageGenerationInstrument());
    this.register(new VideoGenerationInstrument());
    // Add more instruments as they're implemented
  }

  register(instrument: Instrument): void {
    this.instruments.set(instrument.metadata.id, instrument);
  }

  get(id: string): Instrument | undefined {
    return this.instruments.get(id);
  }

  getByIds(ids: string[]): Instrument[] {
    return ids.map(id => this.get(id)).filter((i): i is Instrument => i !== undefined);
  }

  getAll(): Instrument[] {
    return Array.from(this.instruments.values());
  }

  getByCategory(category: Instrument['metadata']['category']): Instrument[] {
    return this.getAll().filter(i => i.metadata.category === category);
  }

  getByComputeType(computeType: 'local' | 'cloud' | 'hybrid'): Instrument[] {
    return this.getAll().filter(i => i.metadata.computeType === computeType);
  }

  search(query: string): Instrument[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      i =>
        i.metadata.name.toLowerCase().includes(lowerQuery) ||
        i.metadata.description.toLowerCase().includes(lowerQuery) ||
        i.metadata.id.toLowerCase().includes(lowerQuery)
    );
  }
}

export const instrumentRegistry = new InstrumentRegistry();
```

### 2.4 Agent Integration

```typescript
// src/services/agent/AgentExecutor.ts (Enhanced)

import { InstrumentRegistry } from './instruments/InstrumentRegistry';
import { subscriptionService } from '@/services/SubscriptionService';

export class AgentExecutor {
  private instrumentRegistry: InstrumentRegistry;

  constructor() {
    this.instrumentRegistry = instrumentRegistry;
  }

  async execute(
    agentId: string,
    task: string,
    context: AgentContext,
    progressCallback?: AgentProgressCallback
  ): Promise<AgentResponse> {
    // Get agent configuration
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Build context with available instruments
    const availableInstruments = this.instrumentRegistry.getAll().map(i => ({
      id: i.metadata.id,
      name: i.metadata.name,
      description: i.metadata.description,
      cost: i.metadata.cost
    }));

    // Add instruments to tool definitions
    const tools = [
      ...agent.tools,
      ...this.buildInstrumentTools(availableInstruments)
    ];

    // Execute with LLM
    const response = await this.executeWithLLM(agent, task, context, tools, progressCallback);

    return response;
  }

  private buildInstrumentTools(instruments: any[]): any[] {
    return instruments.map(instrument => ({
      name: `use_instrument_${instrument.id}`,
      description: `Use the ${instrument.name} instrument. Description: ${instrument.description}`,
      parameters: {
        type: 'OBJECT',
        properties: {
          instrument_id: {
            type: 'string',
            description: 'The ID of the instrument to use'
          },
          params: {
            type: 'OBJECT',
            description: 'Parameters to pass to the instrument'
          }
        },
        required: ['instrument_id', 'params']
      },
      function: async (args: any) => {
        const instrument = this.instrumentRegistry.get(args.instrument_id);
        if (!instrument) {
          throw new Error(`Instrument not found: ${args.instrument_id}`);
        }

        // Check if approval required
        const requiresApproval = await instrument.requiresApproval?.(args.params);
        if (requiresApproval) {
          // Trigger approval UI flow
          const approved = await this.requestApproval(instrument, args.params);
          if (!approved) {
            throw new Error('User denied approval');
          }
        }

        const result = await instrument.execute(args.params);

        if (!result.success) {
          throw new Error(result.error || 'Instrument execution failed');
        }

        return result.data;
      }
    }));
  }

  private async requestApproval(instrument: Instrument, params: Record<string, any>): Promise<boolean> {
    // Show approval modal
    const estimatedCost = await instrument.estimateCost(params);

    return new Promise((resolve) => {
      // Trigger UI modal
      window.dispatchEvent(
        new CustomEvent('approval-request', {
          detail: {
            instrument: instrument.metadata,
            params,
            estimatedCost,
            onApprove: () => resolve(true),
            onDeny: () => resolve(false)
          }
        })
      );
    });
  }

  // ... rest of existing AgentExecutor methods
}
```

### 2.5 Local Compute Foundation (Optional)

```typescript
// src/services/agent/compute/LocalInferenceService.ts

export class LocalInferenceService {
  private modelPath: string;
  private isInitialized: boolean = false;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    // Load local model (e.g., ONNX, TensorFlow.js)
    // This is where you'd integrate with Ollama or local inference engines
    this.isInitialized = true;
  }

  async chatCompletion(messages: any[], options: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Local inference not initialized');
    }

    // Execute local inference
    // This would replace cloud API calls with local execution

    return {
      text: 'Local inference result',
      model: this.modelPath
    };
  }

  async generateImage(prompt: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Local inference not initialized');
    }

    // Generate image locally
    // This would use TensorFlow.js or other local ML libraries

    return {
      url: 'data:image/png;base64,...',
      model: this.modelPath
    };
  }
}

export const localInferenceService = new LocalInferenceService('/models/llama-3-8b');
```

### 2.6 Economic Layer (Optional Tokens)

```typescript
// src/services/economy/TokenService.ts

export interface TokenBalance {
  address: string;
  balance: number; // in wei
  symbol: string;
  decimals: number;
}

export class TokenService {
  private contractAddress: string;
  private connected: boolean = false;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  async connectWallet(): Promise<string> {
    // Connect to Web3 wallet (MetaMask, Coinbase Wallet, etc.)
    // Use eth_connect or similar

    this.connected = true;
    return '0x...'; // Return wallet address
  }

  async getBalance(address: string): Promise<TokenBalance> {
    // Fetch A0T token balance from Base L2

    return {
      address,
      balance: 1000000000000000000n, // 1 A0T
      symbol: 'A0T',
      decimals: 18
    };
  }

  async approveSpend(amount: bigint): Promise<string> {
    // Approve indiiOS contract to spend A0T tokens
    // Returns transaction hash

    return '0xtxhash...';
  }

  async transferTokens(to: string, amount: bigint): Promise<string> {
    // Transfer A0T tokens
    // Returns transaction hash

    return '0xtxhash...';
  }
}

export const tokenService = new TokenService('0xA0T_CONTRACT_ADDRESS_ON_BASE');
```

---

## Phase 3: Prepare for Variant Product Release

### Objectives
- Finalize product differentiation
- Prepare marketing materials
- Set up distribution channels
- Document feature differences

### 3.1 Product Matrix

| Feature | Free (Web) | Pro (Web) | Studio Desktop (3A) | Studio Desktop (3B) |
|---------|------------|-----------|-------------------|-------------------|
| **Price** | $0 | $19/mo or $190/yr | $49/mo or $490/yr | Pay-per-use A0T |
| **Image Gen** | 50/month | 500/month | Unlimited (local) | Unlimited (local) |
| **Video Gen** | 5 min/month | 30 min/month | Unlimited (local) | Cloud via A0T |
| **AI Chat** | 10k tokens | 100k tokens | Unlimited (local) | Unlimited (local) |
| **Storage** | 2GB | 50GB | Local disk | Local disk |
| **Agent Features** | Basic | Advanced | Full | Full (Python) |
| **Offline Mode** | ❌ | ❌ | ✅ | ✅ |
| **Privacy** | Medium | Medium | High | High |
| **Docker Required** | ❌ | ❌ | ❌ | ✅ |
| **Python Scripts** | ❌ | ❌ | ❌ | ✅ |
| **File Access** | Cloud | Cloud | Local | Local |

### 3.2 Deployment Configuration

#### 3.2.1 Web Deployment (Free & Pro)

```yaml
# firebase.json (Web Hosting)
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs22"
  }
}
```

#### 3.2.2 Desktop Deployment (Studio 3A)

```json
// electron-builder.json (TypeScript Native)
{
  "appId": "com.indiios.studio",
  "productName": "indiiOS Studio",
  "directories": {
    "output": "dist-electron"
  },
  "files": [
    "dist-electron/**/*",
    "dist/**/*",
    "package.json"
  ],
  "mac": {
    "target": ["dmg", "zip"],
    "hardenedRuntime": true,
    "gatekeeperAssess": true
  },
  "win": {
    "target": ["nsis", "portable"],
    "signAndEditExecutable": true
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "category": "Audio"
  },
  "publish": {
    "provider": "github",
    "owner": "the-walking-agency-det",
    "repo": "indiiOS-Alpha-Electron"
  }
}
```

#### 3.2.3 Desktop Deployment (Studio 3B)

```json
// electron-builder.json (Docker Variant)
{
  "appId": "com.indiios.studio.docker",
  "productName": "indiiOS Studio Pro",
  "directories": {
    "output": "dist-electron-docker"
  },
  "files": [
    "dist-electron/**/*",
    "dist/**/*",
    "docker/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "docker/docker-compose.yml",
      "to": "docker-compose.yml"
    },
    {
      "from": "docker/Dockerfile",
      "to": "Dockerfile"
    }
  ],
  "mac": {
    "target": ["dmg"],
    "icon": "assets/icon-pro.icns"
  },
  "win": {
    "target": ["nsis"],
    "icon": "assets/icon-pro.ico"
  }
}
```

### 3.3 Docker Configuration (Variant 3B)

```dockerfile
# docker/Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt

# Install Ollama for local inference
RUN curl -fsSL https://ollama.com/install.sh | sh

# Create workspace directory
RUN mkdir -p /a0/usr/projects /a0/usr/instruments /a0/usr/memory

# Copy Agent Zero runtime
COPY agent-zero/ /opt/agent-zero/

# Set working directory
WORKDIR /a0/usr

# Expose API port
EXPOSE 8080

# Start Ollama and Agent Zero
CMD ["sh", "-c", "ollama serve > /dev/null 2>&1 & python /opt/agent-zero/main.py"]
```

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  agent-zero:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: indiios-agent-zero
    volumes:
      # Map local projects to container
      - ${HOME}/indiiOS/Projects:/a0/usr/projects
      - ${HOME}/indiiOS/Memory:/a0/usr/memory
      - ${HOME}/indiiOS/Instruments:/a0/usr/instruments
    ports:
      - "8080:8080"
    environment:
      - AGENT_MODE=hybrid
      - OLLAMA_MODEL=llama3:8b
    restart: unless-stopped

  # Optional: Local PostgreSQL for memory persistence
  postgres:
    image: postgres:15-alpine
    container_name: indiios-postgres
    volumes:
      - indiios-db-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=indiios
      - POSTGRES_USER=indiios
      - POSTGRES_PASSWORD=secure_password
    ports:
      - "5432:5432"

volumes:
  indiios-db-data:
```

```python
# requirements.txt
# Agent Zero Framework
agent-zero==1.0.0

# AI/ML
torch>=2.0.0
transformers>=4.30.0
diffusers>=0.20.0
accelerate>=0.20.0

# Audio Processing
librosa>=0.10.0
sox>=1.4.1
pydub>=0.25.0

# Video Processing
moviepy>=1.0.3
opencv-python>=4.8.0

# Image Processing
pillow>=10.0.0
imageio>=2.31.0

# Data Processing
pandas>=2.0.0
numpy>=1.24.0

# Web3 (for optional A0T integration)
web3>=6.0.0
eth-account>=0.9.0

# Instruments
ffmpeg-python>=0.2.0
openai>=1.0.0
replicate>=0.15.0

# Utilities
python-dotenv>=1.0.0
requests>=2.31.0
httpx>=0.24.0
```

### 3.4 Marketing Materials

#### 3.4.1 Product Comparison Page

```typescript
// src/pages/products/ProductComparison.tsx

export const ProductComparison: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-black mb-8 tracking-tighter text-center">
          WHICH INDIIOS IS RIGHT FOR YOU?
        </h1>

        <ComparisonTable />

        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <FeatureShowcase variant="3A" />
          <FeatureShowcase variant="3B" />
        </div>
      </div>
    </div>
  );
};
```

---

## Phase 4: Foundation for Future Docker Agent Zero

### Objectives
- Create Docker-ready architecture
- Prepare Python instrument ecosystem
- Design A0T token integration
- Document migration path

### 4.1 Python Instrument Ecosystem

```python
# docker/instruments/image_generation.py
"""
Instrument wrapper for image generation
Can be called from Agent Zero
"""

class ImageGenerationInstrument:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.example.com/v1"

    def execute(self, prompt: str, **kwargs):
        """
        Execute image generation

        Args:
            prompt: Text description
            size: Image size (e.g., "1024x1024")
            n: Number of images

        Returns:
            List of image URLs
        """
        import requests

        payload = {
            "prompt": prompt,
            "size": kwargs.get("size", "1024x1024"),
            "n": kwargs.get("n", 1)
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            f"{self.base_url}/images/generate",
            json=payload,
            headers=headers
        )

        return response.json()
```

```python
# docker/instruments/video_editing.py
"""
Python instrument for video editing using ffmpeg-python
"""

import ffmpeg
from typing import Dict, Any

class VideoEditingInstrument:
    def __init__(self):
        self.supported_formats = ['mp4', 'mov', 'avi', 'mkv']

    def resize(self, input_path: str, output_path: str, width: int, height: int, aspect_ratio: str):
        """
        Resize video to specific dimensions

        Args:
            input_path: Input file path
            output_path: Output file path
            width: Target width
            height: Target height
            aspect_ratio: Aspect ratio (e.g., "16:9", "9:16")

        Returns:
            Output file path
        """
        try:
            stream = ffmpeg.input(input_path)

            # Calculate resize dimensions maintaining aspect ratio
            if aspect_ratio == "9:16":
                # TikTok/Reels vertical
                stream = ffmpeg.filter(stream, 'scale', width, -1)
                stream = ffmpeg.filter(stream, 'pad', width, height, '(ow-iw)/2', '(oh-ih)/2')
            elif aspect_ratio == "16:9":
                # YouTube landscape
                stream = ffmpeg.filter(stream, 'scale', -1, height)
                stream = ffmpeg.filter(stream, 'pad', width, height, '(ow-iw)/2', '(oh-ih)/2')
            else:
                stream = ffmpeg.filter(stream, 'scale', width, height)

            stream = ffmpeg.output(stream, output_path)
            ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)

            return output_path

        except ffmpeg.Error as e:
            raise Exception(f"Video resizing failed: {e.stderr.decode('utf8')}")

    def extract_frames(self, input_path: str, output_dir: str, fps: int = 1):
        """
        Extract frames from video

        Args:
            input_path: Input video path
            output_dir: Directory to save frames
            fps: Frames per second to extract

        Returns:
            List of extracted frame paths
        """
        import os

        os.makedirs(output_dir, exist_ok=True)

        (
            ffmpeg
            .input(input_path)
            .output(f'{output_dir}/frame_%04d.png', vf=f'fps={fps}')
            .run(overwrite_output=True)
        )

        frame_files = [f for f in os.listdir(output_dir) if f.startswith('frame_')]
        return sorted(frame_files)

    def create_gif(self, input_path: str, output_path: str, duration: float, fps: int = 10):
        """
        Create GIF from video segment

        Args:
            input_path: Input video path
            output_path: Output GIF path
            duration: Duration in seconds
            fps: Frames per second for GIF

        Returns:
            Output GIF path
        """
        (
            ffmpeg
            .input(input_path, t=duration)
            .output(output_path, vf=f'fps={fps},scale=480:-1:flags=lanczos', split=False)
            .run(overwrite_output=True)
        )

        return output_path

    def audio_mix(self, video_path: str, audio_path: str, output_path: str, volume: float = 1.0):
        """
        Mix audio track into video

        Args:
            video_path: Input video path
            audio_path: Input audio path
            output_path: Output video path
            volume: Audio volume (0.0 to 1.0)

        Returns:
            Output video path
        """
        video = ffmpeg.input(video_path)
        audio = ffmpeg.input(audio_path)

        (
            ffmpeg
            .output(
                video.video,
                audio.audio.filter('volume', volume),
                output_path,
                vcodec='copy',
                acodec='aac',
                shortest=None
            )
            .run(overwrite_output=True)
        )

        return output_path
```

### 4.2 A0T Token Integration

```python
# docker/smart_contract/A0T_ABI.json
{
  "abi": [
    {
      "inputs": [
        {"internalType": "address", "name": "to", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "transfer",
      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ]
}
```

```python
# docker/economy/token_service.py
"""
A0T token service for interacting with Base L2
"""

from web3 import Web3
from web3.exceptions import TransactionNotFound
import json
from typing import Dict, Any

class A0TTokenService:
    def __init__(self, rpc_url: str, contract_address: str, wallet_address: str, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.contract_address = contract_address
        self.wallet_address = wallet_address
        self.private_key = private_key

        # Load ABI
        with open('A0T_ABI.json', 'r') as f:
            abi = json.load(f)
        self.contract = self.w3.eth.contract(address=contract_address, abi=abi)

    def get_balance(self) -> int:
        """Get A0T token balance (in wei)"""
        balance = self.contract.functions.balanceOf(self.wallet_address).call()
        return balance

    def get_balance_formatted(self) -> float:
        """Get A0T balance formatted"""
        balance_wei = self.get_balance()
        return balance_wei / 10**18

    def transfer(self, to_address: str, amount: float) -> Dict[str, Any]:
        """
        Transfer A0T tokens

        Args:
            to_address: Recipient address
            amount: Amount in A0T (not wei)

        Returns:
            Transaction receipt
        """
        amount_wei = int(amount * 10**18)

        # Build transaction
        nonce = self.w3.eth.get_transaction_count(self.wallet_address)
        transaction = self.contract.functions.transfer(
            to_address,
            amount_wei
        ).build_transaction({
            'from': self.wallet_address,
            'nonce': nonce,
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price,
            'chainId': 8453  # Base L2 chain ID
        })

        # Sign transaction
        signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)

        # Send transaction
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)

        # Wait for confirmation
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        return {
            'transactionHash': receipt['transactionHash'].hex(),
            'status': receipt['status'],
            'gasUsed': receipt['gasUsed'],
            'blockNumber': receipt['blockNumber']
        }

    def approve_instrument(self, instrument_address: str, amount: float) -> Dict[str, Any]:
        """
        A0T tokens to instrument service

        Args:
            instrument_address: Address to approve
            amount: Amount in A0T

        Returns:
            Transaction receipt
        """
        amount_wei = int(amount * 10**18)

        nonce = self.w3.eth.get_transaction_count(self.wallet_address)
        transaction = self.contract.functions.approve(
            instrument_address,
            amount_wei
        ).build_transaction({
            'from': self.wallet_address,
            'nonce': nonce,
            'gas': 50000,
            'gasPrice': self.w3.eth.gas_price,
            'chainId': 8453
        })

        signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        return {
            'transactionHash': receipt['transactionHash'].hex(),
            'status': receipt['status']
        }
```

### 4.3 Agent Zero Integration

```python
# docker/agent_zero_integration.py
"""
Integration layer between Agent Zero and indiiOS instruments
"""

from typing import Dict, List, Any
import json
import os
import sys

# Add instruments to path
sys.path.append('/a0/usr/instruments')

from image_generation import ImageGenerationInstrument
from video_editing import VideoEditingInstrument

class IndiiOSAgentZeroBridge:
    """Bridge between Agent Zero and indiiOS ecosystem"""

    def __init__(self):
        self.instruments: Dict[str, Any] = {
            'generate_image': ImageGenerationInstrument(api_key=os.getenv('GEMINI_API_KEY')),
            'video_edit': VideoEditingInstrument(),
            # Add more instruments as needed
        }

        # Load project context
        self.project_context = self.load_project_context()

    def load_project_context(self) -> Dict[str, Any]:
        """Load project context from file system"""
        context = {
            'project_name': '',
            'assets': [],
            'metadata': {}
        }

        projects_path = '/a0/usr/projects'
        if os.path.exists(projects_path):
            for project in os.listdir(projects_path):
                project_path = os.path.join(projects_path, project)
                metadata_path = os.path.join(project_path, 'metadata.json')

                if os.path.isfile(metadata_path):
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                        context['projects'][project] = metadata

        return context

    def execute_instrument(self, instrument_id: str, params: Dict[str, Any]) -> Any:
        """
        Execute an instrument

        Args:
            instrument_id: ID of instrument to execute
            params: Parameters for the instrument

        Returns:
            Result from instrument execution
        """
        instrument = self.instruments.get(instrument_id)

        if not instrument:
            raise ValueError(f"Instrument not found: {instrument_id}")

        # Check if instrument requires approval (A0T tokens)
        if self.requires_approval(instrument_id):
            cost = self.estimate_cost(instrument_id, params)
            approved = self.request_approval(cost)

            if not approved:
                raise PermissionError("User denied approval for instrument execution")

            # Deduct A0T tokens
            self.deduct_tokens(cost)

        # Execute instrument
        result = instrument.execute(**params)

        return result

    def requires_approval(self, instrument_id: str) -> bool:
        """Check if instrument requires user approval"""
        # High-cost instruments require approval
        approval_required_instruments = [
            'generate_video',
            'complex_video_edit',
            'cloud_inference'
        ]

        return instrument_id in approval_required_instruments

    def estimate_cost(self, instrument_id: str, params: Dict[str, Any]) -> float:
        """Estimate A0T cost for instrument execution"""
        cost_table = {
            'generate_image': 1.0,  # 1 A0T per image
            'generate_video': 10.0,  # 10 A0T per video
            'video_resize': 0.5,
            'video_extract_frames': 0.1,
            'audio_mix': 0.5
        }

        return cost_table.get(instrument_id, 0.0)

    def request_approval(self, cost: float) -> bool:
        """
        Request user approval for instrument execution

        Args:
            cost: Cost in A0T

        Returns:
            True if approved, False otherwise
        """
        # This would trigger a UI approval dialog
        # For now, return True (auto-approve in headless mode)
        print(f"⚠️  Instrument execution requires {cost} A0T tokens")

        # Could integrate with Electron IPC here
        return True

    def deduct_tokens(self, amount: float):
        """Deduct A0T tokens from wallet"""
        # Call token service to transfer tokens
        token_service = A0TTokenService(
            rpc_url=os.getenv('BASE_RPC_URL'),
            contract_address=os.getenv('A0T_CONTRACT_ADDRESS'),
            wallet_address=os.getenv('WALLET_ADDRESS'),
            private_key=os.getenv('WALLET_PRIVATE_KEY')
        )

        # Transfer tokens to platform wallet
        result = token_service.transfer(
            to_address=os.getenv('PLATFORM_WALLET_ADDRESS'),
            amount=amount
        )

        print(f"✅ Transferred {amount} A0T to platform wallet")
        print(f"   Transaction: {result['transactionHash']}")
```

---

## Implementation Timeline

### Phase 1 (Weeks 1-4): Cloud Enhancement
- [ ] Week 1: Subscription tier definitions and UI
- [ ] Week 2: Firebase Functions for Stripe integration
- [ ] Week 3: Usage tracking and quota management
- [ ] Week 4: Performance optimization (caching, optimistic updates)

### Phase 2 (Weeks 5-10): Desktop Foundation
- [ ] Week 5-6: Instrument layer architecture
- [ ] Week 7-8: Core instruments (Image, Video)
- [ ] Week 9: Agent integration with instruments
- [ ] Week 10: Local compute foundation (optional)

### Phase 3 (Weeks 11-14): Product Variant Prep
- [ ] Week 11: Product matrix finalization
- [ ] Week 12: Deployment configuration for all variants
- [ ] Week 13: Docker configuration for variant 3B
- [ ] Week 14: Marketing materials and documentation

### Phase 4 (Weeks 15-20): Docker Agent Zero Foundation
- [ ] Week 15-16: Python instrument ecosystem
- [ ] Week 17-18: A0T token integration (optional)
- [ ] Week 19: Agent Zero integration layer
- [ ] Week 20: Documentation and migration guide

---

## Success Metrics

### Tier 1 (Free)
- Sign-ups: 1,000/month
- Conversion to Pro: >5%
- Daily active users: >200

### Tier 2 (Pro)
- Subscribers: 50/month
- Churn rate: <5%
- Feature utilization: High

### Tier 3 (Studio)
- Downloads: 20/month
- Monthly active: 80%
- Desktop preference: >70%

---

## Risk Mitigation

### Technical Risks
- **Docker Complexity:** Provide TypeScript-native variant (3A) for majority
- **Performance:** Implement caching and optimistic updates
- **Offline Mode:** Design sync architecture carefully

### Business Risks
- **Market Confusion:** Clear product differentiation
- **Pricing:** Competitive analysis and A/B testing
- **Support:** Tier-specific support SLAs

### Security Risks
- **Local Data:** Encryption at rest
- **Cloud Data:** Access controls and audit logs
- **Authentication:** Multi-factor authentication for higher tiers

---

## Conclusion

This three-tier strategy provides comprehensive coverage of the music industry's diverse needs:

1. **Free (Cloud)**: Entry-level hook for new users
2. **Pro (Cloud)**: Professional subscription for teams
3. **Studio (Desktop)**: Privacy-first, flexible offering for serious producers

By leveraging the existing TypeScript codebase and gradually adding Docker support, we ensure rapid development while maintaining flexibility for future expansion.

The architecture prioritizes:
- **User Privacy**: Multiple deployment options
- **Flexibility**: Mix of local and cloud compute
- **Scalability**: Can grow with user needs
- **Developer Experience**: Leverages existing investments
