'use client';

import React from 'react';
import { getStudioUrl } from '../../lib/auth';

interface WaitlistSectionProps {
  email: string;
  status: 'idle' | 'loading' | 'sent' | 'success' | 'error';
  message: string;
  majorMilestoneUpdates: boolean;
  preferenceMode?: boolean;
  onChange: (email: string) => void;
  onMilestoneUpdatesChange: (enabled: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export default function WaitlistSection({
  email,
  status,
  message,
  majorMilestoneUpdates,
  preferenceMode = false,
  onChange,
  onMilestoneUpdatesChange,
  onSubmit,
}: WaitlistSectionProps) {
  return (
    <section
      id="waitlist"
      data-system-section="waitlist"
      className="relative z-20 scroll-mt-[104px] border-y border-amber-400/40 bg-gradient-to-r from-[#100D09] via-[#1A140F] to-[#100D09] shadow-[0_0_60px_rgba(255,184,0,0.18)]"
      aria-labelledby="waitlist-title"
    >
      <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,184,0,0.15),rgba(0,188,212,0.06)_50%,transparent_75%)]" />
      <div className="relative mx-auto grid max-w-[1500px] gap-8 px-5 py-12 md:grid-cols-[0.48fr_1fr_0.36fr] md:items-center md:px-10 md:py-14">
        <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.23em] text-[#FFB800] [text-shadow:0_0_12px_rgba(255,184,0,0.6)]">
          <span className="h-2 w-2 rounded-full bg-[#FFB800] shadow-[0_0_15px_rgba(255,184,0,0.9)]" />
          {preferenceMode ? 'Email preferences' : 'Waitlist open'}
        </div>
        <div>
          <h2
            id="waitlist-title"
            className="text-3xl font-black tracking-[-0.045em] text-white md:text-4xl"
          >
            {preferenceMode ? 'Manage Founding Artist email preferences.' : 'Join the Founding Artist Beta waitlist.'}
          </h2>
          {preferenceMode ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
              Verify the email used for your waitlist account, then choose whether to receive major development milestones. Beta invitation emails remain part
              of the waitlist.
            </p>
          ) : (
            <div className="mt-3 max-w-2xl space-y-2 text-sm leading-relaxed text-white/70 md:text-base">
              <p>
                Create a free account with a verified email. You will join the beta waitlist and get access to a guided creative experience built around your
                own finished music.
              </p>
              <p>
                Beta invitations are sent first come, first served. We will also let you know when meaningful product milestones arrive and give you
                early-pricing priority.
              </p>
            </div>
          )}
        </div>
        <div className="md:text-right">
          <form onSubmit={onSubmit} className="flex w-full flex-col gap-3 md:items-end">
            <div className="flex w-full flex-col gap-3 sm:flex-row md:justify-end">
              <label htmlFor="waitlist-email" className="sr-only">
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                placeholder="Enter your email"
                required
                value={email}
                onChange={(e) => onChange(e.target.value)}
                disabled={status === 'loading' || status === 'success'}
                className="w-full rounded-lg border border-amber-400/40 bg-black/70 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none backdrop-blur-md transition-all focus:border-[#FFB800] focus:bg-black/90 focus:shadow-[0_0_20px_rgba(255,184,0,0.4)] sm:max-w-[240px]"
              />
              <button
                type="submit"
                disabled={status === 'loading' || status === 'success'}
                className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-6 py-2.5 text-sm font-black text-black shadow-[0_0_28px_rgba(255,184,0,0.45)] transition-all hover:scale-[1.02] hover:shadow-[0_0_38px_rgba(255,184,0,0.7)] disabled:opacity-50"
              >
                {status === 'loading'
                  ? 'Verifying...'
                  : status === 'sent'
                    ? 'Resend verification'
                    : status === 'success'
                      ? preferenceMode ? 'Updated' : 'Account verified'
                      : preferenceMode ? 'Verify & update' : 'Create free account'}
              </button>
            </div>
            <label className="flex max-w-[380px] items-start gap-2 text-left text-[11px] leading-relaxed text-white/45 md:text-right">
              <input
                type="checkbox"
                checked={majorMilestoneUpdates}
                onChange={(event) => onMilestoneUpdatesChange(event.target.checked)}
                disabled={status === 'loading' || status === 'success'}
                className="mt-0.5 accent-amber-400"
              />
              <span>The beta invitation is part of joining. Also email me major development milestones. I can unsubscribe from updates.</span>
            </label>
          </form>
          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-3 text-xs ${status === 'success' || status === 'sent' ? 'text-amber-400' : status === 'error' ? 'text-red-400' : 'text-white/55'}`}
            >
              {message}
            </p>
          )}
          <a
            href={getStudioUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-white/60 transition-colors hover:text-white"
          >
            Log in
          </a>
        </div>
      </div>
    </section>
  );
}
