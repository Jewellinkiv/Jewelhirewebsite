import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Next.js 16 ships eslint-config-next as native ESLint flat configs, so we
// spread them directly (no FlatCompat bridge).
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "docs/**", "scratchpad/**"],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // Baseline for adopting ESLint on this existing codebase (it was never
    // linted — Next 16 dropped the `next lint` command that used to run it).
    rules: {
      // Apostrophes in JSX copy are harmless and pervasive; this rule is noise.
      "react/no-unescaped-entities": "off",
      // Real signal worth keeping visible, but not worth blocking on the
      // pre-existing code — surface as warnings to burn down over time.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
