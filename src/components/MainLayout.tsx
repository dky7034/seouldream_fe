import React from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom"; // Add useLocation
import { useAuth } from "../hooks/useAuth";

const roleMap: Record<string, string> = {
  EXECUTIVE: "임원단",
  CELL_LEADER: "셀장",
  MEMBER: "셀원",
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation(); // Get location object
  const currentPath = location.pathname; // Extract pathname

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          {/* 좌측: 로고 + 네비게이션 */}
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">
              <Link to="/dashboard">넥스트드림</Link>
            </h1>

            <nav className="hidden md:flex space-x-6 text-sm">
              {user && (
                <>
                  {/* 임원 전용 메뉴 */}
                  {isExecutive && (
                    <>
                      <Link
                        to="/admin/users"
                        className={`${
                          currentPath.startsWith("/admin/users")
                            ? "text-indigo-600 font-bold"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        사용자
                      </Link>
                      <Link
                        to="/admin/teams"
                        className={`${
                          currentPath.startsWith("/admin/teams")
                            ? "text-indigo-600 font-bold"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        팀
                      </Link>
                      <Link
                        to="/admin/cells"
                        className={`${
                          currentPath.startsWith("/admin/cells")
                            ? "text-indigo-600 font-bold"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        셀
                      </Link>
                      <Link
                        to="/admin/semesters"
                        className={`${
                          currentPath.startsWith("/admin/semesters")
                            ? "text-indigo-600 font-bold"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        학기
                      </Link>
                    </>
                  )}

                  {/* 셀장 전용 메뉴 */}
                  {isCellLeader && (
                    <Link
                      to="/my-cell"
                      className={`${
                        currentPath === "/my-cell"
                          ? "text-indigo-600 font-bold"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      내 셀
                    </Link>
                  )}

                  {/* 임원 + 셀장 공통 관리 메뉴 */}
                  {(isExecutive || isCellLeader) && (
                    <>
                      {isExecutive && (
                                              <Link
                                                to="/admin/attendances"
                                                className={`${
                                                  currentPath.startsWith("/admin/attendances") &&
                                                  !currentPath.startsWith("/admin/incomplete-checks-report")
                                                    ? "text-indigo-600 font-bold"
                                                    : "text-gray-500 hover:text-gray-900"
                                                }`}
                                              >
                                                출석
                                              </Link>
                                              )}
                                              {isExecutive && (
                                                <Link
                                                  to="/admin/incomplete-checks-report"
                                                  className={`${
                                                    currentPath === "/admin/incomplete-checks-report"
                                                      ? "text-indigo-600 font-bold"
                                                      : "text-gray-500 hover:text-gray-900"
                                                }`}
                                              >
                                                출석 누락 현황
                                              </Link>
                                              )}
                        
                                              <Link
                                                to="/admin/attendance-alerts"
                                                className={`${
                                                  currentPath === "/admin/attendance-alerts"
                                                    ? "text-indigo-600 font-bold"
                                                    : "text-gray-500 hover:text-gray-900"
                                                }`}
                                              >
                                                결석 관리
                                              </Link>
                                              
                                              {isExecutive && ( // Added isExecutive condition
                                                <Link
                                                  to="/admin/prayers"
                                                  className={`${
                                                    currentPath.startsWith("/admin/prayers")
                                                      ? "text-indigo-600 font-bold"
                                                      : "text-gray-500 hover:text-gray-900"
                                                  }`}
                                                >
                                                  기도제목
                                                </Link>
                                              )}
                      <Link
                        to="/admin/notices"
                        className={`${
                          currentPath.startsWith("/admin/notices")
                            ? "text-indigo-600 font-bold"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        공지사항
                      </Link>
                    </>
                  )}

                  <Link
                    to="/my-profile"
                    className={`${
                      currentPath === "/my-profile"
                        ? "text-indigo-600 font-bold"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    내 프로필
                  </Link>
                  <Link
                    to="/birthdays"
                    className={`${
                      currentPath === "/birthdays"
                        ? "text-indigo-600 font-bold"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    생일자
                  </Link>
                  <Link
                    to="/dashboard"
                    className={`${
                      currentPath === "/dashboard" || currentPath === "/"
                        ? "text-indigo-600 font-bold"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    대시보드
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* 우측: 사용자 인사 + 로그아웃 */}
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">
                안녕하세요, {user.name}님! ({roleMap[user.role] || user.role})
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
