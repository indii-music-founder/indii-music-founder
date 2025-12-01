/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                special: ['Permanent Marker', 'cursive'],
            },
            colors: {
                brand: {
                    DEFAULT: '#b026ff', // neon-purple
                    dark: '#7e22ce',
                    light: '#d8b4fe',
                    glow: '#d8b4fe',
                },
                neon: {
                    purple: '#b026ff',
                    blue: '#00f3ff',
                    green: '#00ff9d',
                },
                surface: {
                    DEFAULT: '#0a0a0a', // Obsidian
                    panel: '#1a1a1a', // Sidebar/Navbar
                    card: '#1a1a1a', // Card bg
                    border: '#27272a', // gray-800
                }
            }
        },
    },
    plugins: [],
}
