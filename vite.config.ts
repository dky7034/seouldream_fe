import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  // 👇 아래 build 설정 전체를 추가하세요
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // node_modules(라이브러리)를 'vendor'라는 별도 파일로 분리
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
