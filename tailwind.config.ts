import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        birdseye: {
          50: "#f0f9f4",
          100: "#dcf2e3",
          200: "#bce4cb",
          300: "#8fcea6",
          400: "#5ab078",
          500: "#36945c",
          600: "#28774a",
          700: "#225f3d",
          800: "#1e4c34",
          900: "#1a3f2c",
          950: "#14453d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
