/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: [
          'Inter', 
          'system-ui', 
          'sans-serif',
          // Emoji font support for cross-platform compatibility
          'Apple Color Emoji',
          'Segoe UI Emoji', 
          'Segoe UI Symbol',
          'Noto Color Emoji'
        ],
        mono: [
          'JetBrains Mono', 
          'Consolas', 
          'monospace',
          // Emoji support for monospace
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol', 
          'Noto Color Emoji'
        ],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  darkMode: 'class',
}; 