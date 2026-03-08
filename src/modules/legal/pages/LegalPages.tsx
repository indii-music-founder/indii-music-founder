import { Scale, FileText, Shield, Mail, ExternalLink } from 'lucide-react';

/**
 * Items 308, 309: Legal Pages (Attorney-Review Scaffolds)
 *
 * These pages contain placeholder content that MUST be reviewed and finalized
 * by a qualified attorney before the app goes live. They are structured with
 * all required sections for GDPR, CCPA, COPPA, and DMCA compliance.
 */

// ============================================================================
// Terms of Service
// ============================================================================

export function TermsOfService() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12 text-gray-300">
            <div className="flex items-center gap-3 mb-8">
                <Scale className="w-8 h-8 text-purple-400" />
                <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
            </div>
            <p className="text-xs text-gray-500 mb-8 font-mono">
                Last updated: March 2026 · Effective date: [DATE_TBD]
            </p>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8">
                <p className="text-sm text-amber-300 font-medium">
                    ⚠️ Draft — This document requires attorney review before publication.
                </p>
            </div>

            <div className="space-y-8 text-sm leading-relaxed">
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using the indiiOS platform ("Service"), you agree to be bound by these
                        Terms of Service ("Terms"). If you disagree with any part of the terms, you may not
                        access the Service.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
                    <p>
                        indiiOS is a multi-tenant creative platform providing AI-powered tools for music production,
                        image generation, video production, distribution, and business operations for independent
                        artists, producers, and creators.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
                    <p>You are responsible for maintaining the confidentiality of your account credentials
                        and for all activities under your account. You must be at least 13 years old to
                        create an account (per COPPA). Users between 13–17 must have parental consent.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">4. Intellectual Property</h2>
                    <p>[ATTORNEY_REVIEW_REQUIRED] Define ownership of user-generated content, AI-generated
                        assets, and platform IP. Clarify that users retain ownership of their original music
                        and creative works uploaded to the platform.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">5. AI-Generated Content</h2>
                    <p>[ATTORNEY_REVIEW_REQUIRED] Define the usage rights for AI-generated images, videos,
                        and text created through the platform's Gemini-powered tools. Address copyright
                        implications per current US Copyright Office guidance.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">6. Subscription & Billing</h2>
                    <p>Subscriptions are billed via Stripe. Plans include Free, Pro, and Label tiers.
                        Cancellation takes effect at the end of the current billing period. Refunds
                        are available within 14 days of initial purchase.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">7. Distribution Services</h2>
                    <p>[ATTORNEY_REVIEW_REQUIRED] Define terms for music distribution to DSPs (Spotify,
                        Apple Music, etc.) including takedown procedures, exclusivity terms, and
                        split sheet enforceability.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">8. Prohibited Conduct</h2>
                    <p>Users must not upload copyrighted material they don't own or have license for,
                        engage in prompt injection attacks against AI systems, or use the platform for
                        illegal purposes.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
                    <p>[ATTORNEY_REVIEW_REQUIRED] Standard limitation of liability clause. Indemnification
                        for distribution errors, AI output inaccuracies, and payment processing issues.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">10. Governing Law</h2>
                    <p>[ATTORNEY_REVIEW_REQUIRED] Jurisdiction and governing law (e.g., State of Michigan).
                        Dispute resolution mechanism (arbitration vs. litigation).</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
                    <p>For questions about these Terms, contact us at <a href="mailto:legal@indiios.com" className="text-purple-400 hover:underline">legal@indiios.com</a>.</p>
                </section>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-700/50 text-xs text-gray-500">
                © 2026 IndiiOS LLC. All rights reserved.
            </div>
        </div>
    );
}

// ============================================================================
// Privacy Policy
// ============================================================================

export function PrivacyPolicy() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12 text-gray-300">
            <div className="flex items-center gap-3 mb-8">
                <Shield className="w-8 h-8 text-purple-400" />
                <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
            </div>
            <p className="text-xs text-gray-500 mb-8 font-mono">
                Last updated: March 2026 · Effective date: [DATE_TBD]
            </p>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8">
                <p className="text-sm text-amber-300 font-medium">
                    ⚠️ Draft — This document requires attorney review before publication.
                </p>
            </div>

            <div className="space-y-8 text-sm leading-relaxed">
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                    <h3 className="text-base font-medium text-gray-200 mb-2">Personal Information</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                        <li>Email address and display name (via Firebase Authentication)</li>
                        <li>Date of birth (for COPPA age verification — not shared with third parties)</li>
                        <li>Payment information (processed by Stripe — we do not store card numbers)</li>
                        <li>Profile preferences and settings</li>
                    </ul>

                    <h3 className="text-base font-medium text-gray-200 mb-2 mt-4">Usage Data</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                        <li>Error reports (via Sentry — only with user consent)</li>
                        <li>Feature usage analytics (via Firebase Analytics — only with user consent)</li>
                        <li>Session duration and interaction patterns</li>
                    </ul>

                    <h3 className="text-base font-medium text-gray-200 mb-2 mt-4">User Content</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                        <li>Music files, images, and videos uploaded by users</li>
                        <li>AI-generated assets created through the platform</li>
                        <li>Release metadata and distribution information</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
                    <p>We use collected information to provide and improve the Service, process payments,
                        distribute music to DSPs, and communicate with you about your account.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">3. GDPR Rights (EU/EEA Users)</h2>
                    <p>Under GDPR, you have the right to:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400 mt-2">
                        <li><strong>Access</strong> — Request a copy of your personal data</li>
                        <li><strong>Rectification</strong> — Request correction of inaccurate data</li>
                        <li><strong>Erasure</strong> — Request deletion of your data (Article 17)</li>
                        <li><strong>Portability</strong> — Export your data in a machine-readable format (Article 20)</li>
                        <li><strong>Object</strong> — Object to processing for direct marketing</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">4. CCPA Rights (California Residents)</h2>
                    <p>California residents have the right to:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400 mt-2">
                        <li>Know what personal information is collected and how it is used</li>
                        <li>Request deletion of personal information</li>
                        <li>Opt-out of the sale or sharing of personal information</li>
                        <li>Non-discrimination for exercising privacy rights</li>
                    </ul>
                    <p className="mt-2">To opt out, visit Settings → Privacy → "Do Not Sell My Data".</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">5. Cookies & Tracking</h2>
                    <p>We use cookies for essential functionality (authentication, session persistence).
                        Non-essential cookies (analytics, error tracking) require explicit consent via
                        our cookie consent banner.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
                    <p>[ATTORNEY_REVIEW_REQUIRED] Define data retention periods for user accounts,
                        uploaded content, analytics data, and legal documents (split sheets, contracts).</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">7. Third-Party Services</h2>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                        <li>Firebase (Google) — Authentication, database, storage, hosting</li>
                        <li>Stripe — Payment processing</li>
                        <li>Sentry — Error tracking (consent-gated)</li>
                        <li>Google Gemini — AI content generation</li>
                        <li>DSP APIs — Music distribution (Spotify, Apple Music, etc.)</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
                    <p>Data Protection Officer: <a href="mailto:privacy@indiios.com" className="text-purple-400 hover:underline">privacy@indiios.com</a></p>
                </section>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-700/50 text-xs text-gray-500">
                © 2026 IndiiOS LLC. All rights reserved.
            </div>
        </div>
    );
}

// ============================================================================
// DMCA Policy
// ============================================================================

export function DMCAPolicy() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12 text-gray-300">
            <div className="flex items-center gap-3 mb-8">
                <FileText className="w-8 h-8 text-purple-400" />
                <h1 className="text-3xl font-bold text-white">DMCA Policy</h1>
            </div>
            <p className="text-xs text-gray-500 mb-8 font-mono">
                Last updated: March 2026
            </p>

            <div className="space-y-8 text-sm leading-relaxed">
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">Designated DMCA Agent</h2>
                    <p>
                        In accordance with the Digital Millennium Copyright Act (17 U.S.C. § 512(c)(2)),
                        we have designated the following agent to receive notifications of claimed
                        copyright infringement:
                    </p>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mt-4 space-y-2">
                        <p><strong className="text-white">Name:</strong> [DESIGNATED_AGENT_NAME]</p>
                        <p><strong className="text-white">Organization:</strong> IndiiOS LLC</p>
                        <p><strong className="text-white">Address:</strong> [REGISTERED_ADDRESS]</p>
                        <p><strong className="text-white">Email:</strong> <a href="mailto:dmca@indiios.com" className="text-purple-400 hover:underline">dmca@indiios.com</a></p>
                        <p><strong className="text-white">Phone:</strong> [PHONE_NUMBER]</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">Filing a DMCA Takedown Notice</h2>
                    <p>To file a DMCA takedown notice, provide the following information in writing:</p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-400 mt-3">
                        <li>A physical or electronic signature of the copyright owner or authorized agent.</li>
                        <li>Identification of the copyrighted work claimed to have been infringed.</li>
                        <li>Identification of the material to be removed with sufficient information to locate it.</li>
                        <li>Your contact information (address, phone number, email).</li>
                        <li>A statement of good faith belief that use of the material is not authorized.</li>
                        <li>A statement under penalty of perjury that the information is accurate and you are authorized to act on behalf of the copyright owner.</li>
                    </ol>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">Counter-Notification</h2>
                    <p>If you believe your content was removed in error, you may file a counter-notification
                        with the information specified under 17 U.S.C. § 512(g)(3). Counter-notifications
                        should be sent to the designated agent listed above.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">Repeat Infringers</h2>
                    <p>indiiOS will terminate the accounts of users who are repeat copyright infringers,
                        in accordance with 17 U.S.C. § 512(i).</p>
                </section>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-700/50 text-xs text-gray-500">
                © 2026 IndiiOS LLC. All rights reserved.
            </div>
        </div>
    );
}
