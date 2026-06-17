/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      colors: {
        engineRed: "#e63946",
        engineDark: "#1a1a1a",
      },
    },
  },

  plugins: [],
};
