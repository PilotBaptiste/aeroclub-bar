/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        aero: {
          dark: "#0a0f1c",
          card: "#131b2e",
          border: "#1e2d4a",
          amber: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
