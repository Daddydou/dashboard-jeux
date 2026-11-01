import type { Config } from "tailwindcss";

/**
 * Une salle de sport le soir : fond nuit, surfaces sobres, et les trois jeux
 * « à la une » peints dans la matière de leur terrain (dur bleu, gazon,
 * parquet). Un seul signal vif : le jaune balle de tennis pour « à faire »,
 * le rouge carton quand ça presse.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nuit: "#0F141B",
        tableau: "#18202B",
        releve: "#222C3A",
        craie: "#EEF2F6",
        brume: "#8C98AA",
        balle: "#DCF44A",
        carton: "#FF5A4E",
        dur: { DEFAULT: "#2559A6", fonce: "#1C4888" },
        gazon: { DEFAULT: "#3A7638", clair: "#41823F" },
        parquet: { DEFAULT: "#9C5627", fonce: "#7E4219" },
      },
      fontFamily: {
        sans: ["var(--font-barlow)", "system-ui", "sans-serif"],
        display: ["var(--font-barlow-condensed)", "var(--font-barlow)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
