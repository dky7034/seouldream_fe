// src/layouts/MainLayout.tsx
import React, { useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const roleMap: Record<string, string> = {
  EXECUTIVE: "임원단",
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
        ? "text-sm px-1 pb-1 border-b-2 border-transparent whitespace-nowrap"
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
          {/* ✅ gap-4 추가: 좌측 메뉴와 우측 유저 정보가 절대 붙지 않도록 안전거리 확보 */}
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

              {/* ✅ 수정됨: space-x-4 -> space-x-2 (메뉴 간격 좁힘) */}
              <nav className="hidden xl:flex space-x-2 lg:space-x-3 text-xs lg:text-sm">
                {renderNavLinks("desktop")}
              </nav>
            </div>

            {/* 우측: 사용자 정보 + 로그아웃 */}
            {user && (
              <div className="hidden xl:flex items-center space-x-3 lg:space-x-4 shrink-0">
                {/* ✅ 수정됨: 2xl(아주 넓은 화면)에서만 인사말 표시, xl(일반 노트북)에서는 숨김 */}
                <span className="hidden 2xl:inline text-gray-700 font-medium text-sm text-right whitespace-nowrap">
                  안녕하세요, {user.name}님! ({roleMap[user.role] || user.role})
                </span>

                {/* (선택사항) xl에서는 이름만 짧게 보여주고 싶다면 아래 주석 해제 */}
                {/* <span className="hidden xl:inline 2xl:hidden text-gray-700 font-medium text-sm">
                   {user.name}님
                </span> */}

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
