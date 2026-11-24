/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1263F5',
          navy: '#101B46',
          purple: '#7048F5',
          'purple-light': '#F1ECFF',
          green: '#12A86B',
          'green-light': '#EAF8F0',
          bg: '#F7F9FF',
          border: '#DCE4F5'
        },
      },
      fontFamily: {
        sans: [
          'Lato',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          '"SFMono-Regular"',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'Courier',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
};

