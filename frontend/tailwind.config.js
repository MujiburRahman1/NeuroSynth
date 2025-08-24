/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'hsl(208 100% 97%)',     // background
          100: 'hsl(207 50% 95%)',     // secondary (very light)
          200: 'hsl(207 40% 90%)',     // borders
          300: 'hsl(195 53% 79%)',     // accent light
          400: 'hsl(195 53% 60%)',     // accent
          500: 'hsl(207 44% 49%)',     // primary
          600: 'hsl(207 44% 40%)',     // primary hover / darker
          700: 'hsl(207 30% 35%)',
          800: 'hsl(207 30% 25%)',
          900: 'hsl(207 30% 18%)',
        }
      }
    },
  },
  plugins: [],
}
