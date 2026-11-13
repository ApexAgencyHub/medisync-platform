import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/.expo/**",
      "apps/web/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "!@/features/*/index"],
              message:
                "Cross-slice deep imports are forbidden. Import from '@/features/<slice>' public index.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/**"],
              message: "src/shared must never import from src/features.",
            },
            {
              group: ["@/app/*", "@/app/**"],
              message: "src/shared must never import from src/app.",
            },
          ],
        },
      ],
    },
  },
);
