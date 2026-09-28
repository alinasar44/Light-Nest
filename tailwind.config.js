/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      opacity: {
        8: '0.08',
        15: '0.15',
      },
    },
  },
  plugins: [],
}
