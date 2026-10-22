/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stitch: {
          canvas: '#0a0d14',
          surface: '#121622',
          surfaceElevated: '#171c2b',
          border: 'rgba(255, 255, 255, 0.08)',
          subtle: '#1b2234',
          violet: '#818cf8',
          cyan: '#38bdf8',
          emerald: '#10b981'
        },
        chatgpt: {
          main: '#212121',
          sidebar: '#171717',
          hover: '#2f2f2f',
          message: '#212121',
          border: '#303030',
          input: '#2f2f2f',
          text: '#ececec',
          subtext: '#b4b4b4',
          accent: '#10a37f',
          accentHover: '#1a7f64'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
