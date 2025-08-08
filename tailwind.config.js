/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: "#6E56CF" } }
    }
  },
  darkMode: "class",
  plugins: []
};
