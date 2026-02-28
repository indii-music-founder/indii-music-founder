import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-gray-400 mb-4">Last updated: January 2025</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
        <p className="text-gray-300 leading-relaxed">
          We collect information you provide directly to us, such as when you create an account,
          upload content, or contact us for support.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
        <p className="text-gray-300 leading-relaxed">
          We use the information we collect to provide, maintain, and improve our services,
          process transactions, and communicate with you.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
        <p className="text-gray-300 leading-relaxed">
          We take reasonable measures to help protect information about you from loss, theft,
          misuse, and unauthorized access.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
        <p className="text-gray-300 leading-relaxed">
          If you have any questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:privacy@indiios.com" className="text-purple-400 hover:text-purple-300">
            privacy@indiios.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
