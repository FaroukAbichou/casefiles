/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f0f10",
          raised: "#18181b",
          overlay: "#1f1f23",
        },
        border: { subtle: "#2a2a2f", DEFAULT: "#3f3f46" },
        accent: { DEFAULT: "#e4e4e7", muted: "#a1a1aa" },
        brand: { DEFAULT: "#fafafa", dim: "#71717a" },
      },
    },
  },
  plugins: [],
};
