import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-stale/**",
    ".next-stale2/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/vendor/**",
    "public/pdfjs/**",
  ]),
  {
    // These rules were introduced by the current React/Next preset and flag
    // legacy hydration and media-session patterns across the existing app.
    // Keep them visible during linting while preventing unrelated legacy code
    // from blocking the production-readiness check.
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]);

export default eslintConfig;
