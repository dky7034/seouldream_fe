import React, { useState, useRef, useEffect } from "react";
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
  const [isProfileOpen, setIsProfileOpen] = useState(false); // 프로필 드롭다운 상태
  const profileRef = useRef<HTMLDivElement>(null); // 드롭다운 외부 클릭 감지용

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
    navigate("/");
  };

  // 외부 클릭 시 프로필 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

    if (variant === "desktop") {
      // 데스크탑: 텍스트만 깔끔하게, 활성화시 굵게+색상변경
      const base =
        "text-sm px-2 py-1 transition-colors duration-200 whitespace-nowrap";
      const active = "text-indigo-600 font-bold";
      const inactive = "text-gray-500 hover:text-gray-900";
      return `${base} ${isActive ? active : inactive}`;
    } else {
      // 모바일
      const base = "block w-full text-left px-4 py-2 text-sm";
      const active = "text-indigo-600 font-semibold bg-indigo-50";
      const inactive =
        "text-gray-500 hover:text-gray-900 hover:border-gray-300";
      return `${base} ${isActive ? active : inactive}`;
    }
  };

  const renderNavLinks = (
    variant: "desktop" | "mobile",
    onLinkClick?: () => void,
  ) => {
    if (!user) return null;

    const menuItems = [];
    if (isExecutive) {
      menuItems.push(
        { to: "/dashboard", label: "대시보드", exact: true },
        { to: "/admin/cells", label: "셀", exact: false },
        {
          to: "/admin/prayers/summary/members",
          label: "기도제목",
          exact: false,
        },
        { to: "/admin/attendances", label: "출석", exact: false },
        {
          to: "/admin/incomplete-checks-report",
          label: "출석 누락",
          exact: true,
        },
        { to: "/admin/attendance-alerts", label: "결석 관리", exact: false },
        { to: "/admin/users", label: "멤버", exact: false },
        { to: "/admin/teams", label: "팀", exact: false },
        { to: "/admin/statistics", label: "통계", exact: false },
        { to: "/admin/semesters", label: "학기", exact: false },
        { to: "/admin/notices", label: "공지사항", exact: false },
      );
    } else if (isCellLeader) {
      menuItems.push(
        { to: "/dashboard", label: "대시보드", exact: true },
        { to: "/my-cell", label: "내 셀", exact: true },
        { to: "/admin/notices", label: "공지사항", exact: false },
      );
    }

    return (
      <>
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={getNavLinkClass(item.to, { exact: item.exact, variant })}
            onClick={onLinkClick}
          >
            {item.label}
          </Link>
        ))}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-pretendard">
      {/* 상단 헤더 (Single Row 복귀) */}
      <header className="bg-white shadow-sm sticky top-0 z-40 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            {/* 1. 좌측: 로고 + 메뉴 (간격 조절) */}
            <div className="flex items-center gap-6 overflow-hidden">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 shrink-0"
              >
                <img
                  src="/seouldream_logo_upscaled_1280_cut.png"
                  alt="서울드림교회 로고"
                  className="h-9 w-auto object-contain"
                />
                <span className="text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap hidden sm:block">
                  NEXTDREAM
                </span>
              </Link>

              {/* 데스크탑 메뉴 (xl 이상에서 보임) */}
              {/* gap-1로 좁혀서 최대한 공간 확보 */}
              <nav className="hidden xl:flex items-center space-x-1">
                {renderNavLinks("desktop")}
              </nav>
            </div>

            {/* 2. 우측: 프로필 드롭다운 (핵심 변경!) */}
            {user && (
              <div
                className="hidden xl:flex items-center ml-4 shrink-0 relative"
                ref={profileRef}
              >
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 focus:outline-none group"
                >
                  <div className="text-right hidden 2xl:block">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">
                      {user.name}
                    </p>
                  </div>
                  {/* 프로필 아바타 (아이콘) */}
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200 group-hover:border-indigo-400 transition">
                    <span className="font-bold text-sm">
                      {user.name.slice(0, 1)}
                    </span>
                  </div>
                </button>

                {/* 프로필 클릭시 나오는 드롭다운 메뉴 */}
                {isProfileOpen && (
                  <div className="absolute right-0 top-12 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-100 z-50 ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">
                        {user.name}님
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {roleMap[user.role] || user.role}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. 모바일: 햄버거 버튼 (xl 미만) */}
            {user && (
              <div className="xl:hidden flex items-center">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
                >
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

          {/* 모바일 메뉴 드롭다운 */}
          {user && (
            <div
              className={`xl:hidden border-t border-gray-200 bg-white transition-all duration-200 ${
                isMobileMenuOpen ? "max-h-screen" : "max-h-0 overflow-hidden"
              }`}
            >
              <div className="px-4 py-4 bg-gray-50 mb-2">
                <p className="text-sm font-bold text-gray-900">
                  {user.name}님 반가워요!
                </p>
                <p className="text-xs text-gray-500">
                  {roleMap[user.role] || user.role}
                </p>
              </div>
              <div className="space-y-1 pb-4">
                {renderNavLinks("mobile", () => setIsMobileMenuOpen(false))}
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 font-medium hover:bg-red-50"
                  >
                    로그아웃
                  </button>
                </div>
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
