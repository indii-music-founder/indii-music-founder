'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { useAuth } from '@/components/auth/AuthProvider';
import { getStudioUrl } from '@/lib/auth';

interface FoundersMeta {
  count: number;
  founders: Array<{ seat: number; name: string; joinedAt: string }>;
}

const MAX_SEATS = 10;
const FOUNDER_PRICE = 2500;

export default function FoundersSection() {
  const { user, loading: authLoading } = useAuth();
  const [meta, setMeta] = useState<FoundersMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaError, setMetaError] = useState(false);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const db = getFirestore(getApp());
        const metaDoc = await getDoc(doc(db, 'founders_meta', 'summary'));
        if (metaDoc.exists()) {
          setMeta(metaDoc.data() as FoundersMeta);
        } else {
          // Document doesn't exist yet — program hasn't started, default to 0
          setMeta({ count: 0, founders: [] });
        }
      } catch (err) {
        console.error('[FoundersSection] Failed to fetch founders meta:', err);
        setMetaError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchMeta();
  }, []);

  const seatsRemaining = meta ? MAX_SEATS - meta.count : 0;
  const programOpen = !metaError && meta !== null && seatsRemaining > 0;
  const ctaReady = !loading && !authLoading && !metaError && meta !== null;

  const handleBecomeFounder = () => {
    // Don't act until both auth and meta have resolved
    if (!ctaReady) return;
    // Redirect to studio to complete checkout (user must be signed in)
    const target = user
      ? `${getStudioUrl()}/founders-checkout`
      : `${getStudioUrl()}/signup?intent=founder`;
    window.location.href = target;
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-[3rem] overflow-hidden border border-white/10 bg-gradient-to-br from-amber-950/30 via-black to-purple-950/30 p-12 md:p-16"
      >
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-amber-500/5 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Founding Seats
          </motion.div>

          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4">
            10 Founders.<br />
            <span className="text-amber-400">Lifetime Access.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            The first 10 people who believe in what we&apos;re building get in forever.
            Your name goes into the code. Your deal is encoded as cryptographic proof.
            No subscriptions. No renewal. Just access — for the life of the software.
          </p>
        </div>

        {/* Seat counter */}
        <div className="flex justify-center mb-12">
          <div className="flex gap-2">
            {Array.from({ length: MAX_SEATS }).map((_, i) => {
              const taken = meta ? i < meta.count : false;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i }}
                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                    taken
                      ? 'bg-amber-500 border-amber-400 text-black'
                      : 'bg-white/5 border-white/20 text-gray-600'
                  }`}
                >
                  {taken ? '✓' : i + 1}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Existing founders list */}
        {meta && meta.founders.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {meta.founders.map((f) => (
              <div
                key={f.seat}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium"
              >
                <span className="text-amber-500 font-mono text-xs">#{f.seat}</span>
                {f.name}
              </div>
            ))}
          </div>
        )}

        {/* Covenant terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {[
            {
              icon: '∞',
              title: 'Lifetime Access',
              desc: 'Every feature, current and future, for the life of the software. No subscription. Ever.',
            },
            {
              icon: '#',
              title: 'Name In The Code',
              desc: 'Your name is committed to the git repository and stays there permanently. Cryptographic proof included.',
            },
            {
              icon: '$',
              title: 'API Costs At Cost',
              desc: 'AI generation costs (Gemini, Vertex) are passed through at zero markup — just what Google charges.',
            },
            {
              icon: '⌗',
              title: 'Covenant Hash',
              desc: 'Your payment generates a SHA-256 hash of your deal terms. Verify it any time. The math doesn\'t lie.',
            },
            {
              icon: '10',
              title: '10 Seats. Final.',
              desc: 'No exceptions. No 11th founder. The seats encoded in the codebase are the cap.',
            },
            {
              icon: '◎',
              title: 'Priority Everything',
              desc: 'Direct line to the team. Your feedback shapes the roadmap. You built this with us.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/30 transition-colors"
            >
              <div className="text-2xl font-black text-amber-400 mb-2 font-mono">{item.icon}</div>
              <div className="text-white font-semibold mb-1">{item.title}</div>
              <div className="text-gray-400 text-sm leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          {loading || authLoading ? (
            <div className="inline-block w-64 h-16 rounded-2xl bg-white/5 animate-pulse" />
          ) : metaError ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 font-mono text-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Unable to confirm seat availability. Please try again later.
              </div>
            </div>
          ) : programOpen ? (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleBecomeFounder}
                disabled={!ctaReady}
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-amber-500 hover:bg-amber-400 text-black font-black text-lg rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] shadow-[0_0_60px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Become Founder #{(meta?.count ?? 0) + 1}
                <span className="text-black/60 font-normal text-base">
                  — ${FOUNDER_PRICE.toLocaleString()} one-time
                </span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
              <p className="text-gray-500 text-sm font-mono">
                {seatsRemaining} of {MAX_SEATS} seats remaining
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 font-mono text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                All 10 founding seats have been claimed.
              </div>
              <p className="text-gray-600 text-xs mt-3">
                The founders program is closed. Check out our{' '}
                <a href={`${getStudioUrl()}/signup`} className="text-purple-400 hover:text-purple-300">
                  Pro and Studio plans
                </a>{' '}
                for full access.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
