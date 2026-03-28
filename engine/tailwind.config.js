/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        engineRed: "#e63946", // Um vermelho esportivo
        engineDark: "#1a1a1a", // Um cinza quase preto automotivo
      },
    },
  },
  plugins: [],
};
