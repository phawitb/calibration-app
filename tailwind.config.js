/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        military: {
          50:  '#f0f4f0',
          100: '#d9e5d9',
          200: '#b3cbb3',
          300: '#7da87d',
          400: '#4d8050',
          500: '#2d5f30',
          600: '#1e4521',
          700: '#163318',
          800: '#0f2410',
          900: '#081508',
        },
        gold: {
          400: '#d4a843',
          500: '#b8861e',
          600: '#9a6e10',
        }
      },
      fontFamily: {
        sans: ['var(--font-sarabun)', 'Sarabun', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
