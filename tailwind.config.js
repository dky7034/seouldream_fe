// Tailwind의 기본 폰트 목록을 가져오기 위해 import 합니다.
// (만약 에러가 나면 import 대신 const defaultTheme = require('tailwindcss/defaultTheme') 로 바꿔보세요)
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // 여기에 폰트 설정을 추가합니다
      fontFamily: {
        // 'sans'는 Tailwind의 기본 폰트(font-sans)를 의미합니다.
        // Pretendard를 제일 앞에 두고, 나머지는 기본 폰트 순서를 따르게 합니다.
        sans: ['"Pretendard"', ...defaultTheme.fontFamily.sans],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
