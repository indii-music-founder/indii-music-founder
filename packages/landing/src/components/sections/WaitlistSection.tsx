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
      className="relative z-20 scroll-mt-[104px] border-y border-amber-400/20 bg-[#080602]"
      aria-labelledby="waitlist-title"
    >
      <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 md:grid-cols-[0.48fr_1fr_0.36fr] md:items-center md:px-10 md:py-14">
        <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.23em] text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.8)]" />
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
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45 md:text-base">
              Verify the email used for your waitlist account, then choose whether to receive major development milestones. Beta invitation emails remain part
              of the waitlist.
            </p>
          ) : (
            <div className="mt-3 max-w-2xl space-y-2 text-sm leading-relaxed text-white/45 md:text-base">
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
                className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-amber-400 focus:bg-white/10 sm:max-w-[240px]"
              />
              <button
                type="submit"
                disabled={status === 'loading' || status === 'success'}
                className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-amber-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-amber-300 disabled:opacity-50 disabled:hover:bg-amber-400"
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
