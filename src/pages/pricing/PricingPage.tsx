/**
 * Pricing Page - Tier Comparison and Subscription Management
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Crown, ArrowRight, Loader2, X } from 'lucide-react';
import { TIER_CONFIGS, SubscriptionTier, calculateYearlySavings } from '@/services/subscription/SubscriptionTier';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { auth } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

interface Feature {
  text: string;
  important?: boolean;
}

export const PricingPage: React.FC = () => {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showYearlyTooltip, setShowYearlyTooltip] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadCurrentTier();
  }, []);

  const loadCurrentTier = async () => {
    try {
      if (auth.currentUser) {
        const subscription = await subscriptionService.getCurrentSubscription();
        setCurrentTier(subscription.tier);
      }
    } catch (error) {
      console.error('Failed to load current tier:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!auth.currentUser) {
      showToast('Please sign in to subscribe', 'error');
      return;
    }

    if (tier === SubscriptionTier.FREE) return;

    setSubscribing(tier);

    try {
      const result = await subscriptionService.createCheckoutSession({
        userId: auth.currentUser.uid,
        tier,
        successUrl: `${window.location.origin}/pricing?success=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`
      });

      window.location.href = result.checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      showToast('Failed to start checkout. Please try again.', 'error');
    } finally {
      setSubscribing(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!auth.currentUser) return;

    try {
      const { url } = await subscriptionService.getCustomerPortalUrl(
        `${window.location.origin}/pricing`
      );
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get portal URL:', error);
      showToast('Failed to open customer portal. Please try again.', 'error');
    }
  };

  const features = [
    'AI image generation',
    'AI video creation',
    'Agent-powered assistance',
    'Project management',
    'Multi-format export',
  ];

  const getFeaturesForTier = (tier: SubscriptionTier): Feature[] => {
    const config = TIER_CONFIGS[tier];
    const tierFeatures: Feature[] = features.map(f => ({ text: f }));

    // Add advanced features
    if (tier !== SubscriptionTier.FREE) {
      tierFeatures.push({ text: 'Team collaboration' });
      tierFeatures.push({ text: 'Advanced AI models' });
      tierFeatures.push({ text: 'Priority support' });
    }

    if (tier === SubscriptionTier.STUDIO) {
      tierFeatures.push({ text: 'Desktop app access', important: true });
      tierFeatures.push({ text: 'Unlimited projects', important: true });
      tierFeatures.push({ text: '4K video rendering', important: true });
      tierFeatures.push({ text: 'API access', important: true });
    }

    return tierFeatures;
  };

  const tiers = [
    SubscriptionTier.FREE,
    SubscriptionTier.PRO_MONTHLY,
    SubscriptionTier.STUDIO
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark text-white flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl sm:text-6xl font-black mb-4 tracking-tighter">
            CHOOSE YOUR CREATIVE POWER
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            From hobbyist to pro, start free or upgrade when you're ready
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              className={`px-4 py-2 rounded-lg font-bold transition ${!isYearly ? 'bg-white text-black' : 'bg-gray-800 text-gray-400'
                }`}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-bold transition relative ${isYearly ? 'bg-white text-black' : 'bg-gray-800 text-gray-400'
                }`}
              onClick={() => setIsYearly(true)}
              onMouseEnter={() => setShowYearlyTooltip(true)}
              onMouseLeave={() => setShowYearlyTooltip(false)}
            >
              Yearly
              <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded">
                Save 17%
              </span>
            </button>
          </div>

          {/* Yearly Tooltip */}
          <AnimatePresence>
            {showYearlyTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="max-w-md mx-auto text-sm text-gray-500"
              >
                Save 17% with yearly billing. Pay annually and get better value.
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {tiers.map((tier, index) => {
            const config = TIER_CONFIGS[tier];
            const price = isYearly && tier !== SubscriptionTier.FREE
              ? TIER_CONFIGS[tier === SubscriptionTier.STUDIO ? tier : SubscriptionTier.PRO_YEARLY].price
              : config.price;
            const billingPeriod = isYearly && tier !== SubscriptionTier.FREE ? 'year' : 'month';
            const features = getFeaturesForTier(tier);
            const isPopular = tier === SubscriptionTier.PRO_MONTHLY;

            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  rounded-2xl p-8 border-2 relative
                  ${isPopular
                    ? 'border-yellow-500 bg-gradient-to-b from-yellow-500/10 to-[#161b22]'
                    : tier === SubscriptionTier.FREE
                      ? 'border-gray-700 bg-[#161b22]'
                      : 'border-purple-500 bg-gradient-to-b from-purple-500/10 to-[#161b22]'
                  }
                `}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 rounded-full text-sm font-bold">
                    MOST POPULAR
                  </div>
                )}

                {/* Popular Icon (Studio) */}
                {tier === SubscriptionTier.STUDIO && !isPopular && (
                  <div className="absolute -top-4 right-4 bg-purple-500 text-white p-2 rounded-full">
                    <Crown size={16} />
                  </div>
                )}

                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    {tier === SubscriptionTier.STUDIO && <Crown className="text-purple-500" size={20} />}
                    {isPopular && <Zap className="text-yellow-500" size={20} />}
                    <h2 className="text-2xl font-bold">{config.name}</h2>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black">
                      ${price}
                    </span>
                    <span className="text-gray-400">
                      /{billingPeriod === 'month' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {tier !== SubscriptionTier.FREE && (
                    <p className="text-gray-400 text-sm mt-1">
                      {isYearly && tier === SubscriptionTier.PRO_MONTHLY && (
                        <span>Billed annually (${TIER_CONFIGS[SubscriptionTier.PRO_MONTHLY].price * 12} total) </span>
                      )}
                      {isYearly && tier === SubscriptionTier.STUDIO && (
                        <span>Billed annually (${TIER_CONFIGS[SubscriptionTier.STUDIO].price * 12} total) </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Quotas */}
                <div className="mb-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Images:</span>
                    <span className="text-white font-medium">
                      {config.imageGenerations.monthly}/month
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Video:</span>
                    <span className="text-white font-medium">
                      {config.videoGenerations.totalDurationMinutes} min/month
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Storage:</span>
                    <span className="text-white font-medium">
                      {config.storage.totalGB}GB
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`flex-shrink-0 mt-0.5 ${feature.important ? 'text-purple-500' : 'text-green-500'
                          }`}
                        size={16}
                      />
                      <span className={feature.important ? 'text-white font-medium' : 'text-gray-300'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {currentTier === tier ? (
                  <button
                    onClick={handleManageSubscription}
                    className="w-full py-3 rounded-lg border border-gray-600 text-white font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
                  >
                    Manage Subscription
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={subscribing !== null}
                    className={`
                      w-full py-3 rounded-lg font-bold transition flex items-center justify-center gap-2
                      ${isPopular
                        ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                        : tier === SubscriptionTier.FREE
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-purple-500 text-white hover:bg-purple-400'
                      }
                      ${subscribing === tier ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {subscribing === tier ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Processing...
                      </>
                    ) : (
                      <>
                        {tier === SubscriptionTier.FREE ? 'Current Plan' : 'Get Started'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <FAQItem key={index} {...faq} />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-800/50 transition"
      >
        <span className="font-medium">{question}</span>
        {isOpen ? (
          <X size={20} className="text-gray-400" />
        ) : (
          <ArrowRight size={20} className="text-gray-400 rotate-90" />
        )}
      </button>
      {isOpen && (
        <div className="px-6 py-4 border-t border-gray-700 text-gray-400">
          {answer}
        </div>
      )}
    </div>
  );
};

const faqData: FAQItemProps[] = [
  {
    question: 'Can I change my plan later?',
    answer: 'Yes! You can upgrade, downgrade, or cancel your subscription at any time from your customer portal. Changes take effect at the next billing cycle.'
  },
  {
    question: 'What happens if I exceed my quota?',
    answer: 'You will be notified as you approach your limits. You can upgrade your plan to get more quota, or your usage will reset at the beginning of the next billing period.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'All tiers start with our generous free tier. You can explore all features with limited quotas before deciding to upgrade to Pro.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit and debit cards through Stripe. Enterprise customers can also pay via invoice.'
  },
  {
    question: 'Can I use indiiOS offline?',
    answer: 'The Web tiers require an internet connection. For offline capabilities, check out our indiiOS Studio Desktop tier with local computing power.'
  },
  {
    question: 'Is there a student discount?',
    answer: 'Yes! Students get 50% off Pro tier with valid student ID. Contact support for verification.'
  },
];

export default PricingPage;
