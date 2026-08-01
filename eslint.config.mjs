// eslint-config-next 16 ships native flat configs, so the previous FlatCompat
// wrapper (from @eslint/eslintrc) is gone. Feeding a flat config through the
// legacy shim made the eslintrc validator walk the plugin object graph and throw
// "Converting circular structure to JSON".
//
// `next lint` was also removed in Next 16: this config is consumed by the ESLint
// CLI directly (`npm run lint`), and `next build` no longer lints at all, so CI
// runs it as its own step.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    // Build output and generated code. The Prisma client alone is tens of
    // thousands of generated lines and is not ours to lint.
    ignores: [".next/**", "node_modules/**", "src/generated/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // eslint-config-next 16 turns on React's Compiler-era hooks rules as
      // ERRORS. They flag 106 pre-existing spots in this codebase (73 of them
      // set-state-in-effect), none of them regressions from the upgrade.
      // Demoted to warnings so lint still gates on real errors; fixing them is
      // its own piece of work, since rewriting a setState-in-effect changes
      // render behaviour and needs per-case testing.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",

      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
];

export default eslintConfig;
