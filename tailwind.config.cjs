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
                    DEFAULT: '#9333ea', // purple-600
                    dark: '#7e22ce', // purple-700
                    light: '#a855f7', // purple-500
                    glow: '#d8b4fe', // purple-300
                },
                surface: {
                    DEFAULT: '#0f0f0f', // Main bg
                    panel: '#1a1a1a', // Sidebar/Navbar
                    card: '#222222',
                    border: '#27272a', // gray-800
                }
            }
        },
    },
    plugins: [],
}
