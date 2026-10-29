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
        // Macha Brown Palette (#6F4E37)
        macha: {
          50: '#FAF6F2',
          100: '#F2EAE2',
          200: '#E2D2C3',
          300: '#CBB39E',
          400: '#AF8E73',
          500: '#8C6549',
          600: '#6F4E37', // Base Macha Brown
          700: '#583E2C',
          800: '#422F22',
          900: '#2D1F17',
          950: '#1D140F'
        },
        // Platinum Silver Palette (#E5E4E2)
        platinum: {
          50: '#FAF9F8',
          100: '#F1F0EE',
          200: '#E5E4E2', // Base Platinum Silver
          300: '#D6D4D1',
          400: '#B8B5B1',
          500: '#999590',
          600: '#7A7570',
          700: '#5C5753',
          800: '#3D3A37',
          900: '#242220',
          950: '#171615'
        },
        // Pale Lavender Palette (#E6E0F0)
        lavender: {
          50: '#FAF9FD',
          100: '#F4F1FA',
          200: '#E6E0F0', // Base Pale Lavender
          300: '#D5CBE5',
          400: '#BEADD7',
          500: '#A28BC6',
          600: '#8569B1',
          700: '#674E91',
          800: '#4D3A6F',
          900: '#35284D',
          950: '#201830'
        },
        // Bespoke Luxury Engineering Surfaces
        luxury: {
          canvas: '#0D0B0A',
          sidebar: '#13100E',
          surface: '#1A1613',
          surfaceElevated: '#241E1A',
          border: 'rgba(229, 228, 226, 0.12)',
          borderSubtle: 'rgba(229, 228, 226, 0.06)',
          borderHover: 'rgba(230, 224, 240, 0.28)',
          subtle: '#2D2621',
          macha: '#6F4E37',
          platinum: '#E5E4E2',
          lavender: '#E6E0F0'
        },
        chatgpt: {
          main: '#1A1613',
          sidebar: '#13100E',
          hover: '#241E1A',
          message: '#1A1613',
          border: 'rgba(229, 228, 226, 0.12)',
          input: '#241E1A',
          text: '#F5F4F2',
          subtext: '#BDB8B3',
          accent: '#6F4E37',
          accentHover: '#8C6549'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
