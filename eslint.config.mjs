import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Preserve the upstream Lucide renderer, verified against the original package.
    files: ["src/components/icons/lucide/Icon.js"],
    rules: { "react/display-name": "off" },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-page-custom-font": "off",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scratch/**",
    ".worktrees/**",
    ".codex-tmp/**",
    "output/**",
    ".playwright-cli/**",
    "artifacts/**",
    ".superpowers/**",
  ]),
]);

export default eslintConfig;
