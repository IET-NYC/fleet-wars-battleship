import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#05070a",
        hull: "#0b1016",
        plating: "#141c25",
        cognition: {
          DEFAULT: "#0d9488",
          bright: "#2dd4bf",
          deep: "#062a28",
        },
        cursor: {
          DEFAULT: "#8b7fa8",
          bright: "#c4b5fd",
          deep: "#241f2e",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "hit-pulse": {
          "0%": { transform: "scale(0.7)", filter: "brightness(2.4)" },
          "60%": { transform: "scale(1.12)" },
          "100%": { transform: "scale(1)", filter: "brightness(1)" },
        },
        "miss-fade": {
          "0%": { opacity: "0", transform: "scale(0.4)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "sunk-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-2px)" },
          "40%": { transform: "translateX(2px)" },
          "60%": { transform: "translateX(-1px)" },
          "80%": { transform: "translateX(1px)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "radar-sweep": {
          "0%": { opacity: "0.15" },
          "50%": { opacity: "0.4" },
          "100%": { opacity: "0.15" },
        },
      },
      animation: {
        "hit-pulse": "hit-pulse 320ms ease-out",
        "miss-fade": "miss-fade 220ms ease-out",
        "sunk-shake": "sunk-shake 380ms ease-in-out",
        "toast-in": "toast-in 180ms ease-out",
        "radar-sweep": "radar-sweep 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
