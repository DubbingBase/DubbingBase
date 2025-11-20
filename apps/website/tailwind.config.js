/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'sm': '640px',
      // No desktop breakpoints: md, lg, xl, 2xl
    },
    extend: {},
  },
  plugins: [],
  corePlugins: {
    hover: false, // No hover states
  },
}