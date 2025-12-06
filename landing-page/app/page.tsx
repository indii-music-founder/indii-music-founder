'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Music,
  Shield,
  Zap,
  Users,
  TrendingUp,
  Sparkles,
  Play,
  ArrowRight,
  Menu,
  X
} from 'lucide-react';

const features = [
  {
    icon: Music,
    title: 'Smart Audio Analysis',
    description: 'AI-powered analysis turns your music into actionable insights. Understand your sound like never before.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  {
    icon: Sparkles,
    title: 'AI Creative Assistant',
    description: 'Meet Indii - your AI assistant that handles the business tasks so you can focus on creating.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  {
    icon: TrendingUp,
    title: 'Career Strategy',
    description: 'Data-driven insights to grow your fanbase and income. Make decisions backed by real analytics.',
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
  },
  {
    icon: Shield,
    title: 'Rights Protection',
    description: 'Secure your IP and get paid for your work. Never miss a royalty payment again.',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  {
    icon: Users,
    title: 'Direct to Fan',
    description: 'Sell merch, tickets, and vinyl directly to your audience. No middlemen, higher margins.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
  },
  {
    icon: Zap,
    title: 'Workflow Automation',
    description: 'Automate repetitive tasks with AI-powered workflows. Scale your operation effortlessly.',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="text-2xl font-bold tracking-tight">
              indiiOS
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/teaser" className="text-sm text-white/60 hover:text-white transition-colors">
                Experience
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-white/80 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-black/95 border-b border-white/5"
          >
            <div className="px-4 py-4 space-y-4">
              <Link href="#features" className="block text-white/60 hover:text-white">
                Features
              </Link>
              <Link href="#pricing" className="block text-white/60 hover:text-white">
                Pricing
              </Link>
              <Link href="/teaser" className="block text-white/60 hover:text-white">
                Experience
              </Link>
              <div className="pt-4 border-t border-white/10 space-y-3">
                <Link
                  href="/login"
                  className="block text-center py-2 text-white/80"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="block text-center py-2 bg-white text-black font-medium rounded-lg"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Now in Alpha
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
              Your Music.
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Your Rules.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto mb-12">
              The AI-native operating system for independent artists.
              Create, protect, and profit from your music.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="group flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-all hover:scale-105"
              >
                Launch Studio
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/teaser"
                className="group flex items-center gap-2 px-8 py-4 bg-white/5 text-white border border-white/10 rounded-lg hover:bg-white/10 transition-all"
              >
                <Play size={20} />
                Watch Experience
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white/40 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Everything You Need
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              A complete toolkit for modern independent artists.
              Powered by AI, designed for creators.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all"
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bgColor} mb-6`}>
                  <feature.icon className={feature.color} size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative p-12 md:p-16 rounded-3xl bg-gradient-to-br from-purple-900/40 via-black to-cyan-900/40 border border-white/10 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />

            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Ready to Build Your Empire?
              </h2>
              <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
                Join the next generation of independent artists taking control of their careers.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-10 py-5 bg-white text-black font-bold text-lg rounded-lg hover:bg-white/90 transition-all hover:scale-105"
              >
                Get Started Free
                <ArrowRight size={24} />
              </Link>
              <p className="text-white/40 mt-6 text-sm">
                No credit card required
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-4">indiiOS</h3>
              <p className="text-white/60 max-w-sm mb-6">
                The operating system for your independence.
                Built by artists, for artists.
              </p>
              <Link
                href="/teaser"
                className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                <Sparkles size={14} />
                Explore the immersive experience
              </Link>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-white/60">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Studio</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-3 text-white/60">
                <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              &copy; 2025 indiiOS. All rights reserved.
            </p>
            <p className="text-white/20 text-xs">
              v1.0.0 (Alpha)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
