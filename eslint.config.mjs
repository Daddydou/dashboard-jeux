import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  { ignores: [".next/**", "next-env.d.ts"] },
  { extends: [...nextCoreWebVitals, ...nextTypescript] },
  // Version explicite : la détection automatique d'eslint-plugin-react
  // appelle context.getFilename(), supprimé dans ESLint 10.
  { settings: { react: { version: "19.3" } } },
]);
