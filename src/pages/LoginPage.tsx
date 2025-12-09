import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  // 페이지 진입 시: 저장된 아이디 불러오고, 포커스 설정
  useEffect(() => {
    const savedRememberMe = localStorage.getItem("rememberMe") === "true";
    const savedUsername = localStorage.getItem("rememberedUsername");

    if (savedRememberMe && savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }

    // 마지막에 포커스
    usernameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ✅ login 함수에 rememberMe 값을 전달
      await login(username, password, rememberMe);

      // ✅ 로그인 성공 후 rememberMe 처리
      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberedUsername");
        localStorage.setItem("rememberMe", "false");
      }

      navigate("/dashboard");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message;
      if (errorMessage === "자격 증명에 실패했습니다.") {
        setError(
          "로그인에 실패했습니다. 아이디와 비밀번호를 다시 확인해주세요."
        );
      } else {
        setError(
          errorMessage ||
            "로그인에 실패했습니다. 잠시 후 다시 시도하시거나, 관리자에게 문의해주세요."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || !username || !password;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <div className="w-full max-w-md px-8 py-10 space-y-6 bg-white rounded-2xl shadow-lg">
        {/* 상단 로고/타이틀 영역 */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-indigo-600 text-white font-bold text-lg">
            D
          </div>
          <h1 className="text-2xl font-bold text-gray-900">출석 관리 시스템</h1>
          <p className="mt-2 text-sm text-gray-600">
            계정으로 로그인하여 출석, 셀원, 기도제목을 한 곳에서 관리하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* 아이디 */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700"
            >
              아이디
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              ref={usernameInputRef}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={loading}
            />
          </div>

          {/* 비밀번호 + 보기 토글 */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              비밀번호
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 pr-10 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* 옵션 영역: 로그인 유지 */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span className="text-xs text-gray-600">로그인 상태 유지</span>
            </label>

            <button
              type="button"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              disabled
            >
              {/* 비밀번호 찾기 준비 중 */}
            </button>
          </div>

          {/* 로그인 버튼 */}
          <div>
            <button
              type="submit"
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-semibold text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitDisabled}
            >
              {loading && (
                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
              )}
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </form>

        {/* 하단 회원가입/안내 영역 */}
        <div className="pt-4 mt-2 border-t border-gray-100">
          <p className="text-sm text-center text-gray-600">
            계정이 없으신가요?{" "}
            <Link
              to="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
