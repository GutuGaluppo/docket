import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "node_modules/**",
      "drizzle/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "controle-de-vagas.jsx",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Architecture rule 1: components and actions never touch a table directly.
    // Everything goes through src/server/db/queries/*, which pins rows to a Scope.
    files: ["src/app/**", "src/components/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/db",
              message: "Import a query from @/server/db/queries/* instead of the raw client.",
            },
            {
              name: "@/server/db/schema",
              message: "Components must not read tables directly. Use @/server/db/queries/*.",
            },
          ],
          patterns: [
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message: "Query building belongs in src/server/db/queries/*.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
