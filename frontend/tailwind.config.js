/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#070D1B",
          card: "#0C1628",
          hover: "#112040",
          border: "#1A2C4A",
        },
        brand: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
          light: "#818CF8",
          dim: "#6366F122",
        },
      },
      animation: {
        pulse_slow: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 4s linear infinite",
        "fade-up": "fadeUp 0.25s ease-out both",
        "ring-1": "ring 3s ease-out infinite",
        "ring-2": "ring 3s ease-out 1s infinite",
        "ring-3": "ring 3s ease-out 2s infinite",
        "orb-breathe": "orbBreathe 3s ease-in-out infinite",
        "orb-think": "orbThink 1.2s ease-in-out infinite",
        "orb-speak": "orbSpeak 0.6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ring: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        orbBreathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        orbThink: {
          "0%, 100%": { transform: "scale(0.96)", opacity: "0.7" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        orbSpeak: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.08)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
