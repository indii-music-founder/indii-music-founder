import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-gray-400 mb-6">Last updated: April 2026</p>

      <p className="text-gray-300 leading-relaxed mb-8">
        New Detroit Music LLC ("Company," "we," "our," or "us") is committed to protecting your privacy.
        This Privacy Policy explains how we collect, use, disclose, and safeguard your information
        when you use our website, applications, and services (collectively, the "Service").
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
        <div className="text-gray-300 leading-relaxed space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">Information You Provide</h3>
            <p>
              We collect information you voluntarily provide, including:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Account credentials (name, email, password)</li>
              <li>Profile information (bio, profile picture, preferences)</li>
              <li>Creative content (images, videos, audio, music tracks)</li>
              <li>Payment and billing information (processed securely)</li>
              <li>Communications with our support team</li>
              <li>User-generated metadata and analytics</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">Information Collected Automatically</h3>
            <p>
              When you use our Service, we automatically collect:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Device information (hardware model, OS, browser type)</li>
              <li>Usage data (features accessed, time spent, interactions)</li>
              <li>IP address and approximate location</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Performance and error logs</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          We use collected information for:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>Providing and improving the Service</li>
          <li>Processing transactions and sending transactional communications</li>
          <li>Personalizing your experience and recommendations</li>
          <li>Sending marketing communications (with your consent)</li>
          <li>Detecting and preventing fraud and abuse</li>
          <li>Complying with legal obligations</li>
          <li>Conducting research and analytics</li>
          <li>Responding to your inquiries and support requests</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. Data Sharing</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          We do not sell your personal data. We may share information with:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>Service providers (payment processors, analytics, hosting)</li>
          <li>Collaborators and artists (if you choose to share)</li>
          <li>Law enforcement or when legally required</li>
          <li>Business partners in case of merger or acquisition</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
        <p className="text-gray-300 leading-relaxed">
          We implement industry-standard security measures including encryption, access controls,
          and regular security audits. However, no method of transmission over the internet is
          100% secure. We encourage you to use strong passwords and enable two-factor authentication.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
        <p className="text-gray-300 leading-relaxed mb-3">
          Depending on your location, you may have rights to:
        </p>
        <ul className="list-disc list-inside ml-4 text-gray-300 leading-relaxed space-y-2">
          <li>Access your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data (right to be forgotten)</li>
          <li>Opt-out of marketing communications</li>
          <li>Receive a copy of your data in a portable format</li>
          <li>Lodge complaints with data protection authorities</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking</h2>
        <p className="text-gray-300 leading-relaxed">
          We use cookies and similar technologies to enhance your experience, remember preferences,
          and analyze usage patterns. You can control cookie preferences in your browser settings.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">7. Retention</h2>
        <p className="text-gray-300 leading-relaxed">
          We retain personal data for as long as necessary to provide the Service and fulfill
          the purposes outlined in this policy. You can request deletion at any time.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">8. Third-Party Links</h2>
        <p className="text-gray-300 leading-relaxed">
          The Service may contain links to third-party sites. We are not responsible for the
          privacy practices of external websites. Please review their privacy policies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
        <p className="text-gray-300 leading-relaxed">
          The Service is not intended for children under 13. We do not knowingly collect personal
          data from children. If we discover we have collected data from a child, we will delete it.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
        <p className="text-gray-300 leading-relaxed">
          Your information may be transferred to countries other than your country of residence.
          By using the Service, you consent to such transfers.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
        <p className="text-gray-300 leading-relaxed">
          We may update this Privacy Policy periodically. We will notify you of material changes
          via email or by posting the updated policy on our website.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
        <p className="text-gray-300 leading-relaxed">
          For privacy inquiries or to exercise your rights, contact us at:
        </p>
        <div className="text-gray-300 mt-4 space-y-2">
          <p>
            Email:{' '}
            <a href="mailto:privacy@indiios.com" className="text-purple-400 hover:text-purple-300">
              privacy@indiios.com
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
