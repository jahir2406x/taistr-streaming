/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ground: {
          DEFAULT: '#09090B',
          elevated: '#121216',
          card: '#16161C',
          border: '#262630',
        },
        ink: {
          DEFAULT: '#F4F4F5',
          muted: '#A1A1AA',
          subtle: '#71717A',
        },
        brand: {
          DEFAULT: '#F59E0B',
          hover: '#D97706',
          whatsapp: '#16A34A',
          whatsappHover: '#15803D',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        display: [
          '"Trebuchet MS"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

