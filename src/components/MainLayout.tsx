// src/layouts/MainLayout.tsx
import React, { useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const roleMap: Record<string, string> = {
  EXECUTIVE: "관리자",
  CELL_LEADER: "셀장",
  MEMBER: "셀원",
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    navigate("/");
  };

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  const getNavLinkClass = (
    targetPath: string,
    options?: { exact?: boolean; variant?: "desktop" | "mobile" },
  ) => {
    const exact = options?.exact ?? false;
    const variant = options?.variant ?? "desktop";

    const isActive = exact
      ? currentPath === targetPath
      : currentPath.startsWith(targetPath);

    const base =
      variant === "desktop"
        ? // ✅ 수정됨: px-1 -> px-2 (글자 좌우 여백을 늘려 클릭하기 편하게 만듦)
          "text-sm px-2 pb-1 border-b-2 border-transparent whitespace-nowrap transition-colors"
        : "block w-full text-left px-4 py-2 text-sm";

    const active =
      variant === "desktop"
        ? "text-indigo-600 font-semibold border-indigo-500"
        : "text-indigo-600 font-semibold bg-indigo-50";
    const inactive = "text-gray-500 hover:text-gray-900 hover:border-gray-300";

    return `${base} ${isActive ? active : inactive}`;
  };

  const renderNavLinks = (
    variant: "desktop" | "mobile",
    onLinkClick?: () => void,
  ) => {
    if (!user) return null;

    if (isExecutive) {
      return (
        <>
          <Link
            to="/dashboard"
            className={getNavLinkClass("/dashboard", { exact: true, variant })}
            onClick={onLinkClick}
          >
            대시보드
          </Link>
          <Link
            to="/admin/cells"
            className={getNavLinkClass("/admin/cells", { variant })}
            onClick={onLinkClick}
          >
            셀
          </Link>
          <Link
            to="/admin/prayers/summary/members"
            className={getNavLinkClass("/admin/prayers/summary", { variant })}
            onClick={onLinkClick}
          >
            기도제목
          </Link>
          <Link
            to="/admin/attendances"
            className={getNavLinkClass("/admin/attendances", { variant })}
            onClick={onLinkClick}
          >
            출석
          </Link>
          <Link
            to="/admin/incomplete-checks-report"
            className={getNavLinkClass("/admin/incomplete-checks-report", {
              exact: true,
              variant,
            })}
            onClick={onLinkClick}
          >
            출석 누락
          </Link>
          <Link
            to="/admin/attendance-alerts"
            className={getNavLinkClass("/admin/attendance-alerts", { variant })}
            onClick={onLinkClick}
          >
            결석 관리
          </Link>
          <Link
            to="/admin/users"
            className={getNavLinkClass("/admin/users", { variant })}
            onClick={onLinkClick}
          >
            멤버
          </Link>
          <Link
            to="/admin/teams"
            className={getNavLinkClass("/admin/teams", { variant })}
            onClick={onLinkClick}
          >
            팀
          </Link>
          <Link
            to="/admin/statistics"
            className={getNavLinkClass("/admin/statistics", { variant })}
            onClick={onLinkClick}
          >
            통계
          </Link>
          <Link
            to="/admin/semesters"
            className={getNavLinkClass("/admin/semesters", { variant })}
            onClick={onLinkClick}
          >
            학기
          </Link>
          <Link
            to="/admin/notices"
            className={getNavLinkClass("/admin/notices", { variant })}
            onClick={onLinkClick}
          >
            공지사항
          </Link>
        </>
      );
    }

    if (isCellLeader) {
      return (
        <>
          <Link
            to="/dashboard"
            className={getNavLinkClass("/dashboard", { exact: true, variant })}
            onClick={onLinkClick}
          >
            대시보드
          </Link>
          <Link
            to="/my-cell"
            className={getNavLinkClass("/my-cell", { exact: true, variant })}
            onClick={onLinkClick}
          >
            내 셀
          </Link>
          <Link
            to="/admin/notices"
            className={getNavLinkClass("/admin/notices", { variant })}
            onClick={onLinkClick}
          >
            공지사항
          </Link>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 gap-4">
            {/* 좌측: 로고 + 네비게이션 */}
            <div className="flex items-center space-x-4 shrink-0">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-1 py-1 rounded-md hover:bg-gray-50 shrink-0"
              >
                <img
                  src="/seouldream_logo_upscaled_1280_cut.png"
                  alt="서울드림교회 로고"
                  className="h-10 w-auto object-contain"
                />
                <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">
                  NEXTDREAM
                </h1>
              </Link>

              {/* ✅ 수정됨: space-x-2 -> space-x-4 (메뉴 사이 간격을 넓혀서 시원하게 보이게 함) 
                이미 인사말이 숨겨져 있어서 공간은 충분합니다.
              */}
              <nav className="hidden xl:flex space-x-4 text-sm">
                {renderNavLinks("desktop")}
              </nav>
            </div>

            {/* 우측: 사용자 정보 + 로그아웃 */}
            {user && (
              <div className="hidden xl:flex items-center space-x-3 lg:space-x-4 shrink-0">
                {/* 2xl(아주 넓은 화면)에서만 인사말 표시, xl에서는 숨김 */}
                <span className="hidden 2xl:inline text-gray-700 font-medium text-sm text-right whitespace-nowrap">
                  안녕하세요, {user.name}님! ({roleMap[user.role] || user.role})
                </span>

                <button
                  onClick={handleLogout}
                  className="px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 whitespace-nowrap"
                >
                  로그아웃
                </button>
              </div>
            )}

            {/* 모바일 햄버거 메뉴 버튼 */}
            {user && (
              <div className="xl:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                >
                  <span className="sr-only">메인 메뉴 열기</span>
                  {isMobileMenuOpen ? (
                    <svg
                      className="h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 모바일 드롭다운 메뉴 */}
          {user && (
            <div
              className={`xl:hidden border-t border-gray-200 bg-white transition-all duration-200 ${
                isMobileMenuOpen ? "max-h-screen" : "max-h-0 overflow-hidden"
              }`}
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  안녕하세요, {user.name}님!
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {roleMap[user.role] || user.role}
                </p>
              </div>

              <div className="pb-3 space-y-1 max-h-[60vh] overflow-y-auto">
                {renderNavLinks("mobile", () => setIsMobileMenuOpen(false))}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
