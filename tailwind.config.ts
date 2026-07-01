import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // JewelLink brand tokens (matched to jewellink.com — see docs/brand.md)
        primary: "#123FB9",
        "primary-bright": "#2F7DFF",
        "primary-dark": "#0E2E8A",
        accent: "#2F7DFF",
        page: "#f4f7fb",
        panel: "#ffffff",
        line: "#c2cfe0",
        head: "#08122B",
        body: "#2b3650",
        muted: "#64748b",
        rowhover: "#edf5ff",
        // GemMatch profile colors
        prof: {
          v: "#4681F4", // Visionary
          c: "#7C6CF0", // Connector
          f: "#1f9e75", // Foundation
          d: "#e2683c", // Determined
        },
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "6px",
      },
      backgroundImage: {
        "brand-grad": "linear-gradient(135deg, #123FB9, #2F7DFF)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
