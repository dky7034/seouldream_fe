// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config"; // globalIgnores는 보통 defineConfig 안에서 처리되거나 별도로 씁니다.

export default defineConfig([
  { ignores: ["dist"] }, // globalIgnores(['dist']) 대신 이렇게 쓰는 것이 Flat Config 표준입니다.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended, // tseslint 설정은 보통 배열이라 ...으로 펼쳐주는 게 좋습니다.
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    // 👇👇👇 여기 rules를 추가하세요 👇👇👇
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // ✅ _로 시작하는 변수나 인자는 사용하지 않아도 경고하지 않음 설정
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
