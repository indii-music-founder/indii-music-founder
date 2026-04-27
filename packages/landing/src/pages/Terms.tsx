import React from 'react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-gray-400 mb-6">Last updated: April 2026</p>

      <p className="text-gray-300 leading-relaxed mb-8">
        These Terms of Service ("Terms") are a binding agreement between you and New Detroit Music LLC ("Company").
        By accessing or using indiiOS, you agree to be bound by these Terms. If you do not agree, do not use the Service.
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
        <p className="text-gray-300 leading-relaxed">
          By using the Service, you represent that you are at least 13 years old and have the legal capacity
          to enter into this agreement. If you are accessing the Service on behalf of an organization, you
          represent that you are authorized to bind that organization to these Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          We grant you a limited, non-exclusive, non-transferable license to:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>Access and use the Service for lawful purposes</li>
          <li>Create, upload, and distribute your creative content</li>
          <li>Collaborate with other artists on the platform</li>
          <li>Use AI-powered tools to generate content</li>
        </ul>
        <p className="text-gray-300 leading-relaxed mt-4">
          This license is subject to the restrictions in these Terms and our Acceptable Use Policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          You agree not to:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>Violate any laws, regulations, or third-party rights</li>
          <li>Upload content that is illegal, defamatory, or infringes intellectual property</li>
          <li>Engage in harassment, abuse, or discrimination</li>
          <li>Attempt to gain unauthorized access to the Service</li>
          <li>Reverse engineer, decompile, or disassemble the Service</li>
          <li>Transmit malware, viruses, or malicious code</li>
          <li>Scrape, crawl, or automated access without permission</li>
          <li>Impersonate another user or entity</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Intellectual Property Rights</h2>
        <div className="text-gray-300 leading-relaxed space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">Our Content</h3>
            <p>
              The Service and its original content, features, and functionality are owned by New Detroit Music LLC
              and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">Your Content</h3>
            <p>
              You retain all rights to content you create and upload. By uploading content, you grant us
              a license to use, store, display, and distribute your content as necessary to operate the Service.
              You represent and warrant that your content does not infringe any third-party rights.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">AI-Generated Content</h3>
            <p>
              Content generated using our AI tools is owned by you. You may use it for commercial or
              personal purposes, subject to applicable laws and our terms regarding global distribution.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Subscriptions and Billing</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          If you subscribe to a paid plan:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>Subscription renews automatically unless canceled</li>
          <li>You can cancel anytime through your account settings</li>
          <li>No refunds for partial months, except as required by law</li>
          <li>We may change pricing with 30 days notice</li>
          <li>Billing information must be accurate and current</li>
          <li>We may suspend service for non-payment</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Limitation of Liability</h2>
        <p className="text-gray-300 leading-relaxed">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, INDIIOS LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES,
          AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE
          POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID IN THE
          PAST 12 MONTHS.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">7. Disclaimer of Warranties</h2>
        <p className="text-gray-300 leading-relaxed">
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
          WE DISCLAIM ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">8. Indemnification</h2>
        <p className="text-gray-300 leading-relaxed">
          You agree to indemnify and hold harmless New Detroit Music LLC from any claims, damages, losses, or expenses
          arising from your use of the Service, violation of these Terms, or infringement of third-party rights.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          We may terminate or suspend your account:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>For violation of these Terms</li>
          <li>For non-payment of subscription fees</li>
          <li>At our discretion with 30 days notice</li>
          <li>Immediately for abuse, illegal activity, or threats</li>
        </ul>
        <p className="text-gray-300 leading-relaxed mt-4">
          Upon termination, your right to use the Service ceases immediately.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">10. Modification of Terms</h2>
        <p className="text-gray-300 leading-relaxed">
          We may modify these Terms at any time. Material changes will be notified via email or by posting
          a prominent notice on the Service. Continued use constitutes acceptance of modified Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
        <p className="text-gray-300 leading-relaxed">
          These Terms are governed by and construed in accordance with the laws of the United States,
          without regard to its conflict of law principles.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">12. Dispute Resolution</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          Any dispute arising under these Terms shall be:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>First subject to informal negotiation</li>
          <li>Then binding arbitration if negotiation fails</li>
          <li>Resolved under the rules of the American Arbitration Association</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">13. Severability</h2>
        <p className="text-gray-300 leading-relaxed">
          If any provision of these Terms is found to be unenforceable, that provision shall be severed,
          and the remaining provisions shall remain in full force and effect.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">14. Entire Agreement</h2>
        <p className="text-gray-300 leading-relaxed">
          These Terms, along with our Privacy Policy and any other policies referenced herein, constitute
          the entire agreement between you and New Detroit Music LLC and supersede all prior agreements.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
        <p className="text-gray-300 leading-relaxed">
          For questions about these Terms, contact us at:
        </p>
        <div className="text-gray-300 mt-4 space-y-2">
          <p>
            Email:{' '}
            <a href="mailto:legal@indiios.com" className="text-purple-400 hover:text-purple-300">
              legal@indiios.com
            </a>
          </p>
          <p>
            Address: New Detroit Music LLC, United States
          </p>
        </div>
      </section>
    </div>
  );
}
