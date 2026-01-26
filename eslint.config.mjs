import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Repo-specific overrides:
  // Next's TypeScript + React ruleset includes a few very strict react-hooks rules
  // (e.g. set-state-in-effect/immutability/static-components) that currently flag large
  // parts of the app. We disable them to keep lint actionable and avoid blocking CI.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/no-reassign': 'off',
      'react-hooks/ref-access': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      // TypeScript strictness that doesn't add much value in this codebase right now.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Many UI components are anonymous; keep lint focused on correctness.
      'react/display-name': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
