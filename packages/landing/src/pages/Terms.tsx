import React from 'react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-gray-400 mb-4">Last updated: January 2025</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Acceptance of Terms</h2>
        <p className="text-gray-300 leading-relaxed">
          By accessing or using indiiOS, you agree to be bound by these Terms of Service
          and all applicable laws and regulations.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Use of Service</h2>
        <p className="text-gray-300 leading-relaxed">
          You may use our service only for lawful purposes and in accordance with these Terms.
          You agree not to use the service in any way that violates applicable laws or regulations.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Intellectual Property</h2>
        <p className="text-gray-300 leading-relaxed">
          The service and its original content, features, and functionality are owned by IndiiOS LLC
          and are protected by international copyright, trademark, and other intellectual property laws.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Termination</h2>
        <p className="text-gray-300 leading-relaxed">
          We may terminate or suspend your account and access to the service immediately, without
          prior notice or liability, for any reason.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
        <p className="text-gray-300 leading-relaxed">
          If you have any questions about these Terms, please contact us at{' '}
          <a href="mailto:legal@indiios.com" className="text-purple-400 hover:text-purple-300">
            legal@indiios.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
