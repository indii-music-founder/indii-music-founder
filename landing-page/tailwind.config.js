/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'void': '#030303',
        'true-black': '#000000', // OLED Optimization
        'resonance-blue': '#2E2EFE',
        'electric-blue': '#00F0FF', // 2026 Trend: High Saturation
        'frequency-pink': '#FE2E9A',
        'dopamine-pink': '#FF0099', // 2026 Trend: Dopamine Color
        'signal-white': '#F0F0F0',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
        hand: ['cursive'], // Fallback for "Human Scribble" trend until a specific font is loaded
      },
      animation: {
        'pulse-slow': 'pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'throb-light': 'throb-light 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

